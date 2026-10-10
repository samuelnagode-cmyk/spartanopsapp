import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { eventsMyRsvps, type MyEventAnswer } from "@/lib/event-rsvps.functions";
import { shortDate, type Lang } from "@/lib/events";
import { ACCENT, ERR, INK, MICHROMA, MUTED, PANEL } from "./ui";

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

export function MyEvents({ lang }: { lang: Lang }) {
  const en = lang === "en";
  const fn = useServerFn(eventsMyRsvps);
  const [d, setD] = useState<{ upcoming: MyEventAnswer[]; past: MyEventAnswer[]; gamesAttended: number } | null>(null);
  const [showPast, setShowPast] = useState(false);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      try { setD(await fn({ data: { accessToken: data.session.access_token } })); } catch { /* ignore */ }
    })();
  }, [fn]);
  if (!d) return null;
  return (
    <section style={{ background: PANEL, border: `1px solid ${ACCENT}44`, padding: "14px 16px", marginBottom: 18 }}>
      <h2 style={{ fontFamily: MICHROMA, fontSize: 11, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", marginBottom: 6 }}>{en ? "My events" : "Moji dogodki"}</h2>
      <p style={{ fontFamily: "monospace", fontSize: 12, color: MUTED, marginBottom: 6 }}>{en ? "Games attended" : "Obiskane igre"}: {d.gamesAttended}</p>
      {d.upcoming.length === 0 ? (
        <p style={{ fontFamily: "monospace", fontSize: 12.5, color: MUTED }}>{en ? "No upcoming events. " : "Ni prihajajočih dogodkov. "}<Link to="/events" style={{ color: ACCENT }}>{en ? "Find one" : "Poišči dogodek"}</Link></p>
      ) : <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>{d.upcoming.map((a) => <Row key={a.event_id} a={a} lang={lang} />)}</ul>}
      {d.past.length > 0 && (
        <>
          <button type="button" className="ev-focus" aria-expanded={showPast} onClick={() => setShowPast((v) => !v)}
            style={{ minHeight: 44, background: "none", border: "none", color: ACCENT, fontFamily: MICHROMA, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0, marginTop: 6 }}>
            {en ? "Past" : "Pretekli"} ({d.past.length}) <ChevronDown size={14} style={{ transform: showPast ? "rotate(180deg)" : "none" }} />
          </button>
          {showPast && <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>{d.past.map((a) => <Row key={a.event_id} a={a} lang={lang} />)}</ul>}
        </>
      )}
    </section>
  );
}
