import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Download, Copy, Check } from "lucide-react";

export const Route = createFileRoute("/print")({
  head: () => ({
    meta: [
      { title: "Print Station — SpartanOps" },
      {
        name: "description",
        content:
          "Download official SpartanOps mission assets, QR codes, and field markers for airsoft operations.",
      },
    ],
  }),
  component: PrintStation,
});

const BG = "#0b0d0a";
const PANEL = "#12140f";
const ACCENT = "#e89a0a";
const ACCENT_SOFT = "rgba(232,154,10,0.35)";
const INK = "#e7e3d6";
const MUTED = "rgba(231,227,214,0.60)";
const HAIRLINE = "rgba(231,227,214,0.10)";

const EMAIL_TEMPLATE = `Subject: Print Order Request - QR Markers

Hello,

I would like to place a print order for the attached PDF files. Since these will be used outdoors for an airsoft event, please follow these specifications:

1. Paper: Heavy Cardstock Paper (between 250g and 300g).
2. Double sided print.
3. Cutting: Cut to the standard bleed borders indicated in the files.
4. Finish: Full MATTE Lamination. It is extremely important that the finish is fully matte (glossy lamination creates sunlight glare and prevents mobile cameras from scanning the QR codes).

Please let me know the pricing and estimated pickup time.

Best regards,
[Your Name / Field Name]`;

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{ background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 0 }}
    >
      {children}
    </div>
  );
}

function DownloadCard({ title, body, image, url }: { title: string; body: string; image?: string; url?: string }) {
  return (
    <Card className="p-6 flex flex-col">
      {image && (
        <div
          className="mb-5 relative"
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
              width: "auto",
              height: "auto",
              objectFit: "contain",
              display: "block",
              filter: "drop-shadow(0 6px 22px rgba(232,154,10,0.28)) drop-shadow(0 0 40px rgba(212,163,89,0.15))",
            }}
          />
        </div>
      )}
      <h3
        style={{
          fontFamily: "'Michroma', monospace",
          fontSize: 14,
          letterSpacing: "0.08em",
          color: ACCENT,
        }}
      >
        {title}
      </h3>
      <p className="mt-3 text-[14px] leading-[1.7] flex-1" style={{ color: MUTED }}>
        {body}
      </p>
      <a
        href={url}
        target={url ? "_blank" : undefined}
        rel={url ? "noreferrer" : undefined}
        className="mt-6 inline-flex items-center justify-center gap-2 font-mono uppercase"
        style={{
          background: ACCENT,
          color: "#0a0a0a",
          letterSpacing: "0.22em",
          fontSize: 11,
          padding: "12px 18px",
          borderRadius: 0,
          border: `1px solid ${ACCENT}`,
          opacity: url ? 1 : 0.45,
          pointerEvents: url ? "auto" : "none",
          textDecoration: "none",
        }}
      >
        <Download size={14} /> Download PDF
      </a>
    </Card>
  );
}

function PrintStation() {
  const [copied, setCopied] = useState(false);
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div style={{ background: BG, color: INK, minHeight: "100vh", paddingTop: 96 }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {/* Header */}
        <div className="mb-12 md:mb-16">
          <p
            className="font-mono uppercase mb-3"
            style={{ fontSize: 11, letterSpacing: "0.32em", color: ACCENT }}
          >
            // FIELD SUPPLY POST
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
            PRINT STATION
          </h1>
          <p className="mt-4 text-[15px] md:text-[16px] leading-[1.7]" style={{ color: INK, maxWidth: 720 }}>
            Download official mission assets, QR codes, and field markers.
          </p>
          <div style={{ width: 56, height: 1, background: ACCENT, marginTop: 18 }} />
        </div>

        {/* Download grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          <DownloadCard
            title="Domination Pack"
            body="Universal QR codes for Sectors Alpha, Beta, Gamma, Delta, Epsilon."
            image="https://res.cloudinary.com/dfifiytid/image/upload/v1783838791/SpartanOps%20app%20v1.0/GALERIJA/preview_domination-11.webp"
            url="https://drive.google.com/drive/folders/1Duj97Ug4mrRz9WDgDib36UWJkt7NinOw?usp=drive_link"
          />
          <DownloadCard
            title="Search & Destroy Pack"
            body="Bomb planting and defusing site markers (Site A, Site B)."
          />
          <DownloadCard
            title="Respawn Point Markers"
            body="Optional markers for team respawn zones. Respawn rules can be toggled on/off in match settings."
            image="https://res.cloudinary.com/dfifiytid/image/upload/v1783838439/SpartanOps%20app%20v1.0/GALERIJA/print_preview-02.webp"
            url="https://drive.google.com/drive/folders/1doaKXijNJeb8XAhY1InBi8lum5xo-WMm?usp=drive_link"
          />
          <DownloadCard
            title="Player HUD Access Cards"
            body="Universal printed QR cards for players to instantly scan, register, and sync their mobile HUD with the active live operation and instructions for use."
            image="https://res.cloudinary.com/dfifiytid/image/upload/v1783838439/SpartanOps%20app%20v1.0/GALERIJA/print_preview-03.webp"
            url="https://drive.google.com/drive/folders/1M97sfC5lOB_4fPrYQ4b8xUb6mJW1wevX?usp=drive_link"
          />
          <DownloadCard
            title="Marshal Operations Center Card"
            body="Control cards for field marshals for quick access to the Marshal control center and instructions for use."
            image="https://res.cloudinary.com/dfifiytid/image/upload/v1783838439/SpartanOps%20app%20v1.0/GALERIJA/print_preview-04.webp"
            url="https://drive.google.com/drive/folders/1MshMyk_o9FquF-7FRSOr1qchZrRcr9CI?usp=drive_link"
          />
        </div>


        {/* Preparation guide */}
        <div className="mt-16">
          <p
            className="font-mono uppercase mb-3"
            style={{ fontSize: 11, letterSpacing: "0.32em", color: ACCENT }}
          >
            // PREPARATION GUIDE
          </p>
          <h2
            style={{
              fontFamily: "'Michroma', monospace",
              fontSize: "clamp(20px, 3vw, 28px)",
              letterSpacing: "0.10em",
              color: ACCENT,
            }}
          >
            PRINT & DEPLOYMENT PROTOCOL
          </h2>
          <div style={{ width: 56, height: 1, background: ACCENT, marginTop: 18 }} />

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
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
                BASIC (Budget Friendly)
              </h3>
              <p className="mt-4 text-[14px] leading-[1.75]" style={{ color: MUTED }}>
                Print on standard A4 paper using any office printer. Place each printed QR code into a
                transparent plastic sleeve to protect it from light rain and BB hits. Secure it to the flag
                or sector post using zip-ties or heavy tape.
              </p>
            </Card>

            {/* Option B */}
            <Card className="p-6 md:p-7">
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
                PRO (Commercial Fields)
              </h3>
              <p className="mt-4 text-[14px] leading-[1.75]" style={{ color: MUTED }}>
                Take these downloaded files to your local print shop. Instruct them to use Heavy Cardstock
                Paper (250g–300g) with a Full Matte Lamination finish. Matte lamination eliminates direct
                sunlight glare, allowing mobile devices to scan the codes instantly while remaining 100%
                waterproof and durable against BB hits.
              </p>

              {/* Email template */}
              <div
                className="mt-6"
                style={{ background: "#0a0c08", border: `1px solid ${ACCENT_SOFT}` }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: `1px solid ${HAIRLINE}` }}
                >
                  <p
                    className="font-mono uppercase"
                    style={{ fontSize: 10, letterSpacing: "0.28em", color: ACCENT }}
                  >
                    Email Template for Your Print Shop
                  </p>
                  <button
                    type="button"
                    onClick={copyEmail}
                    className="inline-flex items-center gap-1.5 font-mono uppercase"
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.24em",
                      color: copied ? "#3ddc84" : ACCENT,
                      border: `1px solid ${copied ? "#3ddc8455" : ACCENT_SOFT}`,
                      padding: "6px 10px",
                      background: "transparent",
                    }}
                    aria-label="Copy email template"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? "Copied" : "Copy Email"}
                  </button>
                </div>
                <pre
                  className="whitespace-pre-wrap px-4 py-4 text-[12.5px] leading-[1.7]"
                  style={{ color: INK, fontFamily: "'JetBrains Mono', ui-monospace, monospace", margin: 0 }}
                >
{EMAIL_TEMPLATE}
                </pre>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
