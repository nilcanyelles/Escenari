import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/current-user";
import { bandPhotoDataUri } from "@/lib/tags";
import { formatDateFull, capitalize, formatConcertTime } from "@/lib/format";
import SubstituteApplyView from "./SubstituteApplyView";

export const dynamic = "force-dynamic";

function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="onboarding-screen">
      <div className="login-glow"></div>
      <img className="login-bg-logo" src="/logo-escenari.png" alt="" />
      <div className="onboarding-card">{children}</div>
    </div>
  );
}

// Enllaç per a un suplent proposat (/s/token): el membre que no pot venir
// l'hi envia; el suplent hi entra o es crea el compte, omple nom i
// instruments, i es presenta a la cerca — el gestor l'accepta o la rebutja
// des de la fitxa del concert.
export default async function SubstituteLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const req = (await db().query(
    `select br.id, br.status, br.member_name, br.instruments, br.role, br.proposed_by,
            c.id as concert_id, c.date, c.time, c.exact_time, c.city, c.venue, c.festa_entitat, c.kind,
            b.id as band_id, b.name as band_name, b.logo, b.color1
     from backup_requests br
     join concerts c on c.id = br.concert_id
     join bands b on b.id = br.band_id
     where br.token=$1`,
    [token]
  )).rows[0];
  if (!req) {
    return <Screen><h1 className="onboarding-title">Aquest enllaç no és vàlid</h1><p className="onboarding-sub">Demana a qui te l&apos;ha enviat que te&apos;n generi un de nou.</p></Screen>;
  }

  const logo = req.logo || bandPhotoDataUri({ id: req.band_id, name: req.band_name });
  const date = toDateStr(req.date);
  const when = `${capitalize(formatDateFull(date))}${req.exact_time ? ` — ${req.exact_time}` : req.time ? ` — ${formatConcertTime(req.time)}` : ""}`;
  const where = [req.festa_entitat, req.venue, req.city ? String(req.city).split(",")[0] : ""].filter(Boolean).join(" · ");
  const needs: string[] = req.role ? [req.role] : (req.instruments || []);
  const back = `/s/${token}`;
  const head = (
    <div className="join-head">
      <img className="join-logo" src={logo} alt="" />
      <div>
        <div className="pf-brand" style={{ margin: 0 }}>ESCENARI</div>
        <h1 className="onboarding-title" style={{ marginTop: 6 }}>{req.band_name} busca suplent</h1>
      </div>
    </div>
  );
  const eventBox = (
    <div className="sub-event">
      <div className="sub-event-when">{when}</div>
      {where && <div className="sub-event-where">{where}</div>}
      <div className="sub-event-who">
        Substituint <strong>{req.member_name}</strong>{needs.length ? ` · ${needs.join(", ")}` : ""}
        {req.proposed_by ? ` · proposat per ${req.proposed_by}` : ""}
      </div>
    </div>
  );

  if (req.status !== "oberta") {
    return <Screen>{head}{eventBox}<p className="onboarding-sub" style={{ marginTop: 16 }}>Aquesta cerca de suplent ja està tancada.</p></Screen>;
  }

  const { userId } = await auth();
  if (!userId) {
    return (
      <Screen>
        {head}
        {eventBox}
        <p className="onboarding-sub" style={{ marginTop: 16 }}>
          T&apos;han proposat com a suplent per a aquest bolo. Crea un compte d&apos;Escenari (o entra, si ja en tens) per presentar-t&apos;hi:
          el gestor del grup ho confirmarà i ho veuràs a la teva agenda.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn-primary" style={{ textDecoration: "none", width: "auto" }} href={`/sign-up?redirect_url=${encodeURIComponent(back)}`}>Crea un compte</Link>
          <Link className="btn-outline" style={{ textDecoration: "none" }} href={`/sign-in?redirect_url=${encodeURIComponent(back)}`}>Ja tinc compte</Link>
        </div>
      </Screen>
    );
  }

  const profile = await getProfile();
  const cu = await currentUser();
  const defaultName = profile?.name || [cu?.firstName, cu?.lastName].filter(Boolean).join(" ") || cu?.username || "";
  const mine = (await db().query(
    "select status from backup_applications where request_id=$1 and clerk_user_id=$2",
    [req.id, userId]
  )).rows[0];

  return (
    <Screen>
      {head}
      {eventBox}
      <SubstituteApplyView
        token={token}
        bandName={req.band_name}
        defaultName={defaultName}
        defaultInstruments={profile?.instruments || []}
        hasProfile={!!profile}
        existingStatus={(mine?.status as "pendent" | "acceptada" | "rebutjada" | undefined) || null}
      />
    </Screen>
  );
}
