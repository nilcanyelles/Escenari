import { redirect } from "next/navigation";
import { getProfile } from "@/lib/current-user";
import ChooseUsernameForm from "./ChooseUsernameForm";

export const dynamic = "force-dynamic";

// Pantalla de pas per a comptes creats abans que el nom d'usuari (@...)
// existís: requireManager/requireArtist hi redirigeixen qui encara no en
// té, i no deixa continuar fins que en tria un de disponible.
export default async function ChooseUsernamePage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");
  if (profile.username) redirect(profile.role === "artist" ? "/artista" : "/resum");

  return (
    <div className="onboarding-screen">
      <div className="login-glow"></div>
      <img className="login-bg-logo" src="/logo-escenari.png" alt="" />
      <ChooseUsernameForm name={profile.name} role={profile.role} />
    </div>
  );
}
