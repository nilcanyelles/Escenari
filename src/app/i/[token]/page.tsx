import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/current-user";
import { bandPhotoDataUri } from "@/lib/tags";
import ClaimBandView from "./ClaimBandView";

export const dynamic = "force-dynamic";

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="onboarding-screen">
      <div className="login-glow"></div>
      <img className="login-bg-logo" src="/logo-escenari.png" alt="" />
      <div className="onboarding-card">{children}</div>
    </div>
  );
}

// Enllaç per reclamar el perfil d'un membre d'un grup (/i/token): el músic
// (o tècnic) entra, crea el perfil si cal, i queda vinculat al membre que
// el gestor va crear al grup.
export default async function ClaimBandPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = (await db().query(
    `select i.id, i.name, i.status, i.as_crew, i.role_label, b.id as band_id, b.name as band_name, b.logo, b.color1
     from invitations i join bands b on b.id = i.band_id where i.token=$1`,
    [token]
  )).rows[0];
  if (!inv) {
    return <Screen><h1 className="onboarding-title">Aquest enllaç no és vàlid</h1><p className="onboarding-sub">Demana al gestor del grup que te&apos;n generi un de nou.</p></Screen>;
  }
  const logo = inv.logo || bandPhotoDataUri({ id: inv.band_id, name: inv.band_name });
  const back = `/i/${token}`;

  const { userId } = await auth();
  if (!userId) {
    return (
      <Screen>
        <div className="join-head">
          <img className="join-logo" src={logo} alt="" />
          <div>
            <div className="pf-brand" style={{ margin: 0 }}>ESCENARI</div>
            <h1 className="onboarding-title" style={{ marginTop: 6 }}>{inv.band_name} et convida</h1>
          </div>
        </div>
        <p className="onboarding-sub">
          {inv.name ? `Hi ha un perfil de "${inv.name}" esperant-te` : "T'han convidat"} a {inv.band_name}{inv.as_crew ? ` (equip tècnic${inv.role_label ? ": " + inv.role_label : ""})` : ""}.
          Entra o crea un compte de músic i el reclamaràs amb un clic.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn-primary" style={{ textDecoration: "none", width: "auto" }} href={`/sign-up?redirect_url=${encodeURIComponent(back)}`}>Crea un compte</Link>
          <Link className="btn-outline" style={{ textDecoration: "none" }} href={`/sign-in?redirect_url=${encodeURIComponent(back)}`}>Ja tinc compte</Link>
        </div>
      </Screen>
    );
  }

  const profile = await getProfile();
  // Sense perfil: primer l'alta com a artista, i torna aquí.
  if (!profile) redirect(`/onboarding?next=${encodeURIComponent(back)}`);
  if (profile.role !== "artist") {
    return (
      <Screen>
        <h1 className="onboarding-title">Aquest enllaç és per a músics</h1>
        <p className="onboarding-sub">El teu compte és de gestor. Per reclamar un perfil de músic, entra amb un altre compte.</p>
        <Link className="btn-outline" style={{ textDecoration: "none" }} href="/resum">Torna a l&apos;app</Link>
      </Screen>
    );
  }

  return (
    <Screen>
      <ClaimBandView token={token} bandName={inv.band_name} logo={logo} memberName={inv.name || ""} asCrew={!!inv.as_crew} roleLabel={inv.role_label || ""} used={inv.status !== "pendent"} />
    </Screen>
  );
}
