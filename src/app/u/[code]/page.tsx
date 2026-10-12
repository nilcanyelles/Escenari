import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/current-user";
import { bandPhotoDataUri } from "@/lib/tags";
import SwitchToArtistBridge from "./SwitchToArtistBridge";

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

// Enllaç d'invitació pel codi d'un grup (compartit per WhatsApp des de la
// pestanya Equip): si qui el clica ja té compte, el porta a "Els meus
// grups" amb el codi ja introduït (com si l'hagués escrit a mà); si no en
// té, primer li fa crear el perfil i torna aquí després.
export default async function JoinByLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cleaned = (code || "").trim().toUpperCase();
  const band = (await db().query(
    "select id, name, logo, color1 from bands where upper(join_code)=$1 and join_code_active",
    [cleaned]
  )).rows[0];
  if (!band) {
    return <Screen><h1 className="onboarding-title">Aquest enllaç no és vàlid</h1><p className="onboarding-sub">Demana al gestor del grup que te&apos;n generi un de nou.</p></Screen>;
  }
  const logo = band.logo || bandPhotoDataUri({ id: band.id, name: band.name });
  const back = `/u/${cleaned}`;

  const { userId } = await auth();
  if (!userId) {
    return (
      <Screen>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <img className="join-logo" style={{ width: 72, height: 72, marginBottom: 16 }} src={logo} alt="" />
          <div className="pf-brand" style={{ margin: 0 }}>ESCENARI</div>
          <h1 className="onboarding-title" style={{ marginTop: 6 }}>T&apos;han convidat al grup {band.name}</h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 20 }}>
            <Link className="btn-primary" style={{ textDecoration: "none", width: "auto" }} href={`/sign-up?redirect_url=${encodeURIComponent(back)}`}>Crea el teu perfil</Link>
            <Link className="btn-outline" style={{ textDecoration: "none" }} href={`/sign-in?redirect_url=${encodeURIComponent(back)}`}>Ja tinc compte</Link>
          </div>
        </div>
      </Screen>
    );
  }

  const profile = await getProfile();
  // Sense perfil encara: primer l'alta com a artista, i torna aquí.
  if (!profile) redirect(`/onboarding?next=${encodeURIComponent(back)}`);
  const target = `/els-meus-grups?code=${encodeURIComponent(cleaned)}`;
  if (profile.role !== "artist") {
    // Tot gestor pot tenir també el seu compte de músic (botó "Vista de
    // músic" del perfil) — entrant per un enllaç d'invitació hi canvia
    // automàticament, sense cap pantalla de bloqueig pel mig.
    return (
      <Screen>
        <SwitchToArtistBridge next={`${target}&switched=artist`} />
      </Screen>
    );
  }

  // Compte d'artista ja fet: mateixa pàgina que si hagués escrit el codi a
  // mà a "Els meus grups", amb el codi ja introduït.
  redirect(target);
}
