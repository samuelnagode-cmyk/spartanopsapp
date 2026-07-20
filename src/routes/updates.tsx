import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/updates")({
  head: () => ({
    meta: [
      { title: "System Updates — SpartanOps Devlog" },
      {
        name: "description",
        content:
          "Full changelog of patches, modules and improvements deployed to the SpartanOps network.",
      },
      { property: "og:title", content: "System Updates — SpartanOps Devlog" },
      {
        property: "og:description",
        content:
          "Full changelog of patches, modules and improvements deployed to the SpartanOps network.",
      },
    ],
  }),
  component: UpdatesPage,
});

const BG = "#0b0d0a";
const ACCENT = "#e89a0a";
const ACCENT_SOFT = "rgba(232,154,10,0.35)";
const INK = "#e7e3d6";
const MUTED = "rgba(231,227,214,0.60)";

export const CHANGELOG_ENTRIES = [
  {
    date: "July 16, 2026",
    title: "SPARTACUS GPS ANTI-CHEAT V1.0",
    body: "Deployed the Spartacus anti-cheat module. When enabled by the marshal, every objective QR code is anchored to real-world GPS coordinates on its first legitimate scan of the match. Any subsequent capture attempted more than 10 meters from that anchor is instantly flagged in the Marshal Command Center — fraudulent scans do not count towards the score until manually approved. Physical integrity of the game, secured.",
  },
  {
    date: "July 12, 2026",
    title: "OFFICIAL APP LAUNCH // VERSION 1.0",
    body: "The wait is over. After rigorous field testing, the official SpartanOps application is live. Fully optimized, deployed on a dedicated standalone network, and battle-ready for players and fields worldwide.",
  },
  {
    date: "July 11, 2026",
    title: "NEXT-GEN UI OVERHAUL",
    body: "Redesigned the entire user interface from scratch. Engineered a high-contrast, premium tactical dark theme optimized for maximum readability under intense outdoor sunlight and high-stress field scenarios.",
  },
  {
    date: "July 10, 2026",
    title: "AUDIO IMMERSION DEPLOYMENT",
    body: "Integrated immersive, cinematic soundtracks and tactical audio sound effects. The countdowns, base captures, and match events now feature full audio feedback to dramatically boost adrenaline on the field. Will be updated in the future.",
  },
  {
    date: "June 1, 2026",
    title: "STANDALONE ARCHITECTURE BLUEPRINT",
    body: "Outgrew initial hosting limits. Designed and executed a comprehensive structural migration plan to separate SpartanOps onto its own dedicated ecosystem, paving the way for future massive multiplayer scaling.",
  },
  {
    date: "May 29, 2026",
    title: "CORE QR ENGINE OPTIMIZATION",
    body: "Successfully refactored and patched underlying scanning bugs. Overhauled the response loop to ensure instantaneous, seamless QR code processing even with poor mobile internet connections deep in forest terrain.",
  },
  {
    date: "May 25, 2026",
    title: "MARSHAL COMMAND CENTER v1",
    body: "Engineered the master control board for game masters. Introduced real-time team balancing, manual lobby initialization, match state controls, and advanced direct-connect capabilities.",
  },
  {
    date: "May 20, 2026",
    title: "INITIAL DEMO VERSION LAUNCH",
    body: "Launched the very first operational demo version hosted directly on the Spartan Airsoft platform. Gathered vital real-world data from our initial core community testing phase.",
  },
];

function UpdatesPage() {
  return (
    <div style={{ background: BG, color: INK, minHeight: "100vh", paddingTop: 96, paddingBottom: 96 }}>
      <section className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Link
            to="/spartanops"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: MUTED,
              fontFamily: "monospace",
              fontSize: 11,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              textDecoration: "none",
              marginBottom: 24,
            }}
          >
            <ArrowLeft size={12} /> Back to home
          </Link>

          <div className="mb-10 md:mb-14">
            <p
              className="font-mono uppercase mb-3"
              style={{ fontSize: 11, letterSpacing: "0.32em", color: ACCENT }}
            >
              // DEVLOG
            </p>
            <h1
              style={{
                fontFamily: "'Michroma', 'Rajdhani', monospace",
                fontSize: "clamp(22px, 3.4vw, 34px)",
                letterSpacing: "0.10em",
                color: ACCENT,
                lineHeight: 1.1,
              }}
            >
              SYSTEM UPDATES
            </h1>
            <p className="mt-3 text-[14px] md:text-[15px] leading-[1.7]" style={{ color: MUTED, maxWidth: 720 }}>
              Full history of patches and modules deployed to the SpartanOps network.
            </p>
          </div>

          <ol
            className="relative"
            style={{
              borderLeft: `1px solid ${ACCENT_SOFT}`,
              paddingLeft: 32,
              listStyle: "none",
              margin: 0,
            }}
          >
            {CHANGELOG_ENTRIES.map((e) => (
              <li key={e.title} className="pb-10 last:pb-0 relative flex flex-col gap-2">
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: -37,
                    top: 6,
                    width: 10,
                    height: 10,
                    background: ACCENT,
                    boxShadow: `0 0 12px ${ACCENT}`,
                  }}
                />
                <p
                  className="font-mono uppercase m-0"
                  style={{ fontSize: 10, letterSpacing: "0.28em", color: ACCENT, lineHeight: 1.2 }}
                >
                  {e.date}
                </p>
                <h3
                  className="mt-1"
                  style={{
                    fontFamily: "'Michroma', monospace",
                    fontSize: 14,
                    letterSpacing: "0.08em",
                    color: INK,
                    lineHeight: 1.4,
                    wordBreak: "break-word",
                  }}
                >
                  {e.title}
                </h3>
                <p className="mt-1 text-[14px] leading-[1.7]" style={{ color: MUTED }}>
                  {e.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
