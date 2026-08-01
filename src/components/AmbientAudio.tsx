import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { Music, Volume2, VolumeX, Waves } from "lucide-react";
import songMain from "@/assets/SONG_MAIN.mp3.asset.json";
import songLobby from "@/assets/SONG_LOBBY.mp3.asset.json";
import songDebrief from "@/assets/SONG_DEBRIEFING.mp3.asset.json";
import sfxCountdown from "@/assets/SOUNDEFFECT_STARTCOUNTOWN.mp3.asset.json";
import sfxSector from "@/assets/SOUNDEFFECT_SECTORSECURED.mp3.asset.json";
import sfxTeamCapture from "@/assets/SOUNDEFFECT_TEAMCAPTUREDSECTOR.mp3.asset.json";
import sfxEnemyCapture from "@/assets/SOUNDEFFECT_ENEMYCAPTUREDSECTOR.mp3.asset.json";
import sfxRespawn from "@/assets/SOUNDEFFECT_RESPAWNTIMER.mp3.asset.json";


/**
 * Global audio orchestrator. One AudioContext at root so switching between
 * pages (Home -> Lobby -> Game) never restarts a track. Music vs SFX are
 * independent global toggles persisted to localStorage. Casual visitors get
 * both OFF by default — nothing plays until they opt in.
 *
 * Music routing (when musicEnabled):
 *   - Homepage & public info pages  -> SONG_MAIN
 *   - /join, /admin-pregled, /misija-in-lobby -> SONG_LOBBY
 *   - Active in-match (post match-start, pre match-end) -> SILENCE
 *   - Post match end / debrief -> SONG_DEBRIEFING
 *
 * SFX (when sfxEnabled):
 *   - spartanops:countdown  -> SOUNDEFFECT_STARTCOUNTOWN.mp3 (T-15s pre-match, respawn scan)
 *   - spartanops:capture-success -> SOUNDEFFECT_SECTORSECURED.mp3
 */

type Ctx = {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  toggleMusic: () => void;
  toggleSfx: () => void;
  setMusicEnabled: (v: boolean) => void;
  setSfxEnabled: (v: boolean) => void;
  unlock: () => void;
};

const AudioCtx = createContext<Ctx | null>(null);

export function useAmbientAudio() {
  const c = useContext(AudioCtx);
  if (!c) throw new Error("useAmbientAudio must be inside AmbientAudioProvider");
  return c;
}

const MUSIC_KEY = "spartanops:music-enabled";
const SFX_KEY = "spartanops:sfx-enabled";

const FADE_MS = 1400;
type Fadable = HTMLAudioElement & { __fadeToken?: number };
function fade(el: HTMLAudioElement, to: number, ms = FADE_MS) {
  const node = el as Fadable;
  // Cancel any in-flight fade on this node so ramps never fight each other.
  const token = (node.__fadeToken ?? 0) + 1;
  node.__fadeToken = token;
  const from = el.volume;
  if (from === to && (to === 0 ? el.paused : !el.paused)) return;
  const start = performance.now();
  if (to > 0 && el.paused) {
    el.volume = 0;
    el.play().catch(() => {});
  }
  const step = (t: number) => {
    if (node.__fadeToken !== token) return; // superseded by a newer fade
    const k = Math.min(1, (t - start) / ms);
    // Ease-in-out so the ramp never sounds like an abrupt cut.
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    el.volume = Math.max(0, Math.min(1, from + (to - from) * e));
    if (k < 1) requestAnimationFrame(step);
    else if (to === 0) el.pause();
  };
  requestAnimationFrame(step);
}

type Track = "main" | "lobby" | "debrief" | "silent";

function isLobbyPath(pathname: string) {
  return /^\/(join|admin-pregled)(\b|\/|$)/i.test(pathname);
}
function isMissionPath(pathname: string) {
  return /^\/misija(\b|\/|$)/i.test(pathname);
}
// In-field tactical views must stay musically silent — only SFX play there.
function isSilentPath(pathname: string) {
  return /^\/(capture|scan|spawn)(\b|\/|$)/i.test(pathname);
}

export function AmbientAudioProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [musicEnabled, setMusicEnabledState] = useState(false);
  const [sfxEnabled, setSfxEnabledState] = useState(false);
  // Mission phase, only meaningful on /misija. Updated by event bridges.
  const [missionPhase, setMissionPhase] = useState<"lobby" | "active" | "debrief">("lobby");

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (window.localStorage.getItem(MUSIC_KEY) === "1") setMusicEnabledState(true);
      if (window.localStorage.getItem(SFX_KEY) === "1") setSfxEnabledState(true);
    } catch {
      /* ignore */
    }
  }, []);
  const setMusicEnabled = useCallback((v: boolean) => {
    setMusicEnabledState(v);
    try {
      localStorage.setItem(MUSIC_KEY, v ? "1" : "0");
    } catch {}
  }, []);
  const setSfxEnabled = useCallback((v: boolean) => {
    setSfxEnabledState(v);
    try {
      localStorage.setItem(SFX_KEY, v ? "1" : "0");
    } catch {}
  }, []);
  const toggleMusic = useCallback(() => setMusicEnabled(!musicEnabled), [musicEnabled, setMusicEnabled]);
  const toggleSfx = useCallback(() => setSfxEnabled(!sfxEnabled), [sfxEnabled, setSfxEnabled]);

  // Reset mission phase whenever we leave /misija.
  useEffect(() => {
    if (!isMissionPath(pathname)) setMissionPhase("lobby");
  }, [pathname]);

  const mainRef = useRef<HTMLAudioElement | null>(null);
  const lobbyRef = useRef<HTMLAudioElement | null>(null);
  const debriefRef = useRef<HTMLAudioElement | null>(null);
  const countdownRef = useRef<HTMLAudioElement | null>(null);
  const sectorRef = useRef<HTMLAudioElement | null>(null);
  const teamCapRef = useRef<HTMLAudioElement | null>(null);
  const enemyCapRef = useRef<HTMLAudioElement | null>(null);
  const respawnRef = useRef<HTMLAudioElement | null>(null);


  // Instantiate audio nodes once.
  useEffect(() => {
    const main = new Audio(songMain.url);
    main.loop = true;
    main.preload = "auto";
    main.volume = 0;
    const lobby = new Audio(songLobby.url);
    lobby.loop = true;
    lobby.preload = "auto";
    lobby.volume = 0;
    // Debrief is heavier and not needed until match end — lazy load.
    const debrief = new Audio(songDebrief.url);
    debrief.loop = false;
    debrief.preload = "none";
    debrief.volume = 0;
    const cd = new Audio(sfxCountdown.url);
    cd.preload = "none";
    cd.volume = 1;
    const sec = new Audio(sfxSector.url);
    sec.preload = "none";
    sec.volume = 0.95;
    const teamCap = new Audio(sfxTeamCapture.url);
    teamCap.preload = "none";
    teamCap.volume = 0.95;
    const enemyCap = new Audio(sfxEnemyCapture.url);
    enemyCap.preload = "none";
    enemyCap.volume = 0.95;
    const rsp = new Audio(sfxRespawn.url);
    rsp.preload = "none";
    rsp.volume = 0.95;
    mainRef.current = main;
    lobbyRef.current = lobby;
    debriefRef.current = debrief;
    countdownRef.current = cd;
    sectorRef.current = sec;
    teamCapRef.current = teamCap;
    enemyCapRef.current = enemyCap;
    respawnRef.current = rsp;
    return () => {
      [main, lobby, debrief, cd, sec, teamCap, enemyCap, rsp].forEach((a) => {

        try {
          a.pause();
          a.src = "";
        } catch {}
      });
    };
  }, []);

  // Compute active music track from route + mission phase.
  const activeTrack: Track = useMemo(() => {
    if (isSilentPath(pathname)) return "silent";
    if (isMissionPath(pathname)) {
      if (missionPhase === "active") return "silent";
      if (missionPhase === "debrief") return "debrief";
      return "lobby";
    }
    if (isLobbyPath(pathname)) return "lobby";
    return "main";
  }, [pathname, missionPhase]);

  // Drive playback whenever music enable or the desired track changes.
  useEffect(() => {
    const main = mainRef.current,
      lobby = lobbyRef.current,
      debrief = debriefRef.current;
    if (!main || !lobby || !debrief) return;
    const stopAll = () => {
      [main, lobby, debrief].forEach((a) => {
        try {
          fade(a, 0);
        } catch {}
      });
    };
    if (!musicEnabled) {
      // Hard stop — silence must be immediate on mute.
      [main, lobby, debrief].forEach((a) => {
        try {
          a.pause();
          a.volume = 0;
        } catch {}
      });
      return;
    }
    if (activeTrack === "silent") {
      stopAll();
      return;
    }
    if (activeTrack === "debrief") {
      fade(main, 0);
      fade(lobby, 0);
      debrief.preload = "auto";
      fade(debrief, 0.65);
      return;
    }
    if (activeTrack === "lobby") {
      fade(main, 0);
      fade(debrief, 0);
      fade(lobby, 0.55);
      return;
    }
    // main
    fade(lobby, 0);
    fade(debrief, 0);
    fade(main, 0.5);
  }, [musicEnabled, activeTrack]);

  // SFX event bridges. Countdown is dispatched by pre-match at T-14s AND by
  // /spawn on respawn scan; sector-secured by /capture on success.
  useEffect(() => {
    const onCountdown = () => {
      const cd = countdownRef.current;
      if (!cd || !sfxEnabled) return;
      try {
        cd.load(); // Prisili iOS, da pravilno inicializira zvok šele ob kliku/dogodku
        cd.currentTime = 0;
      } catch {}
      cd.volume = 1;
      cd.play().catch(() => {});
    };

    const onSector = () => {
      const s = sectorRef.current;
      if (!s || !sfxEnabled) return;
      try {
        s.load(); // Enako dodaj tukaj za sector secured zvok
        s.currentTime = 0;
      } catch {}
      s.volume = 0.95;
      s.play().catch(() => {});
    };
    const onMatchStart = () => setMissionPhase("active");
    const onMatchEnd = () => setMissionPhase("debrief");
    const onDebriefExit = () => setMissionPhase("lobby");
    const onLobby = (e: Event) => {
      const detail = (e as CustomEvent<{ active: boolean }>).detail;
      // Explicit lobby signal from misija — keep us in lobby phase.
      if (detail && detail.active) setMissionPhase("lobby");
    };
    const playOneShot = (ref: typeof sectorRef, vol: number) => {
      const a = ref.current;
      if (!a || !sfxEnabled) return;
      try {
        a.load();
        a.currentTime = 0;
      } catch {}
      a.volume = vol;
      a.play().catch(() => {});
    };
    const onTeamCapture = () => playOneShot(teamCapRef, 0.95);
    const onEnemyCapture = () => playOneShot(enemyCapRef, 0.95);
    const onRespawnSfx = () => playOneShot(respawnRef, 0.95);
    window.addEventListener("spartanops:sfx-team-capture", onTeamCapture);
    window.addEventListener("spartanops:sfx-enemy-capture", onEnemyCapture);
    window.addEventListener("spartanops:sfx-respawn", onRespawnSfx);
    window.addEventListener("spartanops:countdown", onCountdown);
    window.addEventListener("spartanops:capture-success", onSector);

    window.addEventListener("spartanops:match-start", onMatchStart);
    window.addEventListener("spartanops:match-end", onMatchEnd);
    window.addEventListener("spartanops:debrief-exit", onDebriefExit);
    window.addEventListener("spartanops:lobby", onLobby as EventListener);
    return () => {
      window.removeEventListener("spartanops:sfx-team-capture", onTeamCapture);
      window.removeEventListener("spartanops:sfx-enemy-capture", onEnemyCapture);
      window.removeEventListener("spartanops:sfx-respawn", onRespawnSfx);
      window.removeEventListener("spartanops:countdown", onCountdown);
      window.removeEventListener("spartanops:capture-success", onSector);

      window.removeEventListener("spartanops:match-start", onMatchStart);
      window.removeEventListener("spartanops:match-end", onMatchEnd);
      window.removeEventListener("spartanops:debrief-exit", onDebriefExit);
      window.removeEventListener("spartanops:lobby", onLobby as EventListener);
    };
  }, [sfxEnabled]);

  // Unlock: on first user interaction, prime audio nodes with a silent play so
  // mobile Safari/Chrome accepts later programmatic playback. Runs once, and
  // never touches a node that is already playing (that would cut the music).
  const unlockedRef = useRef(false);
  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    const nodes = [mainRef.current, lobbyRef.current, debriefRef.current, countdownRef.current, sectorRef.current, teamCapRef.current, enemyCapRef.current, respawnRef.current];
    nodes.forEach((a) => {
      if (!a || !a.paused) return;
      const wasVol = a.volume;
      try {
        a.volume = 0;
        a.play()
          .then(() => {
            try {
              a.pause();
              a.volume = wasVol;
            } catch {}
          })
          .catch(() => {
            try {
              a.volume = wasVol;
            } catch {}
          });
      } catch {
        /* ignore */
      }
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ musicEnabled, sfxEnabled, toggleMusic, toggleSfx, setMusicEnabled, setSfxEnabled, unlock }),
    [musicEnabled, sfxEnabled, toggleMusic, toggleSfx, setMusicEnabled, setSfxEnabled, unlock],
  );

  return (
    <AudioCtx.Provider value={value}>
      {children}
      <AudioFab />
    </AudioCtx.Provider>
  );
}

function AudioFab() {
  const { musicEnabled, sfxEnabled, toggleMusic, toggleSfx, unlock } = useAmbientAudio();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const anythingOn = musicEnabled || sfxEnabled;

  const onFabClick = () => {
    unlock();
    setOpen((v) => !v);
  };

  // Close the music/SFX card when clicking (or tapping) anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      const el = wrapRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "fixed", bottom: 24, left: 24, zIndex: 60 }}>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            bottom: 62,
            left: 0,
            minWidth: 190,
            background: "rgba(11,13,10,0.94)",
            border: "1px solid rgba(224,176,78,0.55)",
            boxShadow: "0 18px 40px -12px rgba(0,0,0,0.75), 0 0 24px -6px rgba(224,176,78,0.45)",
            backdropFilter: "blur(8px)",
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            animation: "sop-slideup 180ms ease-out",
          }}
        >
          <FabRow
            active={musicEnabled}
            onClick={() => {
              unlock();
              toggleMusic();
            }}
            icon={<Music size={14} />}
            label="MUSIC"
          />
          <FabRow
            active={sfxEnabled}
            onClick={() => {
              unlock();
              toggleSfx();
            }}
            icon={<Waves size={14} />}
            label="SFX"
          />
          <style>{`@keyframes sop-slideup { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
      )}
      <button
        type="button"
        onClick={onFabClick}
        aria-label="Audio controls"
        aria-expanded={open}
        style={{
          width: 52,
          height: 52,
          borderRadius: 999,
          background: "rgba(11,13,10,0.85)",
          border: "1px solid rgba(224,176,78,0.55)",
          boxShadow: "0 0 24px -4px rgba(224,176,78,0.55)",
          backdropFilter: "blur(6px)",
          color: "#E0B04E",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          position: "relative",
        }}
      >
        {anythingOn ? (
          <Volume2 size={20} strokeWidth={1.8} className={musicEnabled ? "animate-pulse" : ""} />
        ) : (
          <VolumeX size={20} strokeWidth={1.8} />
        )}
      </button>
    </div>
  );
}

function FabRow({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={active}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        background: active ? "rgba(224,176,78,0.16)" : "transparent",
        border: `1px solid ${active ? "#E0B04E" : "rgba(224,176,78,0.25)"}`,
        color: active ? "#E0B04E" : "rgba(236,227,196,0.75)",
        fontFamily: "'Michroma', monospace",
        fontSize: 10,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span style={{ display: "inline-flex" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: active ? "#3ddc84" : "rgba(236,227,196,0.25)",
          boxShadow: active ? "0 0 8px #3ddc84" : "none",
        }}
      />
    </button>
  );
}
