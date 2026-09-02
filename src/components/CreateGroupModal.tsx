"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import InstrumentPicker from "@/components/InstrumentPicker";
import { instrumentIconFor } from "@/lib/tags";
import type { CreateGroupPerson, CreateGroupResult } from "@/lib/group-create";
import { createGroupAction } from "@/app/(app)/configuracio/actions";
import { createGroupAsMusicianAction } from "@/app/(artist)/actions";

const DEFAULT_COLOR1 = "#8b7bff";
const DEFAULT_COLOR2 = "#e86bd0";

const BAND_COOKIE = "escenari_band";

function readImage(file: File | undefined, set: (dataUrl: string) => void, max = 256) {
  if (!file) return;
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    set(canvas.toDataURL("image/png"));
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="btn-outline" style={{ padding: "6px 10px", fontSize: 12 }}
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}>
      {copied ? "Copiat ✓" : "Copia"}
    </button>
  );
}

type PersonDraft = CreateGroupPerson & { open: boolean };

// Alta d'un grup: nom, logotip, colors i el seu equip (músics amb els seus
// instruments, i equip tècnic amb el càrrec). En crear-lo, cada persona rep
// un enllaç per reclamar el seu perfil. Qui el crea pot entrar-hi també com
// a músic (el músic que crea el seu grup, sempre).
export default function CreateGroupModal({ onClose, mode = "agency", selfName = "", selfInstruments = [] }: {
  onClose: () => void;
  mode?: "agency" | "musician";
  selfName?: string;
  selfInstruments?: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [logo, setLogo] = useState("");
  const [color1, setColor1] = useState(DEFAULT_COLOR1);
  const [color2, setColor2] = useState(DEFAULT_COLOR2);
  const [tags, setTags] = useState("");
  const [addSelf, setAddSelf] = useState(mode === "musician");
  const [selfIns, setSelfIns] = useState<string[]>(selfInstruments);
  const [selfOpen, setSelfOpen] = useState(mode === "musician" && selfInstruments.length === 0);
  const [people, setPeople] = useState<PersonDraft[]>([{ name: "", kind: "musician", instruments: [], role: "", email: "", open: false }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CreateGroupResult | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  function update(i: number, patch: Partial<PersonDraft>) {
    setPeople((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  async function create() {
    if (!name.trim()) { setError("Cal el nom del grup."); return; }
    setBusy(true);
    setError("");
    try {
      const input = {
        name, logo, color1, color2, city,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        people: people.filter((p) => p.name.trim()).map(({ open: _open, ...p }) => p),
      };
      const res = mode === "musician"
        ? await createGroupAsMusicianAction(input, selfIns)
        : await createGroupAction(input, addSelf ? { instruments: selfIns } : null);
      setResult(res);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No s'ha pogut crear el grup.");
    }
    setBusy(false);
  }

  function openGroup() {
    if (!result) return;
    document.cookie = `${BAND_COOKIE}=${encodeURIComponent(result.bandId)}; path=/; max-age=31536000; samesite=lax`;
    router.push("/grup");
    router.refresh();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide cg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{result ? `${name} creat` : mode === "musician" ? "Crea el teu grup" : "Nou grup"}</div>
          <button className="cf-head-close" onClick={onClose}>✕</button>
        </div>

        {result ? (
          <div className="modal-form" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mode === "musician" && (
              <div className="sx-notice ok">Ja tens el grup: hi ets com a músic i el gestiones tu. Trobaràs la gestió (bolos, full de ruta, facturació…) a &ldquo;Gestió del grup&rdquo;.</div>
            )}
            {result.invites.length > 0 ? (
              <>
                <div className="t-dim" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  Passa a cada persona el seu enllaç: en entrar-hi reclamarà el seu perfil dins del grup (als que tenen correu també se&apos;ls ha enviat, si el correu està configurat).
                </div>
                <div className="ob-links">
                  {result.invites.map((l) => (
                    <div key={l.url} className="ob-link-row">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="t-strong" style={{ fontSize: 13 }}>{l.name}{l.asCrew ? <span className="t-dim" style={{ fontWeight: 400 }}> · crew</span> : null}</div>
                        <div className="t-dim" style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.url}</div>
                      </div>
                      <CopyBtn text={l.url} />
                      <button type="button" className="btn-outline cd-wa-btn" style={{ padding: "6px 10px", fontSize: 12 }}
                        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Uneix-te a ${name} a Escenari: ${l.url}`)}`, "_blank")}>WhatsApp</button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="t-dim" style={{ fontSize: 13 }}>{mode === "musician" ? "Podràs afegir-hi la resta de gent des de la pestanya Equip del grup." : "El grup s'ha creat sense membres: els pots afegir des de la pestanya Equip."}</div>
            )}
            <div className="modal-actions">
              <div className="spacer"></div>
              <button className="btn-outline" onClick={onClose}>Tanca</button>
              <button className="btn-save" onClick={openGroup}>Obre el grup</button>
            </div>
          </div>
        ) : (
          <div className="modal-form" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Identitat */}
            <div className="cg-identity">
              <button type="button" className="ob-logo-btn" onClick={() => logoRef.current?.click()} title="Logotip del grup"
                style={{ background: logo ? undefined : `linear-gradient(135deg, ${color1}, ${color2})` }}>
                {logo ? <img src={logo} alt="" /> : <span>Logo</span>}
              </button>
              <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => readImage(e.target.files?.[0], setLogo)} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label className="form-label">Nom del grup *</label>
                  <input className="field-input form-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: La Bona Party" autoFocus />
                </div>
                <div className="cg-two">
                  <div>
                    <label className="form-label">Població</label>
                    <input className="field-input form-field" value={city} onChange={(e) => setCity(e.target.value)} placeholder="D'on és el grup" />
                  </div>
                  <div>
                    <label className="form-label">Etiquetes (separades per comes)</label>
                    <input className="field-input form-field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Rock, Versions…" />
                  </div>
                </div>
                <div className="ga-colors" style={{ marginTop: 2 }}>
                  <label className="ga-color">Color principal<input type="color" value={color1} onChange={(e) => setColor1(e.target.value)} /></label>
                  <label className="ga-color">Color secundari<input type="color" value={color2} onChange={(e) => setColor2(e.target.value)} /></label>
                  <div className="ga-swatch" style={{ background: `linear-gradient(120deg, ${color1}, ${color2})` }}></div>
                </div>
              </div>
            </div>

            {/* Tu, dins del grup */}
            <div className="cg-self">
              {mode === "musician" ? (
                <div className="cg-self-head">
                  <span className="t-strong" style={{ fontSize: 13.5 }}>Tu hi toques{selfName ? ` (${selfName})` : ""}</span>
                  <button type="button" className="btn-outline cg-ins-btn" onClick={() => setSelfOpen((v) => !v)}>
                    {selfIns.length ? (
                      <>{selfIns.slice(0, 2).map((ins) => <img key={ins} src={instrumentIconFor(ins)} alt="" />)}{selfIns.slice(0, 2).join(", ")}{selfIns.length > 2 ? ` +${selfIns.length - 2}` : ""}</>
                    ) : "Els teus instruments…"}
                  </button>
                </div>
              ) : (
                <label className="cg-self-head" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={addSelf} onChange={(e) => { setAddSelf(e.target.checked); if (e.target.checked && selfIns.length === 0) setSelfOpen(true); }} />
                  <span className="t-strong" style={{ fontSize: 13.5 }}>Jo també hi toco{selfName ? ` (${selfName})` : ""}</span>
                  {addSelf && (
                    <button type="button" className="btn-outline cg-ins-btn" style={{ marginLeft: "auto" }} onClick={(e) => { e.preventDefault(); setSelfOpen((v) => !v); }}>
                      {selfIns.length ? selfIns.slice(0, 2).join(", ") + (selfIns.length > 2 ? ` +${selfIns.length - 2}` : "") : "Els meus instruments…"}
                    </button>
                  )}
                </label>
              )}
              {(mode === "musician" || addSelf) && selfOpen && (
                <div className="cg-person-ins">
                  <InstrumentPicker value={selfIns} onChange={setSelfIns} />
                  <button type="button" className="btn-ghost-sm" onClick={() => setSelfOpen(false)}>Fet</button>
                </div>
              )}
            </div>

            {/* Equip */}
            <div>
              <div className="form-label" style={{ marginBottom: 8 }}>{mode === "musician" ? "La resta del grup" : "Músics i equip tècnic"}</div>
              <div className="cg-people">
                {people.map((p, i) => (
                  <div key={i} className="cg-person">
                    <div className="cg-person-row">
                      <input className="field-input compact-field" placeholder="Nom *" value={p.name} onChange={(e) => update(i, { name: e.target.value })} />
                      <div className="stats-tabs" style={{ padding: 2 }}>
                        <button type="button" className={"stats-tab" + (p.kind === "musician" ? " active" : "")} style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => update(i, { kind: "musician" })}>Músic</button>
                        <button type="button" className={"stats-tab" + (p.kind === "crew" ? " active" : "")} style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => update(i, { kind: "crew" })}>Crew</button>
                      </div>
                      {p.kind === "crew" ? (
                        <input className="field-input compact-field" placeholder="Càrrec (so, llums…)" value={p.role} onChange={(e) => update(i, { role: e.target.value })} />
                      ) : (
                        <button type="button" className="btn-outline cg-ins-btn" onClick={() => update(i, { open: !p.open })}>
                          {p.instruments.length ? (
                            <>{p.instruments.slice(0, 2).map((ins) => <img key={ins} src={instrumentIconFor(ins)} alt="" />)}{p.instruments.slice(0, 2).join(", ")}{p.instruments.length > 2 ? ` +${p.instruments.length - 2}` : ""}</>
                          ) : "Instruments…"}
                        </button>
                      )}
                      <input className="field-input compact-field" type="email" placeholder="Correu (opcional)" value={p.email} onChange={(e) => update(i, { email: e.target.value })} />
                      <button type="button" className="row-delete-btn" title="Treu" onClick={() => setPeople((prev) => prev.filter((_, j) => j !== i))}>✕</button>
                    </div>
                    {p.kind === "musician" && p.open && (
                      <div className="cg-person-ins">
                        <InstrumentPicker value={p.instruments} onChange={(next) => update(i, { instruments: next })} />
                        <button type="button" className="btn-ghost-sm" onClick={() => update(i, { open: false })}>Fet</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className="btn-ghost-sm" style={{ marginTop: 8 }} onClick={() => setPeople((prev) => prev.concat([{ name: "", kind: "musician", instruments: [], role: "", email: "", open: false }]))}>
                + Afegeix una persona
              </button>
              <div className="t-dim" style={{ fontSize: 12, marginTop: 6 }}>Cadascú rebrà un enllaç per reclamar el seu perfil (amb correu, també per correu).</div>
            </div>

            {error && <div className="fin-neg" style={{ fontSize: 13 }}>{error}</div>}
            <div className="modal-actions">
              <div className="spacer"></div>
              <button className="btn-outline" onClick={onClose}>Cancel·la</button>
              <button className="btn-save" disabled={busy || !name.trim()} onClick={create}>{busy ? "Creant…" : "Crea el grup"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
