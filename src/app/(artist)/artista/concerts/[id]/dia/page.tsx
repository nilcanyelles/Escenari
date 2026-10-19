import { notFound } from "next/navigation";
import BackLink from "@/components/BackLink";
import { requireArtist } from "@/lib/current-user";
import { requireConcertAccess } from "@/lib/band-access";
import { getBands, getConcerts } from "@/lib/data";
import { formatDateFull, formatConcertTime, capitalize } from "@/lib/format";
import DiaTopActions from "@/components/DiaTopActions";
import DiaBody from "@/components/DiaBody";
import { getLinkedMembers } from "@/lib/group-data";
import { getFormations } from "@/lib/formation-data";
import { mapsHrefFor } from "@/lib/nav-app";

export const dynamic = "force-dynamic";

// Bessona de la vista "dia de bolo" del gestor, per a qualsevol músic del
// grup convocat a aquest concert — mateix cos (DiaBody); només un Admin del
// grup hi pot editar l'assistència (la resta la veu de només lectura).
export default async function ArtistDiaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireArtist();
  const access = await requireConcertAccess(id);
  const { workspaceId } = access;
  const editable = access.isManager || access.perms.admin;
  const [bands, concerts] = await Promise.all([getBands(workspaceId), getConcerts(workspaceId)]);
  const c = concerts.find((x) => x.id === id);
  if (!c) notFound();
  const band = bands.find((b) => b.id === c.bandId);
  const [linkedMembers, formations] = await Promise.all([
    band ? getLinkedMembers(band.id) : Promise.resolve([]),
    band ? getFormations(band.id) : Promise.resolve([]),
  ]);
  const linkedNames = linkedMembers.map((m) => m.memberName);
  const mapsQuery = [c.venue, c.address, c.city].filter(Boolean).join(", ");
  const navApp = profile.navApp;

  return (
    <div className="dia">
      <div className="dia-top">
        <BackLink href={`/artista/concerts/${id}`}>Concert</BackLink>
        <div className="dia-top-right">
          <span className="t-dim" style={{ fontSize: 12 }}>{c.bandName}</span>
          <DiaTopActions concert={c} band={band || null} base="/artista" />
        </div>
      </div>

      <div className="cd-poster">
        <div className="cd-poster-glow" aria-hidden="true"></div>
        <div className="cd-poster-kicker">{c.bandName}</div>
        <div className="cd-poster-subtitle">{c.festaEntitat || (c.kind && c.kind !== "bolo" ? (c.kind === "reunio" ? "reunió" : c.kind) : "concert")}</div>
        {c.city && <div className="cd-poster-title">{c.city.split(",")[0]}</div>}
        {c.venue && (
          <a className="cd-poster-place" href={mapsHrefFor(navApp, mapsQuery)} target="_blank" rel="noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            {c.venue}
          </a>
        )}
        <div className="cd-poster-date">{capitalize(formatDateFull(c.date))}{c.exactTime ? ` — ${c.exactTime}` : c.time ? ` — ${formatConcertTime(c.time)}` : ""}</div>
      </div>

      <DiaBody concert={c} band={band || null} editable={editable} linkedNames={linkedNames} navApp={navApp} formations={formations} />
    </div>
  );
}
