"use client";

// Graella "Chroma" (reactbits) adaptada a Escenari: targetes de persona amb
// focus de color que segueix el ratolí i vel gris que es va aclarint.

import { useRef, useEffect } from "react";
import { gsap } from "gsap";

export type ChromaAction = {
  icon: string;
  title: string;
  href?: string;
  onClick?: () => void;
};

export type ChromaItem = {
  image: string;
  title: string;
  subtitle: string;
  handle?: string;
  location?: string;
  borderColor?: string;
  gradient?: string;
  url?: string;
  onClick?: () => void;
  actions?: ChromaAction[];
  footer?: React.ReactNode;
};

export default function ChromaGrid({
  items,
  className = "",
  radius = 260,
  columns = 3,
  cardWidth = 200,
  damping = 0.45,
  fadeOut = 0.6,
  ease = "power3.out",
}: {
  items: ChromaItem[];
  className?: string;
  radius?: number;
  columns?: number;
  cardWidth?: number;
  damping?: number;
  fadeOut?: number;
  ease?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const setX = useRef<((v: number) => void) | null>(null);
  const setY = useRef<((v: number) => void) | null>(null);
  const pos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setX.current = gsap.quickSetter(el, "--x", "px") as (v: number) => void;
    setY.current = gsap.quickSetter(el, "--y", "px") as (v: number) => void;
    const { width, height } = el.getBoundingClientRect();
    pos.current = { x: width / 2, y: height / 2 };
    setX.current(pos.current.x);
    setY.current(pos.current.y);
  }, []);

  const moveTo = (x: number, y: number) => {
    gsap.to(pos.current, {
      x,
      y,
      duration: damping,
      ease,
      onUpdate: () => {
        setX.current?.(pos.current.x);
        setY.current?.(pos.current.y);
      },
      overwrite: true,
    });
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    moveTo(e.clientX - r.left, e.clientY - r.top);
    gsap.to(fadeRef.current, { opacity: 0, duration: 0.25, overwrite: true });
  };

  const handleLeave = () => {
    gsap.to(fadeRef.current, { opacity: 1, duration: fadeOut, overwrite: true });
  };

  const handleCardMove = (e: React.MouseEvent<HTMLElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={rootRef}
      className={`chroma-grid ${className}`.trim()}
      style={{
        ["--r" as string]: `${radius}px`,
        ["--cols" as string]: columns,
        ["--card-w" as string]: `${cardWidth}px`,
      }}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {items.map((c, i) => (
        <article
          key={i}
          className="chroma-card"
          onMouseMove={handleCardMove}
          onClick={(e) => {
            e.stopPropagation();
            if (c.onClick) c.onClick();
            else if (c.url) window.open(c.url, "_blank", "noopener,noreferrer");
          }}
          style={{
            ["--card-border" as string]: c.borderColor || "transparent",
            ["--card-gradient" as string]: c.gradient || "linear-gradient(145deg, #444, #000)",
            cursor: c.onClick || c.url ? "pointer" : "default",
          }}
        >
          <div className="chroma-img-wrapper">
            <img src={c.image} alt={c.title} loading="lazy" />
          </div>
          <footer className="chroma-info">
            <h3 className="name">{c.title}</h3>
            {c.handle && <span className="handle">{c.handle}</span>}
            <p className="role">{c.subtitle}</p>
            {c.location && <span className="location">{c.location}</span>}
          </footer>
          {c.actions && c.actions.length > 0 && (
            <div className="chroma-actions" onClick={(e) => e.stopPropagation()}>
              {c.actions.map((a, j) =>
                a.href ? (
                  <a key={j} className="chroma-action" href={a.href} title={a.title} target={a.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{a.icon}</a>
                ) : (
                  <button key={j} type="button" className="chroma-action" title={a.title} onClick={a.onClick}>{a.icon}</button>
                )
              )}
            </div>
          )}
          {c.footer && <div className="chroma-footer" onClick={(e) => e.stopPropagation()}>{c.footer}</div>}
        </article>
      ))}
      <div className="chroma-overlay" />
      <div ref={fadeRef} className="chroma-fade" />
    </div>
  );
}
