import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/qr-generator")({
  head: () => ({
    meta: [
      { title: "QR Generator — SpartanOps" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    field_id: typeof s.field_id === "string" ? s.field_id : (typeof s.field === "string" ? s.field : ""),
  }),
  component: QrGeneratorPage,
});

const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";
const DOMAIN = "https://www.spartanopsapp.com";

type Row = { label: string; url: string };

function buildRows(fieldId: string): { section: string; rows: Row[] }[] {
  const points = ["alpha", "beta", "gamma", "delta", "epsilon"];
  const encodedFieldId = encodeURIComponent(fieldId.trim());
  return [
    {
      section: "SECTOR DOMINATION POINTS",
      rows: points.map((p) => ({
        label: p.toUpperCase(),
        url: `${DOMAIN}/capture?field=${encodedFieldId}&point=${p}`,
      })),
    },
    {
      section: "FACTION RESPAWN POINTS",
      rows: [
        { label: "UNIVERSAL RESPAWN", url: `${DOMAIN}/spawn?field=${encodedFieldId}` },
      ],
    },
    {
      section: "DIRECT LOBBY JOIN",
      rows: [{ label: "LOBBY ENTRY", url: `${DOMAIN}/join?field_id=${encodedFieldId}` }],
    },
  ];
}

function QrGeneratorPage() {
  const { field_id } = Route.useSearch();
  const [manualId, setManualId] = useState("");
  const activeId = field_id || manualId;
  const sections = buildRows(activeId || "[FIELD_UUID]");

  return (
    <div style={{ background: BG, color: INK, minHeight: "100vh", paddingTop: 112 }} className="pb-16">
      <div className="max-w-5xl mx-auto px-4">
        <Link to="/admin-pregled" style={{ color: ACCENT, fontFamily: "monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ChevronLeft size={12} /> Back to Command Center
        </Link>
        <p className="mt-6 font-mono uppercase" style={{ fontSize: 11, letterSpacing: "0.3em", color: ACCENT }}>
          // MISSION SUPPLY POST
        </p>
        <h1 style={{ fontFamily: "'Michroma', monospace", fontSize: "clamp(24px, 4vw, 36px)", letterSpacing: "0.1em", color: ACCENT, marginTop: 6 }}>
          TACTICAL QR GENERATOR
        </h1>
        <p className="mt-3 text-[14px]" style={{ color: MUTED, maxWidth: 640, lineHeight: 1.7 }}>
          Generate print-ready QR codes for sector domination, universal respawn, and lobby entry. URLs bind to the active mission UUID.
        </p>

        {!field_id && (
          <div className="mt-6 p-4" style={{ background: PANEL, border: `1px dashed ${ACCENT}66` }}>
            <label className="block font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: MUTED }}>
              Mission UUID
            </label>
            <input
              value={manualId}
              onChange={(e) => setManualId(e.target.value.trim())}
              placeholder="paste mission UUID"
              style={{ width: "100%", background: BG, color: INK, border: `1px solid ${ACCENT}44`, padding: "10px 12px", fontFamily: "monospace", fontSize: 13 }}
            />
          </div>
        )}

        <div className="mt-8 space-y-10">
          {sections.map((s) => (
            <section key={s.section}>
              <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: 13, letterSpacing: "0.2em", color: ACCENT, borderBottom: `1px solid ${ACCENT}33`, paddingBottom: 8 }}>
                {s.section}
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {s.rows.map((r) => (
                  <QrCard key={r.label} row={r} disabled={!activeId} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function QrCard({ row, disabled }: { row: Row; disabled: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(row.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* ignore */ }
  };
  return (
    <div style={{ background: PANEL, border: `1px solid ${ACCENT}33`, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em", color: ACCENT }}>{row.label}</span>
      </div>
      <div style={{ background: "#fff", padding: 12, display: "grid", placeItems: "center" }}>
        {disabled ? (
          <p className="font-mono text-[10px]" style={{ color: "#333", padding: 40 }}>NO FIELD ID</p>
        ) : (
          <QRCodeSVG value={row.url} size={168} level="M" />
        )}
      </div>
      <div style={{ background: "#0a0c07", border: `1px solid ${ACCENT}22`, padding: "8px 10px", fontFamily: "monospace", fontSize: 10, color: INK, wordBreak: "break-all", lineHeight: 1.5 }}>
        {row.url}
      </div>
      <button
        type="button"
        onClick={copy}
        disabled={disabled}
        className="inline-flex items-center justify-center gap-2"
        style={{ background: copied ? "#3ddc8422" : "transparent", color: copied ? "#3ddc84" : ACCENT, border: `1px solid ${copied ? "#3ddc8477" : ACCENT + "66"}`, padding: "8px 10px", fontFamily: "monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1 }}
      >
        {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy URL</>}
      </button>
    </div>
  );
}
