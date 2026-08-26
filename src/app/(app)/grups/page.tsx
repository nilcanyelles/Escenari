import { redirect } from "next/navigation";

// La pàgina de grups ara viu a /grup (fitxa del grup seleccionat o graella).
export default function GrupsPage() {
  redirect("/grup");
}
