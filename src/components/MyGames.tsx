import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { playerGamesForget, playerGamesMine } from "@/lib/player.functions";

const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const OK = "#9eff3d";

type GameRow = { mission_name: string | null; field_name: string | null; ended_at: string; team: string; team_won: boolean; captures: number; deaths: number; is_mvp: boolean };
type Games = { totals: { games: number; wins: number; captures: number; deaths: number; mvps: number }; games: GameRow[] };

export function MyGames({ en }: { en: boolean }) {
  const getGames = useServerFn(playerGamesMine);
  const forget = useServerFn(playerGamesForget);
  const [g, setG] = useState<Games | null>(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const tok = async () => (await supabase.auth.getSession()).data.session?.access_token ?? "";
  const load = useCallback(async (limit: number) => {
    try { setG((await getGames({ data: { accessToken: await tok(), limit } })) as Games); setFailed(false); }
    catch { setFailed(true); }
  }, [getGames]);
  useEffect(() => { void load(50); }, [load]);

  const box = { background: PANEL, border: `1px solid ${ACCENT}44`, padding: "20px 18px", marginTop: 14 } as const;
  const h = <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>{en ? "Missions played" : "Odigrane misije"}</h2>;
  if (failed) return <section style={box}>{h}<p style={{ fontFamily: "monospace", fontSize: 12.5 }}>{en ? "Could not load your games." : "Iger ni bilo mogoče naložiti."}</p></section>;
  if (!g) return <section style={box} aria-busy="true">{h}{[0, 1, 2].map((i) => <div key={i} style={{ height: 18, background: `${ACCENT}14`, marginBottom: 8 }} />)}</section>;
  if (!g.totals.games) return <section style={box}>{h}<p style={{ fontFamily: "monospace", fontSize: 12.5, lineHeight: 1.6, opacity: 0.8 }}>{en ? "No games yet. Join a mission while signed in and it will appear here." : "Še ni iger. Pridruži se misiji, ko si prijavljen, in se bo prikazala tukaj."}</p></section>;

  const t = g.totals;
  const stats: [string, number][] = [[en ? "Games" : "Igre", t.games], [en ? "Wins" : "Zmage", t.wins], [en ? "Caps" : "Zavz.", t.captures], [en ? "Deaths" : "Smrti", t.deaths], ["MVP", t.mvps]];
  const rows = all ? g.games : g.games.slice(0, 10);
  const fmt = new Intl.DateTimeFormat(en ? "en-GB" : "sl-SI", { day: "numeric", month: "numeric", year: "2-digit" });
  return (
    <section style={box}>
      {h}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 14, textAlign: "center" }}>
        {stats.map(([l, v]) => <div key={l}><div style={{ fontFamily: "'Michroma', monospace", fontSize: 16, color: ACCENT }}>{v}</div><div style={{ fontFamily: "monospace", fontSize: 10, opacity: 0.7, textTransform: "uppercase" }}>{l}</div></div>)}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {rows.map((r, i) => (
          <li key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 8, alignItems: "center", fontFamily: "monospace", fontSize: 12, padding: "7px 0", borderTop: `1px solid ${ACCENT}22` }}>
            <span style={{ opacity: 0.7 }}>{fmt.format(new Date(r.ended_at))}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{r.mission_name || r.field_name} · {r.team}</span>
            <span style={{ color: r.team_won ? OK : "#d97a6c" }}>{r.team_won ? (en ? "W" : "Z") : (en ? "L" : "P")}</span>
            <span style={{ whiteSpace: "nowrap" }}>{r.captures}/{r.deaths}{r.is_mvp ? " ★" : ""}</span>
          </li>
        ))}
      </ul>
      {!all && t.games > 10 && (
        <button type="button" onClick={() => { setAll(true); if (g.games.length < t.games) void load(200); }}
          style={{ width: "100%", marginTop: 12, padding: 10, background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}`, fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer" }}>
          {en ? "Show all" : "Pokaži vse"}
        </button>
      )}
      <p style={{ textAlign: "center", marginTop: 14 }}>
        <button type="button" onClick={() => setConfirm(true)} style={{ background: "none", border: "none", color: INK, opacity: 0.6, textDecoration: "underline", fontFamily: "monospace", fontSize: 11.5, cursor: "pointer" }}>
          {en ? "Delete my game history" : "Izbriši mojo zgodovino iger"}
        </button>
      </p>
      {confirm && (
        <div role="dialog" aria-modal="true" onClick={() => setConfirm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...box, marginTop: 0, maxWidth: 420, width: "100%" }}>
            <p style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
              {en ? "Remove all games from your profile? The anonymous results stay with the field, without your name. This cannot be undone." : "Odstranim vse igre iz tvojega profila? Anonimni rezultati ostanejo pri poligonu, brez tvojega imena. Tega ni mogoče razveljaviti."}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setConfirm(false)} style={{ flex: 1, padding: 12, background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}`, cursor: "pointer", fontFamily: "monospace" }}>{en ? "Cancel" : "Prekliči"}</button>
              <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await forget({ data: { accessToken: await tok() } }); setConfirm(false); await load(50); } finally { setBusy(false); } }}
                style={{ flex: 1, padding: 12, background: "#d97a6c", color: BG, border: "none", cursor: "pointer", fontFamily: "monospace", opacity: busy ? 0.5 : 1 }}>{en ? "Delete" : "Izbriši"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
