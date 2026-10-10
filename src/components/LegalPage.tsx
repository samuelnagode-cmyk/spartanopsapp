import { useEffect, type CSSProperties } from "react";
import { useLang } from "@/lib/i18n";
import { CONTROLLER_ADDRESS, CONTROLLER_NAME } from "@/lib/legal";
import { CONTROLLER_LINE, LEGAL_UPDATED, PRIVACY, TERMS, type LegalBlock } from "@/lib/legal-text";

const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const p: CSSProperties = { fontFamily: "monospace", fontSize: 14, lineHeight: 1.7, marginBottom: 12 };
const cell: CSSProperties = { border: `1px solid ${ACCENT}33`, padding: "8px 10px", verticalAlign: "top", textAlign: "left" };

export function LegalPage({ doc }: { doc: "privacy" | "terms" }) {
  const { lang } = useLang();
  const l = lang === "en" ? "en" : "sl";
  const d = (doc === "privacy" ? PRIVACY : TERMS)[l];

  useEffect(() => {
    document.title = `${d.title} — SpartanOps`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", d.description);
  }, [d]);

  const render = (b: LegalBlock, i: number) => {
    if (b.kind === "controller") return <p key={i} style={p}>{CONTROLLER_LINE[l](CONTROLLER_NAME, CONTROLLER_ADDRESS)}</p>;
    if (b.kind === "p") return <p key={i} style={p}>{b.text}</p>;
    if (b.kind === "list") return <ul key={i} style={{ ...p, paddingLeft: 20, listStyle: "disc" }}>{b.items.map((t) => <li key={t} style={{ marginBottom: 8 }}>{t}</li>)}</ul>;
    return (
      <div key={i} style={{ overflowX: "auto", marginBottom: 12 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontFamily: "monospace", fontSize: 12.5, lineHeight: 1.5 }}>
          <thead><tr>{b.head.map((h) => <th key={h} style={{ ...cell, color: ACCENT, fontWeight: 600 }}>{h}</th>)}</tr></thead>
          <tbody>{b.rows.map((r) => <tr key={r[0]}>{r.map((c, j) => <td key={j} style={cell}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  };

  return (
    <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "110px 16px 56px" }}>
      <article style={{ maxWidth: 720, margin: "0 auto", background: PANEL, border: `1px solid ${ACCENT}44`, padding: "28px 22px" }}>
        <h1 style={{ fontFamily: "'Michroma', monospace", fontSize: 18, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>{d.title}</h1>
        <p style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.65, marginBottom: 26 }}>{LEGAL_UPDATED[l]}</p>
        {d.sections.map((s, i) => (
          <section key={s.title} style={{ marginBottom: 22 }}>
            <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.14em", color: ACCENT, textTransform: "uppercase", marginBottom: 10 }}>
              {i + 1}. {s.title}
            </h2>
            {s.blocks.map(render)}
          </section>
        ))}
      </article>
    </main>
  );
}
