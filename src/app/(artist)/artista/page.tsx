import { redirect } from "next/navigation";

// L'entrada de l'àrea d'artista aterra al perfil (la primera pàgina).
export default function ArtistHomePage() {
  redirect("/artista/perfil");
}
