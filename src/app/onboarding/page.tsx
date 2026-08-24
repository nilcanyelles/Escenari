import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getProfile } from "@/lib/current-user";
import OnboardingFlow from "./OnboardingFlow";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const profile = await getProfile();
  if (profile) redirect(profile.role === "artist" ? "/artista" : "/resum");

  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const defaultName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "";

  return (
    <div className="onboarding-screen">
      <div className="login-glow"></div>
      <img className="login-bg-logo" src="/logo-escenari.png" alt="" />
      <OnboardingFlow defaultName={defaultName} />
    </div>
  );
}
