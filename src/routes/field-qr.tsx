import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";

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
  const [acct, setAcct] = useState<{ name: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [base, setBase] = useState(PROD_ORIGIN);

  useEffect(() => {
    setBase(baseUrl());
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { navigate({ to: "/marshal-account" }); return; }
      const { data: row } = await db
        .from("spartanops_accounts")
        .select("business_name, field_code")
        .eq("id", data.user.id)
        .maybeSingle();
      if (row) setAcct({ name: (row as any).business_name ?? "", code: (row as any).field_code ?? "" });
    });
  }, [navigate]);

  if (!acct) {
    return <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "110px 16px" }}><p style={{ textAlign: "center", fontFamily: "monospace" }}>…</p></main>;
  }

  const url = `${base}/field?code=${acct.code}`;
  const shortHost = base.replace(/^https?:\/\//, "");

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm; }
          body * { visibility: hidden !important; }
          #field-poster, #field-poster * { visibility: visible !important; }
          #field-poster { display: flex !important; position: fixed; inset: 0; }
        }
      `}</style>
      <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "110px 16px 48px" }}>
        <div style={{ maxWidth: 440, margin: "0 auto", background: PANEL, border: `1px solid ${ACCENT}44`, padding: "28px 22px", textAlign: "center" }}>
          <h1 style={{ fontFamily: "'Michroma', monospace", fontSize: 18, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 18 }}>{acct.name}</h1>
          <div data-testid="field-qr" style={{ background: "#ffffff", padding: 16, display: "inline-block" }}>
            <QRCodeSVG value={url} size={260} level="M" bgColor="#ffffff" fgColor="#000000" />
          </div>
          <p style={{ fontFamily: "monospace", fontSize: 34, letterSpacing: "0.3em", color: ACCENT, margin: "18px 0 6px" }}>{acct.code}</p>
          <p style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.7, wordBreak: "break-all" }}>{url}</p>
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
        </div>
      </main>

      <div
        id="field-poster"
        style={{ display: "none", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8mm", background: "#ffffff", color: "#000000", fontFamily: "Arial, sans-serif", textAlign: "center" }}
      >
        <div style={{ fontSize: "30pt", fontWeight: 800, letterSpacing: "0.04em" }}>{en ? "SCAN TO JOIN THE GAME" : "SKENIRAJ ZA VSTOP V IGRO"}</div>
        <QRCodeSVG value={url} size={420} level="M" bgColor="#ffffff" fgColor="#000000" />
        <div style={{ fontSize: "24pt", fontWeight: 700 }}>{acct.name}</div>
        <div style={{ fontSize: "14pt" }}>{en ? "No app to install — scan with your phone camera" : "Aplikacije ni treba namestiti — skeniraj s kamero telefona"}</div>
        <div style={{ fontSize: "13pt" }}>
          {en ? `or go to ${shortHost}/field and enter the code: ` : `ali odpri ${shortHost}/field in vnesi kodo: `}
          <strong style={{ fontFamily: "monospace", fontSize: "18pt", letterSpacing: "0.15em" }}>{acct.code}</strong>
        </div>
        <div style={{ fontSize: "9pt", opacity: 0.6, marginTop: "6mm" }}>Powered by SpartanOps</div>
      </div>
    </>
  );
}
