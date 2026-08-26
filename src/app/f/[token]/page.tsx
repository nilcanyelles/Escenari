import { db } from "@/lib/db";
import { normalizeRouteSheet, type RouteSheet } from "@/lib/route-sheet";
import PublicShareForm from "@/components/PublicShareForm";

export const dynamic = "force-dynamic";

function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

// Formulari públic (sense sessió) per omplir la informació o el full de ruta
// d'un concert a través d'un enllaç caducable.
export default async function PublicSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = (await db().query("select * from share_links where id=$1", [token])).rows[0];

  let state: "ok" | "caducat" | "revocat" | "inexistent" = "ok";
  if (!link) state = "inexistent";
  else if (link.revoked) state = "revocat";
  else if (new Date(link.expires_at).getTime() < Date.now()) state = "caducat";

  if (state !== "ok") {
    return (
      <div className="pf-screen">
        <div className="pf-dead">
          <div className="pf-brand">ESCENARI</div>
          <div className="pf-dead-icon">🔒</div>
          <h1>Aquest enllaç ja no és actiu</h1>
          <p>
            {state === "caducat"
              ? "L'enllaç ha caducat. Demana'n un de nou a qui te l'ha enviat."
              : state === "revocat"
                ? "L'enllaç s'ha revocat. Demana'n un de nou a qui te l'ha enviat."
                : "Aquest enllaç no existeix."}
          </p>
        </div>
      </div>
    );
  }

  const c = (await db().query("select * from concerts where id=$1 and workspace_id=$2", [link.concert_id, link.workspace_id])).rows[0];
  if (!c) {
    return (
      <div className="pf-screen">
        <div className="pf-dead">
          <div className="pf-brand">ESCENARI</div>
          <h1>Aquest concert ja no existeix</h1>
        </div>
      </div>
    );
  }

  await db().query("update share_links set last_opened_at=now() where id=$1", [token]);

  const concert = {
    id: c.id,
    date: toDateStr(c.date),
    time: c.time,
    venue: c.venue,
    city: c.city,
    festaEntitat: c.festa_entitat,
    bandName: c.band_name,
  };
  const routeSheet = normalizeRouteSheet(c.route_sheet as RouteSheet | null, { venue: c.venue, time: c.time });

  return (
    <PublicShareForm
      token={token}
      scope={link.scope}
      recipientName={link.recipient_name || ""}
      alreadySubmitted={!!link.submitted_at}
      concert={concert}
      routeSheet={routeSheet}
    />
  );
}
