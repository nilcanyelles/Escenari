import ContactesView from "@/components/ContactesView";
import { getContacts } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ContactesPage() {
  const contacts = await getContacts();
  return <ContactesView contacts={contacts} />;
}
