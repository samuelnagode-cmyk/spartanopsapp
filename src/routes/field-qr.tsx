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

  return (
    <>
      <style>{`
        #field-poster {
          display: none; position: relative; flex-direction: column;
          align-items: center; justify-content: center; gap: 6mm;
          background: var(--poster-ink); color: var(--poster-ink);
          font-family: Arial, sans-serif; text-align: center;
          print-color-adjust: exact; -webkit-print-color-adjust: exact;
        }
        .field-poster-background {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; object-position: center top;
        }
        .field-poster-content {
          position: relative; width: 100%; display: flex; flex-direction: column;
          align-items: center; gap: 6mm;
        }
        .field-poster-logo { width: 148mm; max-width: 100%; height: auto; }
        .field-poster-label { background: var(--poster-paper); padding: 3mm 5mm; }
        .field-poster-name { font-size: 24pt; font-weight: 700; overflow-wrap: anywhere; }
        .field-poster-qr { background: var(--poster-paper); padding: 6mm; line-height: 0; }
        .field-poster-instruction { font-size: 18pt; font-weight: 800; }
        .field-poster-camera { font-size: 14pt; }
        .field-poster-password {
          display: flex; align-items: flex-end; gap: 4mm; margin-top: 4mm;
          width: 100%; box-sizing: border-box; text-align: left;
        }
        .field-poster-password-label { font-size: 16pt; font-weight: 700; flex-shrink: 0; }
        .field-poster-password-line { flex: 1; min-width: 0; height: 16mm; border-bottom: 2px solid var(--poster-ink); }
        .field-poster-credit { font-size: 9pt; margin-top: 4mm; }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: var(--poster-paper) !important; }
          header, footer, #field-screen, [role="dialog"], [data-sonner-toaster] { display: none !important; }
          body * { visibility: hidden !important; }
          [style*="position: fixed"] { display: none !important; }
          #field-poster, #field-poster * { visibility: visible !important; }
          #field-poster {
            display: flex !important; position: relative !important;
            width: 210mm; height: 297mm; box-sizing: border-box; padding: 14mm;
            break-inside: avoid; break-after: avoid; overflow: hidden;
          }
        }
      `}</style>
      <main id="field-screen" style={{ minHeight: "100vh", background: BG, color: INK, padding: "110px 16px 48px" }}>
        <div style={{ maxWidth: 440, margin: "0 auto", background: PANEL, border: `1px solid ${ACCENT}44`, padding: "28px 22px", textAlign: "center" }}>
          <Link to="/marshal-account" style={{ display: "block", textAlign: "left", color: ACCENT, fontFamily: "monospace", fontSize: 12, marginBottom: 14 }}>
            {en ? "← Field settings" : "← Nastavitve poligona"}
          </Link>
          <h1 style={{ fontFamily: "'Michroma', monospace", fontSize: 18, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 18 }}>{acct.name}</h1>
          <div data-testid="field-qr" style={{ background: "#ffffff", padding: 16, display: "inline-block" }}>
            <QRCodeSVG value={url} size={260} level="M" bgColor="#ffffff" fgColor="#000000" />
          </div>
          <p style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.7, wordBreak: "break-all", marginTop: 18 }}>{url}</p>
          <button
            type="button"
            style={btnStyle}
            onClick={() => { navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
          >
            {copied ? (en ? "Copied" : "Kopirano") : en ? "Copy link" : "Kopiraj povezavo"}
          </button>
          <button type="button" style={btnStyle} onClick={() => window.print()}>
            {en ? "Print poster" : "Natisni plakat"}
          </button>
          <p style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.7, marginTop: 14, lineHeight: 1.6, textAlign: "left" }}>
            {en
              ? "Tip: laminate the poster and write the password on it with a dry-erase marker. Change the password on your account page whenever you like — for example every weekend."
              : "Namig: plakat laminiraj in geslo napiši z brisljivim flomastrom. Geslo lahko kadar koli spremeniš na strani računa — na primer vsak vikend."}
          </p>
        </div>
      </main>

      <div id="field-poster">
        <img className="field-poster-background" src={posterBackground.url} alt="" />
        <div className="field-poster-content">
          <img className="field-poster-logo" src={posterLogo.url} alt="SpartanOps" />
          <div className="field-poster-label field-poster-name">{en ? "FIELD:" : "POLIGON:"} {acct.name}</div>
          <div className="field-poster-qr">
            <QRCodeSVG value={url} size={380} level="M" bgColor="var(--poster-paper)" fgColor="var(--poster-ink)" />
          </div>
          <div className="field-poster-label field-poster-instruction">{en ? "Scan to join the game" : "Skeniraj za vstop v igro"}</div>
          <div className="field-poster-label field-poster-camera">{en ? "No app to install — scan with your phone camera" : "Aplikacije ni treba namestiti — skeniraj s kamero telefona"}</div>
          <div className="field-poster-label field-poster-password">
            <div className="field-poster-password-label">{en ? "Today's password:" : "Današnje geslo:"}</div>
            <div className="field-poster-password-line" />
          </div>
          <div className="field-poster-label field-poster-credit">Powered by SpartanOps</div>
        </div>
      </div>
    </>
  );
}
