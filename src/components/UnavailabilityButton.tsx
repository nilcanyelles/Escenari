"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createUnavailabilityAction } from "@/app/(artist)/actions";
import InlineDatePicker from "@/components/InlineDatePicker";
import TimePeriodBubble from "@/components/TimePeriodBubble";

// "+ No disponible": esdeveniment personal (vacances, etc.), no lligat a
// cap grup — apareix en vermell al calendari propi i avisa qualsevol
// gestor/admin que et convoqui aquells dies (vegeu ConcertDetailView).
export default function UnavailabilityButton({ defaultDate }: { defaultDate?: string }) {
  const router = useRouter();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(defaultDate || todayStr);
  const [startTime, setStartTime] = useState("10:00");
  const [startAllDay, setStartAllDay] = useState(true);
  const [endDate, setEndDate] = useState(defaultDate || todayStr);
  const [endTime, setEndTime] = useState("10:00");
  const [endAllDay, setEndAllDay] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const portal = (node: React.ReactNode) => (mounted ? createPortal(node, document.body) : null);

  function openModal() {
    const d = defaultDate || todayStr;
    setTitle(""); setStartDate(d); setEndDate(d); setStartAllDay(true); setEndAllDay(true);
    setOpen(true);
  }

  async function handleCreate() {
    setBusy(true);
    const allDay = startAllDay && endAllDay;
    await createUnavailabilityAction({
      title,
      startDate,
      startTime: startAllDay ? "" : startTime,
      endDate: endDate >= startDate ? endDate : startDate,
      endTime: endAllDay ? "" : endTime,
      allDay,
    });
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn-outline" onClick={openModal}>+ No disponible</button>

      {open && portal(
        <div className="modal-overlay" onClick={() => !busy && setOpen(false)}>
          <div className="modal unavail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Marca&apos;t com a no disponible</div>
              <button className="cf-head-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="modal-form" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="t-dim" style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: -6 }}>
                Els esdeveniments de no disponibilitat poden ser altres compromisos que tinguis fora del grup, com altres bolos o vacances. Si els administradors del grup et convoquen en una franja on no estàs disponible, els hi apareixerà un missatge d&apos;advertència.
              </div>
              <div>
                <label className="form-label">Títol</label>
                <input className="field-input form-field" placeholder="Vacances" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="form-label">Data d&apos;inici</label>
                  <InlineDatePicker value={startDate} onChange={(v) => { setStartDate(v); if (endDate < v) setEndDate(v); }} today={todayStr} />
                </div>
                <div>
                  <label className="form-label">Hora aproximada</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ opacity: startAllDay ? 0.4 : 1, pointerEvents: startAllDay ? "none" : "auto" }}>
                      <TimePeriodBubble time={startTime} onChange={setStartTime} />
                    </div>
                    <button type="button" className={"cd-att-btn" + (startAllDay ? " yes active" : "")} onClick={() => setStartAllDay((v) => !v)}>
                      {startAllDay ? "✓ " : ""}Tot el dia
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="form-label">Data de finalització</label>
                  <InlineDatePicker value={endDate} onChange={setEndDate} today={todayStr} minDate={startDate} />
                </div>
                <div>
                  <label className="form-label">Hora aproximada</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ opacity: endAllDay ? 0.4 : 1, pointerEvents: endAllDay ? "none" : "auto" }}>
                      <TimePeriodBubble time={endTime} onChange={setEndTime} />
                    </div>
                    <button type="button" className={"cd-att-btn" + (endAllDay ? " yes active" : "")} onClick={() => setEndAllDay((v) => !v)}>
                      {endAllDay ? "✓ " : ""}Tot el dia
                    </button>
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <div className="spacer"></div>
                <button className="btn-outline" onClick={() => setOpen(false)}>Cancel·la</button>
                <button className="btn-save" disabled={busy} onClick={handleCreate}>{busy ? "Creant…" : "Marca-ho"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
