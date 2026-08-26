import { auth } from "@clerk/nextjs/server";
import StageLanding from "@/components/StageLanding";

export const dynamic = "force-dynamic";

// Landing "escenari": una sola pantalla sense scroll, amb el focus de llum
// WebGL com a protagonista i pestanyes per a funcionalitats i contacte.
export default async function LandingPage() {
  const { userId } = await auth();
  return <StageLanding signedIn={!!userId} />;
}
