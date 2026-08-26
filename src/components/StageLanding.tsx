"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LightRays from "@/components/LightRays";
import SpecularButton from "@/components/SpecularButton";

const MANAGER_FEATURES = [
  "Agenda i calendari de tots els grups, amb subscripció iCal",
  "Concerts amb full de ruta, estat i vista mòbil del dia del bolo",
  "Formularis externs perquè ajuntaments i sales omplin les dades",
  "Riders tècnics amb plànol d'escenari i flux d'aprovació",
  "Setlists compartibles i repertori amb lletres i acords",
  "Assistència dels músics, suplents i borsa de suplències",
  "Factures amb IVA i IRPF, bestretes i recordatoris de cobrament",
  "Despeses amb rebuts, marge net per bolo i exportació CSV",
  "Repartiment del caixet i comptes clars per músic",
  "Checklists per concert i seguiment de contactes",
  "Estadístiques de concerts i diners per grup i població",
  "Fitxers del grup i la imatge del mes per compartir",
];

const MUSICIAN_FEATURES = [
  "Tots els teus bolos de tots els grups en un sol lloc",
  "Confirma l'assistència amb un clic (i proposa suplents)",
  "El teu calendari personal de bolos, subscrivible (iCal)",
  "Borsa de suplències: presenta't a bolos d'altres grups",
  "Riders i setlists del grup, editables si tens permís",
  "Mode escenari: lletres i acords amb auto-scroll i metrònom",
  "Transposició d'acords i to inicial de cada cançó",
  "Registre de pràctica amb objectius i progrés setmanal",
  "Gravacions, partitures i fitxers del grup sempre a mà",
  "El caixet de cada bolo, si el gestor ho activa",
];

type Tab = "inici" | "funcionalitats" | "contacte";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

function FeaturePanels() {
  return (
    <div className="stage-features">
      <div className="stage-feature-panel">
        <div className="stage-feature-title">Per a gestors</div>
        <ul>
          {MANAGER_FEATURES.map((f) => <li key={f}>{f}</li>)}
        </ul>
      </div>
      <div className="stage-feature-panel">
        <div className="stage-feature-title">Per a músics</div>
        <ul>
          {MUSICIAN_FEATURES.map((f) => <li key={f}>{f}</li>)}
        </ul>
      </div>
    </div>
  );
}

function HeroContent({ signedIn, opacity = 1 }: { signedIn: boolean; opacity?: number }) {
  return (
    <div className="stage-hero" style={{ opacity }}>
      <h1 className="stage-title">ESCENARI</h1>
      <p className="stage-tagline">Tota la vida en directe dels teus grups, en un sol escenari.</p>
      <div className="stage-ctas">
        {signedIn ? (
          <Link href="/resum" style={{ textDecoration: "none" }}>
            <SpecularButton size="lg" radius={16} tint="#8b7bff" tintOpacity={0.35} baseColor="#8b7bff" lineColor="#ffffff">
              Obre l&apos;aplicació
            </SpecularButton>
          </Link>
        ) : (
          <>
            <Link href="/sign-up" style={{ textDecoration: "none" }}>
              <SpecularButton size="lg" radius={16} tint="#8b7bff" tintOpacity={0.35} baseColor="#8b7bff" lineColor="#ffffff">
                Crea el teu compte
              </SpecularButton>
            </Link>
            <Link href="/sign-in" style={{ textDecoration: "none" }}>
              <SpecularButton size="lg" radius={16} tint="#ffffff" tintOpacity={0.06} baseColor="#6a6a7a" lineColor="#e8e4ff">
                Inicia sessió
              </SpecularButton>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function StageLanding({ signedIn }: { signedIn: boolean }) {
  const [tab, setTab] = useState<Tab>("inici");
  const isMobile = useIsMobile();
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(0);

  // Al mòbil, la llum "s'encén" a mesura que fas scroll (com el vell efecte
  // de la foto que creixia): tot negre → focus a plena potència.
  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 1);
    });
  }

  const rays = (intensity: number, mouse: boolean) => (
    <>
      <div className="stage-rays">
        <LightRays
          raysOrigin="top-center"
          raysColor="#cdb4ff"
          raysSpeed={1.2}
          lightSpread={0.55}
          rayLength={2.6}
          fadeDistance={1.6}
          saturation={1.1}
          followMouse={mouse}
          mouseInfluence={0.12}
          noiseAmount={0.06}
          distortion={0.04}
          intensity={intensity}
        />
      </div>
      <div className="stage-rays stage-rays-side">
        <LightRays raysOrigin="top-left" raysColor="#ffd9a0" raysSpeed={0.8} lightSpread={0.9} rayLength={1.8} fadeDistance={1.2} followMouse={false} intensity={intensity * 0.4} />
      </div>
      <div className="stage-rays stage-rays-side">
        <LightRays raysOrigin="top-right" raysColor="#9ad8ff" raysSpeed={0.7} lightSpread={0.9} rayLength={1.8} fadeDistance={1.2} followMouse={false} intensity={intensity * 0.36} />
      </div>
    </>
  );

  // ---------- Mòbil: reveal amb scroll + pestanyes a baix ----------
  if (isMobile) {
    const lightOn = tab !== "inici";
    const intensity = lightOn ? 2.2 : 0.04 + progress * 2.3;
    return (
      <div className="stage-landing stage-landing-mobile">
        {/* Barra superior: logo + accés */}
        <header className="stage-mheader">
          <span className="brand-lockup">
            <img className="brand-mark" src="/logo-mark.png" alt="" />
            <span className="brand-name">ESCENARI</span>
          </span>
          <div className="stage-mheader-cta">
            {signedIn ? (
              <Link className="landing-cta-secondary sx-cta-ghost" href="/resum">Obre l&apos;app</Link>
            ) : (
              <>
                <Link className="landing-cta-secondary sx-cta-ghost" href="/sign-in">Inicia sessió</Link>
                <Link className="stage-mcta-primary" href="/sign-up">Crea compte</Link>
              </>
            )}
          </div>
        </header>

        {tab === "inici" ? (
          <div className="stage-mscroll" onScroll={handleScroll}>
            <div className="stage-mtrack">
              <div className="stage-msticky">
                {rays(intensity, false)}
                <div className="stage-floor" style={{ opacity: 0.25 + progress * 0.75 }} aria-hidden="true">
                  <div className="stage-floor-spot" style={{ opacity: progress }}></div>
                </div>
                <div className="stage-main stage-mmain" style={{ opacity: 0.12 + progress * 0.88 }}>
                  <HeroContent signedIn={signedIn} />
                </div>
                {progress < 0.12 && (
                  <div className="stage-mhint" aria-hidden="true">
                    <span>Desplaça&apos;t per encendre els llums</span>
                    <span className="stage-mhint-arrow">↓</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="stage-mpanel">
            {rays(1.4, false)}
            <div className="stage-mpanel-content">
              {tab === "funcionalitats" ? (
                <FeaturePanels />
              ) : (
                <div className="stage-contact"><h2 className="stage-contact-title">Contacte</h2></div>
              )}
            </div>
          </div>
        )}

        {/* Pestanyes a baix */}
        <nav className="stage-tabs stage-mtabs">
          <button className={"stage-tab" + (tab === "inici" ? " active" : "")} onClick={() => { setTab("inici"); }}>Inici</button>
          <button className={"stage-tab" + (tab === "funcionalitats" ? " active" : "")} onClick={() => setTab("funcionalitats")}>Funcionalitats</button>
          <button className={"stage-tab" + (tab === "contacte" ? " active" : "")} onClick={() => setTab("contacte")}>Contacte</button>
        </nav>
      </div>
    );
  }

  // ---------- Escriptori: escena fixa ----------
  return (
    <div className="stage-landing">
      {rays(2.2, true)}

      <div className="stage-floor" aria-hidden="true">
        <div className="stage-floor-spot"></div>
      </div>

      <header className="stage-header">
        <span className="brand-lockup">
          <img className="brand-mark" src="/logo-mark.png" alt="" />
          <span className="brand-name">ESCENARI</span>
        </span>
        <nav className="stage-tabs">
          <button className={"stage-tab" + (tab === "inici" ? " active" : "")} onClick={() => setTab("inici")}>Inici</button>
          <button className={"stage-tab" + (tab === "funcionalitats" ? " active" : "")} onClick={() => setTab("funcionalitats")}>Funcionalitats</button>
          <button className={"stage-tab" + (tab === "contacte" ? " active" : "")} onClick={() => setTab("contacte")}>Contacte</button>
        </nav>
        <div className="stage-header-cta">
          {signedIn ? (
            <Link className="landing-cta-secondary sx-cta-ghost" href="/resum">Obre l&apos;aplicació</Link>
          ) : (
            <Link className="landing-cta-secondary sx-cta-ghost" href="/sign-in">Inicia sessió</Link>
          )}
        </div>
      </header>

      <main className="stage-main">
        {tab === "inici" && <HeroContent signedIn={signedIn} />}
        {tab === "funcionalitats" && <FeaturePanels />}
        {tab === "contacte" && (
          <div className="stage-contact">
            <h2 className="stage-contact-title">Contacte</h2>
          </div>
        )}
      </main>

      <div className="stage-footer">© {new Date().getFullYear()} Escenari</div>
    </div>
  );
}
