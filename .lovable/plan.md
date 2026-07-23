## Anti-Cheat Scanner System — Implementation Plan

Bulletproof capture path: printed URLs stop executing on landing, and captures only flow through an in-app scanner that carries fresh GPS + a server-enforced per-player cooldown.

### 1. `/scan` — URL Poisoning Defense

Rewrite `src/routes/scan.tsx`:
- On mount, before any render, parse `field_id`, `type`, `point`.
- Immediately call `window.history.replaceState(null, "", "/misija")` so the executable URL disappears from history/back/reload.
- Do NOT navigate to `/capture` or call any capture RPC.
- Redirect to `/misija` (the HUD) and push a localized toast:
  - EN: "SECURITY ALERT: Point capture is only valid via the In-App Scanner."
  - SLO: "VARNOSTNO OPOZORILO: Zajem točke je mogoč le preko vgrajenega skenerja v aplikaciji."
- Legacy internal navigation to `/capture` (via the in-app scanner) is preserved through a new sentinel (see §3), so only external/history entries into `/scan` get blocked.

### 2. Permissions Gate on Deployment Registration (`/join`)

In `src/routes/join.tsx` deployment/registration step:
- Before allowing "Deploy", request BOTH:
  - `navigator.geolocation.getCurrentPosition(...)`
  - `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })` then immediately stop tracks.
- Track `gpsGranted` / `cameraGranted` in local state.
- If either is denied, render a diagnostic card blocking the flow:
  - EN title "PERMISSIONS DENIED" / SLO "DOVOLJENJA ZAVRNJENA" with the exact copy from the brief and a "Retry" button.
- Persist a `spartanops.permissions_ok` flag in localStorage so the HUD can trust prior grants but still re-check on scan open.

### 3. In-App Scanner — HUD Button + Modal

New component `src/components/QRScanner.tsx`:
- Full-screen `bg-black/90` overlay with:
  - Centered `<video>` viewport with a glowing gold/cyan crosshair bounding box (pure CSS/SVG, animated).
  - Top-corner flashlight toggle: `track.applyConstraints({ advanced: [{ torch: boolean }] })` wrapped in strict try/catch; hide toggle if unsupported.
  - Bottom close button (EN "CLOSE" / SLO "ZAPRI").
- Decode strategy: use native `BarcodeDetector` when available; otherwise dynamic-import `jsqr` (add via `bun add jsqr`) and decode from a hidden canvas frame loop.
- On decode, treat result as a raw string. Parse via `new URL(text, window.location.origin)` (tolerant to bare paths), extract `field_id`, `type`, `point`.
- Cleanse: reject unless `type === "domination"` and `point` matches a whitelist (`alpha|beta|gamma|delta|epsilon`); map point names → 1..5 for existing backend.
- On accept: stop tracks, close modal, navigate internally to `/capture` with a session-only sentinel `sessionStorage.setItem("spartanops.scan_ticket", <token>)` proving the scan originated in-app. `/capture` consumes and clears the ticket; if missing, it redirects to `/misija` with the same security-alert toast (prevents users from typing `/capture?...` manually or reloading it).

HUD button (in `src/routes/misija.tsx`, under the map widget):
- Prominent tactical button, animated pulsing gold/amber border (`animate-pulse` + custom ring).
- Label EN "SCAN CODE" / SLO "SKENIRAJ TOČKO".
- Opens `<QRScanner />`.

### 4. Server-Side Anti-Cheat Core

Extend `src/lib/spartanops-spartacus.functions.ts` (`spartanopsSpartacusCapture`):
- **Per-player 3-minute cooldown:** before insert/apply, query `spartanops_captures` for the same `player_checkin_id` + `point_number` within the last 3 minutes. If found, return `{ ok: false, error: "cooldown" }` and surface a localized toast on the client.
- **Hardened 15 m GPS check:** when a valid anchor exists AND fresh GPS is provided, if `dist > 15` (independent of accuracy buffers), reject with `{ ok: false, error: "out_of_range", distance_m }`. Keep the existing Spartacus suspicious flow only for missing/stale GPS edge cases — the hard 15 m rule takes precedence when GPS is present.
- Keep anchor-on-first-scan behavior unchanged.

Client toasts in `src/routes/capture.tsx`:
- `cooldown` → EN "Cooldown active — wait before rescanning this point." / SLO equivalent.
- `out_of_range` → EN "ERROR: Out of range (max 15m)!" / SLO "NAPAKA: Niste v dometu točke (največ 15m)!"

### 5. i18n Cleanliness

All new strings routed through the existing `useI18n()` hook via new keys under a `scanner.*` namespace in `src/lib/i18n.tsx` (EN + SLO). No literal `//` prefix strings baked into JSX — the tactical `//` prefix comes from a shared helper so language switches never leak English.

### Technical Notes

- Add dep: `jsqr` (fallback decoder). `BarcodeDetector` used when available for perf.
- No DB migrations: cooldown reads from existing `spartanops_captures.captured_at`.
- Printed QR URLs (`/scan?...`) remain valid physical assets — they now serve only as offline pointers; scanning them via the in-app scanner works because the scanner parses the URL and routes through the protected `/capture` path with a scan ticket. Scanning them with an external camera lands on `/scan`, which sanitizes and redirects without capturing.
- `/capture` gains a `scan_ticket` guard so it can no longer be triggered by URL sharing, reload, or history.
