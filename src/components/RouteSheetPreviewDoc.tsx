"use client";

import type { Concert } from "@/lib/types";
import {
  type RouteSheet, type LlocItem, type ContactItem, type HospitalitatItem, type TecnicItem,
  normalizeRouteSheet, rsIsComplete, formatPhoneDisplay, rsFormatDuration, RS_SECTION_ICONS, RS_LLOC_ICONS,
} from "@/lib/route-sheet";
import { capitalize, formatDateFull } from "@/lib/format";

const RS_LABEL_COLOR = "oklch(0.15 0.01 258)";
const RS_VALUE_COLOR = "oklch(0.42 0.01 258)";

function TickCross({ yes }: { yes: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={yes ? "oklch(0.6 0.15 155)" : "oklch(0.6 0.18 25)"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px" }}>
      {yes ? <polyline points="20 6 9 17 4 12"></polyline> : <><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></>}
    </svg>
  );
}
function SectionIcon({ title }: { title: string }) {
  const path = RS_SECTION_ICONS[title];
  if (!path) return null;
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} dangerouslySetInnerHTML={{ __html: path }} />;
}
function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 700, color: RS_LABEL_COLOR, marginBottom: 9 }}>
      <SectionIcon title={title} /><span>{title}</span>
    </div>
  );
}
function Box({ title, children, flexStyle }: { title: string; children: React.ReactNode; flexStyle?: React.CSSProperties }) {
  return (
    <div style={{ background: "oklch(0.97 0.004 258)", border: "1px solid oklch(0.88 0.005 258)", borderRadius: 10, padding: "14px 16px", flex: "1 1 0", minWidth: 0, ...flexStyle }}>
      <SectionTitle title={title} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>{children}</div>
    </div>
  );
}
function InclusionLine({ label, included, value }: { label: string; included: boolean; value?: string }) {
  if (!label) return null;
  return (
    <div><span style={{ color: RS_LABEL_COLOR, fontWeight: 600 }}>{label}&nbsp;</span><TickCross yes={included} />{value && <>&nbsp;<span style={{ color: RS_VALUE_COLOR }}>{value}</span></>}</div>
  );
}
function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return <div><span style={{ color: RS_LABEL_COLOR, fontWeight: 600 }}>{label}&nbsp;</span><span style={{ color: RS_VALUE_COLOR }}>{value}</span></div>;
}

function contactActions(ct: ContactItem) {
  if (!ct.phone) return null;
  const digits = ct.phone.replace(/[^\d+]/g, "");
  const intl = digits.indexOf("+") === 0 ? digits.slice(1) : "34" + digits;
  return (
    <>
      <a href={"tel:+" + intl} title={"Truca a " + ct.phone} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 19, height: 19, borderRadius: 5, background: "oklch(0.68 0.19 290 / 0.14)", color: "oklch(0.55 0.19 290)", flex: "none", marginLeft: 3, verticalAlign: "middle" }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
      </a>
      <a href={"https://wa.me/" + intl} target="_blank" rel="noopener" title={"WhatsApp a " + ct.phone} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 19, height: 19, borderRadius: 5, background: "oklch(0.72 0.15 155 / 0.16)", color: "oklch(0.6 0.15 155)", flex: "none", marginLeft: 3, verticalAlign: "middle" }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
      </a>
    </>
  );
}

function LlocLine({ item }: { item: LlocItem }) {
  const label = item.label, value = item.value;
  const isParking = label && label.trim().toLowerCase() === "parking";
  const plateList = isParking && item.plates ? item.plates.split(/[,;\n]+/).map((p) => p.trim()).filter((p) => p) : [];
  if (!value && !plateList.length) return null;
  const iconPath = RS_LLOC_ICONS[(label || "").trim().toLowerCase()];
  const isLink = value && /^https?:\/\//i.test(value.trim());
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ color: RS_LABEL_COLOR, fontWeight: 600, minWidth: 66, flex: "none" }}>{label}</span>
      {iconPath && isLink ? (
        <a href={value} target="_blank" rel="noopener" title={label + " — obre a Google Maps"} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, background: "oklch(0.68 0.19 290 / 0.14)", color: "oklch(0.55 0.19 290)", flex: "none" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: iconPath }} />
        </a>
      ) : (
        <span style={{ color: RS_VALUE_COLOR }}>{value || ""}</span>
      )}
      {plateList.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, color: RS_VALUE_COLOR }}>
          {plateList.map((p, i) => <span key={i}>{p}</span>)}
        </div>
      )}
    </div>
  );
}

function HotelLine({ it }: { it: HospitalitatItem }) {
  const isHotel = it.label && it.label.trim().toLowerCase() === "allotjament";
  const included = it.included !== false;
  if (!isHotel) return <InclusionLine label={it.label} included={included} value={it.value} />;
  if (!included) return <InclusionLine label={it.label} included={included} value={it.value} />;

  const digits = (it.phone || "").replace(/[^\d+]/g, "");
  const intl = digits ? (digits.indexOf("+") === 0 ? digits.slice(1) : "34" + digits) : "";
  const icons: React.ReactNode[] = [];
  if (it.phone) {
    icons.push(
      <a key="tel" href={"tel:+" + intl} title="Truca a l'allotjament" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 19, height: 19, borderRadius: 5, background: "oklch(0.68 0.19 290 / 0.14)", color: "oklch(0.55 0.19 290)", flex: "none", marginLeft: 6, verticalAlign: "middle" }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
      </a>
    );
  }
  if (it.location) {
    icons.push(
      <a key="loc" href={it.location} target="_blank" rel="noopener" title="Ubicació de l'allotjament" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 19, height: 19, borderRadius: 5, background: "oklch(0.68 0.19 290 / 0.14)", color: "oklch(0.55 0.19 290)", flex: "none", marginLeft: 3, verticalAlign: "middle" }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
      </a>
    );
  }

  const lines: React.ReactNode[] = [];
  if (it.value || icons.length) {
    lines.push(
      <div key="name"><span style={{ color: RS_LABEL_COLOR, fontWeight: 600 }}>Allotjament&nbsp;</span><TickCross yes={true} />{it.value && <>&nbsp;<span style={{ color: RS_VALUE_COLOR }}>{it.value}</span></>}{icons}</div>
    );
  }
  const phoneDisplay = formatPhoneDisplay(it.phone);
  if (phoneDisplay) lines.push(<Field key="phone" label="Telèfon" value={phoneDisplay} />);
  if (it.value) {
    const parkingAvailable = it.parkingAvailable !== false;
    lines.push(
      <div key="parking"><span style={{ color: RS_LABEL_COLOR, fontWeight: 600 }}>Pàrquing&nbsp;</span><TickCross yes={parkingAvailable} />{it.parkingPlates && <>&nbsp;<span style={{ color: RS_VALUE_COLOR }}>{it.parkingPlates}</span></>}</div>
    );
  }
  if (it.checkIn) lines.push(<Field key="ci" label="Check-in" value={it.checkIn} />);
  if (it.checkOut) lines.push(<Field key="co" label="Check-out" value={it.checkOut} />);
  if (it.value) {
    const breakfastAvailable = it.breakfastAvailable !== false;
    lines.push(
      <div key="bkf"><span style={{ color: RS_LABEL_COLOR, fontWeight: 600 }}>Esmorzar&nbsp;</span><TickCross yes={breakfastAvailable} />{breakfastAvailable && it.breakfastTime && <>&nbsp;<span style={{ color: RS_VALUE_COLOR }}>{it.breakfastTime}</span></>}</div>
    );
  }
  const filtered = lines.filter(Boolean);
  if (!filtered.length) return null;
  return <div style={{ border: "1px solid oklch(0.88 0.005 258)", borderRadius: 8, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 3 }}>{filtered}</div>;
}

function TecnicLine({ it }: { it: TecnicItem }) {
  const label = (it.label || "").trim().toLowerCase();
  if (label === "pantalla led") return <InclusionLine label={it.label} included={it.included !== false} value={it.value} />;
  if (label === "contra rider") {
    if (!it.value) return null;
    const isApproved = /aprovat/i.test(it.value);
    return (
      <div><span style={{ color: RS_LABEL_COLOR, fontWeight: 600 }}>{it.label}&nbsp;</span><span style={{ color: RS_VALUE_COLOR }}>{it.value}</span>{isApproved && <>&nbsp;<TickCross yes={true} /></>}</div>
    );
  }
  return <Field label={it.label} value={it.value} />;
}

export default function RouteSheetPreviewDoc({ concert }: { concert: Concert }) {
  const rs: RouteSheet = normalizeRouteSheet(concert.routeSheet as RouteSheet | null, concert);
  const complete = rsIsComplete(concert);

  const llocLines = rs.lloc.map((f, i) => <LlocLine key={i} item={f} />);
  const contacts = rs.contacts.filter((ct) => ct.role || ct.name);
  const contactsHtml = contacts.length ? (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 6, rowGap: 8 }}>
      {contacts.map((ct, i) => (
        <>
          <span key={"r" + i} style={{ fontWeight: 600, color: RS_LABEL_COLOR, whiteSpace: "nowrap" }}>{ct.role || "Contacte"}</span>
          <span key={"n" + i} style={{ whiteSpace: "nowrap" }}>
            <span style={{ color: RS_VALUE_COLOR }}>{ct.name}</span>
            {ct.company && <span style={{ color: RS_VALUE_COLOR }}> — {ct.company}</span>}
            {ct.phone && (
              <div style={{ whiteSpace: "nowrap", marginTop: 2 }}>
                <span style={{ color: "oklch(0.55 0.19 290)" }}>{formatPhoneDisplay(ct.phone)}</span>
                {contactActions(ct)}
              </div>
            )}
          </span>
        </>
      ))}
    </div>
  ) : null;

  const hospLines = rs.hospitalitat.map((f, i) => <HotelLine key={i} it={f} />).filter((n) => n !== null);
  const tecLines = rs.tecnic.map((f, i) => <TecnicLine key={i} it={f} />);

  const phases = rs.schedule.filter((ph) => ph.phase && (ph.start || ph.end));

  const cityLen = (concert.city || "").length;
  const citySize = cityLen > 20 ? 18 : cityLen > 16 ? 22 : cityLen > 13 ? 26 : cityLen > 10 ? 30 : cityLen > 7 ? 34 : 38;

  return (
    <div id="rs-doc-print" className="rs-doc" style={{ fontFamily: "Inter,system-ui,sans-serif", color: "oklch(0.2 0.01 258)", background: "oklch(0.995 0.002 258)", padding: "0.6in 0.55in", display: "flex", flexDirection: "column" }}>
      {!complete && (
        <div style={{ margin: "-0.6in -0.55in 16px -0.55in", background: "oklch(0.78 0.15 80 / 0.5)", color: "oklch(0.28 0.06 80)", padding: "14px 0.55in", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22h14"></path><path d="M5 2h14"></path><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"></path><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"></path></svg>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: "0.08em" }}>INACABAT</span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 18, marginBottom: 18, borderBottom: "2px solid oklch(0.2 0.01 258)", gap: 16 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: citySize, textTransform: "uppercase", whiteSpace: "nowrap", flex: "none" }}>{concert.city}</div>
            <div style={{ fontSize: 14, color: "oklch(0.45 0.01 258)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{concert.venue}</div>
          </div>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 19, color: "oklch(0.2 0.01 258)", marginTop: 6 }}>{concert.bandName}</div>
          <div style={{ fontSize: 12, color: "oklch(0.4 0.01 258)", marginTop: 2 }}>{capitalize(formatDateFull(concert.date))}</div>
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: "0.04em", color: "oklch(0.55 0.19 290)" }}>FULL DE RUTA</div>
        </div>
      </div>

      {(llocLines.some(Boolean) || contactsHtml) && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
          {llocLines.some(Boolean) && <Box title="Lloc" flexStyle={{ flex: "4 1 0" }}>{llocLines}</Box>}
          {contactsHtml && <Box title="Contactes" flexStyle={{ flex: "6 1 0" }}>{contactsHtml}</Box>}
        </div>
      )}

      {phases.length > 0 && (
        <div style={{ background: "oklch(0.97 0.004 258)", border: "1px solid oklch(0.88 0.005 258)", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
          <SectionTitle title="Horaris" />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1.5px solid oklch(0.2 0.01 258)" }}>
                <th style={{ textAlign: "left", fontSize: 10.5, fontWeight: 700, color: RS_LABEL_COLOR, textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 0 7px" }}>Fase</th>
                <th style={{ textAlign: "left", fontSize: 10.5, fontWeight: 700, color: RS_LABEL_COLOR, textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 0 7px" }}>Inici</th>
                <th style={{ textAlign: "left", fontSize: 10.5, fontWeight: 700, color: RS_LABEL_COLOR, textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 0 7px" }}>Fi</th>
                <th style={{ textAlign: "left", fontSize: 10.5, fontWeight: 700, color: RS_LABEL_COLOR, textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 0 7px" }}>Durada</th>
              </tr>
            </thead>
            <tbody>
              {phases.map((ph, i) => {
                const isConcert = /concert/i.test(ph.phase);
                const dur = rsFormatDuration(ph.start, ph.end);
                const strong: React.CSSProperties = isConcert ? { fontWeight: 700 } : {};
                const accent: React.CSSProperties = { color: isConcert ? RS_LABEL_COLOR : RS_VALUE_COLOR };
                const plainColor: React.CSSProperties = isConcert ? {} : { color: RS_VALUE_COLOR };
                return (
                  <tr key={i} style={{ borderBottom: "1px solid oklch(0.88 0.005 258)" }}>
                    <td style={{ padding: "9px 0", fontSize: 12.5, ...strong, ...accent }}>{ph.phase}</td>
                    <td style={{ padding: "9px 0", fontSize: 12.5, ...strong, ...plainColor }}>{ph.start}</td>
                    <td style={{ padding: "9px 0", fontSize: 12.5, ...strong, ...plainColor }}>{ph.end}</td>
                    <td style={{ padding: "9px 0", fontSize: 12.5, color: RS_VALUE_COLOR, ...strong }}>{dur}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(hospLines.length > 0 || tecLines.some(Boolean)) && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
          {hospLines.length > 0 && <Box title="Hospitalitat">{hospLines}</Box>}
          {tecLines.some(Boolean) && <Box title="Detalls tècnics">{tecLines}</Box>}
        </div>
      )}

      <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid oklch(0.88 0.005 258)", fontSize: 10, color: "oklch(0.5 0.01 258)", textAlign: "center" }}>
        La Bona Party · {concert.date.split("-")[0]}
      </div>
    </div>
  );
}
