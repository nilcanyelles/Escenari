"use client";

import { useState } from "react";

// Panell plegable: capçalera amb títol, resum (què hi ha a dins, per no
// haver-lo d'obrir) i acció opcional a la dreta; el cos només es pinta
// quan està obert.
export default function FoldPanel({ id, title, summary, defaultOpen = true, action, children, className = "" }: {
  id?: string;
  title: string;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} className={"panel cd-section fold-panel" + (open ? " open" : "") + (className ? " " + className : "")}>
      <div className="fold-head">
        <button type="button" className="fold-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="fold-chevron" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>
          </span>
          <span className="fold-title">{title}</span>
          {summary && <span className="fold-summary">{summary}</span>}
        </button>
        {action && <div className="fold-action">{action}</div>}
      </div>
      {open && <div className="fold-body">{children}</div>}
    </div>
  );
}
