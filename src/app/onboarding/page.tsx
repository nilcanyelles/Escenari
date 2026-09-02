import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getProfile } from "@/lib/current-user";
import OnboardingFlow from "./OnboardingFlow";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const nextRaw = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  // Només rutes internes (p. ex. /i/token, per reclamar un grup un cop creat el perfil).
  const next = nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : undefined;

  const profile = await getProfile();
  if (profile) redirect(next || (profile.role === "artist" ? "/artista" : "/resum"));

  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const defaultName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "";

  return (
    <div className="onboarding-screen">
      <div className="login-glow"></div>
      <img className="login-bg-logo" src="/logo-escenari.png" alt="" />
      <OnboardingFlow defaultName={defaultName} next={next} />
    </div>
  );
}
