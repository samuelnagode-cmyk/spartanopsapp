import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/print")({
  head: () => ({
    meta: [
      { title: "Print Station — SpartanOps" },
      {
        name: "description",
        content:
          "Download the complete SpartanOps tactical operation pack: QR codes, HUD cards, and marshal assets in one bundle.",
      },
    ],
  }),
  component: PrintStation,
});

const BG = "#0b0d0a";
const PANEL = "#12140f";
const ACCENT = "#e89a0a";
const INK = "#e7e3d6";
const MUTED = "rgba(231,227,214,0.60)";
const HAIRLINE = "rgba(231,227,214,0.10)";

const DRIVE_URL = "https://drive.google.com/drive/u/2/folders/1GbWC3b8tx7ZwJEWd2rFQK2n6ikcd3nvX";

const PREVIEWS: { title: string; image: string }[] = [
  {
    title: "Domination Pack",
    image: "https://res.cloudinary.com/dfifiytid/image/upload/v1783838791/SpartanOps%20app%20v1.0/GALERIJA/preview_domination-11.webp",
  },
  {
    title: "Respawn Point Markers",
    image: "https://res.cloudinary.com/dfifiytid/image/upload/v1783838439/SpartanOps%20app%20v1.0/GALERIJA/print_preview-02.webp",
  },
  {
    title: "Player HUD Access Cards",
    image: "https://res.cloudinary.com/dfifiytid/image/upload/v1783838439/SpartanOps%20app%20v1.0/GALERIJA/print_preview-03.webp",
  },
  {
    title: "Marshal Operations Center Card",
    image: "https://res.cloudinary.com/dfifiytid/image/upload/v1783838439/SpartanOps%20app%20v1.0/GALERIJA/print_preview-04.webp",
  },
];

function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{ background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 0, ...style }}
    >
      {children}
    </div>
  );
}

function PreviewTile({ title, image }: { title: string; image: string }) {
  return (
    <Card className="p-5 flex flex-col">
      <div
        className="mb-4 relative"
        style={{
          aspectRatio: "4 / 3",
          background:
            "radial-gradient(ellipse at center, rgba(232,154,10,0.18) 0%, rgba(212,163,89,0.08) 40%, rgba(0,0,0,0) 72%)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <img
          src={image}
          alt={title}
          loading="lazy"
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            display: "block",
            filter: "drop-shadow(0 6px 22px rgba(232,154,10,0.28)) drop-shadow(0 0 40px rgba(212,163,89,0.15))",
          }}
        />
      </div>
      <h3
        style={{
          fontFamily: "'Michroma', monospace",
          fontSize: 12,
          letterSpacing: "0.08em",
          color: ACCENT,
          textAlign: "center",
        }}
      >
        {title}
      </h3>
    </Card>
  );
}

function PrintStation() {
  const t = useT();

  return (
    <div style={{ background: BG, color: INK, minHeight: "100vh", paddingTop: 80 }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Header */}
        <div className="mb-10 md:mb-12">
          <p
            className="font-mono uppercase mb-3"
            style={{ fontSize: 11, letterSpacing: "0.32em", color: ACCENT }}
          >
            {t("print.kicker")}
          </p>
          <h1
            style={{
              fontFamily: "'Michroma', monospace",
              fontSize: "clamp(28px, 4.6vw, 44px)",
              letterSpacing: "0.10em",
              color: ACCENT,
              lineHeight: 1.1,
            }}
          >
            {t("print.title")}
          </h1>
          <div style={{ width: 56, height: 1, background: ACCENT, marginTop: 18 }} />
        </div>

        {/* Main CTA Hero */}
        <Card
          className="p-8 md:p-12 text-center"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(232,154,10,0.10) 0%, rgba(0,0,0,0) 70%), #12140f",
            border: `1px solid ${ACCENT}55`,
          }}
        >
          <h2
            style={{
              fontFamily: "'Michroma', monospace",
              fontSize: "clamp(20px, 3vw, 30px)",
              letterSpacing: "0.10em",
              color: ACCENT,
              lineHeight: 1.15,
            }}
          >
            {t("print.heroTitle")}
          </h2>
          <p
            className="mt-5 mx-auto text-[14px] md:text-[15px] leading-[1.75]"
            style={{ color: INK, maxWidth: 720 }}
          >
            {t("print.heroDesc")}
          </p>
          <a
            href={DRIVE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex items-center justify-center gap-2 font-mono uppercase"
            style={{
              background: ACCENT,
              color: "#0a0a0a",
              letterSpacing: "0.22em",
              fontSize: 12,
              padding: "16px 28px",
              borderRadius: 0,
              border: `1px solid ${ACCENT}`,
              textDecoration: "none",
              boxShadow: "0 0 24px rgba(232,154,10,0.35)",
            }}
          >
            <Download size={16} /> {t("print.accessFiles")}
          </a>
        </Card>

        {/* Preview grid */}
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {PREVIEWS.map((p) => (
            <PreviewTile key={p.title} title={p.title} image={p.image} />
          ))}
        </div>

        {/* Notice */}
        <div className="mt-12">
          <p
            className="font-mono text-[13px] md:text-[14px] leading-[1.7]"
            style={{ color: ACCENT, letterSpacing: "0.04em" }}
          >
            {t("printNoticeText")}
          </p>
        </div>

        {/* Two options */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {/* Option A */}
          <Card className="p-6 md:p-7">
            <p
              className="font-mono uppercase mb-2"
              style={{ fontSize: 10, letterSpacing: "0.28em", color: MUTED }}
            >
              OPTION A
            </p>
            <h3
              style={{
                fontFamily: "'Michroma', monospace",
                fontSize: 14,
                letterSpacing: "0.08em",
                color: INK,
              }}
            >
              {t("optionATitle")}
            </h3>
            <p className="mt-4 text-[14px] leading-[1.75]" style={{ color: MUTED }}>
              {t("optionADesc")}
            </p>
          </Card>

          {/* Option B — Pro (glow) */}
          <Card
            className="p-6 md:p-7"
            style={{
              border: `1px solid ${ACCENT}`,
              boxShadow:
                "0 0 0 1px rgba(232,154,10,0.35), 0 0 28px rgba(232,154,10,0.35), inset 0 0 24px rgba(232,154,10,0.08)",
            }}
          >
            <p
              className="font-mono uppercase mb-2"
              style={{ fontSize: 10, letterSpacing: "0.28em", color: ACCENT }}
            >
              OPTION B — RECOMMENDED
            </p>
            <h3
              style={{
                fontFamily: "'Michroma', monospace",
                fontSize: 14,
                letterSpacing: "0.08em",
                color: INK,
              }}
            >
              {t("optionBTitle")}
            </h3>
            <p className="mt-4 text-[14px] leading-[1.75]" style={{ color: MUTED }}>
              {t("optionBDesc")}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
