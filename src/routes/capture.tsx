import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import captureTrack from "@/assets/spartanops-capture-levelup.mp3.asset.json";
import { spartanopsSpartacusCapture } from "@/lib/spartanops-spartacus.functions";
import { spartanopsResolveSessionField } from "@/lib/spartanops-checkin.functions";
import { useLang } from "@/lib/i18n";

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
    ? "This QR code still contains a placeholder mission ID. Regenerate/print it with the real mission UUID, or have the player join the mission first so SpartanOps can resolve the active mission."
    : "Ta QR koda še vedno vsebuje predlogo za ID misije. Ponovno jo ustvarite/natisnite s pravim UUID misije ali naj se igralec najprej pridruži misiji, da SpartanOps prepozna aktivno misijo.";
}

function playCaptureTrack() {
  try {
    const audio = new Audio(captureTrack.url);
    audio.volume = 0.95;
    audio.play().catch(() => {});
  } catch { /* ignore */ }
}

function CapturePage() {
  const { lang } = useLang();
  const en = lang === "en";
  const { point, field } = Route.useSearch();
  const resolvedField = useMemo(() => resolveQrField(field), [field]);
  const dbField = toDbField(resolvedField);
  const navigate = useNavigate();
  const applyCapture = useServerFn(spartanopsSpartacusCapture);
  const resolveSessionField = useServerFn(spartanopsResolveSessionField);
  const [state, setState] = useState<"loading" | "success" | "error" | "already_held">("loading");
  const [errMsg, setErrMsg] = useState("");
  const [team, setTeam] = useState<string | null>(null);

  useEffect(() => {
    const getPosition = () =>
      new Promise<{ lat: number | null; lng: number | null }>((resolve) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({ lat: null, lng: null });
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({ lat: null, lng: null }),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
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
      const captureKey = `spartanops:capture:${effectiveField}:${point}`;
      try {
        const last = Number(sessionStorage.getItem(captureKey) ?? 0);
        if (last && Date.now() - last < 30000) {
          setState("success");
          setTimeout(() => navigate({ to: "/misija", search: { field: effectiveRouteField }, replace: true }), 700);
          return;
        }
      } catch { /* ignore */ }
      try {
        const { lat, lng } = await getPosition();
        const result = await applyCapture({ data: { fieldId: effectiveField, point, sessionId: session, lat, lng } });
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
          setErrMsg(msg[errCode] ?? "Napaka."); setState("error"); return;
        }
        setTeam((result as any).team ?? null);
        setState("success");
        try { sessionStorage.setItem(captureKey, String(Date.now())); } catch { /* ignore */ }
        playCaptureTrack();
        try { window.dispatchEvent(new CustomEvent("spartanops:capture-success", { detail: { localPlaybackStarted: true } })); } catch {}
        setTimeout(() => navigate({ to: "/misija", search: { field: effectiveRouteField }, replace: true }), 5500);
      } catch (e: any) {
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
          <h2 style={{ color: "#ffd6d6", fontFamily: "'Michroma', monospace", fontSize: 14 }}>Skeniranje ni uspelo</h2>
          <p className="text-sm mt-3" style={{ color: MUTED }}>{errMsg}</p>
        </div>
      </div>
    );
  }

  const c = team ? TEAM_COLOR[team] : ACCENT;
  const label = team ? TEAM_LABEL[team] : "";

  return (
    <div style={{ background: BG, color: INK, minHeight: "100vh", backgroundImage: `radial-gradient(ellipse at center, ${c}22, transparent 60%)` }} className="flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center rounded-xl p-8" style={{ background: `${c}0a`, border: `2px solid ${c}`, boxShadow: `0 0 60px -10px ${c}88` }}>
        {state === "loading" ? (
          <>
            <div className="font-mono text-xs tracking-[0.24em] uppercase animate-pulse" style={{ color: c }}>▌ SCANNING...</div>
            <div className="mt-5 mx-auto rounded-full" style={{ width: 80, height: 80, border: `4px solid ${c}44`, borderTopColor: c, animation: "spo-spin 0.9s linear infinite" }} />
          </>
        ) : (
          <>
            <CheckCircle2 size={56} style={{ color: c }} className="mx-auto mb-3" />
            <p className="font-mono uppercase text-[11px] tracking-[0.22em]" style={{ color: c }}>▌ {en ? "CAPTURE CONFIRMED" : "ZAVZEM POTRJEN"}</p>
            <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: 18, color: INK, fontWeight: 700, marginTop: 10 }}>
              {en ? "POINT " : "TOČKA "}{point ? (["ALPHA", "BETA", "GAMMA", "DELTA", "EPSILON"][point - 1] ?? point) : ""}{en ? " CAPTURED" : " ZAVZETA"}
            </h2>
            <p className="text-xs mt-4 font-mono uppercase tracking-[0.2em]" style={{ color: MUTED }}>{en ? "Redirecting to mission..." : "Preusmerjam v misijo..."}</p>
          </>
        )}
      </div>
      <style>{`@keyframes spo-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
