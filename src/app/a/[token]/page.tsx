import { db } from "@/lib/db";
import { normalizeRiderContent } from "@/lib/material-types";
import ApprovalView from "./ApprovalView";

export const dynamic = "force-dynamic";

function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

// Pàgina pública d'aprovació d'un rider: la persona externa el revisa,
// l'aprova o hi proposa canvis (contrarider).
export default async function ApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = (await db().query(
    `select ap.*, c.date, c.city, c.venue, c.band_name, b.id as band_id, b.name as real_band_name,
            r.name as rider_name, r.content as rider_content, r.public_token
     from rider_approvals ap
     join concerts c on c.id = ap.concert_id
     join riders r on r.id = ap.rider_id
     join bands b on b.id = r.band_id
     where ap.id=$1`,
    [token]
  )).rows[0];

  if (!row) {
    return (
      <div className="pf-screen">
        <div className="pf-dead">
          <div className="pf-brand">ESCENARI</div>
          <div className="pf-dead-icon">🔒</div>
          <h1>Aquest enllaç no és vàlid</h1>
          <p>Demana un enllaç nou a qui te l&apos;ha enviat.</p>
        </div>
      </div>
    );
  }

  return (
    <ApprovalView
      token={token}
      status={row.status}
      recipientName={row.recipient_name || ""}
      counterNote={row.counter_note || ""}
      bandId={row.band_id}
      bandName={row.real_band_name}
      riderName={row.rider_name}
      publicToken={row.public_token}
      concert={{ date: toDateStr(row.date), city: row.city, venue: row.venue }}
      content={normalizeRiderContent(row.status !== "pendent" && row.counter_content ? row.counter_content : row.rider_content)}
    />
  );
}
