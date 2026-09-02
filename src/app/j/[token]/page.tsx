import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getAgencyInvitation } from "@/lib/agency";
import { getProfile } from "@/lib/current-user";
import JoinAgencyView from "./JoinAgencyView";

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

// Enllaç d'invitació a una agència: qui hi entra (amb sessió) queda dins
// de l'agència com a gestor, amb els permisos que li han marcat.
export default async function JoinAgencyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await getAgencyInvitation(token);
  if (!inv) {
    return <Screen><h1 className="onboarding-title">Aquest enllaç no és vàlid</h1><p className="onboarding-sub">Demana a l&apos;agència que te&apos;n generi un de nou.</p></Screen>;
  }

  const { userId } = await auth();
  const back = `/j/${token}`;
  if (!userId) {
    return (
      <Screen>
        <div className="join-head">
          {inv.workspaceLogo && <img className="join-logo" src={inv.workspaceLogo} alt="" />}
          <div>
            <div className="pf-brand" style={{ margin: 0 }}>ESCENARI</div>
            <h1 className="onboarding-title" style={{ marginTop: 6 }}>{inv.workspaceName || "Una agència"} et convida</h1>
          </div>
        </div>
        <p className="onboarding-sub">
          {inv.invitedBy ? `${inv.invitedBy} t'ha convidat` : "T'han convidat"} a gestionar els grups de {inv.workspaceName || "l'agència"} des d&apos;Escenari{inv.roleLabel ? ` com a ${inv.roleLabel}` : ""}.
          Entra o crea un compte i quedaràs dins de l&apos;agència directament.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn-primary" style={{ textDecoration: "none", width: "auto" }} href={`/sign-up?redirect_url=${encodeURIComponent(back)}`}>Crea un compte</Link>
          <Link className="btn-outline" style={{ textDecoration: "none" }} href={`/sign-in?redirect_url=${encodeURIComponent(back)}`}>Ja tinc compte</Link>
        </div>
      </Screen>
    );
  }

  const profile = await getProfile();
  if (profile && profile.role === "manager" && profile.workspaceId === inv.workspaceId) {
    return (
      <Screen>
        <h1 className="onboarding-title">Ja formes part de {inv.workspaceName}</h1>
        <Link className="btn-primary" style={{ textDecoration: "none", width: "auto" }} href="/resum">Entra a Escenari</Link>
      </Screen>
    );
  }
  if (profile) {
    return (
      <Screen>
        <h1 className="onboarding-title">Aquest compte ja està en ús</h1>
        <p className="onboarding-sub">
          {profile.role === "artist"
            ? "Aquest compte és de músic. Per entrar a l'agència, tanca la sessió i entra amb un altre compte (o un altre correu)."
            : "Aquest compte ja pertany a una altra agència."}
        </p>
        <Link className="btn-outline" style={{ textDecoration: "none" }} href={profile.role === "artist" ? "/artista" : "/resum"}>Torna a l&apos;app</Link>
      </Screen>
    );
  }

  const user = await currentUser();
  const defaultName = inv.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "";
  return (
    <Screen>
      <JoinAgencyView token={token} workspaceName={inv.workspaceName} workspaceLogo={inv.workspaceLogo} invitedBy={inv.invitedBy} defaultName={defaultName} defaultRole={inv.roleLabel} />
    </Screen>
  );
}
