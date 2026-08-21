import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/intel")({
  head: () => ({
    meta: [
      { title: "Tactical Briefing — SpartanOps" },
      { name: "description", content: "SpartanOps tactical briefing and full field manual for marshals and players." },
      { property: "og:title", content: "Tactical Briefing — SpartanOps" },
      { property: "og:description", content: "Complete operational manual for marshals and player HUD guide." },
    ],
  }),
  component: IntelPage,
});

const BG = "#0b0d0a";
const PANEL = "#12140f";
const ACCENT = "#e89a0a";
const ACCENT_SOFT = "rgba(232,154,10,0.35)";
const INK = "#e7e3d6";
const MUTED = "rgba(231,227,214,0.60)";
const HAIRLINE = "rgba(231,227,214,0.10)";

type BriefingBlock = { eyebrow: string; title: string; bullets: (string | { note: string })[] };

function cornerTick(pos: "tl" | "tr" | "bl" | "br"): React.CSSProperties {
  const size = 10;
  const base: React.CSSProperties = { position: "absolute", width: size, height: size, borderColor: ACCENT_SOFT, borderStyle: "solid", borderWidth: 0 };
  if (pos === "tl") return { ...base, top: -1, left: -1, borderTopWidth: 1, borderLeftWidth: 1 };
  if (pos === "tr") return { ...base, top: -1, right: -1, borderTopWidth: 1, borderRightWidth: 1 };
  if (pos === "bl") return { ...base, bottom: -1, left: -1, borderBottomWidth: 1, borderLeftWidth: 1 };
  return { ...base, bottom: -1, right: -1, borderBottomWidth: 1, borderRightWidth: 1 };
}

function HudCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={className} style={{ background: PANEL, border: `1px solid ${HAIRLINE}`, position: "relative" }}>
      <span style={cornerTick("tl")} />
      <span style={cornerTick("tr")} />
      <span style={cornerTick("bl")} />
      <span style={cornerTick("br")} />
      {children}
    </div>
  );
}

function BriefingContent({ blocks }: { blocks: BriefingBlock[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {blocks.map((b) => (
        <div key={b.title}>
          <p className="font-mono uppercase mb-1" style={{ fontSize: 10, letterSpacing: "0.28em", color: ACCENT }}>
            {b.eyebrow}
          </p>
          <h3 style={{ fontFamily: "'Michroma', monospace", fontSize: 16, letterSpacing: "0.08em", color: INK, lineHeight: 1.3, marginBottom: 10 }}>
            {b.title}
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {b.bullets.map((raw, i) => {
              const isNote = typeof raw !== "string";
              const text = isNote ? (raw as { note: string }).note : (raw as string);
              return (
                <li key={i} className="text-[13.5px] leading-[1.7]"
                  style={{
                    color: isNote ? "rgba(231,227,214,0.55)" : MUTED,
                    fontStyle: isNote ? "italic" : "normal",
                    paddingLeft: 16,
                    position: "relative",
                  }}
                >
                  <span aria-hidden style={{
                    position: "absolute", left: 0, top: "0.55em", width: 6, height: 6,
                    background: isNote ? "transparent" : ACCENT,
                    border: isNote ? `1px solid ${ACCENT_SOFT}` : "none",
                    transform: "rotate(45deg)",
                  }} />
                  {text}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function IntelPage() {
  const [tab, setTab] = useState<"marshal" | "player">("marshal");

  const marshalBlocks: BriefingBlock[] = [
    {
      eyebrow: "[01] PRE-GAME SETUP",
      title: "COMMAND CENTER INITIALIZATION",
      bullets: [
        "Click 'Create Operation' to open the Marshal Command Center and select 'New Field' — or an existing one if your field is already registered.",
        "Set up your active field name, marshal password and game password, choose the desired gamemode (e.g., Domination), and define the total match countdown duration and respawn times.",
        { note: "Import your map illustration and add the desired number of points, spawns, and accessories to custom positions." },
        "Click 'Initialize Lobby' to generate your dynamic session QR code and direct-join URL.",
      ],
    },
    {
      eyebrow: "[02] BRIEFING & DEPLOYMENT",
      title: "STAGE THE OPERATORS",
      bullets: [
        "Share the generated direct URL into your community chat or display the Quick Join QR code on your screen for players to scan at the staging area.",
        { note: "The easiest way for players to join and rejoin during the match is to print the 'Player HUD cards' available for download." },
        "Instruct arriving players to submit their callsigns and choose their faction (Blue or Red team).",
        "Monitor the live roster panel to ensure team balancing looks correct before initiating combat.",
      ],
    },
    {
      eyebrow: "[03] IN-GAME COMMAND",
      title: "EXECUTE THE MATCH",
      bullets: [
        "Once all operators are deployed, press 'Start Mission' to trigger the selected synchronized real-time countdown.",
        { note: "During this countdown players have time to get ready and move to their designated spawn positions." },
        "Use the Live Map and Event Log to oversee objectives and scoreboards.",
        "In case of field emergencies or rule changes, use the global override controls to pause or prematurely secure the operation.",
      ],
    },
  ];

  const playerBlocks: BriefingBlock[] = [
    {
      eyebrow: "[01] DEPLOYMENT REGISTRATION",
      title: "ENTER THE OPERATION",
      bullets: [
        "Enter your field's active operation via: (1) the Marshal's Quick Join QR code on their phone, (2) tapping the Marshal's shared direct session URL, (3) scanning the Player HUD card QR code, or (4) manually finding it in the 'Active Operation' section on our website.",
        { note: "If it's your first time entering the active operation (field), you must input the game password set up by the Marshal." },
        "Enter your Call Sign (tactical moniker), select your faction (team), and choose your experience level.",
        "Stand by at the staging area and monitor the Pre-Start Countdown Screen for rules, map configurations, and vital operational data.",
      ],
    },
    {
      eyebrow: "[02] SECTOR CAPTURE MECHANICS",
      title: "SECURE THE OBJECTIVES",
      bullets: [
        "After the game starts, locate the physical high-visibility QR plates mounted across the tactical zones on the field (Alpha, Beta, Gamma, Delta).",
        "To capture an objective for your team, open your phone's Camera and scan the QR code.",
        "The system instantly registers the point, logs the event, and credits it to your team based on the gamemode and settings.",
      ],
    },
    {
      eyebrow: "[03] HUD RESPONSES & RE-ENGAGEMENT",
      title: "STAY IN THE FIGHT",
      bullets: [
        "Keep your Player HUD active to monitor real-time scoreboards, live capture logs, and the tactical map.",
        "If eliminated, return immediately to your designated Faction HQ (Blue or Red Spawn) and follow your Marshal's respawn timers to safely re-enter the operational area.",
      ],
    },
  ];

  const tabs = [
    { id: "marshal" as const, label: "FOR MARSHALS", sub: "// MARSHAL CONTROL CENTER" },
    { id: "player" as const, label: "FOR PLAYERS", sub: "// PLAYER HUD" },
  ];

  return (
    <div style={{ background: BG, color: INK, minHeight: "100dvh", paddingTop: 80 }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <p className="font-mono uppercase mb-3" style={{ fontSize: 11, letterSpacing: "0.32em", color: ACCENT }}>
          // INTEL / FIELD MANUAL
        </p>
        <h1 style={{
          fontFamily: "'Michroma', monospace",
          fontSize: "clamp(28px, 4.6vw, 44px)",
          letterSpacing: "0.10em",
          color: ACCENT,
          lineHeight: 1.1,
        }}>
          TACTICAL BRIEFING
        </h1>
        <div style={{ width: 56, height: 1, background: ACCENT, marginTop: 18 }} />

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Tactical briefing audience"
          className="grid grid-cols-2 mt-10 mb-8"
          style={{ borderBottom: `1px solid ${HAIRLINE}` }}
        >
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                type="button"
                className="text-left px-4 py-3 transition-colors"
                style={{
                  background: active ? "rgba(232,154,10,0.06)" : "transparent",
                  borderBottom: active ? `2px solid ${ACCENT}` : "2px solid transparent",
                  marginBottom: -1,
                  color: active ? ACCENT : MUTED,
                  fontFamily: "'Rajdhani', monospace",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <span className="block text-[13px] md:text-[15px]">{t.label}</span>
                <span className="block font-mono"
                  style={{ fontSize: 10, letterSpacing: "0.24em", color: active ? ACCENT_SOFT : "rgba(231,227,214,0.35)", marginTop: 4 }}
                >
                  {t.sub}
                </span>
              </button>
            );
          })}
        </div>

        <HudCard className="p-5 md:p-8">
          <p className="font-mono uppercase mb-6"
            style={{ fontSize: 10, letterSpacing: "0.28em", color: ACCENT_SOFT }}>
            {tab === "marshal" ? "// MARSHAL OPERATIONAL MANUAL //" : "// OPERATOR FIELD MANUAL //"}
          </p>
          <BriefingContent blocks={tab === "marshal" ? marshalBlocks : playerBlocks} />
        </HudCard>

        <div className="mt-12">
          <Link
            to="/spartanops"
            className="inline-flex items-center gap-2 font-mono uppercase"
            style={{
              fontSize: 11,
              letterSpacing: "0.24em",
              color: ACCENT,
              border: `1px solid ${ACCENT_SOFT}`,
              padding: "12px 18px",
              background: "transparent",
            }}
          >
            <ArrowLeft size={14} /> Back to Command
          </Link>
        </div>
      </div>
    </div>
  );
}
