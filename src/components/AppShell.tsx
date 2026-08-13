"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PAGES, NavIcon, USER_NAME, USER_ROLE, USER_INITIALS } from "@/lib/nav";
import { logoutAction } from "@/app/login/actions";

export default function AppShell({ todayLabel, children }: { todayLabel: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);

  function ProfileButton() {
    return (
      <button className="profile-btn" onClick={() => setProfileOpen((v) => !v)}>
        <div className="profile-btn-avatar">{USER_INITIALS}</div>
      </button>
    );
  }

  return (
    <div className="app-shell">
      <div className="main-col">
        <div className="mobile-topbar mobile-only">
          <img className="mobile-logo-img" src="/logo.webp" alt="Escenari" />
          <div className="spacer"></div>
          <ProfileButton />
        </div>

        <div className="page-header desktop-only">
          <div className="page-header-brand">
            <img className="topbar-logo-img" src="/logo.webp" alt="Escenari" />
          </div>
          <div className="topnav">
            {PAGES.map((p) => {
              const active = pathname === p.href;
              return (
                <Link
                  key={p.key}
                  className={"topnav-item" + (active ? " active" : "")}
                  href={p.href}
                  title={p.label}
                >
                  <NavIcon page={p.key} color={active ? "var(--accent-text)" : "var(--text-muted)"} className="nav-icon" />
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

        <main className="content">{children}</main>
      </div>

      <div className="bottom-nav mobile-only">
        {PAGES.map((p) => {
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
            <div className="profile-popover-avatar">{USER_INITIALS}</div>
            <div className="profile-popover-name">{USER_NAME}</div>
            <div className="profile-popover-role">{USER_ROLE}</div>
            <form action={logoutAction}>
              <button className="btn-danger-outline" style={{ width: "100%" }} type="submit">
                Tanca sessió
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
