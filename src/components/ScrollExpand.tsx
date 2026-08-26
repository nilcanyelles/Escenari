"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => t * t * (3 - 2 * t);

type ScrollExpandProps = {
  /** Image shown inside the frame. */
  src: string;
  alt?: string;
  /** Big display text kept centred in the frame the whole way. */
  title?: string;
  /** Small nudge shown while the frame is still closed. */
  scrollHint?: string;
  /** Drive the animation from the page scroll instead of the component's own scrollbar. */
  useWindowScroll?: boolean;
  /** Closed-state frame size, in % of the stage. */
  startWidth?: number;
  startHeight?: number;
  startRadius?: number;
  endRadius?: number;
  /** How far the media is zoomed in while closed (1 = no zoom). */
  mediaZoom?: number;
  /** Point of the image the closed frame is centred on, in %. */
  focusX?: number;
  focusY?: number;
  /** Scroll needed to open the frame / to hold it open, in viewports. */
  scrollDistance?: number;
  holdDistance?: number;
  /** 0-1 follow factor; lower = lazier. */
  smoothing?: number;
  /** Darkening over the media, 0-1. */
  overlayScrim?: number;
  /** Progress at which `children` start fading in. */
  revealAt?: number;
  enabled?: boolean;
  className?: string;
  children?: ReactNode;
};

export default function ScrollExpand({
  src,
  alt = "",
  title,
  scrollHint,
  useWindowScroll = false,
  startWidth = 42,
  startHeight = 58,
  startRadius = 24,
  endRadius = 0,
  mediaZoom = 1.35,
  focusX = 50,
  focusY = 55,
  scrollDistance = 1.2,
  holdDistance = 0.35,
  smoothing = 0.1,
  overlayScrim = 0.45,
  revealAt = 0.4,
  enabled = true,
  className = "",
  children,
}: ScrollExpandProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLImageElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const [mediaFailed, setMediaFailed] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const paint = (p: number) => {
      const e = smoothstep(clamp(p));
      const focus = `${lerp(focusX, 50, e)}% ${lerp(focusY, 50, e)}%`;

      if (frameRef.current) {
        frameRef.current.style.width = `${lerp(startWidth, 100, e)}%`;
        frameRef.current.style.height = `${lerp(startHeight, 100, e)}%`;
        frameRef.current.style.borderRadius = `${lerp(startRadius, endRadius, e)}px`;
      }
      if (mediaRef.current) {
        mediaRef.current.style.transform = `scale(${lerp(mediaZoom, 1, e)})`;
        mediaRef.current.style.transformOrigin = focus;
        mediaRef.current.style.objectPosition = focus;
      }
      if (scrimRef.current) {
        scrimRef.current.style.opacity = `${lerp(overlayScrim * 0.82, overlayScrim, e)}`;
      }
      if (titleRef.current) {
        titleRef.current.style.transform = `scale(${lerp(0.72, 1, e)})`;
      }
      if (revealRef.current) {
        const t = clamp((e - revealAt) / Math.max(0.001, 1 - revealAt));
        revealRef.current.style.opacity = `${t}`;
        revealRef.current.style.transform = `translateY(${lerp(22, 0, t)}px)`;
        revealRef.current.style.pointerEvents = t > 0.6 ? "auto" : "none";
      }
      if (hintRef.current) {
        hintRef.current.style.opacity = `${clamp(1 - p * 5)}`;
      }
    };

    if (!enabled) {
      paint(1);
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const follow = reduceMotion ? 1 : clamp(smoothing, 0.02, 1);

    let current = 0;
    let target = 0;
    let raf = 0;
    let running = false;

    const measure = () => {
      // In self-scroll mode the sticky stage can't express "as tall as my scroller" in CSS.
      if (!useWindowScroll && stageRef.current) {
        stageRef.current.style.height = `${root.clientHeight}px`;
      }
      const span = scrollDistance * (useWindowScroll ? window.innerHeight : root.clientHeight);
      if (span <= 0) {
        target = 1;
        return;
      }
      target = useWindowScroll
        ? clamp(-root.getBoundingClientRect().top / span)
        : clamp(root.scrollTop / span);
    };

    const tick = () => {
      current = follow >= 1 ? target : lerp(current, target, follow);
      if (Math.abs(target - current) < 0.0005) current = target;
      paint(current);
      if (current !== target) {
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };

    const onScroll = () => {
      measure();
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    const onResize = () => {
      measure();
      current = target;
      paint(current);
    };

    measure();
    current = target;
    paint(current);

    const scroller: Window | HTMLElement = useWindowScroll ? window : root;
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [
    enabled,
    useWindowScroll,
    startWidth,
    startHeight,
    startRadius,
    endRadius,
    mediaZoom,
    focusX,
    focusY,
    scrollDistance,
    holdDistance,
    smoothing,
    overlayScrim,
    revealAt,
  ]);

  const total = enabled ? 1 + scrollDistance + holdDistance : 1;

  return (
    <div
      ref={rootRef}
      className={`sx ${useWindowScroll ? "sx-window" : "sx-self"} ${className}`.trim()}
      style={useWindowScroll ? { height: `${total * 100}dvh` } : undefined}
    >
      <div className="sx-track" style={{ height: `${total * 100}%` }}>
        <div ref={stageRef} className="sx-stage">
          <div
            ref={frameRef}
            className="sx-frame"
            style={{
              width: `${enabled ? startWidth : 100}%`,
              height: `${enabled ? startHeight : 100}%`,
              borderRadius: `${enabled ? startRadius : endRadius}px`,
            }}
          >
            {mediaFailed ? (
              <div className="sx-media sx-media-fallback" role="img" aria-label={alt} />
            ) : (
              <img
                ref={mediaRef}
                className="sx-media"
                src={src}
                alt={alt}
                onError={() => setMediaFailed(true)}
                style={{
                  transform: `scale(${enabled ? mediaZoom : 1})`,
                  transformOrigin: `${focusX}% ${focusY}%`,
                  objectPosition: `${focusX}% ${focusY}%`,
                }}
              />
            )}
            <div ref={scrimRef} className="sx-scrim" style={{ opacity: overlayScrim }} />

            <div className="sx-content">
              {title ? (
                <div ref={titleRef} className="sx-title-wrap">
                  <span className="sx-title">{title}</span>
                </div>
              ) : null}
              {children ? (
                <div
                  ref={revealRef}
                  className="sx-reveal"
                  style={enabled ? { opacity: 0, transform: "translateY(22px)" } : undefined}
                >
                  {children}
                </div>
              ) : null}
            </div>

            {scrollHint && enabled ? (
              <div ref={hintRef} className="sx-hint">
                <span>{scrollHint}</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <polyline points="19 12 12 19 5 12"></polyline>
                </svg>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
