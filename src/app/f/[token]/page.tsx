import { db } from "@/lib/db";
import { assemblePublicShareData } from "@/lib/public-share-data";
import PublicShareForm from "@/components/PublicShareForm";
import ShareLinkGate from "@/components/ShareLinkGate";

export const dynamic = "force-dynamic";

// Formulari públic (sense sessió) per omplir la informació o el full de ruta
// d'un concert a través d'un enllaç caducable — si l'enllaç té un codi
// d'accés, primer cal passar per la pantalla d'avís (ShareLinkGate).
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
          <div className="pf-brand"><img className="pf-logo" src="/logo-escenari.png" alt="Escenari" /></div>
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

  // Sense codi d'accés: comportament d'abans, el formulari s'obre
  // directament amb l'enllaç sol.
  if (!link.access_code) {
    const data = await assemblePublicShareData(link);
    if (!data) {
      return (
        <div className="pf-screen">
          <div className="pf-dead">
            <div className="pf-brand"><img className="pf-logo" src="/logo-escenari.png" alt="Escenari" /></div>
            <h1>Aquest concert ja no existeix</h1>
          </div>
        </div>
      );
    }
    return <PublicShareForm token={token} {...data} />;
  }

  const codeExpired = !link.code_expires_at || new Date(link.code_expires_at).getTime() < Date.now();
  const ws = (await db().query("select name, logo from workspaces where id=$1", [link.workspace_id])).rows[0];
  return <ShareLinkGate token={token} codeExpired={codeExpired} agency={ws ? { name: ws.name || "", logo: ws.logo || "" } : null} />;
}
