import type { Concert, Band } from "@/lib/types";
import { normalizeRouteSheet, type RouteSheet, formatPhoneDisplay, rsFormatDuration, llocItemMapsHref, RS_LLOC_ICONS } from "@/lib/route-sheet";
import DiaQuiVeCard from "@/components/DiaQuiVeCard";

// Cos de la vista "dia de bolo" (bombolles de mapa, horaris, contactes, qui
// ve i allotjament/hospitalitat) — separat de la pàgina de gestor
// perquè es pugui incrustar tal qual a sota del pòster de la pàgina
// pública de confirmació (/conf/[token]): en compartir per WhatsApp des
// del botó de compartir, qui rep l'enllaç veu la mateixa informació del
// dia, no només un formulari d'assistència. "editable" activa el llapis
// de "Qui ve" (només a la vista de gestor — mai a la pàgina pública).
export default function DiaBody({ concert: c, band, editable = false }: { concert: Concert; band: Band | null; editable?: boolean }) {
  const rs = normalizeRouteSheet(c.routeSheet as RouteSheet | null, c);

  // L'adreça és el mateix camp que "Informació general" (mai un text lliure
  // propi del full de ruta) — es fa servir sempre la del concert.
  const address = c.address || "";
  const mapsQuery = encodeURIComponent([c.venue, address, c.city].filter(Boolean).join(", "));
  const descarregaHref = llocItemMapsHref(rs.lloc.find((l) => l.label.trim().toLowerCase() === "descàrrega"));
  const parkingHref = llocItemMapsHref(rs.lloc.find((l) => l.label.trim().toLowerCase() === "parking"));

  // Allotjament té la seva pròpia targeta amb tots els detalls (telèfon,
  // check-in/out, pàrquing, esmorzar) — la resta d'hospitalitat es queda a
  // la targeta genèrica de sota, com fins ara.
  const hotel = rs.hospitalitat.find((h) => h.label.trim().toLowerCase() === "allotjament");
  const hotelIncluded = !!hotel && hotel.included !== false && !!hotel.value.trim();
  const hotelDigits = hotel?.phone ? hotel.phone.replace(/[^\d+]/g, "") : "";
  const hotelIntl = hotelDigits ? (hotelDigits.indexOf("+") === 0 ? hotelDigits.slice(1) : "34" + hotelDigits) : "";
  const otherHosp = rs.hospitalitat.filter((h) => h.label.trim().toLowerCase() !== "allotjament" && h.value.trim());

  return (
    <>
      <div className="dia-map-bubbles">
        <a className="dia-map-bubble" href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noreferrer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span>Recinte</span>
        </a>
        {descarregaHref && (
          <a className="dia-map-bubble" href={descarregaHref} target="_blank" rel="noreferrer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: RS_LLOC_ICONS["descàrrega"] }} />
            <span>Descàrrega</span>
          </a>
        )}
        {parkingHref && (
          <a className="dia-map-bubble" href={parkingHref} target="_blank" rel="noreferrer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: RS_LLOC_ICONS["parking"] }} />
            <span>Pàrquing</span>
          </a>
        )}
      </div>

      {/* Horaris */}
      <div className="dia-card">
        <div className="dia-card-title">Horaris</div>
        {rs.schedule.filter((p) => p.start).length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Sense horaris al full de ruta{c.time ? ` — concert a les ${c.time}h` : ""}.</div>
        ) : (
          rs.schedule.filter((p) => p.start).map((p, i) => (
            <div key={i} className="dia-sched-row">
              <span className="dia-sched-time">{p.start}{p.end ? ` – ${p.end}` : ""}</span>
              <span>{p.phase}</span>
              <span className="t-dim" style={{ marginLeft: "auto", fontSize: 11.5 }}>{rsFormatDuration(p.start, p.end)}</span>
            </div>
          ))
        )}
      </div>

      {/* Contactes */}
      <div className="dia-card">
        <div className="dia-card-title">Contactes</div>
        {rs.contacts.filter((ct) => ct.name.trim()).length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Cap contacte al full de ruta.</div>
        ) : (
          rs.contacts.filter((ct) => ct.name.trim()).map((ct, i) => {
            const digits = ct.phone ? ct.phone.replace(/[^\d+]/g, "") : "";
            const intl = digits ? (digits.indexOf("+") === 0 ? digits.slice(1) : "34" + digits) : "";
            return (
              <div key={i} className="dia-contact-row">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{ct.name}</div>
                  <div className="t-dim" style={{ fontSize: 12 }}>{[ct.role, ct.company].filter(Boolean).join(" · ")}</div>
                </div>
                {ct.phone && (
                  <div className="dia-contact-btns">
                    <span className="t-dim" style={{ fontSize: 12.5 }}>{formatPhoneDisplay(ct.phone)}</span>
                    <a className="dia-call" title="Truca" href={`tel:${digits}`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    </a>
                    <a className="dia-whatsapp" title="WhatsApp" href={`https://wa.me/${intl}`} target="_blank" rel="noreferrer">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    </a>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Formació */}
      <DiaQuiVeCard key={c.id} concert={c} band={band} editable={editable} />

      {/* Hospitalitat ràpida */}
      {otherHosp.length > 0 && (
        <div className="dia-card">
          <div className="dia-card-title">Hospitalitat</div>
          {otherHosp.map((h, i) => (
            <div key={i} className="dia-sched-row"><span style={{ fontWeight: 600 }}>{h.label}</span><span className="t-dim">{h.value}</span></div>
          ))}
        </div>
      )}

      {/* Allotjament, amb tots els detalls */}
      {hotelIncluded && hotel && (
        <div className="dia-card">
          <div className="dia-card-title">Allotjament</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {hotel.location ? (
              <a href={hotel.location} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{hotel.value}</a>
            ) : hotel.value}
          </div>
          {hotel.phone && (
            <div className="dia-contact-btns" style={{ marginTop: 6 }}>
              <span className="t-dim" style={{ fontSize: 12.5 }}>{formatPhoneDisplay(hotel.phone)}</span>
              <a className="dia-call" title="Truca" href={`tel:${hotelDigits}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              </a>
              <a className="dia-whatsapp" title="WhatsApp" href={`https://wa.me/${hotelIntl}`} target="_blank" rel="noreferrer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              </a>
            </div>
          )}
          {(hotel.checkIn || hotel.checkOut) && (
            <div className="dia-sched-row"><span style={{ fontWeight: 600 }}>Check-in / Check-out</span><span className="t-dim">{hotel.checkIn || "—"} / {hotel.checkOut || "—"}</span></div>
          )}
          {hotel.parkingAvailable !== undefined && (
            <div className="dia-sched-row"><span style={{ fontWeight: 600 }}>Pàrquing</span><span className="t-dim">{hotel.parkingAvailable ? (hotel.parkingPlates || "Sí") : "No"}</span></div>
          )}
          {hotel.breakfastAvailable !== undefined && (
            <div className="dia-sched-row"><span style={{ fontWeight: 600 }}>Esmorzar</span><span className="t-dim">{hotel.breakfastAvailable ? (hotel.breakfastTime || "Sí") : "No"}</span></div>
          )}
        </div>
      )}
    </>
  );
}
