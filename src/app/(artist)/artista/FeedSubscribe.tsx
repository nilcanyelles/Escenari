"use client";

import { useState } from "react";

// Copia l'URL del feed iCal personal (Google/Apple Calendar).
export default function FeedSubscribe({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button" className="link-btn" style={{ fontSize: 12.5 }}
      title="Copia l'URL per veure tots els teus bolos al teu calendari (Google Calendar, Apple Calendar…)"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}/api/ics/${token}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }}
    >📅 {copied ? "Enllaç copiat ✓" : "Els meus bolos al calendari"}</button>
  );
}
