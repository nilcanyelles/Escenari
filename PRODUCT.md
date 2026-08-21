# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is whoever runs Escenari day to day for their own music collective/label — they manage a roster of in-house bands ("Grups") and everything about booking and running each gig ("bolo"): the calendar, the concert/venue details, band attendance and logistics, the invoice, and promotion. Today it's a single shared admin login; more user roles are planned for later (e.g. giving each band its own login to see its own calendar or route sheet).

## Product Purpose

Escenari centralizes the day-to-day operation of a music collective's live-gig business: scheduling and tracking concerts across all its bands, producing the per-gig logistics document ("Full de ruta") the band and venue need, generating invoices per concert, and sharing the gig on Instagram/WhatsApp to fans. Success is having one place that replaces juggling spreadsheets, chat threads, and separate invoice/graphic tools for every booking.

## Positioning

Unlike a spreadsheet or a generic booking CRM, Escenari's mechanism is that the route sheet, invoice, and promotional story are all generated from the same concert record instead of being redone by hand for each one — and it's purpose-built for the Catalan "festa major" gig circuit (Catalan-language interface throughout, region flags/maps for Catalunya, Països Catalans, País Valencià, Illes Balears, etc. built into the promotional story generator).

## Operating Context

- Bands ("Grups") are in-house acts belonging to the same collective, each with members, crew, city, and a default fee ("catxet").
- A gig ("Concert"/"bolo") ties together a band, date/time, venue, city, the local festival committee or client ("Festa/entitat"), a fee, and a status (confirmat/pendent/cancel·lat).
- Each concert has a route sheet ("Full de ruta") covering venue/parking/access, contacts, schedule (arrival, setup, soundcheck, show), and hospitality (catering, dressing room, lodging).
- Each concert can have attendance tracked per member/crew (confirmed/declined, with a substitute if someone can't make it).
- Confirmed concerts can be invoiced, with sequential invoice numbering and stored company billing info.
- Concerts can be shared as an Instagram-story-style image (with a location pin on a selectable regional map) or as a pre-filled WhatsApp attendance-confirmation message.
- Main views: Resum (dashboard), Calendari (month/week), Concerts (list), Grups (roster), Facturació (invoices), Base de dades (inline-editable master tables).

## Capabilities and Constraints

- Single shared admin login today (password-gated); per-role/per-band logins are a planned but not-yet-built direction — future work should leave room for it without building it prematurely.
- Backend: Neon Postgres via server actions; no multi-tenancy currently — one collective's data per deployment.
- Catalan is the interface language throughout; not currently localized to other languages.

## Brand Commitments

- Name: Escenari (recently renamed from "La Bona Party" — all remaining references to the old name have been swept from the UI, invoices, and route sheet PDFs).
- Logo: stacked bars + a stage-spotlight cone forming an "E", blue-to-purple gradient on black/white backgrounds.
- Dark, deep-blue/purple themed UI throughout the admin app; the login screen carries the full wordmark lockup, while the app shell and favicon use icon-only marks.

## Evidence on Hand

- Band names, cities, gig dates, and amounts visible in the current dev database were used throughout prior sessions for testing and were never confirmed as the real production roster versus seed/placeholder data — future work should not treat specific names or numbers seen there as durable facts without checking.

## Product Principles

1. One concert record is the single source of truth that the route sheet, invoice, and promotional story all render from — never make the user re-enter the same gig details in multiple places.
2. Keep the whole product in Catalan and tuned to local festa major/gig-circuit vocabulary (colla/festa, catxet, full de ruta) rather than generic English SaaS terminology.
3. Favor fast, low-friction data entry for a single operator running many gigs (inline-editable tables, auto-filled defaults like the band's rate) over heavier workflow/approval structures.
4. Design for the current single-admin reality without closing the door on the planned multi-role future (e.g., bands eventually viewing their own calendar/route sheet).
