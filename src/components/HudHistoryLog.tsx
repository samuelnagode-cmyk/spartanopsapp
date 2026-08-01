import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";

import type { DeathEvent } from "@/lib/hud-history";

/**
 * Two-tier tactical History Log.
 * Major events (sector captures) are full-width and bold; minor events
 * (player deaths / respawn requests) are compact and only rendered when
 * respawn QR codes are enabled for the mission.
 */

export type CaptureEntry = {
  id: string;
  point_number: number;
  team: string;
  player_callsign: string | null;
  captured_at: string;
};

const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";
const PANEL = "rgba(255,255,255,0.03)";

function fmtTime(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

type Row =
  | { kind: "capture"; id: string; at: number; team: string; player: string; sector: string }
  | { kind: "death"; id: string; at: number; team: string; player: string };

export function HudHistoryLog({
  captures,
  deaths,
  respawnEnabled,
  teamLabelFor,
  teamColor,
  nodeNames,
  maxHeight = 320,
}: {
  captures: CaptureEntry[];
  deaths: DeathEvent[];
  respawnEnabled: boolean;
  teamLabelFor: (t: string) => string;
  teamColor: (t: string) => string;
  nodeNames: string[];
  maxHeight?: number;
}) {
  const t = useT();
  const [filter, setFilter] = useState<"all" | "sectors">("all");

  const rows = useMemo<Row[]>(() => {
    const capRows: Row[] = captures.map((c) => ({
      kind: "capture" as const,
      id: `cap-${c.id}`,
      at: new Date(c.captured_at).getTime() || 0,
      team: c.team,
      player: c.player_callsign ? String(c.player_callsign).toUpperCase() : "—",
      sector: nodeNames[c.point_number - 1] ?? `#${c.point_number}`,
    }));
    const deathRows: Row[] =
      respawnEnabled && filter === "all"
        ? deaths.map((d) => ({
            kind: "death" as const,
            id: `dth-${d.id}`,
            at: d.at,
            team: d.team,
            player: String(d.callsign ?? "—").toUpperCase(),
          }))
        : [];
    return [...capRows, ...deathRows].sort((a, b) => b.at - a.at);
  }, [captures, deaths, respawnEnabled, filter, nodeNames]);


  return (
    <div style={{ background: PANEL, border: "1px solid rgba(236,227,196,0.12)" }}>
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid rgba(236,227,196,0.1)",
          fontFamily: "monospace",
          fontSize: 11,
          letterSpacing: "0.2em",
          color: ACCENT,
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span>▌ {t("hudLog.title")}</span>
        {respawnEnabled && (
          <div style={{ marginLeft: "auto", display: "inline-flex", border: `1px solid ${ACCENT}55` }}>
            {(["all", "sectors"] as const).map((f) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  style={{
                    padding: "5px 10px",
                    fontFamily: "monospace",
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    background: active ? ACCENT : "transparent",
                    color: active ? "#0b0d09" : MUTED,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {f === "all" ? t("hudLog.all") : t("hudLog.sectorsOnly")}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ maxHeight, overflowY: "auto" }}>
        {rows.length === 0 && (
          <p style={{ color: MUTED, fontStyle: "italic", padding: 16, fontSize: 12, textAlign: "center" }}>
            {t("hudLog.empty")}
          </p>
        )}
        {rows.map((r) => {
          const c = teamColor(r.team) ?? ACCENT;
          const isCap = r.kind === "capture";
          return (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                whiteSpace: "nowrap",
                overflow: "hidden",
                padding: "4px 12px",
                borderTop: "1px solid rgba(236,227,196,0.05)",
                borderLeft: `3px solid ${isCap ? c : `${c}66`}`,
                background: isCap ? `${c}0d` : "transparent",
              }}
            >
              <span aria-hidden style={{ fontSize: isCap ? 11 : 10, color: c, lineHeight: 1 }}>
                {isCap ? "🎯" : "☠"}
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 9.5, color: MUTED, letterSpacing: "0.08em" }}>
                {fmtTime(r.at)}
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 10.5,
                  color: c,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {teamLabelFor(r.team)}
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: isCap ? 11.5 : 10.5,
                  color: isCap ? INK : "rgba(236,227,196,0.72)",
                  fontWeight: isCap ? 700 : 400,
                  letterSpacing: "0.06em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.player}
              </span>
              {isCap && (
                <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 10, color: MUTED, letterSpacing: "0.1em" }}>
                  {r.sector}
                </span>
              )}
            </div>
          );
        })}

      </div>
    </div>
  );
}
