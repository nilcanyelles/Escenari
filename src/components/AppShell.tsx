"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SignOutButton } from "@clerk/nextjs";
import { NavIcon, initialsOf, type NavPage } from "@/lib/nav";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type ShellUser = { name: string; roleLabel: string };

export default function AppShell({
  todayLabel,
  pages,
  user,
  children,
}: {
  todayLabel: string;
  pages: NavPage[];
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const topnavRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number; ready: boolean }>({ left: 0, width: 0, ready: false });
  const initials = initialsOf(user.name);

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

  function ProfileButton() {
    return (
      <button className="profile-btn" onClick={() => setProfileOpen((v) => !v)}>
        <div className="profile-btn-avatar">{initials}</div>
      </button>
    );
  }

  return (
    <div className="app-shell">
      <div className="main-col">
        <div className="mobile-topbar mobile-only">
          <span className="brand-lockup">
            <img className="brand-mark" src="/logo-mark.png" alt="" />
            <span className="brand-name">ESCENARI</span>
          </span>
          <div className="spacer"></div>
          <ProfileButton />
        </div>

        <div className="page-header desktop-only">
          <div className="page-header-brand">
            <span className="brand-lockup">
              <img className="brand-mark" src="/logo-mark.png" alt="" />
              <span className="brand-name">ESCENARI</span>
            </span>
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
              const active = pathname === p.href;
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
          const active = pathname === p.href;
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
            <div className="profile-popover-avatar">{initials}</div>
            <div className="profile-popover-name">{user.name}</div>
            <div className="profile-popover-role">{user.roleLabel}</div>
            <SignOutButton redirectUrl="/">
              <button className="btn-danger-outline" style={{ width: "100%" }} type="button">
                Tanca sessió
              </button>
            </SignOutButton>
          </div>
        </div>
      )}
    </div>
  );
}
