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
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Date.now() - at > 60 * 1000) return null;
    return { lat, lng, accuracy: typeof parsed.accuracy === "number" && Number.isFinite(parsed.accuracy) ? parsed.accuracy : null };
  } catch {
    return null;
  }
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

  const enableGpsAndRetry = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      window.location.reload();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          localStorage.setItem(GPS_OK_KEY, "1");
          localStorage.setItem(GPS_FIX_KEY, JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, at: Date.now() }));
        } catch { /* ignore */ }
        window.location.reload();
      },
      () => window.location.reload(),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
  };


  useEffect(() => {
    const getPosition = () =>
      new Promise<{ lat: number | null; lng: number | null; accuracy?: number | null }>((resolve) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({ lat: null, lng: null });
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            try {
              localStorage.setItem(GPS_OK_KEY, "1");
              localStorage.setItem(GPS_FIX_KEY, JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, at: Date.now() }));
            } catch { /* ignore */ }
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
          },
          () => resolve(readCachedGpsFix() ?? { lat: null, lng: null }),
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
        );
      });

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
        const result = await applyCapture({ data: { fieldId: effectiveField, point, sessionId: session, lat, lng, accuracy } });
        if ((result as any)?.ok && (result as any)?.already_held) {
          setState("already_held");
          setTimeout(() => navigate({ to: "/misija", search: { field: effectiveRouteField }, replace: true }), 2600);
          return;
        }
        if (!result?.ok) {
          const errCode = (result as any)?.error ?? "";
          // Game not currently capturable → silently return the player to
          // /misija so they see the same screen everyone else sees
          // (pre-start countdown or debriefing) without capturing the point.
          if (errCode === "pre_start_locked" || errCode === "match_not_active") {
            navigate({ to: "/misija", search: { field: effectiveRouteField }, replace: true });
            return;
          }
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
        setErrMsg(e?.message ?? "Napaka pri shranjevanju zavzema."); setState("error");
      }
    };

    run();
  }, [point, field, resolvedField, dbField, navigate, applyCapture, resolveSessionField, en]);

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
          </>
        )}
      </div>
      <style>{`@keyframes spo-spin{to{transform:rotate(360deg)}}@keyframes spo-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>
    </div>
  );
}
