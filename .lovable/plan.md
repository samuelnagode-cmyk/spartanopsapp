# Events System Overhaul — Implementation Plan

A large multi-part refactor. I'll outline what changes where, then implement after your approval.

## 1. Database (migration)
- New table `public.event_registrations`:
  - `id uuid pk`, `event_id uuid fk → events(id) on delete cascade`
  - `full_name text` (admin only), `email_or_phone text` (admin only)
  - `wants_food boolean default false`
  - `public_callsign text not null`, `loadout_role text not null`
  - `avatar_id text not null`
  - `created_at timestamptz default now()`
- Grants + RLS:
  - `GRANT INSERT, SELECT ON event_registrations TO anon, authenticated` (anon insert needed for public signup)
  - `GRANT ALL TO service_role`
  - Policies:
    - Public INSERT allowed (with basic length checks)
    - Public SELECT only of safe columns via a **view** `public.event_registrations_public` exposing only `id, event_id, public_callsign, loadout_role, avatar_id, wants_food, created_at`. Grant SELECT on view to anon/authenticated. RLS on base table denies SELECT to anon for admin columns.
  - Admin reads of full rows happen server-side via service-role server fn protected by the hardcoded password (request-time check inside server fn — never expose key client-side).
- Confirm `events.category` already supports 'airsoft' / 'glamping' / 'lokalno' (it does — text column). No schema change needed there.

## 2. Main calendar `/dogodki` (Glamping/Local only)
- Remove the "AIRSOFT" filter tab; keep VSI / GLAMPING / LOKALNO.
- Filter events query to `category in ('glamping','lokalno')`.
- Below calendar, add centered beige-themed CTA banner linking to `/rezervacije` (the existing contact/inquiry route — site has no `/kontakt`; will use `/rezervacije` and label "kontakt").

## 3. New `/airsoft/dogodki` route
- Full-width dark/tactical calendar fetching `category = 'airsoft'`.
- Three filter buttons: Upcoming (default) / Past / All.
- Expanded card retains Google Calendar + Copy Link buttons.
- Each card shows tactical **Register** button + disclaimer.
- Below card: "Kdo vse pride?" public attendee grid with avatars/callsigns/roles + live summary by role.
- Attendee list lazy-fetched only when card expanded (per requirement).
- CTA banner below calendar → `/rezervacije`.
- Footer matches /airsoft (dark).

## 4. Airsoft page button rewire
- `/airsoft` "AKTUALNI DOGODKI" button now links to `/airsoft/dogodki` instead of current target.

## 5. Registration modal
- Form fields exactly as specified, 8 preset SVG avatar icons (inline SVG), loadout dropdown (AEG/Sniper/DMR/HPA/Pistol/Najem).
- Zod validation. Inserts via `createServerFn` (uses publishable-key client + RLS insert policy).
- Success toast + refetch of attendee list.

## 6. Admin view `/airsoft/admin-pregled`
- Footer "ADMIN" link only on `/airsoft*` routes.
- Password gate (client-entered) → calls server fn `getAdminRegistrations({password})` which checks `password === "spartanjenajaci666"` server-side, then uses service-role client to fetch full rows joined with events.
- Dashboard: per upcoming event → total count, food count, expandable player table, CSV export button (client-side CSV generation).

## 7. i18n
- Add all new strings to `src/lib/i18n.tsx` SL + EN.

## 8. SEO
- `/airsoft/dogodki` route head() with localized title/description, canonical, og tags.

## Technical notes
- Server fns live in `src/lib/airsoft-events.functions.ts` (registration insert, attendee list fetch, admin fetch).
- Hardcoded admin password is a weak gate (per your spec); I'll keep the comparison server-side and never ship the string to client code.
- No business logic in UI components beyond presentation.
- No changes to existing colors, fonts, or other pages.

Ready to implement on approval.