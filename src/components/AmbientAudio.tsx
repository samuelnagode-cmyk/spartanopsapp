import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { Volume2, VolumeX } from "lucide-react";
import raging from "@/assets/raging-fires.mp3.asset.json";
import deactivator from "@/assets/deactivator.mp3.asset.json";
import countdown from "@/assets/countdown-10.mp3.asset.json";
import endgame from "@/assets/spartanops-endgame.mp3.asset.json";
import capture from "@/assets/spartanops-capture-levelup.mp3.asset.json";

type DeployMode = "broadcast" | "mute" | "command";

type Ctx = {
  enabled: boolean;
  toggle: () => void;
  deployMode: DeployMode;
  setDeployMode: (m: DeployMode) => void;
  startCountdown: () => void;
};

const AudioCtx = createContext<Ctx | null>(null);

export function useAmbientAudio() {
  const c = useContext(AudioCtx);
  if (!c) throw new Error("useAmbientAudio must be inside AmbientAudioProvider");
  return c;
}

const FADE_MS = 900;

function fade(el: HTMLAudioElement, to: number, ms = FADE_MS) {
  const from = el.volume;
  const start = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / ms);
    el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(step);
    else if (to === 0) el.pause();
  };
  if (to > 0 && el.paused) {
    el.volume = 0;
    el.play().catch(() => {});
  }
  requestAnimationFrame(step);
}

const ENABLED_KEY = "spartanops:audio-enabled";

export function AmbientAudioProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [enabled, setEnabled] = useState(false);
  const [deployMode, setDeployMode] = useState<DeployMode>("broadcast");
  const [lobbyOverride, setLobbyOverride] = useState<boolean | null>(null);

  // Restore last opt-in choice: player must toggle on the first time, then
  // the preference carries across QR scans, page reloads, and route jumps.
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem(ENABLED_KEY) === "1") {
        setEnabled(true);
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
      }
    } catch { /* ignore */ }
  }, [enabled]);

  const track1Ref = useRef<HTMLAudioElement | null>(null);
  const track2Ref = useRef<HTMLAudioElement | null>(null);
  const countdownRef = useRef<HTMLAudioElement | null>(null);
  const endgameRef = useRef<HTMLAudioElement | null>(null);
  const captureRef = useRef<HTMLAudioElement | null>(null);
  const endgamePlayingRef = useRef(false);

  // Route-based fallback: /join is the mission list / pre-lobby surface.
  // /misija is phase-driven below because it can be registration, team select,
  // pre-start, live HUD, respawn lock, or debriefing.
  const routeRaging = /^\/(|spartanops|archive|arhiv|print|updates)(\b|\/|$)/i.test(pathname);
  const routeLobby = /^\/(join|lobby)(\b|\/|$)/i.test(pathname);
  const routeMission = /^\/misija(\b|\/|$)/i.test(pathname);
  const inLobby = lobbyOverride ?? routeLobby;
  const awaitingMissionPhase = routeMission && lobbyOverride === null;
  const hasRouteAudio = routeRaging || routeLobby || routeMission;

  useEffect(() => {
    if (!/^\/misija(\b|\/|$)/i.test(pathname)) setLobbyOverride(null);
  }, [pathname]);

  const stopEndgameAndRestore = useCallback((forceLobby?: boolean) => {
    const eg = endgameRef.current;
    if (eg) {
      fade(eg, 0);
      try { eg.currentTime = 0; } catch { /* ignore */ }
    }
    endgamePlayingRef.current = false;
    if (typeof forceLobby === "boolean") setLobbyOverride(forceLobby);
    if (!enabled) return;
    const t1 = track1Ref.current, t2 = track2Ref.current;
    const nextLobby = forceLobby ?? inLobby;
    if (!hasRouteAudio) {
      if (t1) fade(t1, 0);
      if (t2) fade(t2, 0);
    } else if (nextLobby) {
      if (t1) fade(t1, 0);
      if (t2) fade(t2, 0.55);
    } else {
      if (t2) fade(t2, 0);
      if (t1) fade(t1, 0.5);
    }
  }, [enabled, inLobby, hasRouteAudio]);

  useEffect(() => {
    const t1 = new Audio(raging.url);
    t1.loop = true;
    t1.preload = "auto";
    t1.volume = 0;
    const t2 = new Audio(deactivator.url);
    t2.loop = true;
    t2.preload = "auto";
    t2.volume = 0;
    const cd = new Audio(countdown.url);
    cd.preload = "auto";
    cd.volume = 1;
    // Debriefing track is large — defer network until match ends.
    const eg = new Audio(endgame.url);
    eg.loop = false;
    eg.preload = "none";
    eg.volume = 0;
    // Capture SFX — small file, load eagerly for instant playback.
    const cap = new Audio(capture.url);
    cap.preload = "auto";
    cap.volume = 0.9;
    track1Ref.current = t1;
    track2Ref.current = t2;
    countdownRef.current = cd;
    endgameRef.current = eg;
    captureRef.current = cap;
    return () => {
      [t1, t2, cd, eg, cap].forEach((a) => { a.pause(); a.src = ""; });
    };
  }, []);

  // Switch tracks on enable/route change
  useEffect(() => {
    const t1 = track1Ref.current, t2 = track2Ref.current, eg = endgameRef.current, cap = captureRef.current, cd = countdownRef.current;
    if (!t1 || !t2) return;
    if (!enabled) {
      // Hard-stop every audio node — a slow fade left leftover sound after
      // the mute button was pressed on some browsers.
      const hardStop = (a: HTMLAudioElement | null) => {
        if (!a) return;
        try { a.pause(); a.volume = 0; a.currentTime = 0; } catch { /* ignore */ }
      };
      hardStop(t1); hardStop(t2); hardStop(cd); hardStop(cap);
      if (eg) { hardStop(eg); endgamePlayingRef.current = false; }
      return;
    }
    if (endgamePlayingRef.current) {
      // Endgame track owns the mix until it ends or user toggles.
      fade(t1, 0);
      fade(t2, 0);
      return;
    }
    if (!hasRouteAudio || awaitingMissionPhase) {
      fade(t1, 0);
      fade(t2, 0);
      return;
    }
    if (inLobby) {
      fade(t1, 0);
      fade(t2, 0.55);
    } else if (routeRaging || routeMission) {
      fade(t2, 0);
      fade(t1, 0.5);
    } else {
      fade(t1, 0);
      fade(t2, 0);
    }
  }, [enabled, inLobby, awaitingMissionPhase, hasRouteAudio, routeRaging, routeMission]);

  const startCountdown = useCallback(() => {
    const cd = countdownRef.current;
    if (!cd) return;
    cd.currentTime = 0;
    cd.play().catch(() => {});
  }, []);

  // Event bridges from other components (misija, SpartanOpsConsole).
  useEffect(() => {
    const onCountdown = () => startCountdown();
    const onLobby = (e: Event) => {
      const detail = (e as CustomEvent<{ active: boolean }>).detail;
      if (detail && typeof detail.active === "boolean") setLobbyOverride(detail.active);
    };
    const onMatchStart = () => {
      // Match countdown / game begins — fade out lobby music completely.
      setLobbyOverride(false);
      const t2 = track2Ref.current;
      if (t2) fade(t2, 0);
    };
    const onMatchEnd = () => {
      const t1 = track1Ref.current, t2 = track2Ref.current, eg = endgameRef.current;
      if (t1) fade(t1, 0);
      if (t2) fade(t2, 0);
      if (!eg) return;
      endgamePlayingRef.current = true;
      // Only actually play if audio is enabled; still start loading on-demand.
      eg.preload = "auto";
      eg.currentTime = 0;
      if (enabled) {
        fade(eg, 0.6);
      }
      const onEnded = () => stopEndgameAndRestore(true);
      eg.addEventListener("ended", onEnded, { once: true });
    };
    const onDebriefExit = () => stopEndgameAndRestore(true);
    const onCapture = () => {
      // Capture SFX is gated behind the audio toggle: if the player never
      // opted in, we stay silent. Route the sound through the shared audio
      // node so muting the app also mutes the capture chime.
      const cap = captureRef.current;
      if (!cap || !enabled) return;
      try { cap.currentTime = 0; } catch {}
      cap.volume = 0.9;
      cap.play().catch(() => {});
    };
    window.addEventListener("spartanops:countdown", onCountdown);
    window.addEventListener("spartanops:lobby", onLobby as EventListener);
    window.addEventListener("spartanops:match-start", onMatchStart);
    window.addEventListener("spartanops:match-end", onMatchEnd);
    window.addEventListener("spartanops:debrief-exit", onDebriefExit);
    window.addEventListener("spartanops:capture-success", onCapture);
    return () => {
      window.removeEventListener("spartanops:countdown", onCountdown);
      window.removeEventListener("spartanops:lobby", onLobby as EventListener);
      window.removeEventListener("spartanops:match-start", onMatchStart);
      window.removeEventListener("spartanops:match-end", onMatchEnd);
      window.removeEventListener("spartanops:debrief-exit", onDebriefExit);
      window.removeEventListener("spartanops:capture-success", onCapture);
    };
  }, [startCountdown, enabled, stopEndgameAndRestore]);

  const toggle = useCallback(() => setEnabled((v) => !v), []);

  const value = useMemo(
    () => ({ enabled, toggle, deployMode, setDeployMode, startCountdown }),
    [enabled, toggle, deployMode, startCountdown],
  );

  return (
    <AudioCtx.Provider value={value}>
      {children}
      <AudioFab />
    </AudioCtx.Provider>
  );
}

function AudioFab() {
  const { enabled, toggle } = useAmbientAudio();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? "Mute ambient audio" : "Enable ambient audio"}
      className="fixed z-50 flex items-center justify-center transition-transform hover:scale-105"
      style={{
        bottom: 24,
        left: 24,
        width: 52,
        height: 52,
        borderRadius: 999,
        background: "rgba(11,13,10,0.85)",
        border: "1px solid rgba(232,154,10,0.55)",
        boxShadow: "0 0 24px -4px rgba(232,154,10,0.55)",
        backdropFilter: "blur(6px)",
        color: "#e89a0a",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: -6,
          borderRadius: 999,
          background: "radial-gradient(circle, rgba(232,154,10,0.35) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      {enabled ? (
        <Volume2 size={20} strokeWidth={1.8} className="animate-pulse" />
      ) : (
        <VolumeX size={20} strokeWidth={1.8} />
      )}
    </button>
  );
}
