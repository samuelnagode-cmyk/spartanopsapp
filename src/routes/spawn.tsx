import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { spartanopsGetMyCheckin, spartanopsResolveSessionField, spartanopsSetRespawnLock } from "@/lib/spartanops-checkin.functions";
import { useLang } from "@/lib/i18n";

/**
 * Universal Spawn Link.
 *
 * URL structure (use in externally-generated QR codes):
 *   https://spartanopsapp.com/spawn?field=<FIELD_ID>
 *
 * On visit, we look up the player's session, read their assigned faction from
 * the check-in table, and trigger the team-appropriate respawn sequence.
 * Unassigned players see a tactical error overlay.
 */

export const Route = createFileRoute("/spawn")({
  head: () => ({
    meta: [
      { title: "SpartanOps · Respawn" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => {
    const rawField = typeof s.field === "string" ? s.field : (typeof s.field_id === "string" ? s.field_id : "");
    const field = rawField.length <= 120 ? rawField : "";
    return { field };
  },
  component: SpawnPage,
});

const SESSION_KEY = "spartanops:session_id";
const BG = "#0b0d09";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";
const ACCENT = "#E0B04E";
const TEAM_COLOR: Record<string, string> = { modra: "#3b82f6", rdeca: "#ef4444", rumena: "#eab308" };
const TEAM_LABEL: Record<string, string> = { modra: "BLUE", rdeca: "RED", rumena: "YELLOW" };
const LEGACY_FIELDS = new Set(["zeleni-raj", "field-1", "field-2", "field-3"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RespawnSettings = {
  enabled?: boolean;
  mode?: "linear" | "dynamic";
  linearSec?: number;
  dynStartMin?: number;
  dynEndMin?: number;
};

type SpawnGameState = {
  status?: string | null;
  match_started_at: string | null;
  match_duration_minutes: number | null;
  settings?: { respawn?: RespawnSettings } | null;
};

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
    ? "This respawn QR still contains a placeholder mission ID. Regenerate/print it with the real mission UUID, or have the player join the mission first so SpartanOps can resolve the active mission."
    : "Ta respawn QR koda še vedno vsebuje predlogo za ID misije. Ponovno jo ustvarite/natisnite s pravim UUID misije ali naj se igralec najprej pridruži misiji, da SpartanOps prepozna aktivno misijo.";
}

function respawnSeconds(gs: SpawnGameState | null): number {
  const respawn = gs?.settings?.respawn;
  if (!respawn?.enabled) return 0;
  if (respawn.mode !== "dynamic") return Math.max(1, Math.round(Number(respawn.linearSec ?? 30)));
  const startMin = Math.max(0, Number(respawn.dynStartMin ?? 0.5));
  const endMin = Math.max(startMin, Number(respawn.dynEndMin ?? 2));
  const matchStart = gs?.match_started_at ? Date.parse(gs.match_started_at) : NaN;
  const durationMs = Math.max(1, Number(gs?.match_duration_minutes ?? 1) * 60_000);
  const progress = Number.isFinite(matchStart) ? Math.min(1, Math.max(0, (Date.now() - matchStart) / durationMs)) : 0;
  return Math.max(1, Math.round((startMin + (endMin - startMin) * progress) * 60));
}

function respawnLockKey(fieldId: string, sessionId: string): string {
  return `spartanops:respawn:${fieldId}:${sessionId}`;
}

function setRespawnLock(fieldId: string, sessionId: string, seconds: number) {
  if (typeof window === "undefined") return;
  const key = respawnLockKey(fieldId, sessionId);
  if (seconds <= 0) {
    localStorage.removeItem(key);
    return;
  }
  const unlockAt = Date.now() + seconds * 1000;
  const current = Number(localStorage.getItem(key) ?? 0);
  localStorage.setItem(key, String(Math.max(current, unlockAt)));
}

function SpawnPage() {
  const { lang } = useLang();
  const en = lang === "en";
  const { field } = Route.useSearch();
  const resolvedField = useMemo(() => resolveQrField(field), [field]);
  const dbField = toDbField(resolvedField);
  const navigate = useNavigate();
  const getMyCheckin = useServerFn(spartanopsGetMyCheckin);
  const resolveSessionField = useServerFn(spartanopsResolveSessionField);
  const setRespawnLockFn = useServerFn(spartanopsSetRespawnLock);
  const [state, setState] = useState<"loading" | "success" | "unassigned" | "error">("loading");
  const [team, setTeam] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [respawnLeft, setRespawnLeft] = useState<number | null>(null);
  const [respawnEnabled, setRespawnEnabled] = useState(false);
  const [returnField, setReturnField] = useState(resolvedField);

  useEffect(() => {
    if (respawnLeft == null || respawnLeft <= 0) return;
    const timer = setInterval(() => setRespawnLeft((s) => (s == null ? s : Math.max(0, s - 1))), 1000);
    return () => clearInterval(timer);
  }, [respawnLeft]);

  // If the match ends (timer runs out or the marshal ends it) while the player
  // is still holding a respawn countdown, drop the countdown and send them
  // straight to the debriefing screen instead of making them wait it out.
  useEffect(() => {
    if (state !== "success" || respawnLeft == null || respawnLeft <= 0) return;
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase
        .from("spartanops_game_state")
        .select("status, match_started_at, match_duration_minutes")
        .eq("field_id", toDbField(returnField))
        .maybeSingle();
      if (cancelled || !data) return;
      const startMs = (data as any).match_started_at ? Date.parse((data as any).match_started_at) : NaN;
      const durMin = Number((data as any).match_duration_minutes ?? 0);
      const expired = Number.isFinite(startMs) && durMin > 0 && Date.now() >= startMs + durMin * 60_000;
      if ((data as any).status === "ended" || expired) {
        navigate({ to: "/misija", search: { field: returnField }, replace: true });
      }
    };
    check();
    const poll = setInterval(check, 4000);
    return () => { cancelled = true; clearInterval(poll); };
  }, [state, respawnLeft, returnField, navigate]);

  // Respawn QR scan triggers the respawn timer SFX immediately so the
  // player hears the countdown cue the moment their timer starts.
  useEffect(() => {
    try { window.dispatchEvent(new Event("spartanops:sfx-respawn")); } catch { /* ignore */ }
  }, []);


  useEffect(() => {
    const run = async () => {
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
        setErrMsg(isQrPlaceholder(field) ? placeholderError(en) : (en ? "Invalid mission ID in respawn QR." : "Neveljaven ID misije v respawn QR kodi."));
        setState("error");
        return;
      }
      if (!session) {
        setErrMsg(en ? "Not signed in to the mission." : "Niste prijavljeni v misijo.");
        setState("error");
        setTimeout(() => navigate({ to: "/misija", search: { field: effectiveRouteField }, replace: true }), 2200);
        return;
      }
      // Back-button / history-navigation guard: if the browser re-loads this
      // route with the exact same respawn payload we just processed, redirect
      // silently to /misija instead of re-arming the respawn lock.
      const spawnKey = `spartanops:spawn:${effectiveField}:${session}`;
      try {
        const last = Number(sessionStorage.getItem(spawnKey) ?? 0);
        if (last && Date.now() - last < 60000) {
          navigate({ to: "/misija", search: { field: effectiveRouteField }, replace: true });
          return;
        }
        sessionStorage.setItem(spawnKey, String(Date.now()));
      } catch { /* ignore */ }
      try {
        const res = await getMyCheckin({ data: { fieldId: effectiveField, sessionId: session } });
        const t = res?.row?.assigned_team ?? "none";
        if (!t || t === "none") {
          setState("unassigned");
          return;
        }

        setTeam(t);
        setReturnField(effectiveRouteField);
        const { data: gs } = await supabase
          .from("spartanops_game_state")
          .select("status, match_started_at, match_duration_minutes, settings")
          .eq("field_id", effectiveField)
          .maybeSingle();
        // Respawn only counts while the match is actively running. If the
        // game hasn't started (pre-start) or has already ended (debrief),
        // send the player back to /misija — they see the same screen as
        // everyone else and no respawn timer is started.
        const gsStatus = (gs as any)?.status as string | undefined;
        const startMs = (gs as any)?.match_started_at ? Date.parse((gs as any).match_started_at) : NaN;
        if (gsStatus === "paused") {
          alert(en
            ? "The Marshal has paused the match — QR scanning is suspended until the match resumes."
            : "Maršal je prekinil tekmo — skeniranje QR kod je onemogočeno, dokler se tekma ne nadaljuje.");
          navigate({ to: "/misija", search: { field: effectiveRouteField }, replace: true });
          return;
        }
        const notRunning =
          gsStatus !== "active" ||
          !Number.isFinite(startMs) ||
          startMs > Date.now();
        if (notRunning) {
          navigate({ to: "/misija", search: { field: effectiveRouteField }, replace: true });
          return;
        }
        const waitSeconds = respawnSeconds((gs as unknown as SpawnGameState | null) ?? null);
        setRespawnEnabled(waitSeconds > 0);
        setRespawnLeft(waitSeconds);
        try {
          const lock = await setRespawnLockFn({ data: { fieldId: effectiveField, sessionId: session, seconds: waitSeconds } });
          if (lock?.unlockAt) {
            const unlockMs = Date.parse(lock.unlockAt);
            if (Number.isFinite(unlockMs)) localStorage.setItem(respawnLockKey(effectiveField, session), String(unlockMs));
          } else {
            setRespawnLock(effectiveField, session, waitSeconds);
          }
        } catch {
          try { setRespawnLock(effectiveField, session, waitSeconds); } catch { /* ignore */ }
        }
        setState("success");
        if (waitSeconds <= 0) {
          setTimeout(() => navigate({ to: "/misija", search: { field: effectiveRouteField }, replace: true }), 3200);
        }
      } catch (e: any) {
        setErrMsg(e?.message ?? "Napaka.");
        setState("error");
      }
    };
    run();
  }, [dbField, field, resolvedField, navigate, getMyCheckin, resolveSessionField, setRespawnLockFn, en]);

  if (state === "error") {
    return (
      <div style={{ background: BG, color: INK, minHeight: "100vh" }} className="flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center rounded-xl p-8" style={{ background: "#1a0808", border: "2px solid #ff3b3b" }}>
          <AlertTriangle size={42} style={{ color: "#ff3b3b" }} className="mx-auto mb-3" />
          <h2 style={{ color: "#ffd6d6", fontFamily: "'Michroma', monospace", fontSize: 14 }}>
            {en ? "SPAWN LINK ERROR" : "NAPAKA POVEZAVE"}
          </h2>
          <p className="text-sm mt-3" style={{ color: MUTED }}>{errMsg}</p>
        </div>
      </div>
    );
  }

  if (state === "unassigned") {
    return (
      <div style={{ background: BG, color: INK, minHeight: "100vh" }} className="flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center rounded-xl p-8" style={{ background: `${ACCENT}0a`, border: `2px solid ${ACCENT}` }}>
          <AlertTriangle size={42} style={{ color: ACCENT }} className="mx-auto mb-3" />
          <p className="font-mono uppercase text-[11px] tracking-[0.22em]" style={{ color: ACCENT }}>
            ▌ {en ? "TACTICAL ERROR" : "TAKTIČNA NAPAKA"}
          </p>
          <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: 15, color: INK, fontWeight: 700, marginTop: 10, letterSpacing: "0.08em" }}>
            ERROR: UNASSIGNED FACTION.<br />SELECT A TEAM BEFORE RE-ENGAGING.
          </h2>
          <button
            onClick={() => navigate({ to: "/misija", search: { field: resolvedField }, replace: true })}
            className="mt-6 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.22em]"
            style={{ background: ACCENT, color: BG, border: "none", cursor: "pointer" }}
          >
            {en ? "Return to Staging" : "Nazaj v zbirno mesto"}
          </button>
        </div>
      </div>
    );
  }

  const c = team ? TEAM_COLOR[team] : ACCENT;
  const label = team ? TEAM_LABEL[team] : "";
  const ready = state === "success" && (respawnLeft ?? 0) <= 0;
  const mm = String(Math.floor((respawnLeft ?? 0) / 60)).padStart(2, "0");
  const ss = String((respawnLeft ?? 0) % 60).padStart(2, "0");

  return (
    <div style={{ background: BG, color: INK, minHeight: "100vh", backgroundImage: `radial-gradient(ellipse at center, ${c}22, transparent 60%)` }} className="flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center rounded-xl p-8" style={{ background: `${c}0a`, border: `2px solid ${c}`, boxShadow: `0 0 60px -10px ${c}88` }}>
        {state === "loading" ? (
          <>
            <div className="font-mono text-xs tracking-[0.24em] uppercase animate-pulse" style={{ color: c }}>▌ VERIFYING FACTION...</div>
            <div className="mt-5 mx-auto rounded-full" style={{ width: 80, height: 80, border: `4px solid ${c}44`, borderTopColor: c, animation: "spo-spin 0.9s linear infinite" }} />
          </>
        ) : (
          <>
            <ShieldCheck size={56} style={{ color: c }} className="mx-auto mb-3" />
            <p className="font-mono uppercase text-[11px] tracking-[0.22em]" style={{ color: c }}>▌ {en ? "RESPAWN AUTHORIZED" : "RESPAWN POTRJEN"}</p>
            <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: 18, color: INK, fontWeight: 700, marginTop: 10 }}>
              {label} {en ? "TEAM SPAWN" : "EKIPA SPAWN"}
            </h2>
            {respawnEnabled && !ready ? (
              <>
                <p className="text-xs mt-4 font-mono uppercase tracking-[0.2em]" style={{ color: MUTED }}>
                  {en ? "Hold position until respawn unlocks." : "Ostani na položaju, dokler se respawn ne odklene."}
                </p>
                <div className="mt-5" style={{ fontFamily: "'Michroma', monospace", fontSize: 46, color: c, textShadow: `0 0 24px ${c}88` }}>
                  {mm}:{ss}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs mt-4 font-mono uppercase tracking-[0.2em]" style={{ color: MUTED }}>
                  {respawnEnabled
                    ? (en ? "Respawn complete — re-engage now." : "Respawn končan — vrni se v boj.")
                    : (en ? "There is no respawn time — you can re-engage immediately." : "Respawn čas ni vklopljen — takoj se lahko vrneš v boj.")}
                </p>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/misija", search: { field: returnField }, replace: true })}
                  className="mt-5 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.22em]"
                  style={{ background: c, color: BG, border: "none", cursor: "pointer" }}
                >
                  {en ? "Return to HUD" : "Nazaj v HUD"}
                </button>
              </>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes spo-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
