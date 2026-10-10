import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  EVENT_KINDS, MAX_REPEAT, addDaysYmd, nextWeekday, safeUrl, shortDate, zonedParts, zonedToUtc, type Lang,
} from "@/lib/events";
import type { EventField, EventFull, EventInput } from "@/lib/events.functions";
import { ACCENT, BG, ERR, INK, MICHROMA, MUTED, PANEL, btnOutline, btnPrimary, chipStyle } from "./ui";

const card: CSSProperties = { background: PANEL, border: `1px solid ${ACCENT}44`, padding: "18px 16px", marginBottom: 12 };
const cardTitle: CSSProperties = { fontFamily: MICHROMA, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 };
const label: CSSProperties = { display: "block", fontFamily: MICHROMA, fontSize: 9.5, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", marginBottom: 6 };
const input: CSSProperties = { width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.4)", color: INK, border: `1px solid ${ACCENT}55`, padding: "10px 12px", fontFamily: "monospace", fontSize: 16, colorScheme: "dark" };
const help: CSSProperties = { fontFamily: "monospace", fontSize: 11.5, color: MUTED, lineHeight: 1.6, marginTop: 5 };
const errStyle: CSSProperties = { fontFamily: "monospace", fontSize: 12, color: ERR, marginTop: 5 };

type FormState = {
  title: string; kind: string; date: string; startTime: string; endTime: string; location_text: string; maps_url: string;
  description: string; price_text: string; capacity: string; min_age: string; rules_text: string; signup_url: string;
  contact_text: string; visibility: "public" | "link"; repeat: boolean; repeatCount: number;
};

export function initialForm(field: EventField, source?: EventFull | null, mode: "edit" | "duplicate" | "new" = "new"): FormState {
  const defaultLoc = [field.name, field.city].filter(Boolean).join(", ");
  if (!source) {
    return {
      title: "", kind: "skirmish", date: nextWeekday(5), startTime: "10:00", endTime: "", location_text: defaultLoc, maps_url: "",
      description: "", price_text: "", capacity: "", min_age: "", rules_text: "", signup_url: "", contact_text: "",
      visibility: "public", repeat: false, repeatCount: 4,
    };
  }
  const s = zonedParts(source.starts_at, source.tz);
  let date = s.ymd;
  if (mode === "duplicate") {
    // Same weekday next week, but never in the past.
    date = addDaysYmd(s.ymd, 7);
    const today = zonedParts(new Date()).ymd;
    while (date <= today) date = addDaysYmd(date, 7);
  }
  return {
    title: source.title, kind: source.kind, date, startTime: s.hm, endTime: source.ends_at ? zonedParts(source.ends_at, source.tz).hm : "",
    location_text: source.location_text ?? "", maps_url: source.maps_url ?? "", description: source.description ?? "",
    price_text: source.price_text ?? "", capacity: source.capacity ? String(source.capacity) : "", min_age: source.min_age ? String(source.min_age) : "",
    rules_text: source.rules_text ?? "", signup_url: source.signup_url ?? "", contact_text: source.contact_text ?? "",
    visibility: source.visibility === "link" ? "link" : "public", repeat: false, repeatCount: 4,
  };
}

export function toInput(f: FormState): EventInput {
  return {
    title: f.title, kind: f.kind, date: f.date, startTime: f.startTime, endTime: f.endTime || null, description: f.description,
    rules_text: f.rules_text, location_text: f.location_text, maps_url: f.maps_url, price_text: f.price_text,
    capacity: f.capacity || null, min_age: f.min_age || null, signup_url: f.signup_url, contact_text: f.contact_text, visibility: f.visibility,
  };
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section style={card}><h2 style={cardTitle}>{title}</h2>{children}</section>;
}
function Counter({ n, max }: { n: number; max: number }) {
  return <span style={{ float: "right", fontFamily: "monospace", fontSize: 10.5, color: n > max * 0.9 ? ACCENT : MUTED }}>{n}/{max}</span>;
}

/** Client-side checks that mirror the server; returns field -> message. */
function localErrors(f: FormState, en: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.title.trim().length < 3) e.title = en ? "At least 3 characters." : "Vsaj 3 znaki.";
  if (!f.date) e.date = en ? "Pick a date." : "Izberi datum.";
  else if (f.startTime && Date.parse(zonedToUtc(f.date, f.startTime)) < Date.now() - 3600000) e.date = en ? "This date is in the past." : "Ta datum je že mimo.";
  if (!f.startTime) e.startTime = en ? "Pick a start time." : "Izberi uro začetka.";
  if (f.maps_url.trim() && !safeUrl(f.maps_url)) e.maps_url = en ? "Must be a link starting with https://" : "Povezava se mora začeti s https://";
  if (f.signup_url.trim() && !safeUrl(f.signup_url)) e.signup_url = en ? "Must be a link starting with https://" : "Povezava se mora začeti s https://";
  if (f.capacity && (!/^\d+$/.test(f.capacity) || +f.capacity < 2 || +f.capacity > 500)) e.capacity = en ? "Between 2 and 500." : "Med 2 in 500.";
  return e;
}

export const SERVER_ERRORS: Record<string, [string, string, string?]> = {
  "validation:title": ["Title: at least 3 characters.", "Naslov: vsaj 3 znaki.", "title"],
  "validation:date": ["The date is not valid or is in the past.", "Datum ni veljaven ali je že mimo.", "date"],
  "validation:start": ["Start time is not valid.", "Ura začetka ni veljavna.", "startTime"],
  "validation:end": ["End time must be after the start.", "Konec mora biti po začetku.", "endTime"],
  "validation:maps_url": ["Maps link is not valid.", "Povezava do zemljevida ni veljavna.", "maps_url"],
  "validation:signup_url": ["Sign-up link is not valid.", "Povezava za prijavo ni veljavna.", "signup_url"],
  "validation:capacity": ["Spots: between 2 and 500.", "Mesta: med 2 in 500.", "capacity"],
  event_limit: ["Your field already has 30 upcoming events. Cancel or delete some first.", "Tvoj poligon ima že 30 prihajajočih dogodkov. Najprej odpovej ali izbriši katerega."],
  field_not_ready: ["Finish your field setup first (password, city, country).", "Najprej dokončaj nastavitve poligona (geslo, mesto, država)."],
  login_required: ["Please sign in again.", "Ponovno se prijavi."],
  account_required: ["This login has no field.", "Ta prijava nima poligona."],
  not_found: ["This event no longer exists.", "Ta dogodek ne obstaja več."],
};

export function EventForm({ lang, field, listedPublicly, initial, isCreate, busy, serverError, onSubmit, onCancel }: {
  lang: Lang; field: EventField; listedPublicly: boolean; initial: FormState; isCreate: boolean; busy: boolean;
  serverError: string | null; onSubmit: (input: EventInput, repeatWeeks: number) => void; onCancel: () => void;
}) {
  const en = lang === "en";
  const [f, setF] = useState<FormState>(initial);
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const errors = touched ? localErrors(f, en) : {};
  const srv = serverError ? Object.entries(SERVER_ERRORS).find(([k]) => serverError.startsWith(k)) : null;
  const srvField = srv?.[1][2];
  const fieldErr = (k: string) => errors[k] ?? (srvField === k ? srv?.[1][en ? 0 : 1] : undefined);

  const preview = useMemo(() => {
    if (!isCreate || !f.repeat || !f.date || !f.startTime) return "";
    return Array.from({ length: f.repeatCount }, (_, i) => shortDate(zonedToUtc(addDaysYmd(f.date, i * 7), f.startTime), "Europe/Ljubljana", lang)).join(", ");
  }, [f.repeat, f.repeatCount, f.date, f.startTime, isCreate, lang]);

  const submit = () => {
    setTouched(true);
    if (Object.keys(localErrors(f, en)).length) return;
    onSubmit(toInput(f), isCreate && f.repeat ? f.repeatCount : 1);
  };

  const quick = (label: string, ymd: string) => (
    <button type="button" className="ev-focus" style={chipStyle(f.date === ymd)} aria-pressed={f.date === ymd} onClick={() => set("date", ymd)}>{label}</button>
  );

  return (
    <div style={{ paddingBottom: 90 }}>
      <Card title={en ? "Basics" : "Osnovno"}>
        <label style={label} htmlFor="ev-title">{en ? "Title" : "Naslov"} <Counter n={f.title.length} max={100} /></label>
        <input id="ev-title" className="ev-focus" style={input} maxLength={100} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={en ? "e.g. Sunday skirmish" : "npr. Nedeljska igra"} />
        {fieldErr("title") && <p style={errStyle}>{fieldErr("title")}</p>}

        <p style={{ ...label, marginTop: 16 }}>{en ? "Type" : "Vrsta"}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {EVENT_KINDS.map((k) => (
            <button key={k.id} type="button" className="ev-focus" aria-pressed={f.kind === k.id} style={chipStyle(f.kind === k.id)} onClick={() => set("kind", k.id)}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: k.color }} />{en ? k.en : k.sl}
            </button>
          ))}
        </div>

        <label style={{ ...label, marginTop: 16 }} htmlFor="ev-date">{en ? "Date" : "Datum"}</label>
        <input id="ev-date" type="date" className="ev-focus" style={input} value={f.date} onChange={(e) => set("date", e.target.value)} />
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {quick(en ? "Next Saturday" : "Naslednja sobota", nextWeekday(5))}
          {quick(en ? "Next Sunday" : "Naslednja nedelja", nextWeekday(6))}
        </div>
        {fieldErr("date") && <p style={errStyle}>{fieldErr("date")}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
          <div>
            <label style={label} htmlFor="ev-start">{en ? "Start" : "Začetek"}</label>
            <input id="ev-start" type="time" step={300} className="ev-focus" style={input} value={f.startTime} onChange={(e) => set("startTime", e.target.value)} />
            {fieldErr("startTime") && <p style={errStyle}>{fieldErr("startTime")}</p>}
          </div>
          <div>
            <label style={label} htmlFor="ev-end">{en ? "End (optional)" : "Konec (neobvezno)"}</label>
            <input id="ev-end" type="time" step={300} className="ev-focus" style={input} value={f.endTime} onChange={(e) => set("endTime", e.target.value)} />
            {fieldErr("endTime") && <p style={errStyle}>{fieldErr("endTime")}</p>}
          </div>
        </div>
        <p style={help}>{en ? "Times are in Slovenian time (Europe/Ljubljana)." : "Ure so po slovenskem času."}</p>
      </Card>

      <Card title={en ? "Where" : "Kje"}>
        <label style={label} htmlFor="ev-loc">{en ? "Location" : "Lokacija"} <Counter n={f.location_text.length} max={160} /></label>
        <input id="ev-loc" className="ev-focus" style={input} maxLength={160} value={f.location_text} onChange={(e) => set("location_text", e.target.value)} />
        <label style={{ ...label, marginTop: 14 }} htmlFor="ev-maps">{en ? "Maps link (optional)" : "Povezava do zemljevida (neobvezno)"}</label>
        <input id="ev-maps" type="url" inputMode="url" className="ev-focus" style={input} maxLength={300} value={f.maps_url} onChange={(e) => set("maps_url", e.target.value)} />
        <p style={help}>{en ? "Paste a Google Maps link." : "Prilepi povezavo iz Google Zemljevidov."}</p>
        {fieldErr("maps_url") && <p style={errStyle}>{fieldErr("maps_url")}</p>}
      </Card>

      <Card title={en ? "Details" : "Podrobnosti"}>
        <label style={label} htmlFor="ev-desc">{en ? "Description" : "Opis"} <Counter n={f.description.length} max={4000} /></label>
        <textarea id="ev-desc" rows={6} className="ev-focus" style={{ ...input, resize: "vertical" }} maxLength={4000} value={f.description} onChange={(e) => set("description", e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={label} htmlFor="ev-price">{en ? "Price" : "Cena"}</label>
            <input id="ev-price" className="ev-focus" style={input} maxLength={80} value={f.price_text} onChange={(e) => set("price_text", e.target.value)} placeholder={en ? "e.g. 25 €, lunch included" : "npr. 25 €, vključena malica"} />
          </div>
          <div>
            <label style={label} htmlFor="ev-cap">{en ? "Spots" : "Mesta"}</label>
            <input id="ev-cap" inputMode="numeric" className="ev-focus" style={input} value={f.capacity} onChange={(e) => set("capacity", e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder={en ? "no limit" : "brez omejitve"} />
            {fieldErr("capacity") && <p style={errStyle}>{fieldErr("capacity")}</p>}
          </div>
          <div>
            <label style={label} htmlFor="ev-age">{en ? "Minimum age" : "Najnižja starost"}</label>
            <select id="ev-age" className="ev-focus" style={input} value={f.min_age} onChange={(e) => set("min_age", e.target.value)}>
              <option value="">{en ? "None" : "Brez"}</option>
              {["14", "16", "18"].map((a) => <option key={a} value={a}>{a}+</option>)}
            </select>
          </div>
        </div>
        <label style={{ ...label, marginTop: 14 }} htmlFor="ev-rules">{en ? "What to bring / rules" : "Kaj prinesti / pravila"} <Counter n={f.rules_text.length} max={1500} /></label>
        <textarea id="ev-rules" rows={4} className="ev-focus" style={{ ...input, resize: "vertical" }} maxLength={1500} value={f.rules_text} onChange={(e) => set("rules_text", e.target.value)} />
      </Card>

      <Card title={en ? "Sign-up and contact (optional)" : "Prijava in kontakt (neobvezno)"}>
        <label style={label} htmlFor="ev-signup">{en ? "External sign-up link" : "Zunanja povezava za prijavo"}</label>
        <input id="ev-signup" type="url" inputMode="url" className="ev-focus" style={input} maxLength={300} value={f.signup_url} onChange={(e) => set("signup_url", e.target.value)} placeholder="https://" />
        {fieldErr("signup_url") && <p style={errStyle}>{fieldErr("signup_url")}</p>}
        <label style={{ ...label, marginTop: 14 }} htmlFor="ev-contact">{en ? "Contact" : "Kontakt"} <Counter n={f.contact_text.length} max={120} /></label>
        <input id="ev-contact" className="ev-focus" style={input} maxLength={120} value={f.contact_text} onChange={(e) => set("contact_text", e.target.value)} placeholder={en ? "e.g. 041 123 456 or Viber: …" : "npr. 041 123 456 ali Viber: …"} />
        <p style={help}>{en ? "This is public. Use a number you are happy to show." : "To je javno. Uporabi številko, ki jo lahko pokažeš."}</p>
      </Card>

      <Card title={en ? "Visibility" : "Vidnost"}>
        <div style={{ display: "grid", gap: 8 }}>
          {([["public", en ? "Public — listed in the calendar" : "Javno — prikazano v koledarju"], ["link", en ? "Link only — not listed, only people with the link can see it" : "Samo s povezavo — ni na seznamu, vidi ga le, kdor ima povezavo"]] as const).map(([v, text]) => (
            <label key={v} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 12px", border: `1px solid ${f.visibility === v ? ACCENT : `${ACCENT}33`}`, background: f.visibility === v ? `${ACCENT}14` : "transparent", cursor: "pointer", fontFamily: "monospace", fontSize: 13, lineHeight: 1.5 }}>
              <input type="radio" name="ev-vis" className="ev-focus" checked={f.visibility === v} onChange={() => set("visibility", v)} style={{ width: 18, height: 18, accentColor: ACCENT, marginTop: 1 }} />
              {text}
            </label>
          ))}
        </div>
        {!listedPublicly && f.visibility === "public" && (
          <p style={{ ...help, color: ACCENT }}>
            {en ? "Your field is hidden from the Join page, so public events will not be listed until you turn listing on. " : "Tvoj poligon je skrit s strani za vstop, zato javni dogodki ne bodo na seznamu, dokler ne vklopiš prikaza. "}
            <Link to="/marshal-account" style={{ color: ACCENT }}>{en ? "Field settings →" : "Nastavitve poligona →"}</Link>
          </p>
        )}
      </Card>

      {isCreate && (
        <Card title={en ? "Repeat" : "Ponavljanje"}>
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontFamily: "monospace", fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" role="switch" className="ev-focus" checked={f.repeat} onChange={(e) => set("repeat", e.target.checked)} style={{ width: 18, height: 18, accentColor: ACCENT }} />
            {en ? "Repeat weekly" : "Ponavljaj tedensko"}
          </label>
          {f.repeat && (
            <>
              <label style={{ ...label, marginTop: 14 }} htmlFor="ev-rep">{en ? "Total games" : "Skupno iger"}</label>
              <input id="ev-rep" type="number" min={2} max={MAX_REPEAT} className="ev-focus" style={{ ...input, width: 100 }} value={f.repeatCount}
                onChange={(e) => set("repeatCount", Math.max(2, Math.min(MAX_REPEAT, Math.floor(Number(e.target.value) || 2))))} />
              <p style={help}>{en ? `Creates ${f.repeatCount} events on: ` : `Ustvari ${f.repeatCount} dogodkov: `}{preview}</p>
            </>
          )}
        </Card>
      )}

      {serverError && !srvField && <p role="alert" style={{ ...errStyle, textAlign: "center", fontSize: 13, margin: "10px 0" }}>{srv ? srv[1][en ? 0 : 1] : en ? "Could not save. Please try again." : "Shranjevanje ni uspelo. Poskusi znova."}</p>}
      {touched && Object.keys(errors).length > 0 && <p role="alert" style={{ ...errStyle, textAlign: "center", margin: "10px 0" }}>{en ? "Please fix the marked fields." : "Popravi označena polja."}</p>}

      <div style={{ position: "sticky", bottom: 0, background: BG, padding: "12px 0", display: "flex", gap: 10, zIndex: 5, borderTop: `1px solid ${ACCENT}22` }}>
        <button type="button" className="ev-focus" style={{ ...btnOutline, flex: 1 }} onClick={onCancel}>{en ? "Cancel" : "Prekliči"}</button>
        <button type="button" className="ev-focus" style={{ ...btnPrimary, flex: 2, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={submit}>{busy ? "…" : en ? "Save" : "Shrani"}</button>
      </div>
    </div>
  );
}
