import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { Music, Volume2, VolumeX, Waves } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { showAudioControl } from "@/lib/audio-routes";
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

/**
 * iOS Safari makes HTMLAudioElement.volume READ-ONLY — assignments are silently
 * ignored. That would make every fade below a no-op on iPhone (music would snap
 * in at full blast, and the silent unlock priming would be audible).
 *
 * So all gain is done through a Web Audio graph: element -> GainNode ->
 * destination. GainNode.gain works identically on iOS, Android and desktop.
 * If Web Audio is unavailable we fall back to el.volume (fine on Android).
 */
let sharedCtx: AudioContext | null = null;
let webAudioBroken = false;
const gainByEl = new WeakMap<HTMLAudioElement, GainNode>();

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || webAudioBroken) return null;
  if (sharedCtx) return sharedCtx;
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) {
    webAudioBroken = true;
    return null;
  }
  try {
    sharedCtx = new AC();
  } catch {
    webAudioBroken = true;
    sharedCtx = null;
  }
  return sharedCtx;
}

/** Route an element through a GainNode once; returns null if Web Audio is unusable. */
function gainFor(el: HTMLAudioElement): GainNode | null {
  const ctx = getAudioContext();
  if (!ctx) return null;
  const existing = gainByEl.get(el);
  if (existing) return existing;
  try {
    const src = ctx.createMediaElementSource(el);
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(g);
    g.connect(ctx.destination);
    gainByEl.set(el, g);
    // Element volume must sit at 1 — the GainNode is now the only volume control.
    try {
      el.volume = 1;
    } catch {
      /* iOS ignores this anyway */
    }
    return g;
  } catch {
    // Same-origin CDN assets, so this should not throw; if it does, degrade.
    return null;
  }
}

/** A suspended context produces total silence, so resume before any playback. */
export function resumeAudioContext() {
  const ctx = sharedCtx;
  if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
}

function readLevel(el: HTMLAudioElement) {
  const g = gainFor(el);
  return g ? g.gain.value : el.volume;
}

function writeLevel(el: HTMLAudioElement, v: number) {
  const clamped = Math.max(0, Math.min(1, v));
  const g = gainFor(el);
  if (g) {
    g.gain.value = clamped;
    return;
  }
  try {
    el.volume = clamped;
  } catch {
    /* read-only on iOS without Web Audio — nothing we can do */
  }
}

type Fadable = HTMLAudioElement & {
  __fadeToken?: number;
  __stopTimer?: ReturnType<typeof setTimeout>;
};
function fade(el: HTMLAudioElement, to: number, ms = FADE_MS) {
  const node = el as Fadable;
  // Cancel any in-flight fade on this node so ramps never fight each other.
  const token = (node.__fadeToken ?? 0) + 1;
  node.__fadeToken = token;
  clearTimeout(node.__stopTimer);
  const from = readLevel(el);
  if (from === to && (to === 0 ? el.paused : !el.paused)) return;
  // requestAnimationFrame is frozen while the phone screen is locked or the app
  // is backgrounded, so the ramp below may never run and the element would keep
  // playing. Timers still fire there, so guarantee the pause with one.
  if (to === 0) {
    node.__stopTimer = setTimeout(() => {
      if (node.__fadeToken !== token) return;
      writeLevel(el, 0);
      try {
        el.pause();
      } catch {
        /* already stopped */
      }
    }, ms + 150);
  }
  const start = performance.now();
  if (to > 0 && el.paused) {
    writeLevel(el, 0);
    resumeAudioContext();
    el.play().catch(() => {});
  }
  const step = (t: number) => {
    if (node.__fadeToken !== token) return; // superseded by a newer fade
    const k = Math.min(1, (t - start) / ms);
    // Ease-in-out so the ramp never sounds like an abrupt cut.
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    writeLevel(el, from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
    else if (to === 0) el.pause();
  };
  requestAnimationFrame(step);
}

/**
 * rAF is frozen while a tab/app is backgrounded, so a fade started right before
 * a mobile backgrounding can strand a node mid-ramp. Snap any such node to its
 * target when we come back. Called on visibilitychange.
 */
function settleFades(els: (HTMLAudioElement | null)[]) {
  els.forEach((el) => {
    if (!el) return;
    if (el.paused && readLevel(el) !== 0) writeLevel(el, 0);
  });
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

  // Bumped on unlock gesture / app resume to re-drive blocked autoplay.
  const [unlockTick, setUnlockTick] = useState(0);
  const mainRef = useRef<HTMLAudioElement | null>(null);

  const lobbyRef = useRef<HTMLAudioElement | null>(null);
  const debriefRef = useRef<HTMLAudioElement | null>(null);
  const countdownRef = useRef<HTMLAudioElement | null>(null);
  const sectorRef = useRef<HTMLAudioElement | null>(null);
  const teamCapRef = useRef<HTMLAudioElement | null>(null);
  const enemyCapRef = useRef<HTMLAudioElement | null>(null);
  const respawnRef = useRef<HTMLAudioElement | null>(null);


  // Audio is created lazily: only once the player reaches a game route (or has
  // opted into music, which also plays on public pages). Casual visitors on
  // home/events/pricing download no audio at all. Once true it never resets.
  const isGameRoute = isLobbyPath(pathname) || isMissionPath(pathname) || isSilentPath(pathname);
  const [audioWanted, setAudioWanted] = useState(false);
  useEffect(() => {
    if (!audioWanted && (isGameRoute || musicEnabled)) setAudioWanted(true);
  }, [audioWanted, isGameRoute, musicEnabled]);
  const [audioReady, setAudioReady] = useState(false);

  // Instantiate audio nodes once. Levels are controlled by the Web Audio gain
  // graph (see writeLevel) because iOS ignores el.volume assignments.
  useEffect(() => {
    if (!audioWanted) return;
    const mk = (url: string, opts: { loop?: boolean; preload?: "auto" | "none" }) => {
      const a = new Audio(url);
      a.loop = !!opts.loop;
      a.preload = opts.preload ?? "auto";
      // iOS refuses inline playback for media without this hint in some webviews.
      a.setAttribute("playsinline", "");
      (a as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      writeLevel(a, 0);
      return a;
    };
    const main = mk(songMain.url, { loop: true, preload: "auto" });
    const lobby = mk(songLobby.url, { loop: true, preload: "auto" });
    // Debrief is heavier and not needed until match end — lazy load.
    const debrief = mk(songDebrief.url, { preload: "none" });
    // SFX must fire with zero latency, and iOS will not fetch mid-event without
    // a prior gesture — so they are eagerly buffered instead of preload="none".
    const cd = mk(sfxCountdown.url, { preload: "auto" });
    const sec = mk(sfxSector.url, { preload: "auto" });
    const teamCap = mk(sfxTeamCapture.url, { preload: "auto" });
    const enemyCap = mk(sfxEnemyCapture.url, { preload: "auto" });
    const rsp = mk(sfxRespawn.url, { preload: "auto" });

    mainRef.current = main;
    lobbyRef.current = lobby;
    debriefRef.current = debrief;
    countdownRef.current = cd;
    sectorRef.current = sec;
    teamCapRef.current = teamCap;
    enemyCapRef.current = enemyCap;
    respawnRef.current = rsp;
    setAudioReady(true);
    return () => {
      [main, lobby, debrief, cd, sec, teamCap, enemyCap, rsp].forEach((a) => {

        try {
          a.pause();
          a.src = "";
        } catch {}
      });
    };
  }, [audioWanted]);

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
      // Smooth fade-out — music is never cut off abruptly.
      [main, lobby, debrief].forEach((a) => {
        try {
          fade(a, 0, 900);
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
    // unlockTick re-runs this after a gesture / app resume, because autoplay
    // before the first gesture is refused on both iOS and Android.
  }, [musicEnabled, activeTrack, unlockTick, audioReady]);


  // SFX event bridges. Countdown is dispatched by pre-match at T-14s AND by
  // /spawn on respawn scan; sector-secured by /capture on success.
  useEffect(() => {
    // One shared one-shot player: gain via Web Audio (iOS-safe), no load()
    // call — load() aborts the buffered stream and forces a refetch, which is
    // exactly what makes SFX arrive late (or not at all) on mobile data.
    const playOneShot = (el: HTMLAudioElement | null, vol: number) => {
      if (!el || !sfxEnabled) return;
      resumeAudioContext();
      try {
        el.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
      writeLevel(el, vol);
      const p = el.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // Autoplay refused (no gesture yet) or the buffer was evicted by iOS
          // memory pressure — re-arm the element so the next trigger works.
          try {
            el.load();
          } catch {
            /* ignore */
          }
        });
      }
    };
    const onCountdown = () => playOneShot(countdownRef.current, 1);
    const onSector = () => playOneShot(sectorRef.current, 0.95);
    const onMatchStart = () => setMissionPhase("active");
    const onMatchEnd = () => setMissionPhase("debrief");
    const onDebriefExit = () => setMissionPhase("lobby");
    const onLobby = (e: Event) => {
      const detail = (e as CustomEvent<{ active: boolean }>).detail;
      // Explicit lobby signal from misija — keep us in lobby phase.
      if (detail && detail.active) setMissionPhase("lobby");
    };
    const onTeamCapture = () => playOneShot(teamCapRef.current, 0.95);
    const onEnemyCapture = () => playOneShot(enemyCapRef.current, 0.95);
    const onRespawnSfx = () => playOneShot(respawnRef.current, 0.95);
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

  // Cut one-shots immediately when effects are disabled or the match ends.
  useEffect(() => {
    if (sfxEnabled && missionPhase !== "debrief") return;
    [countdownRef.current, sectorRef.current, teamCapRef.current, enemyCapRef.current, respawnRef.current].forEach((a) => {
      if (!a) return;
      a.pause();
      try { a.currentTime = 0; } catch { /* not seekable yet */ }
      writeLevel(a, 0);
    });
  }, [sfxEnabled, missionPhase]);

  // Unlock: on first user interaction, resume the AudioContext and prime every
  // node with a truly silent play (gain 0, not el.volume 0 — iOS ignores that)
  // so later programmatic playback is accepted. Never touches a playing node.
  const unlockedRef = useRef(false);

  const unlock = useCallback(() => {
    // Always resume: iOS suspends the context on interruptions (calls, silent
    // switch, backgrounding), and only a gesture can bring it back.
    resumeAudioContext();
    if (unlockedRef.current) return;
    // Nodes not created yet (non-game page): stay un-primed so the next
    // gesture after they exist performs the priming.
    if (!mainRef.current) return;
    unlockedRef.current = true;
    const nodes = [
      mainRef.current,
      lobbyRef.current,
      debriefRef.current,
      countdownRef.current,
      sectorRef.current,
      teamCapRef.current,
      enemyCapRef.current,
      respawnRef.current,
    ];
    const priming: Promise<void>[] = [];
    nodes.forEach((a) => {
      if (!a || !a.paused) return;
      try {
        writeLevel(a, 0);
        priming.push(a.play()
          .then(() => {
            try {
              a.pause();
              a.currentTime = 0;
            } catch {
              /* ignore */
            }
          })
          .catch(() => {
            /* still locked; the next gesture retries */
          }));
      } catch {
        /* ignore */
      }
    });
    // Autoplay was likely refused before this gesture, so re-run the music
    // effect to actually start the track the route asks for.
    setUnlockTick((n) => n + 1);
    void Promise.allSettled(priming).then(() => setUnlockTick((n) => n + 1));
  }, []);

  // Any first tap anywhere counts as the unlock gesture — a player who enabled
  // music on a previous visit should not have to open the FAB again.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onGesture = () => unlock();
    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("touchend", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("touchend", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [unlock]);

  // Mobile lifecycle: returning to the tab/app must resume the context, settle
  // any fade that was frozen mid-ramp, and restart music iOS silently paused.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      resumeAudioContext();
      settleFades([mainRef.current, lobbyRef.current, debriefRef.current]);
      setUnlockTick((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, []);


  const value = useMemo<Ctx>(
    () => ({ musicEnabled, sfxEnabled, toggleMusic, toggleSfx, setMusicEnabled, setSfxEnabled, unlock }),
    [musicEnabled, sfxEnabled, toggleMusic, toggleSfx, setMusicEnabled, setSfxEnabled, unlock],
  );

  return (
    <AudioCtx.Provider value={value}>
      {children}
      <AudioFab track={activeTrack} />
    </AudioCtx.Provider>
  );
}

function AudioFab({ track }: { track: Track }) {
  const { musicEnabled, sfxEnabled, toggleMusic, toggleSfx, setMusicEnabled, unlock } = useAmbientAudio();
  const { pathname } = useLocation();
  const { lang } = useLang();
  const en = lang === "en";
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const debrief = track === "debrief";
  const anythingOn = debrief ? musicEnabled : track === "silent" ? sfxEnabled : musicEnabled || sfxEnabled;

  const onFabClick = () => {
    unlock();
    if (debrief) {
      setOpen(false);
      setMusicEnabled(!musicEnabled);
    } else {
      setOpen((v) => !v);
    }
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

  if (!showAudioControl(pathname, musicEnabled)) return null;

  return (
    <div ref={wrapRef} className="audio-control">
      <style>{`
        .audio-control {
          --audio-background: rgba(11,13,10,0.72);
          --audio-panel: rgba(11,13,10,0.94);
          --audio-border: rgba(224,176,78,0.35);
          --audio-gold: #E0B04E;
          --audio-active: rgba(224,176,78,0.16);
          --audio-muted: rgba(236,227,196,0.75);
          --audio-off: rgba(236,227,196,0.25);
          --audio-on: #3ddc84;
          --audio-shadow: 0 18px 40px -12px rgba(0,0,0,0.75);
          position: fixed; bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          left: calc(16px + env(safe-area-inset-left, 0px)); z-index: 900; isolation: isolate;
        }
        .audio-control .audio-button {
          width: 44px; height: 44px; border-radius: 999px; padding: 0;
          background: var(--audio-background); border: 1px solid var(--audio-border);
          color: var(--audio-gold); box-shadow: none; cursor: pointer; letter-spacing: 0;
        }
        .audio-control .audio-button svg { width: 18px; height: 18px; opacity: 0.8; }
        .audio-control .audio-pill { width: auto; padding: 0 14px; font-size: 10px; font-family: 'Michroma', monospace; }
        .audio-control .audio-pill[aria-pressed="true"] { border-color: var(--audio-gold); }
        .audio-control .audio-menu {
          position: absolute; bottom: 52px; left: 0; width: 260px;
          max-width: calc(100vw - 32px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px));
          background: var(--audio-panel); border: 1px solid var(--audio-border);
          box-shadow: var(--audio-shadow); padding: 8px; border-radius: 8px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .audio-control .audio-row {
          justify-content: flex-start; gap: 10px; padding: 8px 10px; height: auto; min-height: 44px;
          background: transparent; border: 1px solid var(--audio-border); color: var(--audio-muted);
          font-family: 'Michroma', monospace; font-size: 10px; letter-spacing: 0; text-align: left;
        }
        .audio-control .audio-row[aria-checked="true"] { background: var(--audio-active); border-color: var(--audio-gold); color: var(--audio-gold); }
        .audio-control .audio-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--audio-off); }
        .audio-control .audio-row[aria-checked="true"] .audio-dot { background: var(--audio-on); }
        .audio-control button:focus-visible { outline: 2px solid var(--audio-gold); outline-offset: 3px; box-shadow: none; }
        @media (prefers-reduced-motion: reduce) { .audio-control *, .audio-control *::before, .audio-control *::after { transition: none !important; animation: none !important; } }
      `}</style>
      {open && !debrief && (
        <div role="menu" aria-label={en ? "Sound" : "Zvok"} className="audio-menu">
          {track !== "silent" && (
            <FabRow
              active={musicEnabled}
              onClick={() => { unlock(); toggleMusic(); }}
              icon={<Music size={14} />}
              label={en ? "MUSIC" : "GLASBA"}
            />
          )}
          <FabRow
            active={sfxEnabled}
            onClick={() => { unlock(); toggleSfx(); }}
            icon={<Waves size={14} />}
            label={en ? "SOUND EFFECTS" : "ZVOČNI EFEKTI"}
          />
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        onClick={onFabClick}
        aria-label={en ? "Sound" : "Zvok"}
        aria-expanded={debrief ? undefined : open}
        aria-haspopup={debrief ? undefined : "menu"}
        aria-pressed={debrief ? musicEnabled : undefined}
        className={`audio-button${debrief ? " audio-pill" : ""}`}
      >
        {anythingOn ? (
          <Volume2 size={18} strokeWidth={1.8} fill={debrief ? "currentColor" : "none"} />
        ) : (
          <VolumeX size={18} strokeWidth={1.8} />
        )}
        {debrief && <span>{en ? "MUSIC" : "GLASBA"}</span>}
      </Button>
    </div>
  );
}

function FabRow({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      role="menuitemcheckbox"
      aria-checked={active}
      onClick={onClick}
      className="audio-row"
    >
      <span className="inline-flex">{icon}</span>
      <span className="flex-1">{label}</span>
      <span aria-hidden className="audio-dot" />
    </Button>
  );
}
