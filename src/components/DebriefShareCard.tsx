import { useRef, useState } from "react";
import { Share2 } from "lucide-react";

/**
 * Shareable debriefing card (9:16 story format).
 * The card is rendered permanently OFF-SCREEN so it can never affect
 * the visible debriefing layout. On click it is rasterised to PNG and
 * pushed to the native share sheet (Web Share API level 2, files),
 * with a download + clipboard fallback.
 */

const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.62)";

export type ShareTeam = { key: string; name: string; color: string; score: number };
export type SharePlayer = { callsign: string; pts: number; deaths?: number | null; color: string; team?: string };
export type ShareNode = { n: number; x: number; y: number; color: string };

export type DebriefShareData = {
  missionName: string;
  fieldName: string;
  marshalName?: string;
  teams: ShareTeam[];
  top3: SharePlayer[];
  /** Full ranked player list; the card renders ranks 4-8 below the podium. */
  leaderboard?: SharePlayer[];
  nodes: ShareNode[];
  showDeaths: boolean;
  en: boolean;
};

const CARD_W = 1080;
const CARD_H = 1920;

export function DebriefShareButton({ data, accentColor }: { data: DebriefShareData; accentColor?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const en = data.en;
  const col = accentColor || ACCENT;

  async function render(): Promise<Blob | null> {
    const node = ref.current;
    if (!node) return null;
    const { toBlob } = await import("html-to-image");
    const opts = { width: CARD_W, height: CARD_H, pixelRatio: 1, cacheBust: true, backgroundColor: "#070906" };
    try {
      return await toBlob(node, opts);
    } catch {
      return await toBlob(node, { ...opts, skipFonts: true });
    }
  }

  async function onShare() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const blob = await render();
      if (!blob) throw new Error("render failed");
      const file = new File([blob], "spartanops-debriefing.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: data.missionName,
          text: `${data.missionName} · SpartanOps Domination — spartanopsapp.com`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "spartanops-debriefing.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        try {
          await navigator.clipboard?.writeText(`${data.missionName} · SpartanOps Domination — https://spartanopsapp.com`);
        } catch { /* ignore */ }
        setNote(en ? "Image downloaded · link copied" : "Slika shranjena · povezava kopirana");
      }
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      if (!aborted) setNote(en ? "Share failed. Try again." : "Deljenje ni uspelo. Poskusi znova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center mb-10">
      <button
        type="button"
        onClick={onShare}
        disabled={busy}
        className="spo-share-btn"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 26px",
          background: `${col}14`,
          border: `2px solid ${col}`,
          color: col,
          fontFamily: "'Michroma', monospace",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 700,
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        <Share2 size={16} />
        {busy
          ? (en ? "Generating…" : "Ustvarjam…")
          : (en ? "Share mission report" : "Deli rezultate misije")}
      </button>
      {note && (
        <p className="font-mono text-[10px] mt-2" style={{ color: MUTED, letterSpacing: "0.1em" }}>{note}</p>
      )}
      <style>{`
        .spo-share-btn { animation: spo-share-pulse 2.4s ease-in-out infinite; transition: transform 180ms ease, background 200ms ease; }
        .spo-share-btn:hover { transform: translateY(-2px); }
        @keyframes spo-share-pulse {
          0%,100% { box-shadow: 0 0 0 rgba(224,176,78,0); }
          50% { box-shadow: 0 0 26px ${col}66; }
        }
        @media (prefers-reduced-motion: reduce) { .spo-share-btn { animation: none; } }
      `}</style>

      {/* OFF-SCREEN render target — never affects visible layout */}
      <div style={{ position: "fixed", left: -99999, top: 0, width: CARD_W, height: CARD_H, pointerEvents: "none", opacity: 1, zIndex: -1 }} aria-hidden>
        <ShareCard ref={ref} data={data} />
      </div>
    </div>
  );
}

const MEDALS = ["#E9C64B", "#CFD4D8", "#C08048"];
const mono = "'Michroma', monospace";

function fitSize(text: string, base: number, min: number, maxChars: number) {
  if (text.length <= maxChars) return base;
  return Math.max(min, Math.round(base * (maxChars / text.length)));
}

function ShareCard({ ref, data }: { ref: React.Ref<HTMLDivElement>; data: DebriefShareData }) {
  const en = data.en;
  const teams = [...data.teams].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(1, ...teams.map((t) => t.score));
  const winner = teams[0];
  const draw = teams.length > 1 && teams[0].score === teams[1].score;
  const board = (data.leaderboard ?? data.top3).slice(3, 8);

  // podium order: 2nd, 1st, 3rd
  const podiumOrder = [data.top3[1], data.top3[0], data.top3[2]];
  const podiumRank = [2, 1, 3];
  const podiumH = [206, 288, 158];

  return (
    <div
      ref={ref}
      style={{
        width: CARD_W,
        height: CARD_H,
        background: "linear-gradient(168deg, #0f1409 0%, #070906 42%, #120d04 100%)",
        color: INK,
        padding: "70px 62px 58px",
        display: "flex",
        flexDirection: "column",
        fontFamily: "monospace",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ambient glow */}
      <div style={{ position: "absolute", top: -260, left: "50%", marginLeft: -420, width: 840, height: 640, background: `radial-gradient(closest-side, ${ACCENT}22, transparent)` }} />
      <div style={{ position: "absolute", inset: 30, border: `2px solid ${ACCENT}2e` }} />
      {/* corner ticks */}
      {[["30px", "30px"], ["30px", "auto"], ["auto", "30px"], ["auto", "auto"]].map(([t, l], i) => (
        <div key={i} style={{ position: "absolute", top: t === "auto" ? undefined : t, bottom: t === "auto" ? 30 : undefined, left: l === "auto" ? undefined : l, right: l === "auto" ? 30 : undefined, width: 46, height: 46, borderTop: t === "auto" ? "none" : `4px solid ${ACCENT}`, borderBottom: t === "auto" ? `4px solid ${ACCENT}` : "none", borderLeft: l === "auto" ? "none" : `4px solid ${ACCENT}`, borderRight: l === "auto" ? `4px solid ${ACCENT}` : "none" }} />
      ))}

      {/* HEADER */}
      <div style={{ textAlign: "center", position: "relative" }}>
        <p style={{ fontFamily: mono, fontSize: 21, letterSpacing: "0.44em", color: ACCENT, textTransform: "uppercase" }}>
          SPARTANOPS · DOMINATION
        </p>
        <p style={{ fontFamily: mono, fontSize: 16, letterSpacing: "0.34em", color: MUTED, textTransform: "uppercase", marginTop: 14 }}>
          {en ? "MISSION REPORT" : "POROČILO MISIJE"}
        </p>
        <p
          style={{
            fontFamily: mono,
            fontSize: fitSize(data.missionName, 50, 28, 22),
            lineHeight: 1.16,
            letterSpacing: "0.05em",
            color: INK,
            marginTop: 20,
            textTransform: "uppercase",
          }}
        >
          {data.missionName}
        </p>
        <p style={{ fontFamily: mono, fontSize: 20, letterSpacing: "0.22em", color: ACCENT, marginTop: 14, textTransform: "uppercase" }}>
          {data.fieldName}
        </p>
        <div style={{ height: 2, margin: "26px auto 0", width: 520, background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }} />
      </div>

      {/* WINNER BANNER */}
      <div
        style={{
          marginTop: 30,
          padding: "22px 30px",
          textAlign: "center",
          background: draw ? "rgba(255,255,255,0.05)" : `linear-gradient(90deg, transparent, ${winner?.color ?? ACCENT}33, transparent)`,
          border: `2px solid ${draw ? `${ACCENT}66` : `${winner?.color ?? ACCENT}`}`,
        }}
      >
        <p style={{ fontFamily: mono, fontSize: 17, letterSpacing: "0.32em", color: MUTED, textTransform: "uppercase" }}>
          {draw ? (en ? "RESULT" : "IZID") : (en ? "VICTORY" : "ZMAGOVALEC")}
        </p>
        <p style={{ fontFamily: mono, fontSize: 42, letterSpacing: "0.1em", color: draw ? INK : winner?.color ?? ACCENT, marginTop: 12, textTransform: "uppercase" }}>
          {draw ? (en ? "DRAW" : "NEODLOČENO") : winner?.name}
        </p>
      </div>

      {/* TEAM SCORES */}
      <div style={{ marginTop: 32 }}>
        {teams.map((t) => (
          <div key={t.key} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}>
              <span style={{ fontFamily: mono, fontSize: 22, letterSpacing: "0.16em", color: t.color, textTransform: "uppercase" }}>{t.name}</span>
              <span style={{ fontFamily: mono, fontSize: 30, color: t.color, fontWeight: 700 }}>{t.score}</span>
            </div>
            <div style={{ height: 14, background: "rgba(255,255,255,0.07)", border: `1px solid ${t.color}55` }}>
              <div style={{ width: `${Math.round((t.score / maxScore) * 100)}%`, height: "100%", background: t.color, boxShadow: `0 0 20px ${t.color}` }} />
            </div>
          </div>
        ))}
      </div>

      {/* PODIUM */}
      <div style={{ marginTop: 26 }}>
        <p style={{ fontFamily: mono, fontSize: 18, letterSpacing: "0.28em", color: ACCENT, textTransform: "uppercase", marginBottom: 18, textAlign: "center" }}>
          {en ? "TOP OPERATORS" : "NAJBOLJŠI OPERATIVCI"}
        </p>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 18 }}>
          {podiumOrder.map((p, i) => {
            const rank = podiumRank[i];
            const medal = MEDALS[rank - 1];
            if (!p) return <div key={i} style={{ width: 300 }} />;
            return (
              <div key={`${p.callsign}-${rank}`} style={{ width: 300, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: "50%",
                    border: `4px solid ${medal}`,
                    background: `${medal}1f`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: mono,
                    fontSize: 34,
                    color: medal,
                    boxShadow: `0 0 34px ${medal}55`,
                    marginBottom: 14,
                  }}
                >
                  {rank}
                </div>
                <p
                  style={{
                    fontFamily: mono,
                    fontSize: fitSize(p.callsign, rank === 1 ? 25 : 21, 13, rank === 1 ? 11 : 12),
                    color: INK,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    textAlign: "center",
                    marginBottom: 12,
                    maxWidth: 290,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p.callsign}
                </p>
                <div
                  style={{
                    width: "100%",
                    height: podiumH[i],
                    background: `linear-gradient(180deg, ${medal}3a, ${medal}0d)`,
                    borderTop: `4px solid ${medal}`,
                    borderLeft: `2px solid ${medal}55`,
                    borderRight: `2px solid ${medal}55`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontFamily: mono, fontSize: rank === 1 ? 46 : 38, color: p.color, fontWeight: 700 }}>{p.pts}</span>
                  <span style={{ fontFamily: mono, fontSize: 15, letterSpacing: "0.22em", color: MUTED }}>{en ? "PTS" : "TOČ"}</span>
                  {data.showDeaths && (
                    <span style={{ fontFamily: mono, fontSize: 16, color: "#ff8080" }}>☠ {p.deaths ?? 0}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LEADERBOARD 4+ */}
      <div style={{ marginTop: 30, flex: 1 }}>
        {board.length > 0 && (
          <>
            <p style={{ fontFamily: mono, fontSize: 16, letterSpacing: "0.26em", color: ACCENT, textTransform: "uppercase", marginBottom: 14 }}>
              ▌ {en ? "LEADERBOARD" : "LESTVICA"}
            </p>
            {board.map((p, i) => (
              <div
                key={`${p.callsign}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  padding: "14px 20px",
                  marginBottom: 10,
                  background: "rgba(255,255,255,0.035)",
                  borderLeft: `4px solid ${p.color}`,
                }}
              >
                <span style={{ fontFamily: mono, fontSize: 20, color: MUTED, width: 56 }}>#{i + 4}</span>
                <span style={{ fontFamily: mono, fontSize: 22, color: INK, flex: 1, letterSpacing: "0.05em", textTransform: "uppercase", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {p.callsign}
                </span>
                {data.showDeaths && (
                  <span style={{ fontFamily: mono, fontSize: 18, color: "#ff8080", minWidth: 78, textAlign: "right" }}>☠ {p.deaths ?? 0}</span>
                )}
                <span style={{ fontFamily: mono, fontSize: 22, color: p.color, minWidth: 110, textAlign: "right" }}>
                  {p.pts} {en ? "PTS" : "TOČ"}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* SECTOR STRIP */}
      {data.nodes.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: mono, fontSize: 14, letterSpacing: "0.22em", color: MUTED, textTransform: "uppercase", marginRight: 6 }}>
            {en ? "SECTORS" : "SEKTORJI"}
          </span>
          {data.nodes.slice(0, 12).map((n) => (
            <div
              key={n.n}
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: `${n.color}2e`,
                border: `3px solid ${n.color}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: mono,
                fontSize: 18,
                color: n.color,
                boxShadow: `0 0 18px ${n.color}66`,
              }}
            >
              {n.n}
            </div>
          ))}
        </div>
      )}

      {/* FOOTER */}
      <div style={{ textAlign: "center", marginTop: 26 }}>
        {data.marshalName && (
          <p style={{ fontFamily: mono, fontSize: 15, letterSpacing: "0.14em", color: MUTED, marginBottom: 16, textTransform: "uppercase" }}>
            {en ? "ORGANIZED BY" : "IGRO ORGANIZIRAL"}: {data.marshalName}
          </p>
        )}
        <div style={{ height: 2, margin: "0 auto 20px", width: 520, background: `linear-gradient(90deg, transparent, ${ACCENT}88, transparent)` }} />
        <p style={{ fontFamily: mono, fontSize: 24, letterSpacing: "0.2em", color: ACCENT, textTransform: "uppercase" }}>
          SPARTANOPSAPP.COM
        </p>
        <p style={{ fontFamily: mono, fontSize: 14, letterSpacing: "0.2em", color: MUTED, marginTop: 12, textTransform: "uppercase" }}>
          {en ? "RUN YOUR OWN AIRSOFT MISSION" : "VODI SVOJO AIRSOFT MISIJO"}
        </p>
      </div>
    </div>
  );
}
