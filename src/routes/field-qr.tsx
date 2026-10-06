import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import posterBackground from "@/assets/field-poster-background.jpg.asset.json";
import posterLogo from "@/assets/poster-homepage-logo.webp.asset.json";

const db = supabase as unknown as SupabaseClient;

export const Route = createFileRoute("/field-qr")({
  head: () => ({
    meta: [
      { title: "Player QR Poster — SpartanOps" },
      { name: "description", content: "Print the permanent QR poster players scan to join your field." },
      { property: "og:title", content: "Player QR Poster — SpartanOps" },
      { property: "og:description", content: "Print the permanent QR poster players scan to join your field." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FieldQrPage,
});

const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";

const PROD_ORIGIN = "https://spartanopsapp.com";
/** Use the current site when it is a real domain; preview/sandbox hosts fall back to production. */
function baseUrl(): string {
  if (typeof window === "undefined") return PROD_ORIGIN;
  const h = window.location.hostname;
  if (h === "localhost" || h.includes("lovable.app") || h.includes("lovableproject.com")) return PROD_ORIGIN;
  return window.location.origin;
}

const btnStyle: CSSProperties = {
  width: "100%", padding: "12px", background: ACCENT, color: BG, border: "none",
  fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.20em",
  textTransform: "uppercase", fontWeight: 700, cursor: "pointer", marginTop: 10,
};

function FieldQrPage() {
  const { lang } = useLang();
  const en = lang === "en";
  const navigate = useNavigate();
  const [acct, setAcct] = useState<{ id: string; name: string; code: string; listed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [base, setBase] = useState(PROD_ORIGIN);

  useEffect(() => {
    setBase(baseUrl());
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { navigate({ to: "/marshal-account" }); return; }
      const { data: row } = await db
        .from("spartanops_accounts")
        .select("business_name, field_code, listed_publicly")
        .eq("id", data.user.id)
        .maybeSingle();
      if (row) setAcct({ id: data.user.id, name: (row as any).business_name ?? "", code: (row as any).field_code ?? "", listed: (row as any).listed_publicly !== false });
    });
  }, [navigate]);

  if (!acct) {
    return <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "110px 16px" }}><p style={{ textAlign: "center", fontFamily: "monospace" }}>…</p></main>;
  }

  const url = `${base}/field?code=${acct.code}`;

  const nameLen = acct.name.length;
  const nameSize = nameLen <= 16 ? "26pt" : nameLen <= 28 ? "20pt" : "16pt";

  const printPoster = async () => {
    try {
      await document.fonts.ready;
      const img = document.querySelector<HTMLImageElement>(".field-poster-background");
      const logo = document.querySelector<HTMLImageElement>(".field-poster-logo");
      await Promise.all([img?.decode().catch(() => {}), logo?.decode().catch(() => {})]);
    } catch { /* print anyway */ }
    window.print();
  };

  return (
    <>
      <style>{`
        .field-poster-frame {
          width: 300px; height: ${(300 * 297) / 210}px; margin: 0 auto 6px; overflow: hidden;
          border: 1px solid ${ACCENT}; position: relative;
        }
        #field-poster {
          position: absolute; top: 0; left: 0; width: 210mm; height: 297mm; overflow: hidden;
          transform: scale(calc(300 / 793.7)); transform-origin: top left;
          box-sizing: border-box; color: #ffffff; text-align: center;
          font-family: Arial, sans-serif; background: #000000;
          print-color-adjust: exact; -webkit-print-color-adjust: exact;
        }
        #field-poster * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        .field-poster-background {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; object-position: center 20%;
        }
        .field-poster-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.70) 100%);
        }
        .field-poster-content {
          position: relative; height: 100%; display: flex; flex-direction: column;
          align-items: center; padding: 14mm 14mm 0; box-sizing: border-box;
          text-shadow: 0 1px 6px rgba(0,0,0,0.6);
        }
        .field-poster-logo { width: 100mm; height: auto; display: block; }
        .field-poster-kicker {
          margin-top: 5mm; font-family: 'Michroma', sans-serif; font-size: 9pt;
          letter-spacing: 0.3em; color: ${ACCENT}; text-transform: uppercase;
        }
        .field-poster-name {
          margin-top: 2mm; max-width: 182mm; font-family: 'Michroma', 'Arial Black', Arial, sans-serif;
          font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; line-height: 1.25;
          text-wrap: balance; overflow-wrap: anywhere;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .field-poster-rule { width: 30mm; height: 0; border-top: 0.5mm solid ${ACCENT}; margin-top: 3mm; }
        .field-poster-cardwrap { position: relative; margin-top: 8mm; }
        .field-poster-card { width: 130mm; background: #ffffff; padding: 8mm 15mm 6mm; box-sizing: border-box; text-shadow: none; }
        .field-poster-qr { line-height: 0; }
        .field-poster-qr svg { width: 100mm; height: 100mm; display: block; }
        .field-poster-divider { border-top: 0.3mm solid #9a9a9a; margin: 6mm 0 3mm; }
        .field-poster-pwlabel {
          font-family: 'Michroma', sans-serif; font-size: 9pt; letter-spacing: 0.2em;
          color: #444444; text-transform: uppercase;
        }
        .field-poster-pwspace { height: 18mm; border-bottom: 1.2mm solid #000000; }
        .field-poster-corner { position: absolute; width: 8mm; height: 8mm; border: 0 solid ${ACCENT}; }
        .field-poster-corner.tl { top: -3mm; left: -3mm; border-top-width: 0.6mm; border-left-width: 0.6mm; }
        .field-poster-corner.tr { top: -3mm; right: -3mm; border-top-width: 0.6mm; border-right-width: 0.6mm; }
        .field-poster-corner.bl { bottom: -3mm; left: -3mm; border-bottom-width: 0.6mm; border-left-width: 0.6mm; }
        .field-poster-corner.br { bottom: -3mm; right: -3mm; border-bottom-width: 0.6mm; border-right-width: 0.6mm; }
        .field-poster-instruction {
          margin-top: 7mm; font-family: 'Michroma', sans-serif; font-size: 18pt;
          letter-spacing: 0.12em; text-transform: uppercase;
        }
        .field-poster-camera { margin-top: 2mm; font-size: 11pt; opacity: 0.85; }
        .field-poster-credit {
          position: absolute; left: 0; right: 0; bottom: 10mm; font-size: 8pt; opacity: 0.6;
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #000000 !important; }
          header, footer, [role="dialog"], [data-sonner-toaster], .field-screen-only { display: none !important; }
          [style*="position: fixed"] { display: none !important; }
          body * { visibility: hidden !important; }
          #field-poster, #field-poster * { visibility: visible !important; }
          #field-screen, #field-screen-card { padding: 0 !important; margin: 0 !important; border: 0 !important; background: none !important; min-height: 0 !important; max-width: none !important; }
          .field-poster-frame { width: 210mm !important; height: 297mm !important; margin: 0 !important; border: 0 !important; }
          #field-poster {
            position: fixed !important; top: 0 !important; left: 0 !important; transform: none !important;
            break-inside: avoid; break-after: avoid; page-break-after: avoid;
          }
        }
      `}</style>
      <main id="field-screen" style={{ minHeight: "100vh", background: BG, color: INK, padding: "110px 16px 48px" }}>
        <div id="field-screen-card" style={{ maxWidth: 440, margin: "0 auto", background: PANEL, border: `1px solid ${ACCENT}44`, padding: "28px 22px", textAlign: "center" }}>
          <Link className="field-screen-only" to="/marshal-account" style={{ display: "block", textAlign: "left", color: ACCENT, fontFamily: "monospace", fontSize: 12, marginBottom: 14 }}>
            {en ? "← Field settings" : "← Nastavitve poligona"}
          </Link>

          <div className="field-poster-frame" data-testid="field-qr">
            <div id="field-poster">
              <img className="field-poster-background" src={posterBackground.url} alt="" />
              <div className="field-poster-overlay" />
              <div className="field-poster-content">
                <img className="field-poster-logo" src={posterLogo.url} alt="SpartanOps" />
                <div className="field-poster-kicker">{en ? "FIELD" : "POLIGON"}</div>
                <div className="field-poster-name" style={{ fontSize: nameSize }}>{acct.name}</div>
                <div className="field-poster-rule" />
                <div className="field-poster-cardwrap">
                  <span className="field-poster-corner tl" /><span className="field-poster-corner tr" />
                  <span className="field-poster-corner bl" /><span className="field-poster-corner br" />
                  <div className="field-poster-card">
                    <div className="field-poster-qr">
                      <QRCodeSVG value={url} size={400} level="M" bgColor="#ffffff" fgColor="#000000" />
                    </div>
                    <div className="field-poster-divider" />
                    <div className="field-poster-pwlabel">{(en ? "Today's password:" : "Današnje geslo:").replace(/:$/, "")}</div>
                    <div className="field-poster-pwspace" />
                  </div>
                </div>
                <div className="field-poster-instruction">{en ? "Scan to join the game" : "Skeniraj za vstop v igro"}</div>
                <div className="field-poster-camera">{en ? "No app to install — scan with your phone camera" : "Aplikacije ni treba namestiti — skeniraj s kamero telefona"}</div>
              </div>
              <div className="field-poster-credit">Powered by SpartanOps</div>
            </div>
          </div>

          <div className="field-screen-only">
            <p style={{ fontFamily: "monospace", fontSize: 10, opacity: 0.6, wordBreak: "break-all", marginTop: 10 }}>{url}</p>
            <button
              type="button"
              style={btnStyle}
              onClick={() => { navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
            >
              {copied ? (en ? "Copied" : "Kopirano") : en ? "Copy link" : "Kopiraj povezavo"}
            </button>
            <button type="button" style={btnStyle} onClick={printPoster}>
              {en ? "Print poster" : "Natisni plakat"}
            </button>
            <p style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.7, marginTop: 14, lineHeight: 1.6, textAlign: "left" }}>
              {en
                ? "Tip: laminate the poster and write the password on it with a dry-erase marker. Change the password on your account page whenever you like — for example every weekend."
                : "Namig: plakat laminiraj in geslo napiši z brisljivim flomastrom. Geslo lahko kadar koli spremeniš na strani računa — na primer vsak vikend."}
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
