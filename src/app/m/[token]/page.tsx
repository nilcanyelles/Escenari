import { db } from "@/lib/db";
import { normalizeRiderContent } from "@/lib/material-types";
import MaterialDoc from "@/components/MaterialDoc";

export const dynamic = "force-dynamic";

// Vista pública (i imprimible en PDF) d'un rider o una setlist, via token.
export default async function PublicMaterialPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const pool = db();

  const riderRow = (await pool.query(
    `select r.*, b.name as band_name, b.logo, b.color1, b.city, b.contact, b.phone, b.members
     from riders r join bands b on b.id = r.band_id where r.public_token=$1`,
    [token]
  )).rows[0];

  if (riderRow) {
    return (
      <MaterialDoc
        kind="rider"
        name={riderRow.name}
        band={{ name: riderRow.band_name, logo: riderRow.logo || "", color1: riderRow.color1 || "", city: riderRow.city || "", contact: riderRow.contact || "", phone: riderRow.phone || "", members: riderRow.members || [] }}
        rider={normalizeRiderContent(riderRow.content)}
        songs={[]}
        token={token}
      />
    );
  }

  const setlistRow = (await pool.query(
    `select s.*, b.name as band_name, b.logo, b.color1, b.city, b.contact, b.phone, b.members
     from setlists s join bands b on b.id = s.band_id where s.public_token=$1`,
    [token]
  )).rows[0];

  if (setlistRow) {
    return (
      <MaterialDoc
        kind="setlist"
        name={setlistRow.name}
        band={{ name: setlistRow.band_name, logo: setlistRow.logo || "", color1: setlistRow.color1 || "", city: setlistRow.city || "", contact: setlistRow.contact || "", phone: setlistRow.phone || "", members: setlistRow.members || [] }}
        rider={null}
        songs={setlistRow.songs || []}
      />
    );
  }

  return (
    <div className="pf-screen">
      <div className="pf-dead">
        <div className="pf-brand">ESCENARI</div>
        <div className="pf-dead-icon">🔒</div>
        <h1>Aquest document no existeix</h1>
        <p>L&apos;enllaç no és vàlid o el document s&apos;ha eliminat.</p>
      </div>
    </div>
  );
}
