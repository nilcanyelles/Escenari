import { requireArtist } from "@/lib/current-user";
import { getPracticeData } from "@/lib/practice";
import { today } from "@/lib/format";
import PracticeView from "./PracticeView";

export const dynamic = "force-dynamic";

export default async function PracticaPage() {
  const profile = await requireArtist();
  const { goals, entries } = await getPracticeData(profile.clerkUserId);
  return <PracticeView goals={goals} entries={entries} today={today()} />;
}
