import { formatMmSs, type MatchClock, type MatchPhase } from "@/lib/match-clock";

const ACCENT = "#E0B04E";
const MUTED = "rgba(236,227,196,0.55)";
const GREEN = "#3ddc84";
const AMBER = "#f5b041";
const RED = "#e74c3c";

const LABEL: Record<MatchPhase, [string, string]> = {
  inactive: ["GAME INACTIVE", "IGRA NEAKTIVNA"],
  prestart: ["PRE-START", "PRED ZAČETKOM"],
  live: ["LIVE · IN PROGRESS", "AKTIVNO · V TEKU"],
  paused: ["PAUSED", "ZAUSTAVLJENO"],
  timeup: ["TIME UP", "ČAS JE POTEKEL"],
  ended: ["ENDED", "KONČANO"],
};
const COLOR: Record<MatchPhase, string> = {
  inactive: MUTED, prestart: ACCENT, live: GREEN, paused: AMBER, timeup: RED, ended: MUTED,
};

export function MatchClockCard({ en, clock, target }: { en: boolean; clock: MatchClock; target?: number }) {
  const { phase } = clock;
  const color = COLOR[phase];
  const durMin = Math.round(clock.durationSec / 60);
  let caption: string | null = null;
  let value: string | null = null;
  if (phase === "prestart") { caption = en ? "MATCH STARTS IN" : "MISIJA SE ZAČNE ČEZ"; value = formatMmSs(clock.countdownSec); }
  else if (phase === "live") { caption = en ? "TIME REMAINING" : "PREOSTALI ČAS"; value = formatMmSs(clock.remainingSec); }
  else if (phase === "paused") { caption = en ? "TIME REMAINING (FROZEN)" : "PREOSTALI ČAS (ZAMRZNJEN)"; value = formatMmSs(clock.remainingSec); }
  else if (phase === "timeup") { value = "00:00"; }
  else if (phase === "inactive") { caption = en ? "MATCH LENGTH" : "TRAJANJE MISIJE"; value = `${durMin} min`; }

  let detail: string | null = null;
  if (phase === "live" || phase === "paused") {
    detail = en ? `Elapsed ${formatMmSs(clock.elapsedSec)} of ${durMin} min` : `Preteklo ${formatMmSs(clock.elapsedSec)} od ${durMin} min`;
  } else if (phase === "inactive" && target != null) {
    detail = en ? `Target ${target} pts` : `Cilj ${target} točk`;
  }
  const showBar = phase === "live" || phase === "paused";
  const pct = clock.durationSec > 0 ? Math.min(100, (clock.elapsedSec / clock.durationSec) * 100) : 0;

  return (
    <div style={{
      marginBottom: 12, padding: "14px 12px", textAlign: "center", width: "100%", boxSizing: "border-box",
      border: `1px solid ${ACCENT}`, background: "rgba(224,176,78,0.08)",
    }}>
      <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "monospace", fontSize: 11, letterSpacing: "0.22em", color, textTransform: "uppercase", fontWeight: 700, margin: 0 }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        {LABEL[phase][en ? 0 : 1]}
      </p>
      {caption && (
        <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.24em", color: ACCENT, textTransform: "uppercase", margin: "10px 0 4px" }}>
          // {caption}
        </p>
      )}
      {value && (
        <p role="timer" style={{ fontFamily: "'Michroma', monospace", fontSize: 28, letterSpacing: "0.14em", color: phase === "timeup" ? RED : ACCENT, fontWeight: 700, margin: caption ? 0 : "10px 0 0" }}>
          {value}
        </p>
      )}
      {showBar && (
        <div aria-hidden style={{ height: 4, background: "rgba(236,227,196,0.12)", marginTop: 10 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color }} />
        </div>
      )}
      {detail && <p style={{ fontSize: 11, color: MUTED, margin: "8px 0 0" }}>{detail}</p>}
    </div>
  );
}
