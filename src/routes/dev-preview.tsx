import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, AlertTriangle, Shield, Crosshair, Skull, Info, Wifi, WifiOff, MapPin } from "lucide-react";

export const Route = createFileRoute("/dev-preview")({
  head: () => ({
    meta: [
      { title: "SpartanOps · Dev Preview Gallery" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DevPreviewPage,
});

// ============= Design tokens (match SpartanOps tactical system) =============
const BG = "#0b0d09";
const PANEL = "#13160f";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";
const ACCENT = "#E0B04E";

type TeamKey = "modra" | "rdeca" | "rumena" | "zelena" | "vijolicna";
type DeviceKey = "android" | "iphone" | "desktop";

const TEAM_COLOR: Record<TeamKey, string> = {
  modra: "#3b82f6",
  rdeca: "#ef4444",
  rumena: "#eab308",
  zelena: "#22c55e",
  vijolicna: "#a855f7",
};
const TEAM_LABEL_SL: Record<TeamKey, string> = {
  modra: "MODRA",
  rdeca: "RDEČA",
  rumena: "RUMENA",
  zelena: "ZELENA",
  vijolicna: "VIJOLIČNA",
};
const TEAM_LABEL_EN: Record<TeamKey, string> = {
  modra: "BLUE",
  rdeca: "RED",
  rumena: "YELLOW",
  zelena: "GREEN",
  vijolicna: "PURPLE",
};

// Placeholder rosters/scoreboards
const PLACEHOLDER_PLAYERS = [
  { name: "Kozjak_Marko", team: "modra" as TeamKey, captures: 4, deaths: 1, respawn: 0, warn: false, phone: "+386 41 234 567" },
  { name: "Vipera_07", team: "modra" as TeamKey, captures: 2, deaths: 3, respawn: 47, warn: false, phone: "+386 40 111 222" },
  { name: "Ghost_Falcon", team: "rdeca" as TeamKey, captures: 3, deaths: 2, respawn: 0, warn: true, phone: "+386 51 987 654" },
  { name: "Nightshade", team: "rdeca" as TeamKey, captures: 1, deaths: 5, respawn: 22, warn: false, phone: "+386 31 555 111" },
];

// ============= Small primitives =============
function Kicker({ children, color = ACCENT }: { children: React.ReactNode; color?: string }) {
  return (
    <p style={{ fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.22em", color, textTransform: "uppercase", margin: 0, fontWeight: 700 }}>
      {children}
    </p>
  );
}

function CardShell({ title, sound, children, minHeight = 520 }: { title: string; sound?: string; children: React.ReactNode; minHeight?: number }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${ACCENT}33`, borderRadius: 10, padding: 14, boxShadow: `0 0 22px -14px ${ACCENT}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, borderBottom: `1px dashed ${ACCENT}33`, paddingBottom: 8 }}>
        <p style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.14em", color: ACCENT, textTransform: "uppercase", margin: 0, fontWeight: 700 }}>
          ▌ {title}
        </p>
      </div>
      <div style={{ position: "relative", minHeight, background: BG, borderRadius: 6, overflow: "hidden", border: `1px solid ${INK}18` }}>
        {children}
      </div>
      {sound && (
        <p style={{ fontFamily: "monospace", fontSize: 10, color: MUTED, letterSpacing: "0.1em", marginTop: 10, marginBottom: 0, textTransform: "uppercase" }}>
          🔊 SOUNDTRACK: <span style={{ color: INK }}>{sound}</span>
        </p>
      )}
    </div>
  );
}

function RealMisijaPreview({ preset, device }: { preset: "registration" | "team" | "prestart" | "hud"; device: DeviceKey }) {
  const src = `/misija?field=dev-preview&preview=1&preset=${preset}`;
  return (
    <iframe
      title={`Misija preview ${preset}`}
      src={src}
      style={{
        width: "100%",
        height: device === "desktop" ? 720 : 760,
        border: 0,
        display: "block",
        background: BG,
      }}
    />
  );
}

function TeamChangeNotificationMock({ en, team }: { en: boolean; team: TeamKey }) {
  const c = TEAM_COLOR[team];
  const label = en ? TEAM_LABEL_EN[team] : TEAM_LABEL_SL[team];
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div style={{ background: "#141008", border: `2px solid ${c}`, boxShadow: `0 0 32px ${c}80`, padding: "22px 18px", maxWidth: 380, width: "100%", textAlign: "center" }}>
        <p style={{ fontFamily: "'Michroma', monospace", fontSize: 12, color: ACCENT, letterSpacing: "0.14em", marginBottom: 12, textTransform: "uppercase", fontWeight: 700 }}>
          {en ? "⚠️ WARNING: NEW COMMAND RECEIVED" : "⚠️ POZOR: PRIŠLA JE NOVA KOMANDA"}
        </p>
        <p style={{ fontSize: 12, color: INK, lineHeight: 1.7, marginBottom: 18 }}>
          {en ? (
            <>Marshal has decided to balance the teams and placed you into <strong style={{ color: c }}>{label}</strong> team. From now on, you hold position and capture points for this team.</>
          ) : (
            <>Maršal vam je z namenom uravnoteženja ekip spremenil ekipo. Od sedaj naprej zasedate položaje in osvajate točke za <strong style={{ color: c }}>{label}</strong> ekipo.</>
          )}
        </p>
        <button style={{ width: "100%", background: ACCENT, color: BG, padding: "11px 14px", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, border: "none", cursor: "pointer" }}>
          {en ? "UNDERSTAND AND AGREE" : "RAZUMEM IN SE STRINJAM"}
        </button>
      </div>
    </div>
  );
}

function ScoreboardRow({ p, en }: { p: typeof PLACEHOLDER_PLAYERS[number]; en: boolean }) {
  const c = TEAM_COLOR[p.team];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 10, padding: "8px 10px", background: `${c}0f`, borderLeft: `3px solid ${c}`, alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: INK, fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
        {p.warn && <AlertTriangle size={11} style={{ color: "#ff6b6b", flexShrink: 0 }} />}
      </div>
      <span title="captures" style={{ fontFamily: "monospace", fontSize: 11, color: ACCENT }}><Crosshair size={10} style={{ display: "inline", marginRight: 3 }} />{p.captures}</span>
      <span title="deaths" style={{ fontFamily: "monospace", fontSize: 11, color: MUTED }}><Skull size={10} style={{ display: "inline", marginRight: 3 }} />{p.deaths}</span>
      <span style={{ fontFamily: "monospace", fontSize: 10, color: p.respawn ? "#ff6b6b" : MUTED, minWidth: 44, textAlign: "right" }}>
        {p.respawn ? `☠ 0:${String(p.respawn).padStart(2, "0")}` : (en ? "LIVE" : "ŽIV")}
      </span>
    </div>
  );
}

function SuccessCapturePopupMock({ en, team }: { en: boolean; team: TeamKey }) {
  const c = TEAM_COLOR[team];
  return (
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center, ${c}22, transparent 60%), ${BG}`, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div style={{ background: `${c}0a`, border: `2px solid ${c}`, boxShadow: `0 0 60px -10px ${c}88`, padding: 22, textAlign: "center", maxWidth: 340, width: "100%", borderRadius: 10 }}>
        <CheckCircle2 size={44} style={{ color: c, margin: "0 auto 8px", display: "block" }} />
        <p style={{ fontFamily: "monospace", fontSize: 10, color: c, letterSpacing: "0.22em", margin: 0, textTransform: "uppercase" }}>
          ▌ {en ? "SECTOR SECURED" : "SEKTOR ZAVZET"}
        </p>
        <h4 style={{ fontFamily: "'Michroma', monospace", fontSize: 15, color: INK, fontWeight: 700, margin: "10px 0 0", letterSpacing: "0.06em" }}>
          {en ? "POINT ALPHA CAPTURED" : "TOČKA ALPHA ZAVZETA"}
        </h4>
        <button style={{ marginTop: 18, width: "100%", background: c, color: BG, padding: "11px 12px", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", border: "none", cursor: "pointer", fontWeight: 700 }}>
          {en ? "ACKNOWLEDGE & RETURN TO HUD" : "POTRDI IN NAZAJ V HUD"}
        </button>
        <p style={{ fontFamily: "monospace", fontSize: 10, color: MUTED, marginTop: 12, letterSpacing: "0.04em", lineHeight: 1.5 }}>
          {en ? "// SECTOR SECURED. Telemetry transmitting in background. You may return to the field." : "// SEKTOR ZAVZET. Telemetrija se prenaša v ozadju. Lahko se vrnete na bojišče."}
        </p>
        <div style={{ marginTop: 10, height: 3, background: `${c}22`, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: "100%", background: c, boxShadow: `0 0 8px ${c}`, transformOrigin: "left center", animation: "dp-fill 6s linear infinite" }} />
        </div>
      </div>
      <style>{`@keyframes dp-fill { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }`}</style>
    </div>
  );
}

function PointAlreadyHeldMock({ en }: { en: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div style={{ background: `${ACCENT}0a`, border: `2px solid ${ACCENT}`, boxShadow: `0 0 60px -10px ${ACCENT}88`, padding: 24, textAlign: "center", maxWidth: 340, borderRadius: 10 }}>
        <CheckCircle2 size={44} style={{ color: ACCENT, margin: "0 auto 8px", display: "block" }} />
        <Kicker>{en ? "▌ SECTOR SECURED" : "▌ SEKTOR ZAVAROVAN"}</Kicker>
        <h4 style={{ fontFamily: "'Michroma', monospace", fontSize: 13, color: INK, fontWeight: 700, marginTop: 10, letterSpacing: "0.06em", lineHeight: 1.5 }}>
          {en ? "Sector ALPHA is already under your team's control!" : "Sektor ALPHA je že pod nadzorom vaše ekipe!"}
        </h4>
        <p style={{ fontFamily: "monospace", fontSize: 10, color: MUTED, marginTop: 16, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          {en ? "Returning to HUD..." : "Vračam v HUD..."}
        </p>
      </div>
    </div>
  );
}

function DuplicateScanMock({ en }: { en: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div style={{ background: "#1a1408", border: "2px solid #ff9b3d", padding: 22, textAlign: "center", maxWidth: 340, borderRadius: 10 }}>
        <AlertTriangle size={38} style={{ color: "#ff9b3d", margin: "0 auto 8px", display: "block" }} />
        <p style={{ fontFamily: "'Michroma', monospace", fontSize: 11, color: "#ff9b3d", letterSpacing: "0.18em", textTransform: "uppercase", margin: 0 }}>
          {en ? "DUPLICATE SCAN DETECTED" : "PODVOJEN SKEN"}
        </p>
        <p style={{ fontSize: 12, color: INK, marginTop: 12, lineHeight: 1.5 }}>
          {en ? "You already scanned this sector in the last 60 seconds. Returning to HUD." : "Ta sektor si že skeniral v zadnjih 60 sekundah. Vračamo v HUD."}
        </p>
      </div>
    </div>
  );
}

function ScanFailedGpsMock({ en }: { en: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div style={{ background: "#1a0808", border: "2px solid #ff3b3b", padding: 22, textAlign: "center", maxWidth: 340, borderRadius: 10 }}>
        <AlertTriangle size={38} style={{ color: "#ff3b3b", margin: "0 auto 8px", display: "block" }} />
        <p style={{ fontFamily: "'Michroma', monospace", fontSize: 12, color: "#ffd6d6", letterSpacing: "0.14em" }}>
          {en ? "Scan failed" : "Skeniranje ni uspelo"}
        </p>
        <p style={{ fontSize: 11.5, color: MUTED, marginTop: 12, lineHeight: 1.5 }}>
          {en ? "Spartacus protection requires active GPS to verify your capture. Please enable location services to proceed." : "Spartacus zaščita zahteva aktivno GPS povezavo za potrditev tvoje lokacije. Prosimo, omogoči lokacijske storitve."}
        </p>
        <button style={{ marginTop: 16, width: "100%", background: "#9eff3d", color: BG, padding: "11px 12px", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", border: "none", cursor: "pointer", fontWeight: 700, boxShadow: "0 0 22px -6px #9eff3d" }}>
          {en ? "ENABLE GPS" : "OMOGOČI GPS"}
        </button>
      </div>
    </div>
  );
}

function NoInternetMock({ en }: { en: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: BG, padding: 0 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "#3a1717", borderBottom: "1px solid #ff7070", color: "#fff", textAlign: "center", padding: "10px 14px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", boxShadow: "0 2px 18px #ff707055" }}>
          ⚠ {en ? "CONNECTION LOST — RECONNECTING…" : "PREKINJENA POVEZAVA — POSKUS PONOVNEGA POVEZOVANJA…"}
      </div>
      <div style={{ padding: "60px 20px", textAlign: "center", color: INK }}>
        <WifiOff size={46} style={{ color: "#ff7070", margin: "0 auto 12px", display: "block" }} />
        <p style={{ fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.14em", color: "#ffd6d6" }}>
          {en ? "OFFLINE MODE" : "BREZ POVEZAVE"}
        </p>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 10, lineHeight: 1.6 }}>
          {en ? "Your last known state is displayed. Live telemetry paused." : "Prikazano je vaše zadnje stanje. Živa telemetrija je začasno ustavljena."}
        </p>
      </div>
    </div>
  );
}

function SpartacusWarningMock({ en }: { en: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div style={{ background: "#1a0808", border: "2px solid #ff3b3b", boxShadow: "0 0 40px #ff3b3b80", padding: 22, textAlign: "center", maxWidth: 380, borderRadius: 10 }}>
        <Shield size={44} style={{ color: "#ff3b3b", margin: "0 auto 8px", display: "block" }} />
        <p style={{ fontFamily: "'Michroma', monospace", fontSize: 12, color: "#ff3b3b", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
          {en ? "⚠ MARSHAL WARNING" : "⚠ OPOZORILO MARŠALA"}
        </p>
        <p style={{ fontSize: 12, color: INK, marginTop: 12, lineHeight: 1.6 }}>
          {en ? "Suspicious activity detected on your last scan. Remain fair-play or you will be suspended." : "Zaznana je bila sumljiva aktivnost pri tvojem zadnjem skenu. Ohrani pošteno igro ali boš izključen."}
        </p>
        <button style={{ marginTop: 18, width: "100%", background: ACCENT, color: BG, padding: "11px 12px", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", border: "none", cursor: "pointer", fontWeight: 700 }}>
          {en ? "ACKNOWLEDGE" : "POTRDI"}
        </button>
      </div>
    </div>
  );
}

function SuspendedFrozenMock({ en }: { en: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div style={{ background: "#0a0a0a", border: "2px solid #ff3b3b", padding: 26, textAlign: "center", maxWidth: 380, borderRadius: 10 }}>
        <Skull size={54} style={{ color: "#ff3b3b", margin: "0 auto 10px", display: "block" }} />
        <p style={{ fontFamily: "'Michroma', monospace", fontSize: 14, color: "#ff3b3b", letterSpacing: "0.2em", fontWeight: 700, textTransform: "uppercase" }}>
          {en ? "PLAYER SUSPENDED" : "IGRALEC IZKLJUČEN"}
        </p>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 12, lineHeight: 1.6 }}>
          {en ? "You have been removed from active operations by Marshal. HUD is frozen." : "Maršal te je odstranil iz aktivne operacije. HUD je zamrznjen."}
        </p>
      </div>
    </div>
  );
}

function DebriefingMock({ en }: { en: boolean }) {
  return (
    <div style={{ padding: 18, color: INK, textAlign: "center" }}>
      <Kicker>{en ? "// DEBRIEFING" : "// PORAZDELITEV"}</Kicker>
      <h3 style={{ fontFamily: "'Michroma', monospace", fontSize: 22, marginTop: 10, letterSpacing: "0.1em", color: TEAM_COLOR.modra, textShadow: `0 0 20px ${TEAM_COLOR.modra}88` }}>
        {en ? "BLUE TEAM WINS" : "MODRA EKIPA ZMAGA"}
      </h3>
      <p style={{ fontFamily: "monospace", fontSize: 10, color: MUTED, letterSpacing: "0.2em", marginTop: 4 }}>{en ? "FINAL SCORE" : "KONČNI REZULTAT"}</p>
      <div style={{ display: "flex", justifyContent: "space-around", marginTop: 14, fontFamily: "'Michroma', monospace", fontSize: 32, fontWeight: 700 }}>
        <span style={{ color: TEAM_COLOR.modra }}>12</span>
        <span style={{ color: MUTED, fontSize: 20 }}>–</span>
        <span style={{ color: TEAM_COLOR.rdeca }}>7</span>
      </div>
      <div style={{ marginTop: 18, textAlign: "left", background: PANEL, border: `1px solid ${ACCENT}33`, padding: 12 }}>
        <p style={{ fontFamily: "monospace", fontSize: 10, color: ACCENT, letterSpacing: "0.14em", margin: 0, marginBottom: 8, textTransform: "uppercase" }}>{en ? "MVP RANKINGS" : "MVP RAZVRSTITEV"}</p>
        {[...PLACEHOLDER_PLAYERS].sort((a, b) => b.captures - a.captures).map((p, i) => (
          <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontFamily: "monospace", fontSize: 12, borderBottom: `1px dashed ${INK}12` }}>
            <span><span style={{ color: ACCENT }}>#{i + 1}</span> {p.name}</span>
            <span style={{ color: TEAM_COLOR[p.team] }}>{p.captures} caps · {p.deaths} ☠</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GamePausedMock({ en }: { en: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div style={{ background: "#141008", border: `2px solid ${ACCENT}`, boxShadow: `0 0 40px ${ACCENT}66`, padding: 24, textAlign: "center", maxWidth: 380, borderRadius: 10 }}>
        <div style={{ fontFamily: "'Michroma', monospace", fontSize: 40, color: ACCENT, marginBottom: 6 }}>⏸</div>
        <p style={{ fontFamily: "'Michroma', monospace", fontSize: 13, color: ACCENT, letterSpacing: "0.18em", fontWeight: 700, textTransform: "uppercase" }}>
          {en ? "// OPERATION PAUSED" : "// OPERACIJA PREKINJENA"}
        </p>
        <p style={{ fontSize: 12, color: INK, marginTop: 14, lineHeight: 1.7 }}>
          {en ? "The Marshal has temporarily frozen the match. Active telemetry, timers, and QR scanning protocols are suspended. Remain at your current positions." : "Maršal je začasno zamrznil igro. Aktivna telemetrija, števci in protokoli za skeniranje QR kod so onemogočeni. Ostanite na svojih trenutnih položajih."}
        </p>
      </div>
    </div>
  );
}

// ============= Page =============
function DevPreviewPage() {
  const [lang, setLang] = useState<"en" | "sl">("en");
  const [team, setTeam] = useState<TeamKey>("modra");
  const [device, setDevice] = useState<DeviceKey>("iphone");
  const en = lang === "en";

  const frameStyle: React.CSSProperties = device !== "desktop"
    ? { width: device === "iphone" ? 266 : 252, margin: "0 auto", border: `2px solid ${ACCENT}55`, borderRadius: device === "iphone" ? 22 : 12, overflow: "hidden", boxShadow: `0 0 30px -12px ${ACCENT}` }
    : { width: "100%" };

  const cards: { title: string; sound?: string; el: (extra?: React.ReactNode) => React.ReactNode }[] = [
    { title: en ? "DEPLOYMENT REGISTRATION" : "PRIJAVA V OPERACIJO", sound: "SONG_LOBBY.mp3", el: () => <RealMisijaPreview preset="registration" device={device} /> },
    { title: en ? "TEAM SELECTION" : "IZBIRA EKIPE", sound: "SONG_LOBBY.mp3", el: () => <RealMisijaPreview preset="team" device={device} /> },
    { title: en ? "TEAM CHANGE NOTIFICATION" : "OBVESTILO O ZAMENJAVI EKIPE", el: () => <TeamChangeNotificationMock en={en} team={team} /> },
    { title: en ? "PRE-START SCREEN" : "PRED-START", sound: "SOUNDEFFECT_STARTCOUNTOWN.mp3 (T-14s)", el: () => <RealMisijaPreview preset="prestart" device={device} /> },
    { title: en ? "PLAYER HUD (GAME)" : "IGRALSKI HUD (IGRA)", el: () => <RealMisijaPreview preset="hud" device={device} /> },
    { title: en ? "SUCCESS CAPTURE POPUP" : "USPEŠNO ZAVZETJE", sound: "SOUNDEFFECT_SECTORSECURED.mp3", el: () => <SuccessCapturePopupMock en={en} team={team} /> },
    { title: en ? "POINT ALREADY TAKEN" : "TOČKA ŽE ZAVZETA", el: () => <PointAlreadyHeldMock en={en} /> },
    { title: en ? "DUPLICATE SCAN NOTICE" : "PODVOJEN SKEN", el: () => <DuplicateScanMock en={en} /> },
    { title: en ? "SCAN FAILED (GPS OFF)" : "SKEN NEUSPEŠEN (GPS)", el: () => <ScanFailedGpsMock en={en} /> },
    { title: en ? "NO INTERNET CONNECTION" : "BREZ POVEZAVE", el: () => <NoInternetMock en={en} /> },
    { title: en ? "SPARTACUS WARNING" : "SPARTACUS OPOZORILO", el: () => <SpartacusWarningMock en={en} /> },
    { title: en ? "SUSPENDED / FROZEN" : "IZKLJUČEN / ZAMRZNJEN", el: () => <SuspendedFrozenMock en={en} /> },
    { title: en ? "DEBRIEFING SCREEN" : "PORAZDELITEV", sound: "SONG_DEBRIEFING.mp3", el: () => <DebriefingMock en={en} /> },
    { title: en ? "GAME PAUSED OVERLAY" : "IGRA PREKINJENA", el: () => <GamePausedMock en={en} /> },
  ];

  return (
    <div style={{ background: BG, minHeight: "100vh", color: INK, paddingBottom: 60 }}>
      {/* Top control bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: `${BG}f0`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${ACCENT}44`, padding: "14px 20px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontFamily: "'Michroma', monospace", fontSize: 13, letterSpacing: "0.14em", color: ACCENT, margin: 0, fontWeight: 700 }}>
              ▌ SPARTANOPS · DEV PREVIEW GALLERY
            </p>
            <p style={{ fontFamily: "monospace", fontSize: 10, color: MUTED, letterSpacing: "0.12em", margin: "3px 0 0", textTransform: "uppercase" }}>
              QA/dev only · not linked from nav · placeholder data
            </p>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
            <ToggleGroup label="LANG" value={lang} options={[{ v: "en", l: "EN" }, { v: "sl", l: "SLO" }]} onChange={(v) => setLang(v as any)} />
            <ToggleGroup label="DEVICE" value={device} options={[{ v: "android", l: "ANDROID" }, { v: "iphone", l: "IPHONE" }, { v: "desktop", l: "DESKTOP" }]} onChange={(v) => setDevice(v as any)} />
            <div>
              <p style={{ fontFamily: "monospace", fontSize: 9, color: MUTED, letterSpacing: "0.16em", margin: 0, marginBottom: 4, textTransform: "uppercase" }}>TEAM</p>
              <div style={{ display: "flex", gap: 4 }}>
                {(["modra", "rdeca", "rumena", "zelena", "vijolicna"] as TeamKey[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTeam(t)}
                    aria-label={TEAM_LABEL_EN[t]}
                    style={{
                      width: 26, height: 26, borderRadius: 4,
                      background: TEAM_COLOR[t],
                      border: team === t ? `2px solid ${INK}` : `2px solid transparent`,
                      cursor: "pointer",
                      boxShadow: team === t ? `0 0 10px ${TEAM_COLOR[t]}` : "none",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: device !== "desktop" ? "repeat(auto-fill, minmax(300px, 1fr))" : "repeat(auto-fill, minmax(430px, 1fr))", gap: 18 }}>
          {cards.map((c, i) => (
            <CardShell key={i} title={c.title} sound={c.sound}>
              <div style={frameStyle}>{c.el()}</div>
            </CardShell>
          ))}
        </div>
      </div>
    </div>
  );
}

function ToggleGroup({ label, value, options, onChange }: { label: string; value: string; options: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <p style={{ fontFamily: "monospace", fontSize: 9, color: MUTED, letterSpacing: "0.16em", margin: 0, marginBottom: 4, textTransform: "uppercase" }}>{label}</p>
      <div style={{ display: "flex", background: PANEL, border: `1px solid ${ACCENT}44`, borderRadius: 4, overflow: "hidden" }}>
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            style={{
              background: value === o.v ? ACCENT : "transparent",
              color: value === o.v ? BG : INK,
              border: "none",
              padding: "6px 12px",
              fontFamily: "'Michroma', monospace",
              fontSize: 10,
              letterSpacing: "0.12em",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >{o.l}</button>
        ))}
      </div>
    </div>
  );
}
