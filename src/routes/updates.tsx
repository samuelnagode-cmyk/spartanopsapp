import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { spartanDevlogEntries, useT } from "@/lib/i18n";

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

function UpdatesPage() {
  const t = useT();
  const entries = spartanDevlogEntries(t);
  return (
    <div style={{ background: BG, color: INK, minHeight: "100dvh", paddingTop: 80, paddingBottom: 96 }}>
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
              {t("spartan.devlogTag")}
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
              {t("spartan.devlogTitle")}
            </h1>
            <p className="mt-3 text-[14px] md:text-[15px] leading-[1.7]" style={{ color: MUTED, maxWidth: 720 }}>
              {t("spartan.devlogSubtext")}
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
            {entries.map((e) => (
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
