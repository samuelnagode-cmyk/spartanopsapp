import { ACCENT, ERR, MICHROMA, MUTED } from "./ui";
import type { Lang } from "@/lib/events";

export function CapacityBar({ going, capacity, lang, compact = false }: { going: number; capacity: number | null; lang: Lang; compact?: boolean }) {
  if (!capacity) return null;
  const full = going >= capacity;
  const pct = Math.min(100, Math.round((going / capacity) * 100));
  const color = full ? ERR : ACCENT;
  return (
    <div style={{ marginTop: compact ? 6 : 12 }} aria-label={`${going} / ${capacity}`}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: compact ? 11 : 12, color: MUTED, marginBottom: 4 }}>
        <span>{going} / {capacity}</span>
        {full && <span style={{ fontFamily: MICHROMA, fontSize: 9.5, letterSpacing: "0.16em", color: ERR }}>{lang === "en" ? "FULL" : "POLNO"}</span>}
      </div>
      <div style={{ height: compact ? 4 : 6, background: `${ACCENT}22` }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}
