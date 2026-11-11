import { Component, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHARE_NEUTRAL_COLOR, type ShareNode, type ShareSpawn } from "@/lib/debrief-share";

export type ShareTeam = { key: string; name: string; color: string; score: number };
export type SharePlayer = { callsign: string; pts: number; deaths?: number | null; color: string; team?: string };
export type ShareMe = { callsign: string; teamKey: string; teamName: string; color: string; pts: number; deaths: number; rankInTeam: number; teamSize: number; isMvp: boolean };
export type DebriefShareData = {
  missionName: string; fieldName: string; teams: ShareTeam[]; top3: SharePlayer[];
  nodes: ShareNode[]; spawns: ShareSpawn[]; mapUrl: string | null; matchDate: string | null;
  myTeamKey?: string; me?: ShareMe; showDeaths: boolean; showPlayers?: boolean;
  winnerKey?: string | null; isTie?: boolean; en: boolean;
};
const CARD_W = 1080;
const CARD_H = 1920;
const mono = "'Michroma', monospace";
const theme = {
  gold: "#E0B04E", ink: "#ece3c4", muted: "rgba(236,227,196,0.65)", base: "#070906",
  panel: "#11150e", death: "#ff8080", medals: ["#E9C64B", "#CFD4D8", "#C08048"],
};
const cardVars = { "--share-gold": theme.gold, "--share-ink": theme.ink, "--share-muted": theme.muted, "--share-base": theme.base, "--share-panel": theme.panel } as CSSProperties;

class ShareErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function readMap(url: string, signal: AbortSignal): Promise<string> {
  return fetch(url, { mode: "cors", signal }).then(async (response) => {
    if (!response.ok) throw new Error("Map unavailable");
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Invalid map"));
      reader.onerror = () => reject(new Error("Invalid map"));
      reader.readAsDataURL(blob);
    });
  });
}

export function DebriefShareButton({ data, accentColor, previewCard = false }: { data: DebriefShareData; accentColor?: string; previewCard?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const failedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [previewWidth, setPreviewWidth] = useState(343);
  const [map, setMap] = useState<{ url: string; source: string } | null>(null);
  const mapTask = useRef<{ url: string; promise: Promise<string | null> } | null>(null);
  const mapSource = map?.url === data.mapUrl ? map.source : null;
  const en = data.en;
  const col = accentColor || theme.gold;

  useEffect(() => {
    if (!data.mapUrl) { mapTask.current = null; return; }
    const url = data.mapUrl;
    const controller = new AbortController();
    let alive = true;
    const promise = readMap(url, controller.signal).then((source) => {
      if (alive) setMap({ url, source });
      return alive ? source : null;
    }).catch(() => null);
    mapTask.current = { url, promise };
    return () => { alive = false; controller.abort(); };
  }, [data.mapUrl]);

  useEffect(() => {
    if (!previewCard || !previewRef.current) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setPreviewWidth(entry.contentRect.width); });
    observer.observe(previewRef.current);
    return () => observer.disconnect();
  }, [previewCard]);

  async function render(): Promise<Blob | null> {
    if (failedRef.current) return null;
    const task = mapTask.current;
    if (!mapSource && task?.url === data.mapUrl) {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([task.promise, new Promise<null>((resolve) => { timeout = setTimeout(() => resolve(null), 3000); })]);
      if (timeout) clearTimeout(timeout);
      // Give React and the image's onLoad one paint before taking the snapshot.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }
    const node = ref.current;
    if (!node || failedRef.current) return null;
    const { toBlob } = await import("html-to-image");
    const opts = { width: CARD_W, height: CARD_H, pixelRatio: 1, cacheBust: true, backgroundColor: theme.base, style: { transform: "none" } };
    try {
      await toBlob(node, opts).catch(() => null);
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
      const winner = data.teams.find((t) => t.key === data.winnerKey);
      const result = data.isTie
        ? `${en ? "Draw" : "Neodločeno"}: ${data.missionName}.`
        : winner
          ? (en ? `${winner.name} won ${data.missionName}.` : `Ekipa ${winner.name} je zmagala v ${data.missionName}.`)
          : `${en ? "Operation completed" : "Operacija končana"}: ${data.missionName}.`;
      const personal = data.me && data.showPlayers !== false
        ? (en ? ` I made ${data.me.pts} captures.` : ` Moja zavzetja: ${data.me.pts}.`) : "";
      const text = `${result}${personal} #airsoft #spartanops spartanopsapp.com`;
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: data.missionName, text });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "spartanops-debriefing.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        try { await navigator.clipboard?.writeText(text); } catch { /* ignore */ }
        setNote(en ? "Image downloaded · link copied" : "Slika shranjena · povezava kopirana");
      }
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      if (!aborted) setNote(en ? "Share failed. Try again." : "Deljenje ni uspelo. Poskusi znova.");
    } finally { setBusy(false); }
  }

  const card = <ShareErrorBoundary key={`${data.missionName}:${data.matchDate}`} onError={() => { failedRef.current = true; }}>
    <ShareCard ref={ref} data={data} mapSource={mapSource} />
  </ShareErrorBoundary>;
  return (
    <div className="flex flex-col items-center mb-10 w-full" style={cardVars}>
      {previewCard ? (
        <div ref={previewRef} className="w-full mb-5" style={{ height: CARD_H * previewWidth / CARD_W, overflow: "hidden", position: "relative" }}>
          <div style={{ width: CARD_W, height: CARD_H, transform: `scale(${previewWidth / CARD_W})`, transformOrigin: "top left" }}>{card}</div>
        </div>
      ) : <div style={{ position: "fixed", left: -99999, top: 0, width: CARD_W, height: CARD_H, pointerEvents: "none", zIndex: -1 }} aria-hidden>{card}</div>}
      <Button type="button" variant="outline" onClick={onShare} disabled={busy} className="h-auto gap-2 px-5 py-3 font-mono text-[11px] uppercase max-w-full whitespace-normal" style={{ background: `${col}14`, border: `2px solid ${col}`, color: col, fontFamily: mono }}>
        <Share2 size={16} className="shrink-0" />
        {busy ? (en ? "Generating…" : "Ustvarjam…") : (en ? "Share mission report" : "Deli rezultate misije")}
      </Button>
      {note && <p className="font-mono text-[10px] mt-2" style={{ color: "var(--share-muted)" }}>{note}</p>}
    </div>
  );
}

function fitSize(text: string, base: number, min: number, maxChars: number) {
  return Math.max(min, Math.min(base, Math.round(base * maxChars / Math.max(maxChars, text.length))));
}

function matchDate(value: string | null, en: boolean) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const monthsSl = ["JAN", "FEB", "MAR", "APR", "MAJ", "JUN", "JUL", "AVG", "SEP", "OKT", "NOV", "DEC"];
  return `${date.getDate()}${en ? "" : "."} ${(en ? months : monthsSl)[date.getMonth()]} ${date.getFullYear()}`;
}

function Crown() {
  return <svg width="48" height="32" viewBox="0 0 48 32" aria-hidden><path d="M4 7 14 15 24 2 34 15 44 7 39 27H9Z" fill={theme.gold} /><path d="M9 30H39" stroke={theme.gold} strokeWidth="3" /></svg>;
}

function ShareCard({ ref, data, mapSource }: { ref: React.Ref<HTMLDivElement>; data: DebriefShareData; mapSource: string | null }) {
  const [loadedMap, setLoadedMap] = useState<{ source: string; width: number; height: number } | null>(null);
  const en = data.en;
  const teams = [...data.teams].sort((a, b) => b.score - a.score);
  const winner = data.winnerKey ? teams.find((t) => t.key === data.winnerKey) : undefined;
  const draw = !!data.isTie;
  const glow = draw ? theme.gold : winner?.color ?? theme.gold;
  const players = data.showPlayers !== false;
  const podium = players ? data.top3.slice(0, 3) : [];
  const podiumOrder = [podium[1] && { player: podium[1], rank: 2 }, podium[0] && { player: podium[0], rank: 1 }, podium[2] && { player: podium[2], rank: 3 }].filter((p): p is { player: SharePlayer; rank: number } => !!p);
  const mapH = podium.length ? 420 : 700;
  const mapLoaded = !!mapSource && loadedMap?.source === mapSource;
  const naturalRatio = mapLoaded && loadedMap ? loadedMap.width / loadedMap.height : 1;
  const imageWidth = Math.min(948, (mapH - 48) * naturalRatio);
  const imageHeight = imageWidth / naturalRatio;
  const nodes = data.nodes.length ? data.nodes : [1, 2, 3, 4, 5].map((n) => ({ n, name: ["ALPHA", "BETA", "GAMMA", "DELTA", "EPSILON"][n - 1], color: SHARE_NEUTRAL_COLOR, team: null, x: n * 16, y: 50 }));
  const resultLabel = draw ? (en ? "DRAW" : "NEODLOČENO") : !winner ? (en ? "OPERATION COMPLETED" : "OPERACIJA KONČANA") : data.me && data.myTeamKey === winner.key ? (en ? "VICTORY" : "ZMAGA") : (en ? "WINNER" : "ZMAGOVALEC");
  const bigTitle = draw ? (en ? "DRAW" : "NEODLOČENO") : winner?.name ?? "SPARTANOPS";
  const date = matchDate(data.matchDate, en);

  return <div ref={ref} data-share-card style={{ ...cardVars, width: CARD_W, height: CARD_H, boxSizing: "border-box", position: "relative", overflow: "hidden", color: "var(--share-ink)", fontFamily: "monospace", background: theme.base }}>
    <style>{`
      [data-share-card] p { margin: 0; }
      [data-share-card] * { box-sizing: border-box; line-height: 1.1; }
      [data-share-card] .share-mission { font-family: ${mono}; text-transform: uppercase; line-height: 1.2; overflow-wrap: anywhere; }
      [data-share-card] .share-callsign { font-family: ${mono}; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    `}</style>
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 36%, ${glow}47, transparent 58%), radial-gradient(ellipse at 12% 78%, ${theme.gold}12, transparent 65%), linear-gradient(160deg, #11180d, #070906)` }} />
    <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 3px)", pointerEvents: "none" }} />
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.82) 100%)" }} />
    <div style={{ position: "absolute", inset: 30, border: `2px solid ${theme.gold}35` }} />
    {[0, 1, 2, 3].map((i) => <div key={i} style={{ position: "absolute", top: i < 2 ? 30 : undefined, bottom: i >= 2 ? 30 : undefined, left: i % 2 === 0 ? 30 : undefined, right: i % 2 ? 30 : undefined, width: 50, height: 50, borderTop: i < 2 ? `4px solid ${theme.gold}` : undefined, borderBottom: i >= 2 ? `4px solid ${theme.gold}` : undefined, borderLeft: i % 2 === 0 ? `4px solid ${theme.gold}` : undefined, borderRight: i % 2 ? `4px solid ${theme.gold}` : undefined }} />)}

    <div data-share-safe style={{ position: "absolute", left: 60, top: 230, width: 960, height: 1360, display: "flex", flexDirection: "column", gap: 10 }}>
      <header data-share-block="header" style={{ height: 176, flexShrink: 0, textAlign: "center" }}>
        <p style={{ color: theme.gold, fontFamily: mono, fontSize: 20, letterSpacing: "0.22em" }}>SPARTANOPS · DOMINATION</p>
        <p className="share-mission" style={{ fontSize: fitSize(data.missionName, 44, 20, 36), marginTop: 18, maxHeight: 108, overflow: "hidden" }}>{data.missionName}</p>
        <p style={{ fontSize: 20, color: theme.muted, textTransform: "uppercase", marginTop: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.fieldName}{date ? ` · ${date}` : ""}</p>
      </header>

      <section data-share-block="result" style={{ height: 204, flexShrink: 0, textAlign: "center" }}>
        <p style={{ fontFamily: mono, color: theme.gold, fontSize: 22, letterSpacing: "0.18em" }}>{resultLabel}</p>
        <p className="share-mission" style={{ fontSize: fitSize(bigTitle, 96, 28, 12), color: glow, fontWeight: 700, textShadow: `0 0 38px ${glow}88`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 8 }}>{bigTitle}</p>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 24, fontFamily: mono, fontSize: 42, marginTop: 8 }}>
          {teams.map((t, i) => <span key={t.key} style={{ display: "inline-flex", alignItems: "baseline", gap: 24 }}>{i > 0 && <span style={{ color: theme.muted }}>{teams.length === 2 ? ":" : "·"}</span>}<span style={{ color: t.color }}>{t.score}</span></span>)}
        </div>
      </section>

      <section data-share-block="map" style={{ flexShrink: 0 }}>
        <div style={{ height: mapH, position: "relative", border: `2px solid ${theme.gold}88`, background: theme.panel, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <p style={{ position: "absolute", top: -12, left: 22, padding: "7px 16px", fontFamily: mono, fontSize: 16, color: theme.gold, background: theme.base, zIndex: 4 }}>{en ? "FINAL SECTOR CONTROL" : "KONČNI NADZOR SEKTORJEV"}</p>
          {mapSource && <img src={mapSource} alt="" onLoad={(e) => setLoadedMap({ source: mapSource, width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} onError={() => setLoadedMap(null)} style={{ position: "absolute", width: imageWidth, height: imageHeight, objectFit: "contain", opacity: mapLoaded ? 1 : 0 }} />}
          {mapLoaded ? <div data-share-map-geometry style={{ position: "relative", width: imageWidth, height: imageHeight }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.42))" }} />
            {nodes.map((n) => <div key={n.n} data-share-sector={n.n} style={{ position: "absolute", left: `${n.x}%`, top: `${n.y}%`, transform: "translate(-50%,-32px)", width: 100, textAlign: "center" }}>
              <div style={{ width: 64, height: 64, margin: "0 auto", border: `6px solid ${n.color}`, borderRadius: "50%", background: `${n.color}33`, color: n.color, boxShadow: `0 0 22px ${n.color}77`, fontFamily: mono, fontSize: 25, display: "grid", placeItems: "center", textShadow: "0 2px 4px #000" }}>{n.n}</div>
              <p style={{ fontFamily: mono, fontSize: 13, marginTop: 5, color: theme.ink, textShadow: "0 2px 5px #000, 0 0 6px #000" }}>{n.name}</p>
            </div>)}
            {data.spawns.map((spawn) => <div key={spawn.team} style={{ position: "absolute", left: `${spawn.x}%`, top: `${spawn.y}%`, transform: "translate(-50%,-50%)", width: 38, height: 32, border: `3px solid ${spawn.color}`, background: theme.base, color: spawn.color, display: "grid", placeItems: "center", fontFamily: mono, fontSize: 12 }}>HQ</div>)}
          </div> : <div data-share-map-fallback style={{ display: "flex", justifyContent: "center", gap: 30, width: "100%" }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const sector = nodes.find((node) => node.n === n);
              const color = sector?.color ?? SHARE_NEUTRAL_COLOR;
              return <div key={n} style={{ width: 130, textAlign: "center" }}><div style={{ width: 104, height: 104, margin: "0 auto", border: `6px solid ${color}`, borderRadius: "50%", color, background: `${color}22`, boxShadow: `0 0 24px ${color}55`, display: "grid", placeItems: "center", fontFamily: mono, fontSize: 34 }}>{n}</div><p style={{ fontFamily: mono, fontSize: 16, marginTop: 14 }}>{sector?.name ?? ["ALPHA", "BETA", "GAMMA", "DELTA", "EPSILON"][n - 1]}</p></div>;
            })}
          </div>}
          {[0, 1, 2, 3].map((i) => <div key={i} style={{ position: "absolute", width: 24, height: 24, top: i < 2 ? 7 : undefined, bottom: i >= 2 ? 7 : undefined, left: i % 2 === 0 ? 7 : undefined, right: i % 2 ? 7 : undefined, borderTop: i < 2 ? `3px solid ${theme.gold}` : undefined, borderBottom: i >= 2 ? `3px solid ${theme.gold}` : undefined, borderLeft: i % 2 === 0 ? `3px solid ${theme.gold}` : undefined, borderRight: i % 2 ? `3px solid ${theme.gold}` : undefined }} />)}
        </div>
        <div style={{ height: 44, display: "flex", justifyContent: "center", alignItems: "center", gap: 36 }}>
          {teams.map((t) => <span key={t.key} style={{ fontSize: fitSize(t.name, 19, 12, 20), color: t.color, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 10 }}><span style={{ width: 12, height: 12, background: t.color }} />{t.name} {nodes.filter((n) => n.team === t.key).length}</span>)}
        </div>
      </section>

      {podium.length > 0 && <section data-share-block="podium" style={{ height: 290, flexShrink: 0 }}>
        <p style={{ fontFamily: mono, fontSize: fitSize(winner?.name ?? "", 18, 12, 20), color: theme.gold, textAlign: "center", textTransform: "uppercase" }}>{winner ? (en ? `${winner.name} TOP OPERATORS` : `NAJBOLJŠI · EKIPA ${winner.name}`) : (en ? "TOP OPERATORS" : "NAJBOLJŠI")}</p>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 24, height: 258 }}>
          {podiumOrder.map(({ player: p, rank }) => <div key={rank} style={{ width: 290, height: rank === 1 ? 248 : 220, textAlign: "center", position: "relative", paddingTop: rank === 1 ? 26 : 14 }}>
            {rank === 1 && <div style={{ position: "absolute", left: "50%", top: -6, transform: "translateX(-50%)" }}><Crown /></div>}
            <div style={{ width: rank === 1 ? 88 : 72, height: rank === 1 ? 88 : 72, border: `4px solid ${theme.medals[rank - 1]}`, borderRadius: "50%", margin: "0 auto", color: theme.medals[rank - 1], background: `${theme.medals[rank - 1]}18`, boxShadow: `0 0 24px ${theme.medals[rank - 1]}44`, fontFamily: mono, fontSize: 28, display: "grid", placeItems: "center" }}>{rank}</div>
            <p className="share-callsign" style={{ fontSize: fitSize(p.callsign, 22, 12, 15), marginTop: 12 }}>{p.callsign}</p>
            <p style={{ fontFamily: mono, fontSize: 36, color: p.color, marginTop: 8 }}>{p.pts}{rank === 1 && <span style={{ fontSize: 12, color: theme.gold, marginLeft: 12 }}>MVP</span>}</p>
            <p style={{ fontSize: 15, color: theme.muted, marginTop: 3 }}>{en ? "CAPTURES" : "ZAVZETJA"}</p>
            {data.showDeaths && <p style={{ fontSize: 17, color: theme.death, marginTop: 4 }}>☠ {p.deaths ?? 0}</p>}
          </div>)}
        </div>
      </section>}

      {data.me && <section data-share-block="personal" style={{ minHeight: 96, flexShrink: 0, padding: "15px 22px", borderLeft: `6px solid ${data.me.color}`, borderTop: `1px solid ${data.me.color}55`, borderBottom: `1px solid ${data.me.color}55`, background: `${data.me.color}10` }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}><p className="share-callsign" style={{ fontSize: fitSize(data.me.callsign, 24, 12, 28), flex: 1 }}>{data.me.callsign}</p><span style={{ color: data.me.color, fontSize: fitSize(data.me.teamName, 20, 12, 20), textTransform: "uppercase", maxWidth: 320, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{data.me.teamName}</span>{players && data.me.isMvp && <span style={{ border: `1px solid ${theme.gold}`, padding: "3px 10px", color: theme.gold, fontSize: 16 }}>MVP</span>}</div>
        {players && <div style={{ display: "flex", gap: 30, alignItems: "center", fontSize: 20, marginTop: 10 }}><span style={{ color: data.me.color }}>{en ? "CAPTURES" : "ZAVZETJA"}: {data.me.pts}</span>{data.showDeaths && <span style={{ color: theme.death }}>☠ {data.me.deaths}</span>}<span style={{ marginLeft: "auto", color: theme.muted }}>#{data.me.rankInTeam} {en ? "IN TEAM" : "V EKIPI"}</span></div>}
      </section>}

      <footer data-share-block="brand" style={{ marginTop: "auto", textAlign: "center", height: 62, flexShrink: 0 }}>
        <p style={{ fontFamily: mono, color: theme.gold, fontSize: 24, letterSpacing: "0.12em" }}>SPARTANOPSAPP.COM</p>
        <p style={{ color: theme.muted, fontSize: 17, marginTop: 10 }}>{en ? "RUN YOUR OWN AIRSOFT MISSION" : "VODI SVOJO AIRSOFT MISIJO"}</p>
      </footer>
    </div>
  </div>;
}
