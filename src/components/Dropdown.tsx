"use client";

import { Children, isValidElement, useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";

type OptionProps = { value?: string; children?: ReactNode; disabled?: boolean };

// Substitut genèric d'un <select> natiu: mateixa API (value, onChange amb
// e.target.value, fills <option>) perquè es pugui fer servir allà on hi
// havia un <select> sense haver de tocar la lògica que ja hi havia — però
// el menú sempre surt just a sota de la casella, amb la seva mateixa
// amplada, en comptes de deixar-ho decidir al navegador (que no es pot
// forçar amb CSS en un <select> natiu).
export default function Dropdown({
  value, onChange, onBlur, className, style, title, disabled, children,
}: {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  onBlur?: () => void;
  className?: string;
  style?: CSSProperties;
  title?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const options = Children.toArray(children).filter(isValidElement) as ReactElement<OptionProps>[];
  function optionValue(o: ReactElement<OptionProps>, i: number): string {
    if (o.props.value !== undefined) return o.props.value;
    if (typeof o.props.children === "string") return o.props.children;
    return String(i);
  }
  const current = options.find((o, i) => optionValue(o, i) === value);

  function pick(v: string) {
    onChange({ target: { value: v } });
    setOpen(false);
    onBlur?.();
  }

  return (
    <div ref={ref} className="cd-dropdown">
      <button
        type="button" className={(className ? className + " " : "") + "cd-dropdown-trigger"} style={style} title={title}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span>{current ? current.props.children : (options[0]?.props.children ?? "")}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      {open && (
        <div className="cd-dropdown-menu">
          {options.map((o, i) => {
            const v = optionValue(o, i);
            return (
              <button
                key={v + i} type="button" className={"cd-dropdown-item" + (v === value ? " active" : "")}
                disabled={o.props.disabled}
                onClick={() => pick(v)}
              >
                {o.props.children}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
