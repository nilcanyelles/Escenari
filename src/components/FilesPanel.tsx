"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band } from "@/lib/types";
import type { BandFile } from "@/lib/songs";
import { uploadFileAction, deleteFileAction } from "@/app/(app)/grup/songs-actions";

function fmtSize(bytes: number): string {
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return Math.round(bytes / 1024) + " KB";
}

// Fitxers generals del grup (no lligats a cap cançó): contractes, cartells,
// mapes, àudios… compartits amb tots els membres.
export default function FilesPanel({ band, files, canEdit }: { band: Band; files: BandFile[]; canEdit: boolean }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const generalFiles = files.filter((f) => !f.songId);

  async function handleUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.set("bandId", band.id);
    fd.set("file", file);
    const res = await uploadFileAction(fd);
    if (!res.ok) alert(res.error);
    router.refresh();
    setUploading(false);
  }

  return (
    <div className="panel">
      <div className="panel-header-row" style={{ marginBottom: 12 }}>
        <div className="panel-title">Fitxers del grup</div>
        {canEdit && (
          <>
            <button type="button" className="glow-cta" disabled={uploading} onClick={() => input.current?.click()}>
              {uploading ? "Pujant…" : "+ Puja un fitxer"}
            </button>
            <input ref={input} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
          </>
        )}
      </div>
      <div className="t-dim" style={{ fontSize: 13, marginBottom: 14 }}>
        Repositori compartit amb tots els membres: contractes, cartells, mapes d&apos;accés, àudios… (màx. 15 MB per fitxer).
      </div>
      {generalFiles.length === 0 ? (
        <div className="empty-state">Encara no hi ha fitxers.</div>
      ) : (
        <div className="file-list">
          {generalFiles.map((f) => (
            <div key={f.id} className="file-row">
              <span className="file-icon">{f.mime.startsWith("audio") ? "🎧" : f.mime.startsWith("video") ? "🎬" : f.mime.startsWith("image") ? "🖼" : f.mime.includes("pdf") ? "📄" : "📎"}</span>
              <div className="file-row-main">
                <a href={`/api/file/${f.id}`} target="_blank" rel="noreferrer" className="file-name">{f.name}</a>
                <span className="t-dim" style={{ fontSize: 11 }}>
                  {new Date(f.createdAt).toLocaleDateString("ca-ES")}{f.uploadedBy ? ` · ${f.uploadedBy}` : ""}
                </span>
                {f.mime.startsWith("audio") && <audio controls preload="none" src={`/api/file/${f.id}`} className="file-audio" />}
              </div>
              <span className="t-dim" style={{ fontSize: 11 }}>{fmtSize(f.size)}</span>
              {canEdit && (
                <button type="button" className="row-delete-btn" onClick={async () => {
                  if (!confirm(`Eliminar "${f.name}"?`)) return;
                  await deleteFileAction(band.id, f.id);
                  router.refresh();
                }}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
