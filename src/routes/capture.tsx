import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { spartanopsSpartacusCapture } from "@/lib/spartanops-spartacus.functions";
import { spartanopsResolveSessionField } from "@/lib/spartanops-checkin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useLang, useT } from "@/lib/i18n";

export const Route = createFileRoute("/capture")({
  head: () => ({
    meta: [
      { title: "SpartanOps · Zavzem točke" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => {
    const NAME_TO_NUM: Record<string, 1 | 2 | 3 | 4 | 5> = {
      alpha: 1, bravo: 2, beta: 2, charlie: 3, gamma: 3,
      delta: 4, echo: 5, epsilon: 5,
    };
    let point: 1 | 2 | 3 | 4 | 5 | undefined;
    if (typeof s.point === "string") {
      const key = s.point.toLowerCase().trim();
      if (key in NAME_TO_NUM) point = NAME_TO_NUM[key];
      else {
        const n = Number(key);
        if ([1, 2, 3, 4, 5].includes(n)) point = n as 1 | 2 | 3 | 4 | 5;
      }
    } else if (typeof s.point === "number" && [1, 2, 3, 4, 5].includes(s.point)) {
      point = s.point as 1 | 2 | 3 | 4 | 5;
    }
    const rawField = typeof s.field === "string" ? s.field : (typeof s.field_id === "string" ? s.field_id : "");
    const field = rawField.length <= 120 ? rawField : "";
    return { point, field };
  },
  component: CapturePage,
});

const SESSION_KEY = "spartanops:session_id";
const BG = "#0b0d09";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";
const ACCENT = "#E0B04E";
const TEAM_COLOR: Record<string, string> = { modra: "#3b82f6", rdeca: "#ef4444", rumena: "#eab308" };
const TEAM_LABEL: Record<string, string> = { modra: "MODRA", rdeca: "RDEČA", rumena: "RUMENA" };
const LEGACY_FIELDS = new Set(["zeleni-raj", "field-1", "field-2", "field-3"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toDbField(raw: string): string {
  const v = raw.toLowerCase().trim();
  if (v === "zeleniraj" || v === "zeleni-raj") return "zeleni-raj";
  if (v === "field1" || v === "field-1") return "field-1";
  if (v === "field2" || v === "field-2") return "field-2";
  if (v === "field3" || v === "field-3") return "field-3";
  return raw.trim();
}

function isValidFieldId(raw: string): boolean {
  return LEGACY_FIELDS.has(raw) || UUID_RE.test(raw);
}

function isQrPlaceholder(raw: string): boolean {
  const value = raw.trim();
  const lower = value.toLowerCase();
  return (
    !value ||
    value.includes("[") ||
    value.includes("]") ||
    value.includes("<") ||
    value.includes(">") ||
    lower === "field_uuid" ||
    lower === "field_id" ||
    lower === "mission_uuid" ||
    lower === "mission_id"
  );
}

function activeLobbyId(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem("spartanops.active_session");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { lobbyId?: unknown; authenticated?: unknown };
    return parsed?.authenticated && typeof parsed.lobbyId === "string" ? parsed.lobbyId.trim() : "";
  } catch {
    return "";
  }
}

function resolveQrField(raw: string): string {
  const value = raw.trim();
  if (!isQrPlaceholder(value)) return value;
  return activeLobbyId() || value;
}

function placeholderError(en: boolean): string {
  return en
    ? "You have not been deployed into the mission yet."
    : "Še niste bili razporejeni v misijo.";
}

const CAPTURE_SFX_MS = 6000;
const GPS_OK_KEY = "spartanops:gps_authorized";
const GPS_FIX_KEY = "spartanops:gps_fix";

function readCachedGpsFix(): { lat: number | null; lng: number | null; accuracy?: number | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GPS_FIX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: unknown; lng?: unknown; accuracy?: unknown; at?: unknown };
    const lat = typeof parsed.lat === "number" ? parsed.lat : NaN;
    const lng = typeof parsed.lng === "number" ? parsed.lng : NaN;
    const at = typeof parsed.at === "number" ? parsed.at : 0;
    const accuracy = typeof parsed.accuracy === "number" && Number.isFinite(parsed.accuracy) ? parsed.accuracy : 1200;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Date.now() - at > 5 * 60 * 1000) return null;
    return { lat, lng, accuracy };
  } catch {
    return null;
  }
}

function readGpsAuthorized(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(GPS_OK_KEY) === "1"; } catch { return false; }
}

/**
 * Eager GPS warm-up watcher.
 *
 * Started as soon as the Capture view mounts so the device GPS sensor is
 * already streaming coordinates by the time the QR scan resolves. This
 * eliminates the "cold-start timeout" that made Android's very first scan
 * fail with `gps_required`.
 */
type WarmFix = { lat: number; lng: number; accuracy: number; at: number };
let warmLatest: WarmFix | null = null;
let warmWatchId: number | null = null;
let warmRefCount = 0;

function startWarmGpsWatcher() {
  warmRefCount += 1;
  if (typeof navigator === "undefined" || !navigator.geolocation) return;
  if (warmWatchId != null) return;
  try {
    warmWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: WarmFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? 9999,
          at: Date.now(),
        };
        warmLatest = fix;
        try {
          localStorage.setItem(GPS_OK_KEY, "1");
          localStorage.setItem(GPS_FIX_KEY, JSON.stringify(fix));
        } catch { /* ignore */ }
      },
      () => { /* swallow; per-scan getPosition handles fallback */ },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  } catch { /* ignore */ }
}

function stopWarmGpsWatcher() {
  warmRefCount = Math.max(0, warmRefCount - 1);
  if (warmRefCount > 0) return;
  if (warmWatchId != null && typeof navigator !== "undefined" && navigator.geolocation) {
    try { navigator.geolocation.clearWatch(warmWatchId); } catch { /* ignore */ }
  }
  warmWatchId = null;
}

/**
 * Resolve a usable GPS position for capture.
 *  - Prefer a fresh warm-watcher fix (age < 10s).
 *  - Otherwise wait up to 2.5s for the warm watcher to emit its first
 *    coordinate pair before falling back.
 *  - Final fallback: a one-shot high-accuracy read, then cached fix.
 */
function getFreshGpsPosition(): Promise<{ lat: number | null; lng: number | null; accuracy?: number | null }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return resolve(readCachedGpsFix() ?? { lat: null, lng: null });
    }
    const now = Date.now();
    if (warmLatest && now - warmLatest.at < 10000) {
      return resolve({ lat: warmLatest.lat, lng: warmLatest.lng, accuracy: warmLatest.accuracy });
    }
    try { window.dispatchEvent(new Event("spartanops:gps-acquiring")); } catch { /* ignore */ }
    let settled = false;
    const done = (v: { lat: number | null; lng: number | null; accuracy?: number | null }) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const poll = window.setInterval(() => {
      if (warmLatest && Date.now() - warmLatest.at < 10000) {
        window.clearInterval(poll);
        done({ lat: warmLatest.lat, lng: warmLatest.lng, accuracy: warmLatest.accuracy });
      }
    }, 120);
    window.setTimeout(() => {
      window.clearInterval(poll);
      if (settled) return;
      // One-shot high-accuracy attempt after the warm buffer failed to yield.
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const fix: WarmFix = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? 9999,
            at: Date.now(),
          };
          warmLatest = fix;
          try {
            localStorage.setItem(GPS_OK_KEY, "1");
            localStorage.setItem(GPS_FIX_KEY, JSON.stringify(fix));
          } catch { /* ignore */ }
          done({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy });
        },
        () => done(readCachedGpsFix() ?? { lat: null, lng: null }),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 },
      );
    }, 2500);
  });
}


function CapturePage() {
  const { lang } = useLang();
  const t = useT();
  const en = lang === "en";
  const { point, field } = Route.useSearch();
  const resolvedField = useMemo(() => resolveQrField(field), [field]);
  const dbField = toDbField(resolvedField);
  const navigate = useNavigate();
  const applyCapture = useServerFn(spartanopsSpartacusCapture);
  const resolveSessionField = useServerFn(spartanopsResolveSessionField);
  const [state, setState] = useState<"loading" | "success" | "error" | "already_held">("loading");
  const [errMsg, setErrMsg] = useState("");
  const [isGpsError, setIsGpsError] = useState(false);
  const [team, setTeam] = useState<string | null>(null);
  const [resolvedRouteField, setResolvedRouteField] = useState<string>(resolvedField);
  const [acquiringGps, setAcquiringGps] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  

  useEffect(() => {
    const onAcq = () => setAcquiringGps(true);
    window.addEventListener("spartanops:gps-acquiring", onAcq);
    // Warm-up: start the eager GPS watcher the moment this view mounts so the
    // sensor is already streaming coordinates by the time the QR scan runs.
    startWarmGpsWatcher();
    return () => {
      window.removeEventListener("spartanops:gps-acquiring", onAcq);
      stopWarmGpsWatcher();
    };
  }, []);

  const enableGpsAndRetry = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setRetryNonce((n) => n + 1);
      return;
    }
    setIsGpsError(false);
    setErrMsg("");
    setAcquiringGps(true);
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          localStorage.setItem(GPS_OK_KEY, "1");
          localStorage.setItem(GPS_FIX_KEY, JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, at: Date.now() }));
        } catch { /* ignore */ }
        setRetryNonce((n) => n + 1);
      },
      () => setRetryNonce((n) => n + 1),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };


  useEffect(() => {
    const getPosition = getFreshGpsPosition;

    const run = async () => {
      if (!point) { setErrMsg("Manjka oznaka točke (1-5)."); setState("error"); return; }
      const session = typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
      let effectiveField = dbField;
      let effectiveRouteField = resolvedField;
      if (!isValidFieldId(effectiveField) && isQrPlaceholder(field) && session) {
        try {
          const resolved = await resolveSessionField({ data: { sessionId: session } });
          const sessionField = typeof resolved?.fieldId === "string" ? toDbField(resolved.fieldId) : "";
          if (sessionField && isValidFieldId(sessionField)) {
            effectiveField = sessionField;
            effectiveRouteField = sessionField;
          }
        } catch {
          // Fall through to the clear QR-placeholder error below.
        }
      }
      if (!isValidFieldId(effectiveField)) {
        setErrMsg(isQrPlaceholder(field) ? placeholderError(en) : (en ? "Invalid mission ID in QR code." : "Neveljaven ID misije v QR kodi."));
        setState("error");
        return;
      }
      if (!session) {
        setErrMsg("Najprej se prijavite v misijo."); setState("error");
        setTimeout(() => navigate({ to: "/misija", search: { field: effectiveRouteField }, replace: true }), 2200);
        return;
      }
      // Preflight: block scans while the marshal has the match paused.
      try {
        const { data: gs } = await supabase
          .from("spartanops_game_state")
          .select("status")
          .eq("field_id", effectiveField)
          .maybeSingle();
        if ((gs as any)?.status === "paused") {
          alert(en
            ? "The Marshal has paused the match — QR scanning is suspended until the match resumes."
            : "Maršal je prekinil tekmo — skeniranje QR kod je onemogočeno, dokler se tekma ne nadaljuje.");
          navigate({ to: "/misija", search: { field: effectiveRouteField }, replace: true });
          return;
        }
      } catch { /* fall through to server-side validation */ }
      // Back-button / history-navigation guard: if the browser re-loads this
      // route with the exact same scan payload we just processed, redirect
      // silently to /misija instead of re-submitting the capture. The token
      // is set BEFORE the network call so a rapid back-forward can't race.
      const captureKey = `spartanops:capture:${effectiveField}:${point}`;
      try {
        const last = Number(sessionStorage.getItem(captureKey) ?? 0);
        if (last && Date.now() - last < 60000) {
          navigate({ to: "/misija", search: { field: effectiveRouteField }, replace: true });
          return;
        }
        sessionStorage.setItem(captureKey, String(Date.now()));
      } catch { /* ignore */ }

      try {
        const { lat, lng, accuracy } = await getPosition();

        if ((lat == null || lng == null) && readGpsAuthorized()) {
          const cached = readCachedGpsFix();
          if (cached?.lat != null && cached?.lng != null) {
            const result = await applyCapture({ data: { fieldId: effectiveField, point, sessionId: session, lat: cached.lat, lng: cached.lng, accuracy: cached.accuracy ?? 1200 } });
            console.log("SPARTACUS DIAGNOSTIC:", result);
            logDiagnostic("cached-gps-result", result);
            if (result?.ok) {
              setTeam((result as any).team ?? null);
              setResolvedRouteField(effectiveRouteField);
              setState("success");
              try { sessionStorage.setItem(captureKey, String(Date.now())); } catch { /* ignore */ }
              try { window.dispatchEvent(new CustomEvent("spartanops:capture-success")); } catch {}
              return;
            }
            try { sessionStorage.removeItem(captureKey); } catch { /* ignore */ }
          }
        }
        const result = await applyCapture({ data: { fieldId: effectiveField, point, sessionId: session, lat, lng, accuracy } });
        console.log("SPARTACUS DIAGNOSTIC:", result);
        logDiagnostic("fresh-gps-result", result);
        if ((result as any)?.ok && (result as any)?.already_held) {
          setState("already_held");
          setTimeout(() => navigate({ to: "/misija", search: { field: effectiveRouteField }, replace: true }), 2600);
          return;
        }
        if (!result?.ok) {
          const errCode = (result as any)?.error ?? "";
          logDiagnostic(`error-branch:${errCode || "unknown"}`, result);
          // Game not currently capturable → silently return the player to
          // /misija so they see the same screen everyone else sees
          // (pre-start countdown or debriefing) without capturing the point.
          if (errCode === "pre_start_locked" || errCode === "match_not_active") {
            try { sessionStorage.removeItem(captureKey); } catch { /* allow retry */ }
            navigate({ to: "/misija", search: { field: effectiveRouteField }, replace: true });
            return;
          }
          // FRONTEND SAFETY NET: even if the server responded with a warning
          // (e.g. spartacus_flagged), the RPC may have already committed the
          // capture. Verify against the DB — if the latest non-suspicious
          // capture for this point matches this player, show POINT CAPTURED.
          try {
            const { data: me } = await supabase
              .from("spartanops_checkins")
              .select("callsign, assigned_team")
              .eq("id", session)
              .eq("field_id", effectiveField)
              .maybeSingle();
            const callsign = (me as any)?.callsign;
            const team = (me as any)?.assigned_team;
            if (callsign && team && team !== "none") {
              const { data: latest } = await supabase
                .from("spartanops_captures")
                .select("team, player_callsign, captured_at, suspicious")
                .eq("field_id", effectiveField)
                .eq("point_number", point)
                .order("captured_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              const row = latest as any;
              if (row && row.suspicious !== true && row.player_callsign === callsign && row.team === team) {
                const ageMs = Date.now() - new Date(row.captured_at).getTime();
                if (ageMs >= 0 && ageMs < 20000) {
                  logDiagnostic("error-overridden-by-db-success-safety-net", result);
                  setTeam(team);
                  setResolvedRouteField(effectiveRouteField);
                  setState("success");
                  try { sessionStorage.setItem(captureKey, String(Date.now())); } catch { /* ignore */ }
                  try { window.dispatchEvent(new CustomEvent("spartanops:capture-success")); } catch {}
                  return;
                }
              }
            }
          } catch { /* fall through to error UI */ }
          try { sessionStorage.removeItem(captureKey); } catch { /* allow retry */ }
          const msg: Record<string, string> = {
            not_checked_in: "Niste prijavljeni v misijo.",
            no_team: "Nimate dodeljene ekipe.",
            invalid_point: "Neveljavna točka.",
            gps_required: en
              ? "Spartacus protection requires active GPS to verify your capture. Please enable location services to proceed."
              : "Spartacus zaščita zahteva aktivno GPS povezavo za potrditev tvoje lokacije ob zavzetju. Prosimo, omogoči lokacijske storitve za nadaljevanje.",
            spartacus_flagged: en
              ? "⚠ Spartacus flagged this scan as suspicious. Awaiting marshal review."
              : "⚠ Spartacus je označil ta sken kot sumljiv. Čaka pregled maršala.",
          };
          setIsGpsError(errCode === "gps_required");
          setErrMsg(msg[errCode] ?? "Napaka."); setState("error"); return;
        }
        logDiagnostic("success-branch", result);
        setTeam((result as any).team ?? null);
        setResolvedRouteField(effectiveRouteField);
        setState("success");
        try { sessionStorage.setItem(captureKey, String(Date.now())); } catch { /* ignore */ }
        // Route the capture chime through the shared audio node so it obeys
        // the ambient mute toggle. No auto-navigate — the player must ACK.
        try { window.dispatchEvent(new CustomEvent("spartanops:capture-success")); } catch {}
      } catch (e: any) {
        // A network/server failure means the capture did not actually land —
        // clear the guard so the player can retry by re-scanning the QR.
        try { sessionStorage.removeItem(captureKey); } catch { /* ignore */ }
        console.log("SPARTACUS DIAGNOSTIC:", { thrown_error: e?.message ?? e, stack: e?.stack });
        setDebugPayload({ stage: "frontend_exception", rpc_response_payload: { message: e?.message ?? String(e) } });
        setErrMsg(e?.message ?? "Napaka pri shranjevanju zavzema."); setState("error");
      }
    };

    run();
  }, [point, field, resolvedField, dbField, navigate, applyCapture, resolveSessionField, en, retryNonce]);

  if (state === "error") {
    return (
      <div style={{ background: BG, color: INK, minHeight: "100vh" }} className="flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center rounded-xl p-8" style={{ background: "#1a0808", border: "2px solid #ff3b3b" }}>
          <AlertTriangle size={42} style={{ color: "#ff3b3b" }} className="mx-auto mb-3" />
          <h2 style={{ color: "#ffd6d6", fontFamily: "'Michroma', monospace", fontSize: 14 }}>
            {en ? "Scan failed" : "Skeniranje ni uspelo"}
          </h2>
          <p className="text-sm mt-3" style={{ color: MUTED }}>{errMsg}</p>
          {isGpsError && (
            <button
              type="button"
              onClick={enableGpsAndRetry}
              className="mt-5 w-full"
              style={{
                background: "#9eff3d",
                color: "#0b0d09",
                fontFamily: "'Michroma', monospace",
                fontSize: 12,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                padding: "13px 12px",
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                boxShadow: "0 0 22px -6px #9eff3d",
              }}
            >
              {en ? "ENABLE GPS" : "OMOGOČI GPS"}
            </button>
          )}
          {!isGpsError && isQrPlaceholder(field) && (
            <button
              type="button"
              onClick={() => navigate({ to: "/join" })}
              className="mt-5 w-full"
              style={{
                background: ACCENT,
                color: "#0b0d09",
                fontFamily: "'Michroma', monospace",
                fontSize: 12,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                padding: "13px 12px",
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {en ? "JOIN MISSION" : "PRIDRUŽI SE MISIJI"}
            </button>
          )}
          {import.meta.env.DEV && debugPayload && (
            <pre className="mt-5 max-h-64 overflow-auto text-left text-[10px] leading-relaxed" style={{ color: "#ffd6d6", background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.16)", padding: 10, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(debugPayload, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  }

  if (state === "already_held") {
    const pointName = point ? (["ALPHA", "BETA", "GAMMA", "DELTA", "EPSILON"][point - 1] ?? String(point)) : "";
    return (
      <div style={{ background: BG, color: INK, minHeight: "100vh" }} className="flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center rounded-xl p-8" style={{ background: `${ACCENT}0a`, border: `2px solid ${ACCENT}`, boxShadow: `0 0 60px -10px ${ACCENT}88` }}>
          <CheckCircle2 size={48} style={{ color: ACCENT }} className="mx-auto mb-3" />
          <p className="font-mono uppercase text-[11px] tracking-[0.22em]" style={{ color: ACCENT }}>▌ {en ? "SECTOR SECURED" : "SEKTOR ZAVAROVAN"}</p>
          <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: 15, color: INK, fontWeight: 700, marginTop: 10, letterSpacing: "0.06em", lineHeight: 1.4 }}>
            {en
              ? `Sector ${pointName} is already under your team's control!`
              : `Sektor ${pointName} je že pod nadzorom vaše ekipe!`}
          </h2>
          <p className="text-xs mt-4 font-mono uppercase tracking-[0.2em]" style={{ color: MUTED }}>
            {en ? "Returning to HUD..." : "Vračam v HUD..."}
          </p>
        </div>
      </div>
    );
  }

  const c = team ? TEAM_COLOR[team] : ACCENT;
  const pointName = point ? (["ALPHA", "BETA", "GAMMA", "DELTA", "EPSILON"][point - 1] ?? String(point)) : "";
  const ackReturn = () => navigate({ to: "/misija", search: { field: resolvedRouteField }, replace: true });

  return (
    <div style={{ background: BG, color: INK, minHeight: "100vh", backgroundImage: `radial-gradient(ellipse at center, ${c}22, transparent 60%)` }} className="flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center rounded-xl p-8" style={{ background: `${c}0a`, border: `2px solid ${c}`, boxShadow: `0 0 60px -10px ${c}88`, position: "relative", overflow: "hidden" }}>
        {state === "loading" ? (
          <>
            <div className="font-mono text-xs tracking-[0.24em] uppercase animate-pulse" style={{ color: c }}>▌ SCANNING...</div>
            <div className="mt-5 mx-auto rounded-full" style={{ width: 80, height: 80, border: `4px solid ${c}44`, borderTopColor: c, animation: "spo-spin 0.9s linear infinite" }} />
            {acquiringGps && (
              <p className="mt-5 font-mono text-[11px] leading-relaxed" style={{ color: MUTED, letterSpacing: "0.06em" }}>
                {t("gpsAcquiringNotice")}
              </p>
            )}
            {import.meta.env.DEV && debugPayload && (
              <pre className="mt-5 max-h-56 overflow-auto text-left text-[10px] leading-relaxed" style={{ color: MUTED, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)", padding: 10, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(debugPayload, null, 2)}
              </pre>
            )}
          </>
        ) : (
          <>
            <CheckCircle2 size={56} style={{ color: c }} className="mx-auto mb-3" />
            <p className="font-mono uppercase text-[11px] tracking-[0.22em]" style={{ color: c }}>
              ▌ {t("captureSuccessTitle")}
            </p>
            <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: 18, color: INK, fontWeight: 700, marginTop: 10, letterSpacing: "0.06em" }}>
              {en ? "POINT " : "TOČKA "}{pointName}{en ? " CAPTURED" : " ZAVZETA"}
            </h2>

            <button
              type="button"
              onClick={ackReturn}
              className="mt-6 w-full"
              style={{
                background: c,
                color: "#0b0d09",
                fontFamily: "'Michroma', monospace",
                fontSize: 12,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                padding: "14px 12px",
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                boxShadow: `0 0 24px -6px ${c}`,
              }}
            >
              {t("captureAckBtn")}
            </button>

            <p className="mt-5 font-mono text-[10.5px] leading-relaxed" style={{ color: MUTED, letterSpacing: "0.04em" }}>
              {t("captureTelemetryNote")}
            </p>

            {/* Telemetry sync bar — matches the ~6s capture SFX duration */}
            <div style={{ marginTop: 8, height: 3, background: `${c}22`, borderRadius: 2, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: "100%",
                  background: c,
                  boxShadow: `0 0 8px ${c}`,
                  transformOrigin: "left center",
                  animation: `spo-fill ${CAPTURE_SFX_MS}ms linear forwards`,
                }}
              />
            </div>
            {import.meta.env.DEV && debugPayload && (
              <pre className="mt-5 max-h-56 overflow-auto text-left text-[10px] leading-relaxed" style={{ color: MUTED, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)", padding: 10, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(debugPayload, null, 2)}
              </pre>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes spo-spin{to{transform:rotate(360deg)}}@keyframes spo-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>
    </div>
  );
}
