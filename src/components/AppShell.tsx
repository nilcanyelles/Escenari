"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { SignOutButton } from "@clerk/nextjs";
import { NavIcon, initialsOf, type NavPage } from "@/lib/nav";
import { bandPhotoDataUri } from "@/lib/tags";
import ManagerProfileModal from "@/components/ManagerProfileModal";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type ShellUser = {
  name: string;
  roleLabel: string;
  // Presents només per al gestor: activen el botó "Edita el perfil".
  photoUrl?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  editable?: boolean;
};
export type ShellBand = { id: string; name: string; logo: string; color1: string; tags?: string[] };

const BAND_COOKIE = "escenari_band";

function setBandCookie(id: string) {
  document.cookie = `${BAND_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
}

export type RailLink = { href: string; label: string; emoji: string };

export default function AppShell({
  todayLabel,
  pages,
  user,
  bands,
  selectedBandId,
  railLinks,
  routeBase = "",
  homeHref = "/resum",
  children,
}: {
  todayLabel: string;
  pages: NavPage[];
  user: ShellUser;
  bands?: ShellBand[];
  selectedBandId?: string;
  railLinks?: RailLink[];   // enllaços fixos a dalt de la barra (Perfil, Suplències…)
  routeBase?: string;       // "" per al gestor, "/artista" per als músics
  homeHref?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const topnavRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number; ready: boolean }>({ left: 0, width: 0, ready: false });
  // Selecció optimista: la cookie triga un refresh a arribar al servidor.
  const [localBand, setLocalBand] = useState<string | null>(null);
  const initials = initialsOf(user.name);
  const activeBand = localBand ?? (selectedBandId || "");
  const hasRail = Array.isArray(bands);

  useEffect(() => { setLocalBand(null); }, [selectedBandId]);

  useIsomorphicLayoutEffect(() => {
    function measure() {
      const nav = topnavRef.current;
      if (!nav) return;
      const active = nav.querySelector<HTMLAnchorElement>(".topnav-item.active");
      if (!active) { setIndicator((prev) => ({ ...prev, ready: false })); return; }
      setIndicator({ left: active.offsetLeft, width: active.offsetWidth, ready: true });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pathname]);

  function selectBand(id: string) {
    setLocalBand(id);
    setBandCookie(id);
    startTransition(() => {
      if (id) {
        // Triar un grup porta directament a la seva pàgina.
        router.push(routeBase + "/grup");
        router.refresh();
      } else {
        // "Tots els grups" no té pàgina de grup: cap a l'agenda.
        if (pathname.startsWith(routeBase + "/grup")) router.push(routeBase + "/agenda");
        router.refresh();
      }
    });
  }

  function ProfileButton() {
    return (
      <button className="profile-btn" onClick={() => setProfileOpen((v) => !v)}>
        <div className="profile-btn-avatar">
          {user.photoUrl ? <img className="profile-avatar-img" src={user.photoUrl} alt="" /> : initials}
        </div>
      </button>
    );
  }

  function BandRailItem({ b }: { b: ShellBand }) {
    const active = activeBand === b.id;
    return (
      <button
        type="button"
        className={"band-rail-item" + (active ? " active" : "")}
        title={b.name}
        onClick={() => selectBand(active ? "" : b.id)}
        style={active && b.color1 ? { ["--rail-accent" as string]: b.color1 } : undefined}
      >
        <img className="band-rail-avatar" src={b.logo || bandPhotoDataUri(b)} alt="" />
        <span className="band-rail-name">{b.name}</span>
      </button>
    );
  }

  const bandRail = hasRail && (
    <aside className="band-rail desktop-only">
      {railLinks && railLinks.length > 0 && (
        <>
          {railLinks.map((l) => (
            <Link key={l.href} href={l.href}
              className={"band-rail-item band-rail-link" + (pathname === l.href || pathname.startsWith(l.href + "/") ? " active" : "")}>
              <span className="band-rail-avatar band-rail-avatar-all">{l.emoji}</span>
              <span className="band-rail-name">{l.label}</span>
            </Link>
          ))}
          <div className="band-rail-sep"></div>
        </>
      )}
      <div className="band-rail-title">Els teus grups</div>
      <button
        type="button"
        className={"band-rail-item band-rail-all" + (activeBand === "" ? " active" : "")}
        onClick={() => selectBand("")}
      >
        <span className="band-rail-avatar band-rail-avatar-all">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
          </svg>
        </span>
        <span className="band-rail-name">Tots els grups</span>
      </button>
      <div className="band-rail-sep"></div>
      <div className="band-rail-list">
        {(bands || []).map((b) => <BandRailItem key={b.id} b={b} />)}
      </div>
    </aside>
  );

  const bandChips = hasRail && (
    <div className="band-chips mobile-only">
      {(railLinks || []).map((l) => (
        <Link key={l.href} href={l.href} className={"band-chip" + (pathname === l.href || pathname.startsWith(l.href + "/") ? " active" : "")}>
          {l.emoji} {l.label}
        </Link>
      ))}
      <button type="button" className={"band-chip" + (activeBand === "" ? " active" : "")} onClick={() => selectBand("")}>Tots</button>
      {(bands || []).map((b) => (
        <button
          key={b.id}
          type="button"
          className={"band-chip" + (activeBand === b.id ? " active" : "")}
          onClick={() => selectBand(activeBand === b.id ? "" : b.id)}
        >
          <img src={b.logo || bandPhotoDataUri(b)} alt="" />
          {b.name}
        </button>
      ))}
    </div>
  );

  return (
    <div className={"app-shell" + (hasRail ? " has-rail" : "")}>
      {bandRail}
      <div className="main-col">
        <div className="mobile-topbar mobile-only">
          <Link href={homeHref} className="brand-lockup brand-link" title="Torna a l'inici">
            <img className="brand-mark" src="/logo-mark.png" alt="" />
            <span className="brand-name">ESCENARI</span>
          </Link>
          <div className="spacer"></div>
          <ProfileButton />
        </div>
        {bandChips}

        <div className="page-header desktop-only">
          <div className="page-header-brand">
            <Link href={homeHref} className="brand-lockup brand-link" title="Torna a l'inici">
              <img className="brand-mark" src="/logo-mark.png" alt="" />
              <span className="brand-name">ESCENARI</span>
            </Link>
          </div>
          <div className="topnav" ref={topnavRef}>
            <div
              className="topnav-indicator"
              style={{
                transform: `translateX(${indicator.left}px)`,
                width: indicator.width,
                opacity: indicator.ready ? 1 : 0,
              }}
              aria-hidden="true"
            ></div>
            {pages.map((p) => {
              const active = pathname === p.href || pathname.startsWith(p.href + "/");
              return (
                <Link
                  key={p.key}
                  className={"topnav-item" + (active ? " active" : "")}
                  href={p.href}
                  title={p.label}
                >
                  <NavIcon page={p.key} color={active ? "oklch(0.99 0.01 330)" : "var(--text-muted)"} className="nav-icon" />
                  <span>{p.label}</span>
                </Link>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="page-date">{todayLabel}</div>
            <ProfileButton />
          </div>
        </div>

        <main className="content">
          <div key={pathname} className="page-transition">{children}</div>
        </main>
      </div>

      <div className="bottom-nav mobile-only">
        {pages.map((p) => {
          const active = pathname === p.href || pathname.startsWith(p.href + "/");
          return (
            <Link
              key={p.key}
              className="bottom-nav-item"
              href={p.href}
              style={{ color: active ? "var(--accent-text)" : "var(--text-faint)" }}
            >
              <NavIcon page={p.key} color={active ? "var(--accent-text)" : "var(--text-faint)"} className="nav-icon" />
              <span className="bottom-nav-label">{p.label}</span>
            </Link>
          );
        })}
      </div>

      {profileOpen && (
        <div className="profile-overlay" onClick={() => setProfileOpen(false)}>
          <div className="profile-popover" onClick={(e) => e.stopPropagation()}>
            <div className="profile-popover-avatar">
              {user.photoUrl ? <img className="profile-avatar-img" src={user.photoUrl} alt="" /> : initials}
            </div>
            <div className="profile-popover-name">{user.name}</div>
            <div className="profile-popover-role">{user.roleLabel}</div>
            {user.editable && (
              <button
                type="button" className="btn-outline" style={{ width: "100%", marginBottom: 10 }}
                onClick={() => { setProfileOpen(false); setProfileEditOpen(true); }}
              >Edita el perfil</button>
            )}
            <SignOutButton redirectUrl="/">
              <button className="btn-danger-outline" style={{ width: "100%" }} type="button">
                Tanca sessió
              </button>
            </SignOutButton>
          </div>
        </div>
      )}

      {profileEditOpen && (
        <ManagerProfileModal
          profile={{
            name: user.name, roleLabel: user.roleLabel,
            photoUrl: user.photoUrl || "", phone: user.phone || "",
            whatsapp: user.whatsapp || "", email: user.email || "",
          }}
          onClose={() => setProfileEditOpen(false)}
        />
      )}
    </div>
  );
}
