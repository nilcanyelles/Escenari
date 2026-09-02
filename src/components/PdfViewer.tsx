"use client";

// Visor de PDF fet a mida (pdf.js), en comptes del visor natiu del
// navegador — així podem controlar el zoom nosaltres (i limitar el màxim
// de zoom-out a l'alçada del PDF, cosa que un <iframe> no permet perquè el
// visor natiu és un component intern del navegador), el canvi de pàgina
// clicant a banda i banda, i el mode "llibre obert" (2 pàgines) automàtic
// quan la partitura és vertical i té més d'una pàgina.

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

const ZOOM_STEP = 1.15;
// Ritmes d'autoscroll, en píxels per segon.
const SCROLL_SPEEDS = [1.5, 3, 5, 8, 12, 17, 23, 30, 38, 48, 58, 70];

function PdfPage({ page, scale }: { page: PDFPageProxy; scale: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const viewport = page.getViewport({ scale });
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
    const task = page.render({ canvas, canvasContext: ctx, viewport, transform });
    task.promise.catch(() => { /* cancel·lat en desmuntar/canviar de pàgina o escala, esperat */ });
    return () => { task.cancel(); };
  }, [page, scale]);

  return <canvas ref={canvasRef} className="pdfv-canvas" />;
}

// Control vertical d'arrossegar per fer zoom, a la dreta de la pantalla:
// amunt amplia, avall redueix.
function ZoomSlider({ scale, minScale, maxScale, onChange }: {
  scale: number; minScale: number; maxScale: number; onChange: (s: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  function setFromClientY(clientY: number) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const p = 1 - (clientY - rect.top) / rect.height; // amunt = 1, avall = 0
    const clamped = Math.max(0, Math.min(1, p));
    onChange(minScale + clamped * (maxScale - minScale));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromClientY(e.clientY);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    setFromClientY(e.clientY);
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  const percent = maxScale > minScale ? Math.max(0, Math.min(1, (scale - minScale) / (maxScale - minScale))) : 0;

  return (
    <div className="pdfv-zoom-slider" title="Arrossega per fer zoom">
      <div className="pdfv-zoom-slider-track" ref={trackRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <div className="pdfv-zoom-slider-fill" style={{ height: `${percent * 100}%` }} />
        <div className="pdfv-zoom-slider-thumb" style={{ bottom: `${percent * 100}%` }} />
      </div>
    </div>
  );
}

export default function PdfViewer({ url, dark, onEdge }: {
  url: string;
  dark?: boolean;
  onEdge?: (dir: -1 | 1) => void;
}) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [twoPage, setTwoPage] = useState(false);
  const [pageIdx, setPageIdx] = useState(0);
  const [pageA, setPageA] = useState<PDFPageProxy | null>(null);
  const [pageB, setPageB] = useState<PDFPageProxy | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [minScale, setMinScale] = useState(0.1);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ side: "left" | "right"; key: number } | null>(null);
  const flashTimer = useRef<number | null>(null);
  const [extraPages, setExtraPages] = useState<PDFPageProxy[]>([]);
  const [autoScroll, setAutoScroll] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const scrollRafRef = useRef<number>(0);
  // Posició (dins la pila) de cada pàgina renderitzada, per poder saltar
  // exactament al límit d'una pàgina en comptes d'una distància fixa.
  const stackPageRefs = useRef<Array<HTMLDivElement | null>>([]);
  // En vertical amb més d'una pàgina s'obre en mode "llibre obert", però si
  // amplies més enllà del 100% ja no hi caben les dues còmodament: es
  // mostra només la pàgina actual fins que tornes a reduir.
  const showTwoPage = twoPage && scale !== null && scale <= 1.001;

  // Carrega el document i decideix si cal mode "llibre obert" (2 pàgines):
  // només si és vertical i té més d'una pàgina.
  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setPageA(null);
    setPageB(null);
    setScale(null);
    setPageIdx(0);
    setTwoPage(false);
    setError(null);
    const taskRef: { current: { destroy: () => Promise<void> } | null } = { current: null };
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        // Fitxer estàtic servit tal qual des de /public — més fiable que fer
        // que el bundler resolgui l'URL del worker (amb next/webpack de
        // vegades no l'acaba servint bé i el PDF no arriba a carregar mai).
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjsLib.getDocument({ url });
        taskRef.current = task;
        const d = await task.promise;
        if (cancelled) { d.cleanup(); task.destroy(); return; }
        setDoc(d);
        const p1 = await d.getPage(1);
        if (cancelled) return;
        const vp1 = p1.getViewport({ scale: 1 });
        setTwoPage(d.numPages > 1 && vp1.width < vp1.height);
      } catch (err) {
        console.error("PdfViewer: no s'ha pogut carregar el PDF", err);
        if (!cancelled) setError("No s'ha pogut carregar la partitura");
      }
    })();
    return () => { cancelled = true; taskRef.current?.destroy(); };
  }, [url]);

  // Carrega la pàgina (o les dues) del punt actual.
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    doc.getPage(pageIdx + 1).then((p) => { if (!cancelled) setPageA(p); });
    if (twoPage && pageIdx + 2 <= doc.numPages) {
      doc.getPage(pageIdx + 2).then((p) => { if (!cancelled) setPageB(p); });
    } else {
      setPageB(null);
    }
    return () => { cancelled = true; };
  }, [doc, pageIdx, twoPage]);

  // Fora del mode "llibre obert" (horitzontal sempre, o vertical amplia't
  // més del 100%), les pàgines que queden es carreguen totes de cop i es
  // mostren apilades sota la primera: en baixar amb l'scroll (a mà o amb
  // l'autoscroll) van apareixent seguides, separades per una línia fina.
  useEffect(() => {
    if (!doc || showTwoPage) { setExtraPages([]); return; }
    let cancelled = false;
    const rest: Promise<PDFPageProxy>[] = [];
    for (let n = pageIdx + 2; n <= doc.numPages; n++) rest.push(doc.getPage(n));
    Promise.all(rest).then((list) => { if (!cancelled) setExtraPages(list); });
    return () => { cancelled = true; };
  }, [doc, pageIdx, showTwoPage]);

  // Autoscroll a ritme constant per la pila de pàgines. Llegeix el
  // scrollTop real a cada frame (no un acumulador propi) perquè, si
  // l'usuari puja fent scroll a mà mentre està activat, no es lluiti amb
  // ell tornant-lo avall al frame següent.
  useEffect(() => {
    cancelAnimationFrame(scrollRafRef.current);
    if (!autoScroll) return;
    const el = pagesRef.current;
    if (!el) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const total = el.scrollHeight - el.clientHeight;
      if (total <= 0) return;
      el.scrollTop = el.scrollTop + SCROLL_SPEEDS[speedIdx] * dt;
      if (el.scrollTop >= total - 1) { setAutoScroll(false); return; }
      scrollRafRef.current = requestAnimationFrame(step);
    };
    scrollRafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(scrollRafRef.current);
  }, [autoScroll, speedIdx]);

  // El mínim (màxim zoom-out) és sempre l'ajusta-a-l'alçada, mesurat sobre
  // l'àrea real de la partitura (mai la barra de zoom). Per defecte sempre
  // s'obre exactament en aquest mínim, mai al 100% ni a cap zoom anterior.
  function recalcMinScale() {
    if (!pageA || !pagesRef.current) return;
    const vp1 = pageA.getViewport({ scale: 1 });
    const fitH = pagesRef.current.clientHeight / vp1.height;
    setMinScale(fitH);
    setScale((s) => (s === null ? fitH : Math.max(s, fitH)));
  }

  useEffect(() => { recalcMinScale(); }, [pageA]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = pagesRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => recalcMinScale());
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageA]);

  const maxScale = Math.max(minScale, 1) * 4;

  function zoomBy(factor: number) {
    setScale((s) => (s === null ? s : Math.max(minScale, Math.min(maxScale, s * factor))));
  }

  function setScaleClamped(next: number) {
    setScale(Math.max(minScale, Math.min(maxScale, next)));
  }

  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
  }

  function goPage(dir: -1 | 1) {
    if (!doc) return;
    setAutoScroll(false);
    if (showTwoPage) {
      // Mode "llibre obert": només hi ha 1-2 pàgines carregades a la
      // vegada, cal demanar-ne una de nova.
      const next = pageIdx + dir * 2;
      if (next < 0 || next >= doc.numPages) {
        // Ja s'és a la primera/última pàgina i es torna a tirar cap enfora:
        // deixa que qui ens envolta decideixi (p. ex. passar de cançó).
        onEdge?.(dir);
        return;
      }
      setPageIdx(next);
      setScale(null); // recalcula l'ajusta-a-l'alçada per a la nova pàgina
      if (pagesRef.current) pagesRef.current.scrollTop = 0;
      triggerFlash(dir === 1 ? "right" : "left");
      return;
    }
    // Pila contínua: totes les pàgines ja hi són, així que tirar a banda i
    // banda salta exactament al límit de la pàgina — mai es queda
    // "encallat" a l'última pàgina sense poder tornar enrere. Només quan ja
    // s'és al capdamunt/capdavall de tota la pila es passa de cançó.
    const el = pagesRef.current;
    if (!el) return;
    const atTop = el.scrollTop <= 1;
    const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - 1;
    if (dir === -1 && atTop) { onEdge?.(-1); return; }
    if (dir === 1 && atBottom) { onEdge?.(1); return; }

    const pages = stackPageRefs.current.filter((p): p is HTMLDivElement => !!p);
    if (!pages.length) {
      el.scrollBy({ top: dir * (el.clientHeight / 9), behavior: "smooth" });
      triggerFlash(dir === 1 ? "right" : "left");
      return;
    }
    // Quina pàgina de la pila hi ha ara al capdamunt de la vista.
    let curIdx = 0;
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].offsetTop <= el.scrollTop + 1) curIdx = i; else break;
    }
    let target: number;
    if (dir === 1) {
      const pageBottom = pages[curIdx + 1] ? pages[curIdx + 1].offsetTop : el.scrollHeight;
      const viewBottom = el.scrollTop + el.clientHeight;
      if (viewBottom < pageBottom - 2) {
        // Encara no s'ha vist el final d'aquesta pàgina: mostra'l primer.
        target = Math.min(pageBottom - el.clientHeight, el.scrollHeight - el.clientHeight);
      } else {
        // Ja s'ha vist el final d'aquesta pàgina: salta a l'inici de la següent.
        target = pages[curIdx + 1] ? pages[curIdx + 1].offsetTop : el.scrollHeight - el.clientHeight;
      }
    } else if (el.scrollTop - pages[curIdx].offsetTop > 2) {
      // Encara dins la pàgina actual: torna al seu propi límit de dalt.
      target = pages[curIdx].offsetTop;
    } else if (pages[curIdx - 1]) {
      // Ja s'era al límit de dalt d'aquesta pàgina: mostra el final de
      // l'anterior (mai més amunt del seu propi límit de dalt).
      target = Math.max(pages[curIdx - 1].offsetTop, pages[curIdx].offsetTop - el.clientHeight);
    } else {
      target = 0;
    }
    el.scrollTo({ top: target, behavior: "smooth" });
    triggerFlash(dir === 1 ? "right" : "left");
  }

  function triggerFlash(side: "left" | "right") {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    setFlash({ side, key: Date.now() });
    flashTimer.current = window.setTimeout(() => setFlash(null), 450);
  }

  // Clicar a banda i banda passa de pàgina; al mig no fa res (evita canvis
  // sense voler en tocar el centre de la partitura).
  function onAreaClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    if (rel < 0.35) goPage(-1);
    else if (rel > 0.65) goPage(1);
  }

  const numPages = doc?.numPages || 0;
  const pageLabel = showTwoPage && pageB
    ? `${pageIdx + 1}-${pageIdx + 2} / ${numPages}`
    : `${pageIdx + 1} / ${numPages}`;

  return (
    <div className={"pdfv" + (dark ? " dark" : "")} onWheel={onWheel}>
      {error && <div className="pdfv-error">{error}</div>}
      {numPages > 0 && scale !== null && (
        <div className="pdfv-zoom-bar">
          <button type="button" className="row-rs-btn" title="Redueix" onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={scale <= minScale + 0.001}>−</button>
          <span className="pdfv-zoom-val">{Math.round(scale * 100)}%</span>
          <button type="button" className="row-rs-btn" title="Amplia" onClick={() => zoomBy(ZOOM_STEP)}>+</button>
          {numPages > 1 && <span className="pdfv-page-count">{pageLabel}</span>}
          {!showTwoPage && numPages > 1 && (
            <div className={"pdfv-scroll-ctl" + (autoScroll ? " active" : "")}>
              <button type="button" title={speedIdx === 0 ? "Atura l'autoscroll" : "Redueix el ritme"}
                onClick={() => { if (speedIdx === 0) setAutoScroll(false); else setSpeedIdx((i) => Math.max(0, i - 1)); }}>−</button>
              <button type="button" title={`Autoscroll — ritme ${speedIdx + 1}`} onClick={() => setAutoScroll((v) => !v)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="6 13 12 19 18 13"></polyline></svg>
              </button>
              <button type="button" title={!autoScroll ? "Comença l'autoscroll" : "Augmenta el ritme"}
                disabled={autoScroll && speedIdx === SCROLL_SPEEDS.length - 1}
                onClick={() => { if (!autoScroll) setAutoScroll(true); else setSpeedIdx((i) => Math.min(SCROLL_SPEEDS.length - 1, i + 1)); }}>+</button>
            </div>
          )}
        </div>
      )}
      {scale !== null && (
        // Rang fix del control d'arrossegar, del 100% al 250% — independent
        // del rang complet (minScale/maxScale) que sí que fan servir els
        // botons +/− i el zoom amb la roda.
        <ZoomSlider scale={scale} minScale={1} maxScale={2.5} onChange={setScaleClamped} />
      )}
      <div className="pdfv-pages" ref={pagesRef} onClick={onAreaClick}>
        {showTwoPage ? (
          <>
            {pageA && scale !== null && <PdfPage page={pageA} scale={scale} />}
            {pageB && <PdfPage page={pageB} scale={scale as number} />}
          </>
        ) : (
          pageA && scale !== null && (
            <div className="pdfv-stack">
              <div ref={(el) => { stackPageRefs.current[0] = el; }}>
                <PdfPage page={pageA} scale={scale} />
              </div>
              {extraPages.map((p, i) => (
                <div key={i} className="pdfv-stack-item" ref={(el) => { stackPageRefs.current[i + 1] = el; }}>
                  <div className="pdfv-stack-sep" />
                  <PdfPage page={p} scale={scale as number} />
                </div>
              ))}
            </div>
          )
        )}
        {flash && (
          <span key={flash.key} className={"pdfv-flash pdfv-flash-" + flash.side}>
            {flash.side === "left" ? (
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            ) : (
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
