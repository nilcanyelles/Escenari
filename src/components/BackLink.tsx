"use client";

import Link from "next/link";

// Botó de "tornar" de tota l'app: una píndola amb fletxa i prou àrea per
// clicar-la bé (també al mòbil) — en comptes de l'enllaç prim de text amb
// "←" d'abans. Amb "href" és un enllaç; sense, un botó amb "onClick".
export default function BackLink({ href, onClick, children, className = "" }: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const inner = (
    <>
      <svg className="back-btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      <span>{children}</span>
    </>
  );
  const cls = ("back-btn " + className).trim();
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  return <button type="button" className={cls} onClick={onClick}>{inner}</button>;
}
