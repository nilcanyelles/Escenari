import { redirect } from "next/navigation";

// Resum i Calendari s'han fusionat a l'Agenda.
export default function CalendariPage() {
  redirect("/agenda");
}
