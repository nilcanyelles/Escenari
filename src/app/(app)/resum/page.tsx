import { redirect } from "next/navigation";
import { requireManager } from "@/lib/current-user";
import { getBands } from "@/lib/data";

export const dynamic = "force-dynamic";

// Pàgina d'entrada del gestor: amb un sol grup, la seva fitxa; amb més d'un,
// l'agenda de tots els grups.
export default async function ResumPage() {
  const { workspaceId } = await requireManager();
  const bands = await getBands(workspaceId);
  redirect(bands.length === 1 ? "/grup" : "/agenda");
}
