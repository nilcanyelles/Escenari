import ContactesView from "@/components/ContactesView";
import { getContacts } from "@/lib/data";
import { requireManager } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function ContactesPage() {
  const { workspaceId } = await requireManager();
  const contacts = await getContacts(workspaceId);
  return <ContactesView contacts={contacts} />;
}
