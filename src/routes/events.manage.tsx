import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Check, MoreVertical, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { SITE, eventEndMs, type Lang } from "@/lib/events";
import {
  eventsCancel, eventsDelete, eventsMine, eventsReopen, eventsSave, type EventField, type EventFull, type EventInput,
} from "@/lib/events.functions";
import { EventForm, SERVER_ERRORS, initialForm } from "@/components/events/EventForm";
import {
  ACCENT, BG, DateTile, ERR, EventStyles, INK, MICHROMA, MUTED, OK, PANEL, ShareButton, btnOutline, btnPrimary,
} from "@/components/events/ui";

type Search = { edit?: string; from?: string };

export const Route = createFileRoute("/events/manage")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s.edit === "string" ? { edit: s.edit } : {}),
    ...(typeof s.from === "string" ? { from: s.from } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Manage events — SpartanOps" },
      { name: "description", content: "Publish and manage your airsoft field's events in the SpartanOps calendar." },
      { property: "og:title", content: "Manage events — SpartanOps" },
      { property: "og:description", content: "Publish and manage your airsoft field's events in the SpartanOps calendar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ManagePage,
});

type Mine = { events: EventFull[]; fieldReady: boolean; missing: string[]; field: EventField; listedPublicly: boolean };

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function ManagePage() {
  const { lang: uiLang } = useLang();
  const lang: Lang = uiLang === "en" ? "en" : "sl";
  const en = lang === "en";
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const mineFn = useServerFn(eventsMine);
  const saveFn = useServerFn(eventsSave);

  const [state, setState] = useState<"loading" | "signedout" | "nofield" | "ready" | "error">("loading");
  const [mine, setMine] = useState<Mine | null>(null);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ ids: string[] } | null>(null);

  const load = useCallback(async () => {
    const t = await token();
    if (!t) { setState("signedout"); return; }
    try {
      setMine((await mineFn({ data: { accessToken: t } })) as Mine);
      setState("ready");
    } catch (e) {
      const m = String((e as Error)?.message ?? "");
      setState(m.includes("account_required") ? "nofield" : m.includes("login_required") ? "signedout" : "error");
    }
  }, [mineFn]);

  useEffect(() => {
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") void load();
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const wrap = (children: React.ReactNode, width = 760) => (
    <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "96px 16px 48px" }}>
      <EventStyles />
      <div style={{ maxWidth: width, margin: "0 auto" }}>{children}</div>
    </main>
  );
  const notice = (title: string, body: string, to: string, cta: string) => wrap(
    <div style={{ maxWidth: 460, margin: "40px auto", background: PANEL, border: `1px solid ${ACCENT}44`, padding: 26, textAlign: "center" }}>
      <h1 style={{ fontFamily: MICHROMA, fontSize: 14, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>{title}</h1>
      <p style={{ fontFamily: "monospace", fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 18 }}>{body}</p>
      <Link to={to} className="ev-focus" style={btnPrimary}>{cta}</Link>
    </div>,
  );

  if (state === "loading") return wrap(<p style={{ textAlign: "center", fontFamily: "monospace", opacity: 0.7 }}>…</p>);
  if (state === "signedout") return notice(en ? "Marshal sign-in" : "Prijava maršala", en ? "Sign in with your field account to post events." : "Za objavo dogodkov se prijavi z računom poligona.", "/marshal-account", en ? "Sign in" : "Prijava");
  if (state === "nofield") return notice(en ? "This login has no field yet" : "Ta prijava še nima poligona", en ? "Events belong to a field. Create your field first." : "Dogodki pripadajo poligonu. Najprej ustvari poligon.", "/marshal-account", en ? "Create my field" : "Ustvari poligon");
  if (state === "error" || !mine) return notice(en ? "Something went wrong" : "Prišlo je do napake", en ? "Please reload the page." : "Ponovno naloži stran.", "/events/manage", en ? "Reload" : "Ponovno naloži");

  const editing = search.edit;
  const closeForm = () => { setServerError(null); navigate({ search: {} }); };

  if (saved) {
    const url = `${SITE}/events/${saved.ids[0]}`;
    return wrap(
      <div style={{ background: PANEL, border: `1px solid ${OK}66`, padding: "24px 20px", textAlign: "center" }}>
        <Check size={32} color={OK} style={{ margin: "0 auto 10px" }} aria-hidden />
        <h1 style={{ fontFamily: MICHROMA, fontSize: 14, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>
          {saved.ids.length > 1 ? (en ? `${saved.ids.length} events saved` : `Shranjenih dogodkov: ${saved.ids.length}`) : (en ? "Event saved" : "Dogodek shranjen")}
        </h1>
        <p style={{ fontFamily: "monospace", fontSize: 12.5, wordBreak: "break-all", color: MUTED, marginBottom: 16 }}>{url}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <CopyButton text={url} en={en} />
          <ShareButton url={url} title={en ? "Airsoft event" : "Airsoft dogodek"} text={url} lang={lang} />
          <Link to="/events/$eventId" params={{ eventId: saved.ids[0] }} className="ev-focus" style={btnPrimary}>{en ? "View event" : "Poglej dogodek"}</Link>
        </div>
        <button type="button" className="ev-focus" onClick={() => { setSaved(null); void load(); }} style={{ background: "none", border: "none", color: ACCENT, fontFamily: "monospace", fontSize: 12.5, textDecoration: "underline", marginTop: 18, cursor: "pointer" }}>
          {en ? "Back to my events" : "Nazaj na moje dogodke"}
        </button>
      </div>,
    );
  }

  if (editing) {
    const isCreate = editing === "new";
    const source = isCreate ? (search.from ? mine.events.find((e) => e.id === search.from) ?? null : null) : mine.events.find((e) => e.id === editing) ?? null;
    if (!isCreate && !source) return notice(en ? "Event not found" : "Dogodka ni", SERVER_ERRORS.not_found[en ? 0 : 1], "/events/manage", en ? "Back" : "Nazaj");
    if (isCreate && !mine.fieldReady) { navigate({ search: {} }); return null; }
    const submit = async (input: EventInput, repeatWeeks: number) => {
      const answers = (source?.going ?? 0) + (source?.maybe ?? 0);
      if (!isCreate && source && answers > 0 && Date.parse(zonedToUtc(input.date, input.startTime)) !== Date.parse(source.starts_at)) {
        const msg = en
          ? `${answers} players have answered. They are not notified automatically, please tell them the new time.`
          : `Odgovorilo je ${answers} igralcev. Samodejno niso obveščeni, zato jim sporoči novi čas.`;
        if (!window.confirm(msg)) return;
      }
      setBusy(true); setServerError(null);
      try {
        const r = await saveFn({ data: { accessToken: await token(), id: isCreate ? undefined : editing, event: input, repeatWeeks } });
        setSaved(r); navigate({ search: {} });
      } catch (e) {
        setServerError(String((e as Error)?.message ?? "save_failed"));
      } finally { setBusy(false); }
    };
    return wrap(
      <>
        <button type="button" className="ev-focus" onClick={closeForm} style={{ background: "none", border: "none", color: ACCENT, fontFamily: "monospace", fontSize: 12.5, cursor: "pointer", marginBottom: 12, padding: 0 }}>← {en ? "My events" : "Moji dogodki"}</button>
        <h1 style={{ fontFamily: MICHROMA, fontSize: 17, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
          {isCreate ? (en ? "New event" : "Nov dogodek") : (en ? "Edit event" : "Uredi dogodek")}
        </h1>
        <EventForm
          key={`${editing}-${search.from ?? ""}`}
          lang={lang} field={mine.field} listedPublicly={mine.listedPublicly}
          initial={initialForm(mine.field, source, isCreate ? (source ? "duplicate" : "new") : "edit")}
          isCreate={isCreate} busy={busy} serverError={serverError} onSubmit={submit} onCancel={closeForm}
        />
      </>,
      640,
    );
  }

  return wrap(<EventList mine={mine} lang={lang} onChange={load} onNew={() => navigate({ search: { edit: "new" } })} onEdit={(id) => navigate({ search: { edit: id } })} onDuplicate={(id) => navigate({ search: { edit: "new", from: id } })} />);
}

function CopyButton({ text, en }: { text: string; en: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="ev-focus" style={btnOutline} onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { /* ignore */ } }}>
      {done ? (en ? "Link copied" : "Povezava kopirana") : (en ? "Copy link" : "Kopiraj povezavo")}
    </button>
  );
}

function EventList({ mine, lang, onChange, onNew, onEdit, onDuplicate }: {
  mine: Mine; lang: Lang; onChange: () => void; onNew: () => void; onEdit: (id: string) => void; onDuplicate: (id: string) => void;
}) {
  const en = lang === "en";
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const now = Date.now();
  const upcoming = mine.events.filter((e) => eventEndMs(e) >= now);
  const past = mine.events.filter((e) => eventEndMs(e) < now).reverse();
  const rows = tab === "upcoming" ? upcoming : past;
  const tabBtn = (id: "upcoming" | "past", label: string, n: number) => (
    <button type="button" className="ev-focus" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
      style={{ flex: 1, minHeight: 40, background: tab === id ? `${ACCENT}22` : "transparent", color: tab === id ? ACCENT : INK, border: `1px solid ${tab === id ? ACCENT : `${ACCENT}33`}`, fontFamily: MICHROMA, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>
      {label} ({n})
    </button>
  );
  const check = (ok: boolean, text: string) => (
    <li style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "monospace", fontSize: 13, marginBottom: 6 }}>
      {ok ? <Check size={15} color={OK} /> : <X size={15} color={ERR} />}
      {ok ? text : <Link to="/marshal-account" style={{ color: ACCENT }}>{text} →</Link>}
    </li>
  );

  return (
    <>
      {!mine.fieldReady && (
        <section style={{ background: PANEL, border: `1px solid ${ACCENT}`, padding: "16px 16px", marginBottom: 16 }}>
          <p style={{ fontFamily: MICHROMA, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>{en ? "Finish your field setup" : "Dokončaj nastavitve poligona"}</p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {check(!mine.missing.includes("password"), en ? "Field password set" : "Geslo poligona nastavljeno")}
            {check(!mine.missing.includes("city"), en ? "City set" : "Mesto nastavljeno")}
            {check(!mine.missing.includes("country"), en ? "Country set" : "Država nastavljena")}
          </ul>
        </section>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.24em", color: ACCENT, marginBottom: 4 }}>{en ? "EVENTS" : "DOGODKI"}</p>
          <h1 style={{ fontFamily: MICHROMA, fontSize: 18, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0, wordBreak: "break-word" }}>{mine.field.name}</h1>
        </div>
        <div style={{ textAlign: "right" }}>
          <button type="button" className="ev-focus" style={{ ...btnPrimary, opacity: mine.fieldReady ? 1 : 0.45 }} disabled={!mine.fieldReady} onClick={onNew}>+ {en ? "New event" : "Nov dogodek"}</button>
          {!mine.fieldReady && <p style={{ fontFamily: "monospace", fontSize: 11, color: MUTED, marginTop: 6 }}>{en ? "Complete the checklist first." : "Najprej dokončaj seznam."}</p>}
        </div>
      </div>
      <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {tabBtn("upcoming", en ? "Upcoming" : "Prihajajoči", upcoming.length)}
        {tabBtn("past", en ? "Past" : "Pretekli", past.length)}
      </div>
      {rows.length === 0 ? (
        <p style={{ fontFamily: "monospace", fontSize: 13, color: MUTED, textAlign: "center", padding: "26px 0" }}>{tab === "upcoming" ? (en ? "No upcoming events." : "Ni prihajajočih dogodkov.") : (en ? "No past events." : "Ni preteklih dogodkov.")}</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((e) => <Row key={e.id} e={e} lang={lang} onChange={onChange} onEdit={onEdit} onDuplicate={onDuplicate} />)}
        </div>
      )}
      <p style={{ textAlign: "center", marginTop: 22 }}>
        <Link to="/events" className="ev-focus" style={{ color: ACCENT, fontFamily: "monospace", fontSize: 12.5 }}>{en ? "Open the public calendar →" : "Odpri javni koledar →"}</Link>
      </p>
    </>
  );
}

function Row({ e, lang, onChange, onEdit, onDuplicate }: { e: EventFull; lang: Lang; onChange: () => void; onEdit: (id: string) => void; onDuplicate: (id: string) => void }) {
  const en = lang === "en";
  const cancelFn = useServerFn(eventsCancel);
  const reopenFn = useServerFn(eventsReopen);
  const deleteFn = useServerFn(eventsDelete);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"none" | "cancel" | "delete">("none");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url = `${SITE}/events/${e.id}`;
  const status = e.status === "cancelled" ? { t: en ? "Cancelled" : "Odpovedan", c: ERR } : e.status === "hidden" ? { t: en ? "Hidden by admin" : "Skril admin", c: ERR } : e.visibility === "link" ? { t: en ? "Link only" : "Samo s povezavo", c: "#7aa2f7" } : { t: en ? "Published" : "Objavljen", c: OK };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); setMode("none"); setOpen(false); onChange(); }
    catch (x) { const m = String((x as Error)?.message ?? ""); if (m.includes("has_answers")) { setErr(en ? "Players have answered this event. Cancel it instead." : "Igralci so se odzvali. Dogodek raje odpovej."); setMode("delete"); return; } const k = Object.keys(SERVER_ERRORS).find((key) => m.startsWith(key)); setErr(k ? SERVER_ERRORS[k][en ? 0 : 1] : en ? "Action failed." : "Dejanje ni uspelo."); }
    finally { setBusy(false); }
  };
  const item: CSSProperties = { display: "block", width: "100%", textAlign: "left", padding: "11px 14px", background: "transparent", color: INK, border: "none", borderTop: `1px solid ${ACCENT}1f`, fontFamily: "monospace", fontSize: 13, cursor: "pointer", textDecoration: "none" };

  return (
    <div style={{ background: PANEL, border: `1px solid ${ACCENT}33`, padding: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <DateTile iso={e.starts_at} tz={e.tz} kind={e.kind} lang={lang} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: "monospace", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: status.c }}>{status.t}</span>
          <p style={{ fontFamily: MICHROMA, fontSize: 13, lineHeight: 1.4, margin: "4px 0", wordBreak: "break-word", textDecoration: e.status === "cancelled" ? "line-through" : "none" }}>{e.title}</p>
          {(e.status === "published" || e.status === "cancelled") && (
            <p style={{ fontFamily: "monospace", fontSize: 11.5, color: MUTED, margin: "0 0 2px" }}>
              {en ? `${e.going ?? 0} going · ${e.maybe ?? 0} maybe` : `${e.going ?? 0} pride · ${e.maybe ?? 0} morda`}
            </p>
          )}
          {e.status === "cancelled" && e.cancel_reason && <p style={{ fontFamily: "monospace", fontSize: 11.5, color: MUTED }}>{e.cancel_reason}</p>}
        </div>
        <div style={{ position: "relative" }}>
          <button type="button" className="ev-focus" aria-label={en ? "Actions" : "Dejanja"} aria-expanded={open} onClick={() => setOpen((v) => !v)}
            style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}44`, cursor: "pointer" }}>
            <MoreVertical size={18} />
          </button>
          {open && (
            <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 30, minWidth: 200, background: PANEL, border: `1px solid ${ACCENT}66` }}>
              <Link role="menuitem" to="/events/$eventId" params={{ eventId: e.id }} className="ev-focus" style={{ ...item, borderTop: "none" }}>{en ? "Open" : "Odpri"}</Link>
              <button role="menuitem" type="button" className="ev-focus" style={item} onClick={() => onEdit(e.id)}>{en ? "Edit" : "Uredi"}</button>
              <button role="menuitem" type="button" className="ev-focus" style={item} onClick={() => onDuplicate(e.id)}>{en ? "Duplicate" : "Podvoji"}</button>
              <button role="menuitem" type="button" className="ev-focus" style={item} onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ } }}>
                {copied ? (en ? "Link copied" : "Povezava kopirana") : (en ? "Copy link" : "Kopiraj povezavo")}
              </button>
              {e.status === "cancelled"
                ? <button role="menuitem" type="button" className="ev-focus" style={item} disabled={busy} onClick={() => run(async () => reopenFn({ data: { accessToken: await token(), id: e.id } }))}>{en ? "Reopen" : "Ponovno objavi"}</button>
                : e.status === "published" && <button role="menuitem" type="button" className="ev-focus" style={item} onClick={() => { setMode("cancel"); setOpen(false); }}>{en ? "Cancel event" : "Odpovej"}</button>}
              <button role="menuitem" type="button" className="ev-focus" style={{ ...item, color: ERR }} onClick={() => { setMode("delete"); setOpen(false); }}>{en ? "Delete" : "Izbriši"}</button>
            </div>
          )}
        </div>
      </div>
      {mode === "cancel" && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${ACCENT}22`, paddingTop: 12 }}>
          <label style={{ display: "block", fontFamily: MICHROMA, fontSize: 9.5, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", marginBottom: 6 }} htmlFor={`r-${e.id}`}>{en ? "Reason (optional, shown publicly)" : "Razlog (neobvezno, javno)"}</label>
          <input id={`r-${e.id}`} className="ev-focus" maxLength={140} value={reason} onChange={(x) => setReason(x.target.value)} style={{ width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.4)", color: INK, border: `1px solid ${ACCENT}55`, padding: "10px 12px", fontFamily: "monospace", fontSize: 16, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="ev-focus" style={{ ...btnOutline, flex: 1 }} onClick={() => setMode("none")}>{en ? "Back" : "Nazaj"}</button>
            <button type="button" className="ev-focus" style={{ ...btnPrimary, flex: 1, background: ERR }} disabled={busy} onClick={() => run(async () => cancelFn({ data: { accessToken: await token(), id: e.id, reason } }))}>{en ? "Cancel event" : "Odpovej"}</button>
          </div>
        </div>
      )}
      {mode === "delete" && ((e.going ?? 0) + (e.maybe ?? 0) > 0 ? (
        <div style={{ marginTop: 12, borderTop: `1px solid ${ACCENT}22`, paddingTop: 12 }}>
          <p style={{ fontFamily: "monospace", fontSize: 12.5, marginBottom: 10 }}>{en ? "Players have already answered this event, so it cannot be deleted. Cancel it instead: their answers stay and everyone sees the cancelled notice." : "Igralci so se na ta dogodek že odzvali, zato ga ni mogoče izbrisati. Raje ga odpovej: odgovori ostanejo, vsi pa vidijo obvestilo o odpovedi."}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="ev-focus" style={{ ...btnOutline, flex: 1 }} onClick={() => setMode("none")}>{en ? "Back" : "Nazaj"}</button>
            {e.status === "published" && <button type="button" className="ev-focus" style={{ ...btnPrimary, flex: 1, background: ERR }} onClick={() => setMode("cancel")}>{en ? "Cancel instead" : "Raje odpovej"}</button>}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, borderTop: `1px solid ${ACCENT}22`, paddingTop: 12 }}>
          <p style={{ fontFamily: "monospace", fontSize: 12.5, marginBottom: 10 }}>{en ? "Delete this event for good? Players with the link will see “not found”. Cancelling keeps it visible with a notice." : "Dokončno izbrišem ta dogodek? Kdor ima povezavo, bo videl »ni najden«. Odpoved ga pusti vidnega z obvestilom."}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="ev-focus" style={{ ...btnOutline, flex: 1 }} onClick={() => setMode("none")}>{en ? "Back" : "Nazaj"}</button>
            <button type="button" className="ev-focus" style={{ ...btnPrimary, flex: 1, background: ERR }} disabled={busy} onClick={() => run(async () => deleteFn({ data: { accessToken: await token(), id: e.id } }))}>{en ? "Delete" : "Izbriši"}</button>
          </div>
        </div>
      ))}
      {err && <p role="alert" style={{ color: ERR, fontFamily: "monospace", fontSize: 12, marginTop: 8 }}>{err}</p>}
    </div>
  );
}
