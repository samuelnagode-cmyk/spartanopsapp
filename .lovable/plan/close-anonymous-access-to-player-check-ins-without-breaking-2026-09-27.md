# Close anonymous access to player check-ins without breaking live updates

## Goal
Anonymous visitors can no longer read or write `spartanops_checkins` directly. Everything players and marshals see keeps working, including live roster, team and death updates.

## What currently depends on anonymous access
1. **Capture safety check** (`capture.tsx`): reads one player's callsign and team straight from the browser.
2. **Three live-update feeds** listen to changes on this table from the browser:
   - player mission screen (`misija.tsx`)
   - marshal live console (`admin-pregled.tsx`)
   - Spartan console (`SpartanOpsConsole.tsx`)

   The marshal and Spartan consoles only use the change as a "something changed" signal: they then reload the roster through an existing password-checked server function. The player screen also merges the changed row directly into its list, then reloads shortly after.

All other reads already go through server functions with full access and are unaffected.

## The fix

**Step 1: capture safety check goes through the server**
- New small server function: given the player's session id and mission id, it returns only `callsign` and `assigned_team`.
- The capture check calls it instead of reading the table. The logic that uses the result stays the same.
- No public view is needed, so there's no risk of a view exposing every mission's players.

**Step 2: live feeds switch to a lightweight "roster changed" signal**
- A database trigger on `spartanops_checkins` broadcasts a message on a per-mission channel whenever a row is added, changed or removed. The message carries only the mission id and change type, no player data.
- Each of the three screens listens for that signal instead of the table itself, then runs the reload it already has.
- The player screen stops merging row data from the feed and relies on its existing reload, which already runs 600 ms after each change. Before switching, I'll confirm that reload goes through a server function and not a direct table read. If it's a direct read, I'll move it to a server function too.
- Live updates may arrive slightly later on the player screen (up to about half a second), because it now waits for the reload.

**Step 3: revoke**
- `REVOKE ALL ON public.spartanops_checkins FROM anon;` in the same migration as the trigger, applied only after steps 1–2 are in place.
- The `authenticated` and `service_role` grants, RLS policies, table structure and existing public views stay unchanged.

## Verification
- Typecheck.
- A real anonymous read of `spartanops_checkins` returns nothing or a permission error.
- In the browser: open a mission as a player and as a marshal, change a player's team through the marshal console, and confirm both screens update live.
- Capture safety check: I can check it runs without errors, but a full real capture still needs your field test.
- Report the commit reference; the GitHub push stays unconfirmed.

## Files touched
- One new migration (trigger + revoke), written via the shell
- `src/lib/spartanops-checkin.functions.ts` (new server function)
- `src/routes/capture.tsx` (one query swapped)
- `src/routes/misija.tsx`, `src/routes/admin-pregled.tsx`, `src/components/SpartanOpsConsole.tsx` (subscription only)

## Technical notes
- The broadcast uses `realtime.send(payload, event, 'checkins:<field_id>', false)` from a trigger function. It's a public channel, since players and marshals have no login session. The payload contains no player data, so a public channel leaks nothing beyond "this mission's roster changed".
- Nothing is created or altered inside the `realtime` schema; the trigger only calls its send function.
- If the platform blocks `realtime.send`, the fallback is to have the three screens poll their existing server reload every few seconds while a mission is open.
