import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarX, Search, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { COUNTRIES, flagFor } from "@/lib/countries";
import { EVENT_KINDS, bucketLabel, weekBucket, type Lang } from "@/lib/events";
import { eventsList, type EventListItem } from "@/lib/events.functions";
import { useIsMarshal } from "@/lib/use-signed-in";
import { supabase } from "@/integrations/supabase/client";
import { eventsMyRsvps } from "@/lib/event-rsvps.functions";
import {
  ACCENT, BG, ERR, EventCard, EventStyles, INK, MICHROMA, MUTED, PANEL, SkeletonCard, btnOutline, chipStyle,
} from "@/components/events/ui";

type Search = { field?: string; lang?: string };

const TEXT = {
  sl: { title: "Airsoft dogodki — SpartanOps", desc: "Vsi airsoft dogodki na enem mestu. Najdi naslednjo igro, preveri, kdo pride, in se dogovori za prevoz." },
  en: { title: "Airsoft events — SpartanOps", desc: "Every airsoft event in one place. Find your next game, see who is going and arrange a ride." },
};

export const Route = createFileRoute("/events/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s.field === "string" ? { field: s.field } : {}),
    ...(s.lang === "en" || s.lang === "sl" ? { lang: s.lang } : {}),
  }),
  loaderDeps: ({ search }) => ({ field: search.field ?? "", lang: search.lang ?? "sl" }),
  loader: async ({ deps }) => ({
    initial: await eventsList({ data: { accountId: deps.field } }).catch(() => null),
    lang: deps.lang,
  }),
  head: ({ loaderData }) => {
    const t = TEXT[loaderData?.lang === "en" ? "en" : "sl"];
    return {
      meta: [
        { title: t.title },
        { name: "description", content: t.desc },
        { property: "og:title", content: t.title },
        { property: "og:description", content: t.desc },
        { property: "og:url", content: "https://spartanopsapp.com/events" },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: "https://spartanopsapp.com/events" }],
    };
  },
  component: EventsPage,
});

type ListResult = { events: EventListItem[]; total: number; countries: string[]; fieldName: string | null };

function EventsPage() {
  const { lang: uiLang } = useLang();
  const lang: Lang = uiLang === "en" ? "en" : "sl";
  const en = lang === "en";
  const { initial } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const list = useServerFn(eventsList);
  const isMarshal = useIsMarshal();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [kind, setKind] = useState("");
  const [country, setCountry] = useState("");
  const [weekend, setWeekend] = useState(false);
  const [past, setPast] = useState(false);
  const field = search.field ?? "";

  const [data, setData] = useState<ListResult | null>(initial as ListResult | null);
  const [items, setItems] = useState<EventListItem[]>((initial as ListResult | null)?.events ?? []);
  const [countries, setCountries] = useState<string[]>((initial as ListResult | null)?.countries ?? []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const myFn = useServerFn(eventsMyRsvps);
  const [mine, setMine] = useState<Record<string, "going" | "maybe">>({});
  useEffect(() => {
    void (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      try {
        const r = await myFn({ data: { accessToken: s.session.access_token } });
        setMine(Object.fromEntries([...r.upcoming, ...r.past].map((a) => [a.event_id, a.status])));
      } catch { /* signed in without answers or expired session */ }
    })();
  }, [myFn]);
  const first = useRef(true);

  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q.trim()), 250); return () => clearTimeout(t); }, [q]);

  const filters = useMemo(() => ({ q: debouncedQ, kind, country, weekend, past, accountId: field }), [debouncedQ, kind, country, weekend, past, field]);

  const load = async () => {
    setLoading(true); setError(false);
    try {
      const r = (await list({ data: { ...filters, offset: 0, limit: 12 } })) as ListResult;
      setData(r); setItems(r.events);
      if (!filters.past) setCountries(r.countries);
    } catch { setError(true); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (first.current && initial && !debouncedQ && !kind && !country && !weekend && !past) { first.current = false; return; }
    first.current = false;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const r = (await list({ data: { ...filters, offset: items.length, limit: 12 } })) as ListResult;
      setItems((s) => [...s, ...r.events]);
    } finally { setLoadingMore(false); }
  };

  const active = !!(debouncedQ || kind || country || weekend || field);
  const clearAll = () => { setQ(""); setKind(""); setCountry(""); setWeekend(false); if (field) navigate({ search: {} }); };

  const groups = useMemo(() => {
    if (past) return [{ key: "past", items }];
    const map = new Map<string, EventListItem[]>();
    for (const e of items) { const b = weekBucket(e.starts_at); map.set(b, [...(map.get(b) ?? []), e]); }
    return [...map.entries()].map(([key, items]) => ({ key, items }));
  }, [items, past]);

  const feedQuery = new URLSearchParams({ ...(country ? { country } : {}), ...(field ? { field } : {}) }).toString();
  const feedUrl = `webcal://spartanopsapp.com/events.ics${feedQuery ? `?${feedQuery}` : ""}`;
  const postTarget = isMarshal ? "/events/manage" : "/marshal-account";
  const countryName = (c: string) => COUNTRIES.find((x) => x.code === c)?.name ?? c;

  return (
    <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "96px 16px 56px" }}>
      <EventStyles />
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* Hero strip */}
        <section style={{ padding: "8px 0 18px" }}>
          <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.3em", color: ACCENT, marginBottom: 8 }}>AIRSOFT · SLOVENIJA</p>
          <h1 style={{ fontFamily: MICHROMA, fontSize: "clamp(26px, 6vw, 36px)", letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>{en ? "Events" : "Dogodki"}</h1>
          <p style={{ fontFamily: "monospace", fontSize: 13, color: MUTED, margin: "8px 0 16px", lineHeight: 1.6 }}>
            {en ? "Games at every field, in one calendar." : "Igre vseh poligonov v enem koledarju."}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Link to={postTarget} search={isMarshal ? { edit: "new" } : undefined} className="ev-focus" style={btnOutline}>
              {en ? "Post an event" : "Objavi dogodek"}
            </Link>
            <a href={feedUrl} className="ev-focus" style={{ color: ACCENT, fontFamily: "monospace", fontSize: 12 }}>
              {en ? "Subscribe in your calendar" : "Naroči se v koledar"}
            </a>
          </div>
        </section>

        {/* Filter bar */}
        <div style={{ position: "sticky", top: 64, zIndex: 20, background: BG, padding: "10px 0", borderBottom: `1px solid ${ACCENT}22`, marginBottom: 16 }}>
          <label style={{ position: "relative", display: "block" }}>
            <span className="sr-only">{en ? "Search" : "Iskanje"}</span>
            <Search size={16} aria-hidden style={{ position: "absolute", left: 12, top: 13, color: MUTED }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={en ? "Search events or fields…" : "Išči dogodke ali poligone…"}
              className="ev-focus" style={{ width: "100%", boxSizing: "border-box", background: PANEL, color: INK, border: `1px solid ${ACCENT}44`, padding: "11px 12px 11px 36px", fontFamily: "monospace", fontSize: 16 }} />
          </label>
          <div className="ev-chips" style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 10, paddingBottom: 2 }}>
            {field && (
              <button type="button" className="ev-focus" style={chipStyle(true)} onClick={() => navigate({ search: {} })} aria-label={en ? "Remove field filter" : "Odstrani filter poligona"}>
                {data?.fieldName ?? (en ? "This field" : "Ta poligon")} <X size={13} />
              </button>
            )}
            <button type="button" className="ev-focus" aria-pressed={weekend} style={chipStyle(weekend)} onClick={() => setWeekend((v) => !v)}>
              {en ? "This weekend" : "Ta vikend"}
            </button>
            {EVENT_KINDS.map((k) => (
              <button key={k.id} type="button" className="ev-focus" aria-pressed={kind === k.id} style={chipStyle(kind === k.id)} onClick={() => setKind(kind === k.id ? "" : k.id)}>
                <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: k.color }} />{en ? k.en : k.sl}
              </button>
            ))}
            {countries.length > 1 && (
              <select value={country} onChange={(e) => setCountry(e.target.value)} className="ev-focus" aria-label={en ? "Country" : "Država"}
                style={{ ...chipStyle(!!country), appearance: "auto" }}>
                <option value="">{en ? "All countries" : "Vse države"}</option>
                {countries.map((c) => <option key={c} value={c}>{flagFor(c)} {countryName(c)}</option>)}
              </select>
            )}
          </div>
          {active && (
            <button type="button" className="ev-focus" onClick={clearAll} style={{ background: "none", border: "none", color: ACCENT, fontFamily: "monospace", fontSize: 12, textDecoration: "underline", cursor: "pointer", padding: "8px 0 0" }}>
              {en ? "Clear filters" : "Počisti filtre"}
            </button>
          )}
        </div>

        {past && <h2 style={{ fontFamily: MICHROMA, fontSize: 13, letterSpacing: "0.16em", color: ACCENT, marginBottom: 12 }}>{en ? "PAST EVENTS" : "PRETEKLI DOGODKI"}</h2>}

        {/* List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12 }}>{[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
        ) : error ? (
          <div style={{ background: PANEL, border: `1px solid ${ERR}66`, padding: 20, textAlign: "center" }}>
            <p style={{ fontFamily: "monospace", fontSize: 13, marginBottom: 12 }}>{en ? "Could not load events." : "Dogodkov ni bilo mogoče naložiti."}</p>
            <button type="button" className="ev-focus" style={btnOutline} onClick={() => void load()}>{en ? "Try again" : "Poskusi znova"}</button>
          </div>
        ) : items.length === 0 ? (
          <div style={{ background: PANEL, border: `1px solid ${ACCENT}33`, padding: "32px 20px", textAlign: "center" }}>
            <CalendarX size={36} color={ACCENT} style={{ margin: "0 auto 14px" }} aria-hidden />
            <p style={{ fontFamily: MICHROMA, fontSize: 13, letterSpacing: "0.1em", marginBottom: 10 }}>{en ? "No events here yet." : "Tu še ni dogodkov."}</p>
            {!active && !past && (
              <p style={{ fontFamily: "monospace", fontSize: 12.5, color: MUTED, lineHeight: 1.7, marginBottom: 16 }}>
                {en ? "One calendar for every airsoft field." : "En koledar za vse airsoft poligone."}<br />
                {en ? "Fields post their games here for free." : "Poligoni tu brezplačno objavijo svoje igre."}
              </p>
            )}
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
              {active && <button type="button" className="ev-focus" style={btnOutline} onClick={clearAll}>{en ? "Clear filters" : "Počisti filtre"}</button>}
              <Link to={postTarget} search={isMarshal ? { edit: "new" } : undefined} className="ev-focus" style={{ color: ACCENT, fontFamily: "monospace", fontSize: 12.5, alignSelf: "center" }}>
                {en ? "Run a field? Post the first event →" : "Vodiš poligon? Objavi prvi dogodek →"}
              </Link>
            </div>
          </div>
        ) : (
          <>
            {groups.map((g) => (
              <section key={g.key} style={{ marginBottom: 22 }}>
                {g.key !== "past" && (
                  <h2 style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.22em", color: MUTED, textTransform: "uppercase", marginBottom: 10 }}>{bucketLabel(g.key, lang)}</h2>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12 }}>
                  {g.items.map((e) => <EventCard key={e.id} e={e} lang={lang} myStatus={mine[e.id] ?? null} />)}
                </div>
              </section>
            ))}
            {data && items.length < data.total && (
              <div style={{ textAlign: "center", margin: "8px 0 20px" }}>
                <button type="button" className="ev-focus" style={btnOutline} disabled={loadingMore} onClick={() => void loadMore()}>
                  {loadingMore ? "…" : en ? "Load more" : "Naloži več"}
                </button>
              </div>
            )}
          </>
        )}

        <div style={{ textAlign: "center", marginTop: 24, display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
          <button type="button" className="ev-focus" onClick={() => setPast((v) => !v)} style={{ background: "none", border: "none", color: ACCENT, fontFamily: "monospace", fontSize: 12.5, textDecoration: "underline", cursor: "pointer", minHeight: 36 }}>
            {past ? (en ? "Upcoming events" : "Prihajajoči dogodki") : (en ? "Past events" : "Pretekli dogodki")}
          </button>
          <Link to="/marshal-account" className="ev-focus" style={{ color: MUTED, fontFamily: "monospace", fontSize: 12 }}>
            {en ? "Your field is not listed? Add it free →" : "Tvojega poligona ni na seznamu? Dodaj ga brezplačno →"}
          </Link>
        </div>
      </div>
    </main>
  );
}
