import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { eventsMyRsvps, type MyEventAnswer } from "@/lib/event-rsvps.functions";
import { shortDate, type Lang } from "@/lib/events";
import { ACCENT, ERR, INK, MICHROMA, MUTED, PANEL } from "./ui";

const LIMIT = 5;

function Row({ a, lang }: { a: MyEventAnswer; lang: Lang }) {
  const en = lang === "en";
  const cancelled = a.event_status === "cancelled";
  return (
    <li style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderTop: `1px solid ${ACCENT}1f` }}>
      <div style={{ minWidth: 0, flex: 1, fontFamily: "monospace", fontSize: 12.5 }}>
        <div style={{ color: INK, fontWeight: 700, wordBreak: "break-word", textDecoration: cancelled ? "line-through" : "none" }}>{a.title}</div>
        <div style={{ color: MUTED }}>{shortDate(a.starts_at, a.tz, lang)} · {a.field}</div>
        <div style={{ marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ color: ACCENT }}>{a.status === "going" ? (en ? "Going" : "Pridem") : (en ? "Maybe" : "Morda")}</span>
          {cancelled && <span style={{ background: ERR, color: "#0b0d09", padding: "0 6px", fontSize: 11 }}>{en ? "CANCELLED" : "ODPOVEDAN"}</span>}
        </div>
      </div>
      <Link to="/events/$eventId" params={{ eventId: a.event_id }} className="ev-focus" style={{ color: ACCENT, fontFamily: "monospace", fontSize: 12.5, minHeight: 44, display: "inline-flex", alignItems: "center" }}>{en ? "Change" : "Spremeni"}</Link>
    </li>
  );
}

const moreBtn = { width: "100%", marginTop: 10, minHeight: 44, background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}`, fontFamily: MICHROMA, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer" } as const;

function List({ items, lang }: { items: MyEventAnswer[]; lang: Lang }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, LIMIT);
  return (
    <>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>{shown.map((a) => <Row key={a.event_id} a={a} lang={lang} />)}</ul>
      {!all && items.length > LIMIT && <button type="button" className="ev-focus" style={moreBtn} onClick={() => setAll(true)}>{lang === "en" ? "Show all" : "Pokaži vse"} ({items.length})</button>}
    </>
  );
}

export function MyEvents({ lang }: { lang: Lang }) {
  const en = lang === "en";
  const fn = useServerFn(eventsMyRsvps);
  const [d, setD] = useState<{ upcoming: MyEventAnswer[]; past: MyEventAnswer[]; gamesAttended: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [showPast, setShowPast] = useState(false);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      try { setD(await fn({ data: { accessToken: data.session.access_token } })); } catch { setFailed(true); }
    })();
  }, [fn]);
  const box = { background: PANEL, border: `1px solid ${ACCENT}44`, padding: "14px 16px", marginBottom: 18 } as const;
  const h = <h2 style={{ fontFamily: MICHROMA, fontSize: 11, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", marginBottom: 6 }}>{en ? "Events I'm going to" : "Dogodki, na katere grem"}</h2>;
  if (failed) return <section style={box}>{h}<p style={{ fontFamily: "monospace", fontSize: 12.5, color: MUTED }}>{en ? "Could not load your events." : "Dogodkov ni bilo mogoče naložiti."}</p></section>;
  if (!d) return <section style={box} aria-busy="true">{h}{[0, 1].map((i) => <div key={i} style={{ height: 18, background: `${ACCENT}14`, marginBottom: 8 }} />)}</section>;
  return (
    <section style={box}>
      {h}
      <p style={{ fontFamily: "monospace", fontSize: 12, color: MUTED, marginBottom: 6 }}>{en ? "Games attended" : "Obiskane igre"}: {d.gamesAttended}</p>
      {d.upcoming.length === 0 ? (
        <div>
          <p style={{ fontFamily: "monospace", fontSize: 12.5, color: MUTED, marginBottom: 10 }}>{en ? "You are not going to any event yet. Find one on the events page." : "Še ne greš na noben dogodek. Poišči enega na strani Dogodki."}</p>
          <Link to="/events" className="ev-focus" style={{ ...moreBtn, marginTop: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>{en ? "Events" : "Dogodki"}</Link>
        </div>
      ) : <List items={d.upcoming} lang={lang} />}
      {d.past.length > 0 && (
        <>
          <button type="button" className="ev-focus" aria-expanded={showPast} onClick={() => setShowPast((v) => !v)}
            style={{ minHeight: 44, background: "none", border: "none", color: ACCENT, fontFamily: MICHROMA, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0, marginTop: 6 }}>
            {en ? "Past events" : "Pretekli dogodki"} ({d.past.length}) <ChevronDown size={14} style={{ transform: showPast ? "rotate(180deg)" : "none" }} />
          </button>
          {showPast && <List items={d.past} lang={lang} />}
        </>
      )}
    </section>
  );
}
