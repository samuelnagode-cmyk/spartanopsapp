import { bumpTelemetryOnce } from "@/lib/telemetry-client";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * Anti-cheat gateway. A printed QR opened by an external camera app lands
 * here at `https://spartanopsapp.com/scan?field_id=...&type=domination&point=alpha`.
 *
 * This route MUST NOT execute a capture. It exists solely to:
 *   1. Strip the executable URL from browser history via `replaceState`
 *      (defeats back-button / reload replays and history sharing).
 *   2. Redirect the player into the Mission HUD.
 *   3. Surface a tactical security alert instructing them to use the
 *      in-app scanner.
 *
 * The only sanctioned capture path is the in-app scanner on /misija, which
 * writes a `spartanops:scan_ticket` into sessionStorage before navigating
 * to /capture. `/capture` validates that ticket and refuses to execute
 * otherwise.
 */
export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "SpartanOps · Scan" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { field_id?: string; type?: string; point?: string } => ({
    field_id: typeof s.field_id === "string" ? s.field_id : (typeof s.field === "string" ? s.field : ""),
    type: typeof s.type === "string" ? s.type : "",
    point: typeof s.point === "string" ? s.point : "",
  }),
  component: ScanPage,
});

function ScanPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // 0) Marketing telemetry: this route is only ever reached from a printed QR.
    bumpTelemetryOnce("qr_entry", `scan:${Math.floor(Date.now() / 60000)}`);
    // 1) Instantly erase the executable URL from history so back/forward/reload

    //    cannot replay a QR-derived payload. Do this BEFORE anything else.
    try {
      window.history.replaceState(null, "", "/misija");
    } catch { /* ignore */ }

    // 2) Signal the HUD to surface a tactical security alert.
    try {
      sessionStorage.setItem("spartanops:security_alert", String(Date.now()));
    } catch { /* ignore */ }

    // 3) Redirect to the HUD (or /join if the player has no active session).
    let target: "/misija" | "/join" = "/misija";
    try {
      const raw = localStorage.getItem("spartanops.active_session");
      const parsed = raw ? (JSON.parse(raw) as { authenticated?: unknown; lobbyId?: unknown }) : null;
      if (!parsed?.authenticated || typeof parsed.lobbyId !== "string") target = "/join";
    } catch {
      target = "/join";
    }
    navigate({ to: target, replace: true });
  }, [navigate]);

  return (
    <div style={{ minHeight: "100dvh", background: "#0b0d09", color: "#ece3c4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", letterSpacing: "0.2em", fontSize: 12 }}>
      SECURING…
    </div>
  );
}
