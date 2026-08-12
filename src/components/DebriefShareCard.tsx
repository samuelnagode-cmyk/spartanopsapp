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
const MUTED = "rgba(236,227,196,0.6)";

export type ShareTeam = { key: string; name: string; color: string; score: number };
export type SharePlayer = { callsign: string; pts: number; deaths?: number | null; color: string };
export type ShareNode = { n: number; x: number; y: number; color: string };

export type DebriefShareData = {
  missionName: string;
  fieldName: string;
  marshalName?: string;
  teams: ShareTeam[];
  top3: SharePlayer[];
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

function ShareCard({ ref, data }: { ref: React.Ref<HTMLDivElement>; data: DebriefShareData }) {
  const en = data.en;
  const maxScore = Math.max(1, ...data.teams.map((t) => t.score));
  const mono = "'Michroma', monospace";
  return (
    <div
      ref={ref}
      style={{
        width: CARD_W,
        height: CARD_H,
        background: "linear-gradient(165deg, #0d1109 0%, #070906 45%, #100c04 100%)",
        color: INK,
        padding: "78px 70px",
        display: "flex",
        flexDirection: "column",
        fontFamily: "monospace",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* corner brackets */}
      <div style={{ position: "absolute", inset: 34, border: `2px solid ${ACCENT}33` }} />

      {/* HEADER */}
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: mono, fontSize: 24, letterSpacing: "0.42em", color: ACCENT, textTransform: "uppercase" }}>
          SPARTANOPS DOMINATION
        </p>
        <div style={{ height: 2, margin: "26px auto", width: 380, background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }} />
        <p style={{ fontFamily: mono, fontSize: 20, letterSpacing: "0.3em", color: MUTED, textTransform: "uppercase" }}>
          {en ? "MISSION REPORT" : "POROČILO MISIJE"}
        </p>
        <p style={{ fontFamily: mono, fontSize: 52, lineHeight: 1.2, letterSpacing: "0.06em", color: INK, marginTop: 22, textTransform: "uppercase" }}>
          {data.missionName}
        </p>
        <p style={{ fontFamily: mono, fontSize: 26, letterSpacing: "0.2em", color: ACCENT, marginTop: 16, textTransform: "uppercase" }}>
          {data.fieldName}
        </p>
        {data.marshalName && (
          <p style={{ fontSize: 24, letterSpacing: "0.08em", color: MUTED, marginTop: 18 }}>
            {en ? "Organized by" : "Igro organiziral"}: {data.marshalName}
          </p>
        )}
      </div>

      {/* MINI MAP */}
      <div style={{ marginTop: 52, height: 420, border: `2px solid ${ACCENT}55`, background: "rgba(0,0,0,0.55)", position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(${ACCENT}14 1px, transparent 1px), linear-gradient(90deg, ${ACCENT}14 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
        {data.nodes.map((n) => (
          <div
            key={n.n}
            style={{
              position: "absolute",
              left: `${Math.min(94, Math.max(6, n.x))}%`,
              top: `${Math.min(90, Math.max(10, n.y))}%`,
              transform: "translate(-50%, -50%)",
              width: 54,
              height: 54,
              borderRadius: "50%",
              background: `${n.color}33`,
              border: `3px solid ${n.color}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: mono,
              fontSize: 22,
              color: n.color,
              boxShadow: `0 0 26px ${n.color}88`,
            }}
          >
            {n.n}
          </div>
        ))}
        <p style={{ position: "absolute", left: 18, bottom: 12, fontFamily: mono, fontSize: 16, letterSpacing: "0.24em", color: MUTED, textTransform: "uppercase" }}>
          {en ? "SECTOR GRID" : "MREŽA SEKTORJEV"}
        </p>
      </div>

      {/* TEAM SCORES */}
      <div style={{ marginTop: 46 }}>
        {data.teams.map((t) => (
          <div key={t.key} style={{ marginBottom: 26 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ fontFamily: mono, fontSize: 26, letterSpacing: "0.16em", color: t.color, textTransform: "uppercase" }}>{t.name}</span>
              <span style={{ fontFamily: mono, fontSize: 34, color: t.color, fontWeight: 700 }}>{t.score}</span>
            </div>
            <div style={{ height: 16, background: "rgba(255,255,255,0.07)", border: `1px solid ${t.color}55` }}>
              <div style={{ width: `${Math.round((t.score / maxScore) * 100)}%`, height: "100%", background: t.color, boxShadow: `0 0 20px ${t.color}` }} />
            </div>
          </div>
        ))}
      </div>

      {/* TOP 3 */}
      <div style={{ marginTop: 26, flex: 1 }}>
        <p style={{ fontFamily: mono, fontSize: 22, letterSpacing: "0.26em", color: ACCENT, textTransform: "uppercase", marginBottom: 22 }}>
          ▌ {en ? "TOP 3 PLAYERS" : "NAJBOLJŠI 3 IGRALCI"}
        </p>
        {data.top3.map((p, i) => {
          const medal = ["#D4AF37", "#C8CBCE", "#A87C53"][i];
          return (
            <div
              key={`${p.callsign}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 22,
                padding: "20px 22px",
                marginBottom: 14,
                background: "rgba(255,255,255,0.035)",
                border: `2px solid ${medal}66`,
              }}
            >
              <span style={{ fontFamily: mono, fontSize: 30, color: medal, width: 70 }}>#{i + 1}</span>
              <span style={{ fontFamily: mono, fontSize: 28, color: INK, flex: 1, letterSpacing: "0.06em", textTransform: "uppercase", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {p.callsign}
              </span>
              <span style={{ fontFamily: mono, fontSize: 26, color: p.color }}>
                {p.pts} {en ? "PTS" : "TOČ"}
              </span>
              {data.showDeaths && (
                <span style={{ fontFamily: mono, fontSize: 24, color: "#ff7070", minWidth: 90, textAlign: "right" }}>
                  ☠ {p.deaths ?? 0}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div style={{ textAlign: "center", marginTop: 20 }}>
        <div style={{ height: 2, margin: "0 auto 24px", width: 480, background: `linear-gradient(90deg, transparent, ${ACCENT}88, transparent)` }} />
        <p style={{ fontFamily: mono, fontSize: 22, letterSpacing: "0.22em", color: ACCENT, textTransform: "uppercase" }}>
          {en ? "Visit us at SpartanOpsapp.com" : "Obiščite nas na SpartanOpsapp.com"}
        </p>
      </div>
    </div>
  );
}
