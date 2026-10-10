import { useT } from "@/lib/i18n";

const MUTED = "rgba(236,227,196,0.55)";

/** Not built yet: shown as a plain "coming soon" tile, never opens anything. */
export function AutoBalanceSoon({ en }: { en: boolean }) {
  const t = useT();
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        aria-disabled="true"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          padding: "12px 12px",
          background: "rgba(255,255,255,0.03)",
          border: "1px dashed rgba(236,227,196,0.18)",
          color: MUTED, opacity: 0.75, cursor: "default",
        }}
      >
        <span style={{ fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", minWidth: 0 }}>
          {en ? "Auto balance teams" : "Samodejno uravnoteženje ekip"}
        </span>
        <span style={{ flexShrink: 0, border: "1px solid rgba(236,227,196,0.25)", padding: "2px 6px", fontFamily: "monospace", fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          {t("pricing.soonLabel")}
        </span>
      </div>
      <p style={{ marginTop: 8, fontSize: 10.5, color: MUTED, fontFamily: "monospace", lineHeight: 1.55, letterSpacing: "0.04em" }}>
        {en
          ? "Balance the players among teams based on their skill level."
          : "Uravnoteži igralce med ekipami glede na njihovo stopnjo izkušenj."}
      </p>
    </div>
  );
}
