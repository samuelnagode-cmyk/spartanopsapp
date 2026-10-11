import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { playerGamesForget, playerGamesMine, playerGetMine } from "@/lib/player.functions";
import { safeNext } from "@/lib/player-validation";
import { PlayerAuth } from "@/components/PlayerAuth";
import { MyEvents } from "@/components/events/MyEvents";
import { PlayerProfileForm, ProfilePreview, type PlayerProfile } from "@/components/PlayerProfileForm";

export const Route = createFileRoute("/me")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => (typeof s.next === "string" ? { next: s.next } : {}),
  head: () => ({
    meta: [
      { title: "Player profile — SpartanOps" },
      { name: "description", content: "Your SpartanOps player profile: callsign, loadout and privacy tools for airsoft events." },
      { property: "og:title", content: "Player profile — SpartanOps" },
      { property: "og:description", content: "Your SpartanOps player profile: callsign, loadout and privacy tools for airsoft events." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MePage,
});

const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const OK = "#9eff3d";

type Mine = { profile: PlayerProfile | null; needsReconsent: boolean; isMarshal: boolean };

function MePage() {
  const { lang } = useLang();
  const en = lang === "en";
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const getMine = useServerFn(playerGetMine);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [mine, setMine] = useState<Mine | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setSignedIn(false); setMine(null); return; }
    setSignedIn(true);
    try {
      const r = await getMine({ data: { accessToken: data.session.access_token } });
      setMine({ profile: r.profile as PlayerProfile | null, needsReconsent: r.needsReconsent, isMarshal: r.isMarshal });
    } catch { setSignedIn(false); }
  }, [getMine]);

  useEffect(() => {
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void load();
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const title = en ? "Player profile" : "Igralski profil";

  return (
    <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "110px 16px 48px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Michroma', monospace", fontSize: 16, letterSpacing: "0.18em", textAlign: "center", textTransform: "uppercase", marginBottom: 20 }}>{title}</h1>
        {notice && <p role="status" style={{ color: OK, fontFamily: "monospace", fontSize: 13, textAlign: "center", marginBottom: 16 }}>{notice}</p>}
        {signedIn === null || (signedIn && !mine) ? (
          <p style={{ textAlign: "center", fontFamily: "monospace", opacity: 0.7 }}>…</p>
        ) : !signedIn ? (
          <div style={{ background: PANEL, border: `1px solid ${ACCENT}44`, padding: "24px 20px" }}>
            <p style={{ fontFamily: "monospace", fontSize: 13.5, lineHeight: 1.7, marginBottom: 20, textAlign: "center" }}>
              {en ? "Join events, see who is going, share a ride. You do not need an account to play a game." : "Prijavi se na dogodke, poglej, kdo pride, in deli prevoz. Za igranje igre računa ne potrebuješ."}
            </p>
            <PlayerAuth next={next} onDone={() => { const n = safeNext(next); if (n) navigate({ to: n as never }); }} />
            <p style={{ textAlign: "center", marginTop: 18, fontFamily: "monospace", fontSize: 12 }}>
              <Link to="/privacy" style={{ color: ACCENT }}>{en ? "Privacy" : "Zasebnost"}</Link>{"  ·  "}
              <Link to="/terms" style={{ color: ACCENT }}>{en ? "Terms" : "Pogoji"}</Link>
            </p>
          </div>
        ) : mine && (
          <>
            {mine.isMarshal && (
              <p style={{ fontFamily: "monospace", fontSize: 12.5, textAlign: "center", marginBottom: 14 }}>
                {en ? "You also run a field: " : "Vodiš tudi poligon: "}
                <Link to="/marshal-account" style={{ color: ACCENT }}>{en ? "Field settings →" : "Nastavitve poligona →"}</Link>
              </p>
            )}
            {mine.profile && <MyEvents lang={en ? "en" : "sl"} />}
            {mine.profile && !mine.needsReconsent && <ProfilePreview p={mine.profile} en={en} />}
            {mine.needsReconsent && (
              <p style={{ fontFamily: "monospace", fontSize: 12.5, color: ACCENT, textAlign: "center", marginBottom: 14 }}>
                {en ? "Our Privacy notice changed. Please confirm it below to keep your profile." : "Obvestilo o zasebnosti se je spremenilo. Za ohranitev profila ga spodaj potrdi."}
              </p>
            )}
            <PlayerProfileForm
              key={mine.profile ? "edit" : "new"}
              en={en}
              initial={mine.profile}
              needsConsent={!mine.profile || mine.needsReconsent}
              onSaved={(p) => { setMine({ ...mine, profile: p, needsReconsent: false }); const n = safeNext(next); if (n) navigate({ to: n as never }); }}
              onDeleted={(kept) => {
                setNotice(kept
                  ? (en ? "Your profile was deleted. Your field login was kept." : "Tvoj profil je izbrisan. Prijava za poligon je ohranjena.")
                  : (en ? "Your profile and login were deleted." : "Tvoj profil in prijava sta izbrisana."));
                void load();
              }}
            />
            {mine.profile && !mine.needsReconsent && <MyGames en={en} />}
          </>
        )}
      </div>
    </main>
  );
}

type GameRow = { mission_name: string | null; field_name: string | null; ended_at: string; team: string; team_won: boolean; captures: number; deaths: number; is_mvp: boolean };
type Games = { totals: { games: number; wins: number; captures: number; deaths: number; mvps: number }; games: GameRow[] };

function MyGames({ en }: { en: boolean }) {
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
  const h = <h2 style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>{en ? "My games" : "Moje igre"}</h2>;
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
