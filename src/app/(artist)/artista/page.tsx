import { requireArtist } from "@/lib/current-user";
import { getArtistGigs, getFeedToken } from "@/lib/artist-data";
import { today, MONTH_ABBR, statusColors, formatCurrency } from "@/lib/format";
import { bandPhotoDataUri } from "@/lib/tags";
import Link from "next/link";
import AttendanceButtons from "./AttendanceButtons";
import FeedSubscribe from "./FeedSubscribe";
import MyProfileButton from "./MyProfileButton";

export const dynamic = "force-dynamic";

export default async function ArtistHomePage() {
  const profile = await requireArtist();
  const [gigs, feedToken] = await Promise.all([getArtistGigs(profile.clerkUserId), getFeedToken(profile.clerkUserId)]);
  const todayStr = today();
  const upcoming = gigs.filter((g) => g.date >= todayStr);
  const past = gigs.filter((g) => g.date < todayStr).reverse().slice(0, 8);

  function GigCard({ gig, editable }: { gig: (typeof gigs)[number]; editable: boolean }) {
    const [, m, d] = gig.date.split("-");
    const sc = statusColors(gig.status);
    const bandColor = gig.color1 || "#8b7bff";
    const logo = gig.bandLogo || bandPhotoDataUri({ id: gig.bandId, name: gig.bandName });
    return (
      <div className="artist-gig-card">
        <div className="artist-gig-date">
          <div className="d">{parseInt(d, 10)}</div>
          <div className="m">{MONTH_ABBR[parseInt(m, 10) - 1]}</div>
        </div>
        <div className="artist-gig-main">
          <div className="artist-gig-title">{gig.venue || "Sala per determinar"}{gig.city ? ` · ${gig.city}` : ""}</div>
          <div className="artist-gig-meta">
            {gig.time} h{gig.festaEntitat ? ` · ${gig.festaEntitat}` : ""} ·{" "}
            <span style={{ color: sc.color }}>{gig.status}</span>
            {gig.amount !== null && <> · <span style={{ color: "oklch(0.78 0.15 155)" }}>{formatCurrency(gig.amount)}</span></>}
          </div>
        </div>
        <span className="artist-gig-band" style={{ background: `${bandColor}26`, color: bandColor }}>
          <img src={logo} alt="" />
          {gig.bandName}
        </span>
        {editable && (
          <AttendanceButtons
            concertId={gig.id}
            current={gig.myAttendance}
            currentSubstitute={gig.mySubstitute}
            searchPublished={gig.myNoSubstitute}
            backups={gig.bandBackups}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div className="artist-section-title">Pròxims bolos</div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <MyProfileButton />
          {feedToken && <FeedSubscribe token={feedToken} />}
        </div>
      </div>
      {upcoming.length === 0 ? (
        <div className="artist-empty">
          Encara no tens cap bolo a la vista.{" "}
          <Link href="/els-meus-grups">Uneix-te a un grup</Link> per veure els seus concerts aquí.
        </div>
      ) : (
        <div className="artist-gig-list">
          {upcoming.map((gig) => <GigCard key={gig.id} gig={gig} editable={true} />)}
        </div>
      )}

      {past.length > 0 && (
        <>
          <div className="artist-section-title">Bolos passats</div>
          <div className="artist-gig-list" style={{ opacity: 0.7 }}>
            {past.map((gig) => <GigCard key={gig.id} gig={gig} editable={false} />)}
          </div>
        </>
      )}
    </div>
  );
}
