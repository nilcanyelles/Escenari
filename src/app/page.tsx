import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import ScrollExpand from "@/components/ScrollExpand";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "01",
    title: "Crea el grup i convida els músics",
    desc: "Munta el teu col·lectiu en un minut. Cada artista entra amb una invitació o un codi i té el seu propi compte.",
  },
  {
    n: "02",
    title: "Afegeix cada bolo una sola vegada",
    desc: "Data, hora, lloc, caixet i contacte. El concert queda al calendari de tothom i cada músic hi confirma l'assistència.",
  },
  {
    n: "03",
    title: "Genera-ho tot des d'aquell registre",
    desc: "Full de ruta en PDF, factura numerada i la story de promoció surten del mateix concert. Zero còpies, zero errors.",
  },
];

const FEATURES = [
  {
    title: "Calendari de bolos",
    desc: "Tots els concerts de tots els teus grups en una sola vista, per mes o per setmana, amb l'estat de cada bolo d'un cop d'ull.",
    icon: '<rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
  },
  {
    title: "Fulls de ruta",
    desc: "Genera el full de ruta de cada actuació — accessos, horaris, contactes i hospitalitat — a punt per compartir en PDF.",
    icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>',
  },
  {
    title: "Facturació",
    desc: "Factura cada concert confirmat amb numeració automàtica i les dades del client sempre a punt.",
    icon: '<circle cx="12" cy="12" r="9.5"></circle><text x="12" y="16.3" text-anchor="middle" font-size="12.5" font-weight="700" font-family="Inter,sans-serif" stroke="none" fill="currentColor">€</text>',
  },
  {
    title: "Grups i assistència",
    desc: "Convida els teus músics: cada artista confirma la seva assistència a cada bolo des del seu propi compte.",
    icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M15.5 3.13a4 4 0 0 1 0 7.75"></path>',
  },
  {
    title: "Promoció",
    desc: "Converteix cada concert en una story d'Instagram o un missatge de WhatsApp amb un parell de clics.",
    icon: '<rect x="2" y="2" width="20" height="20" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1"></circle>',
  },
  {
    title: "Una sola font de veritat",
    desc: "El full de ruta, la factura i la promoció es generen del mateix registre del concert: mai tornis a copiar dades.",
    icon: '<path d="M12 2 2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path>',
  },
];

export default async function LandingPage() {
  const { userId } = await auth();

  return (
    <div className="landing landing-cinematic">
      <header className="landing-header landing-header-fixed">
        <span className="brand-lockup">
          <img className="brand-mark" src="/logo-mark.png" alt="" />
          <span className="brand-name">ESCENARI</span>
        </span>
        <nav className="landing-nav">
          {userId ? (
            <Link className="btn-primary landing-cta-sm" href="/resum">Obre l&apos;aplicació</Link>
          ) : (
            <>
              <Link className="landing-link" href="/sign-in">Inicia sessió</Link>
              <Link className="btn-primary landing-cta-sm" href="/sign-up">Comença ara</Link>
            </>
          )}
        </nav>
      </header>

      <ScrollExpand
        src="/landing/hero-escenari.jpg"
        alt="Un músic mirant l'escenari abans que s'ompli el públic"
        title="ESCENARI"
        scrollHint="Desplaça't"
        useWindowScroll
        startWidth={40}
        startHeight={58}
        startRadius={26}
        endRadius={0}
        mediaZoom={1.9}
        focusX={50}
        focusY={64}
        scrollDistance={1.25}
        holdDistance={0.4}
        smoothing={0.1}
        overlayScrim={0.5}
        revealAt={0.45}
      >
        <p className="sx-tagline">
          Tota la vida en directe dels teus grups, en un sol escenari.
        </p>
        <div className="sx-actions">
          {userId ? (
            <Link className="btn-primary landing-cta" href="/resum">Obre l&apos;aplicació</Link>
          ) : (
            <>
              <Link className="btn-primary landing-cta" href="/sign-up">Crea el teu compte</Link>
              <Link className="landing-cta-secondary sx-cta-ghost" href="/sign-in">Inicia sessió</Link>
            </>
          )}
        </div>
      </ScrollExpand>

      <main className="landing-body">
        <section className="landing-section">
          <div className="landing-eyebrow">Com funciona</div>
          <h2 className="landing-h2">
            Del primer assaig a la factura, <span className="landing-accent">sense sortir d&apos;aquí</span>
          </h2>
          <p className="landing-sub">
            Escenari centralitza els bolos del teu col·lectiu musical: calendari, fulls de ruta,
            assistència dels músics, factures i promoció — tot generat des del mateix registre de cada concert.
          </p>
          <ol className="landing-steps">
            {STEPS.map((s) => (
              <li className="landing-step" key={s.n}>
                <span className="landing-step-num">{s.n}</span>
                <div className="landing-step-title">{s.title}</div>
                <p>{s.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-section">
          <div className="landing-eyebrow">Què hi trobaràs</div>
          <h2 className="landing-h2">Tot el que envolta un bolo</h2>
          <div className="landing-features">
            {FEATURES.map((f) => (
              <div className="landing-feature" key={f.title}>
                <svg
                  className="landing-feature-icon"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dangerouslySetInnerHTML={{ __html: f.icon }}
                />
                <div className="landing-feature-title">{f.title}</div>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-eyebrow">Per a qui</div>
          <div className="landing-roles">
            <div className="landing-role-card">
              <div className="landing-role-title">Per a agències</div>
              <p>Crea el teu grup, convida els músics i porta el calendari, la facturació i la logística de cada bolo.</p>
            </div>
            <div className="landing-role-card">
              <div className="landing-role-title">Per a artistes</div>
              <p>Uneix-te als teus grups amb una invitació o un codi, mira els pròxims bolos i confirma la teva assistència.</p>
            </div>
          </div>
        </section>

        <section className="landing-final">
          <h2 className="landing-h2">A punt per pujar a l&apos;escenari?</h2>
          <div className="landing-hero-cta">
            {userId ? (
              <Link className="btn-primary landing-cta" href="/resum">Obre l&apos;aplicació</Link>
            ) : (
              <>
                <Link className="btn-primary landing-cta" href="/sign-up">Comença gratis</Link>
                <Link className="landing-cta-secondary" href="/sign-in">Ja tinc compte</Link>
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        © {new Date().getFullYear()} Escenari — Gestió d&apos;actuacions musicals
      </footer>
    </div>
  );
}
