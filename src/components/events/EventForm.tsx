import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  CURRENCIES, DEFAULT_CURRENCY, EVENT_KINDS, MAX_REPEAT, addDaysYmd, currencySymbol, nextWeekday, shortDate, zonedParts, zonedToUtc,
  type LatLng, type Lang,
} from "@/lib/events";
import type { EventField, EventFull, EventInput } from "@/lib/events.functions";
import { fieldProfileGetMine, fieldProfileSave } from "@/lib/field-profile.functions";
import { LocationInput, PointCard } from "./LocationInput";
import { ImageUploader } from "@/components/ImageUploader";
import { ACCENT, BG, ERR, INK, MICHROMA, MUTED, PANEL, btnOutline, btnPrimary, chipStyle } from "./ui";

const card: CSSProperties = { background: PANEL, border: `1px solid ${ACCENT}44`, padding: "18px 16px", marginBottom: 12 };
const cardTitle: CSSProperties = { fontFamily: MICHROMA, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 };
const label: CSSProperties = { display: "block", fontFamily: MICHROMA, fontSize: 9.5, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", marginBottom: 6 };
const input: CSSProperties = { width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.4)", color: INK, border: `1px solid ${ACCENT}55`, padding: "10px 12px", fontFamily: "monospace", fontSize: 16, colorScheme: "dark" };
const help: CSSProperties = { fontFamily: "monospace", fontSize: 11.5, color: MUTED, lineHeight: 1.6, marginTop: 5 };
const errStyle: CSSProperties = { fontFamily: "monospace", fontSize: 12, color: ERR, marginTop: 5 };

type FormState = {
  title: string; kind: string; date: string; startTime: string; endTime: string; location_text: string; maps_url: string;
  description: string; capacity: string; min_age: string; rules_text: string; signup_url: string;
  contact_text: string; visibility: "public" | "link"; repeat: boolean; repeatCount: number;
  priceAmount: string; priceCurrency: string; priceFree: boolean; priceNote: string; oldPriceText: string;
  point: LatLng | null; locMode: "field" | "custom"; locVis: "public" | "going"; showFieldMap: boolean;
};

type FormSource = EventFull & { lat?: number | null; lng?: number | null };

export function initialForm(field: EventField, source?: FormSource | null, mode: "edit" | "duplicate" | "new" = "new"): FormState {
  const defaultLoc = [field.name, field.city].filter(Boolean).join(", ");
  if (!source) {
    return {
      title: "", kind: "skirmish", date: nextWeekday(5), startTime: "10:00", endTime: "", location_text: defaultLoc, maps_url: "",
      description: "", capacity: "", min_age: "", rules_text: "", signup_url: "", contact_text: "",
      visibility: "public", repeat: false, repeatCount: 4,
      priceAmount: "", priceCurrency: DEFAULT_CURRENCY, priceFree: false, priceNote: "", oldPriceText: "",
      point: null, locMode: "field", locVis: "public", showFieldMap: true,
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
    capacity: source.capacity ? String(source.capacity) : "", min_age: source.min_age ? String(source.min_age) : "",
    rules_text: source.rules_text ?? "", signup_url: source.signup_url ?? "", contact_text: source.contact_text ?? "",
    visibility: source.visibility === "link" ? "link" : "public", repeat: false, repeatCount: 4,
    ...priceState(source),
    point: typeof source.lat === "number" && typeof source.lng === "number" ? { lat: source.lat, lng: source.lng } : null,
    locMode: typeof source.lat === "number" ? "custom" : "field",
    locVis: source.location_visibility === "going" ? "going" : "public",
    showFieldMap: source.show_field_map !== false,
  };
}

function priceState(src: FormSource) {
  const structured = src.price_amount !== null && src.price_amount !== undefined && !!src.price_currency;
  const old = !structured && src.price_text ? src.price_text : "";
  return {
    priceAmount: structured && Number(src.price_amount) > 0 ? String(Number(src.price_amount)) : "",
    priceCurrency: src.price_currency ?? DEFAULT_CURRENCY,
    priceFree: structured && Number(src.price_amount) === 0,
    priceNote: old ? old.slice(0, 60) : (src.price_note ?? ""),
    oldPriceText: old,
  };
}

export function toInput(f: FormState, fieldLoc: LatLng | null = null): EventInput {
  const amount = f.priceFree ? "0" : f.priceAmount.trim().replace(",", ".");
  const custom = f.locMode === "custom" || !fieldLoc ? f.point : null;
  return {
    title: f.title, kind: f.kind, date: f.date, startTime: f.startTime, endTime: f.endTime || null, description: f.description,
    // An exact point (event or field) replaces the old Maps link.
    rules_text: f.rules_text, location_text: f.location_text, maps_url: custom || fieldLoc ? null : f.maps_url || null,
    price_amount: amount || null, price_currency: amount ? f.priceCurrency : null, price_note: f.priceNote,
    lat: custom?.lat ?? null, lng: custom?.lng ?? null, location_visibility: f.locVis, show_field_map: f.showFieldMap,
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
  if (!f.priceFree && f.priceAmount.trim() && !/^\d{1,4}([.,]\d{1,2})?$/.test(f.priceAmount.trim())) e.price = en ? "Amount from 0 to 9999.99, at most 2 decimals." : "Znesek od 0 do 9999,99, največ 2 decimalki.";
  if (f.signup_url.trim() && !/^https?:\/\/\S+$/i.test(f.signup_url.trim())) e.signup_url = en ? "Must be a link starting with https://" : "Povezava se mora začeti s https://";
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
  "validation:price": ["Price: amount from 0 to 9999.99 and a currency.", "Cena: znesek od 0 do 9999,99 in valuta.", "price"],
  "validation:location": ["The exact location is not valid.", "Natančna lokacija ni veljavna.", "location"],
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
  const getFieldLoc = useServerFn(fieldProfileGetMine);
  const saveFieldLoc = useServerFn(fieldProfileSave);
  const [fieldLoc, setFieldLoc] = useState<LatLng | null>(null);
  const [fieldLocLoaded, setFieldLocLoaded] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(field.logoUrl ?? null);
  const [mapUrl, setMapUrl] = useState<string | null>(field.mapUrl ?? null);
  const [fieldSaveMsg, setFieldSaveMsg] = useState<string | null>(null);
  const tok = async () => (await supabase.auth.getSession()).data.session?.access_token ?? "";
  useEffect(() => {
    let off = false;
    (async () => {
      try { const r = await getFieldLoc({ data: { accessToken: await tok() } }); if (!off) { setFieldLoc(r.location); setLogoUrl(r.logoUrl); setMapUrl(r.mapUrl); } }
      catch { /* treat as unset */ }
      finally { if (!off) setFieldLocLoaded(true); }
    })();
    return () => { off = true; };
  }, [getFieldLoc]);
  const saveAsField = async () => {
    if (!f.point) return;
    setFieldSaveMsg(null);
    try {
      await saveFieldLoc({ data: { accessToken: await tok(), lat: f.point.lat, lng: f.point.lng } });
      setFieldLoc(f.point); setF((s) => ({ ...s, locMode: "field", point: null }));
      setFieldSaveMsg(en ? "Saved as your field's location." : "Shranjeno kot lokacija poligona.");
    } catch { setFieldSaveMsg(en ? "Could not save the field location." : "Lokacije poligona ni bilo mogoče shraniti."); }
  };

  const preview = useMemo(() => {
    if (!isCreate || !f.repeat || !f.date || !f.startTime) return "";
    return Array.from({ length: f.repeatCount }, (_, i) => shortDate(zonedToUtc(addDaysYmd(f.date, i * 7), f.startTime), "Europe/Ljubljana", lang)).join(", ");
  }, [f.repeat, f.repeatCount, f.date, f.startTime, isCreate, lang]);

  const submit = () => {
    setTouched(true);
    if (Object.keys(localErrors(f, en)).length) return;
    onSubmit(toInput(f, fieldLoc), isCreate && f.repeat ? f.repeatCount : 1);
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
        <div style={{ marginTop: 16 }}>
          {fieldLoc && (
            <div role="radiogroup" aria-label={en ? "Exact location" : "Natančna lokacija"} style={{ display: "flex", gap: 0, marginBottom: 10 }}>
              {(["field", "custom"] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={f.locMode === m} className="ev-focus" onClick={() => set("locMode", m)}
                  style={{ ...chipStyle(f.locMode === m), flex: 1, justifyContent: "center", minHeight: 44 }}>
                  {m === "field" ? (en ? "At the field" : "Na poligonu") : (en ? "Different meeting point" : "Drugo zbirno mesto")}
                </button>
              ))}
            </div>
          )}
          {fieldLoc && f.locMode === "field" ? (
            <>
              <p style={label}>{en ? "Exact location of the field" : "Natančna lokacija poligona"}</p>
              <PointCard value={fieldLoc} lang={lang} />
            </>
          ) : fieldLocLoaded ? (
            <>
              <LocationInput id="ev-point" lang={lang} value={f.point} onChange={(v) => set("point", v)}
                label={fieldLoc ? (en ? "Meeting point" : "Zbirno mesto") : (en ? "Exact location" : "Natančna lokacija")} />
              {!fieldLoc && (
                <div style={{ marginTop: 8 }}>
                  <p style={help}>{en ? "Save it for the whole field in " : "Shrani jo za ves poligon v "}<Link to="/marshal-account" style={{ color: ACCENT }}>{en ? "Field settings" : "Nastavitvah poligona"}</Link>.</p>
                  {f.point && <button type="button" className="ev-focus" style={{ ...btnOutline, minHeight: 36, fontSize: 9.5, marginTop: 6 }} onClick={saveAsField}>{en ? "Also save as my field's location" : "Shrani tudi kot lokacijo poligona"}</button>}
                </div>
              )}
            </>
          ) : <p style={help}>…</p>}
          {fieldSaveMsg && <p role="status" style={{ ...help, color: ACCENT }}>{fieldSaveMsg}</p>}
          {fieldErr("location") && <p style={errStyle}>{fieldErr("location")}</p>}
          {f.maps_url && !(f.point || fieldLoc) && (
            <p style={{ ...help, wordBreak: "break-all" }}>{en ? "Old link: " : "Stara povezava: "}{f.maps_url}<br />{en ? "Set an exact location below to replace it." : "Nastavi natančno lokacijo, da jo zamenjaš."}</p>
          )}
          {f.maps_url && (f.point || fieldLoc) && <p style={help}>{en ? "The old Maps link is replaced when you save." : "Stara povezava do zemljevida se ob shranjevanju zamenja."}</p>}
        </div>

        <p style={{ ...label, marginTop: 16 }}>{en ? "Who can see the exact location" : "Kdo vidi natančno lokacijo"}</p>
        <div style={{ display: "grid", gap: 8 }}>
          {([["public", en ? "Everyone" : "Vsi"], ["going", en ? "Only players who answered Going" : "Samo igralci, ki so odgovorili Pridem"]] as const).map(([v, text]) => (
            <label key={v} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", border: `1px solid ${f.locVis === v ? ACCENT : `${ACCENT}33`}`, background: f.locVis === v ? `${ACCENT}14` : "transparent", cursor: "pointer", fontFamily: "monospace", fontSize: 13 }}>
              <input type="radio" name="ev-locvis" className="ev-focus" checked={f.locVis === v} onChange={() => set("locVis", v)} style={{ width: 18, height: 18, accentColor: ACCENT }} />
              {text}
            </label>
          ))}
        </div>
        <p style={help}>{en ? "Some fields keep the exact spot private until players have answered." : "Nekateri poligoni natančno mesto skrijejo, dokler igralci ne odgovorijo."}</p>
      </Card>

      <Card title={en ? "Logo and field outline" : "Logo in obris poligona"}>
        <p style={{ ...help, marginTop: 0, marginBottom: 10 }}>{en ? "Saved once and used for all your events." : "Shrani se enkrat in velja za vse tvoje dogodke."}</p>
        <div style={{ display: "grid", gap: 10 }}>
          <ImageUploader kind="logo" currentUrl={logoUrl} fieldName={field.name} onChange={setLogoUrl} />
          <ImageUploader kind="map" currentUrl={mapUrl} fieldName={field.name} onChange={setMapUrl} />
        </div>
        {mapUrl && (
          <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, minHeight: 44, fontFamily: "monospace", fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" className="ev-focus" checked={f.showFieldMap} onChange={(e) => set("showFieldMap", e.target.checked)} style={{ width: 18, height: 18, accentColor: ACCENT }} />
            {en ? "Show the field outline on this event" : "Prikaži obris poligona pri tem dogodku"}
          </label>
        )}
      </Card>

      <Card title={en ? "Details" : "Podrobnosti"}>
        <label style={label} htmlFor="ev-desc">{en ? "Description" : "Opis"} <Counter n={f.description.length} max={4000} /></label>
        <textarea id="ev-desc" rows={6} className="ev-focus" style={{ ...input, resize: "vertical" }} maxLength={4000} value={f.description} onChange={(e) => set("description", e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={label} htmlFor="ev-price">{en ? "Price" : "Cena"}</label>
            <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" }}>
              {!f.priceFree && (
                <>
                  <input id="ev-price" type="number" inputMode="decimal" step={0.5} min={0} max={9999.99} className="ev-focus" style={{ ...input, flex: "1 1 110px", width: "auto" }}
                    value={f.priceAmount} onChange={(e) => set("priceAmount", e.target.value)} placeholder={en ? "amount" : "znesek"} />
                  <select aria-label={en ? "Currency" : "Valuta"} className="ev-focus" style={{ ...input, flex: "0 1 120px", width: "auto" }} value={f.priceCurrency} onChange={(e) => set("priceCurrency", e.target.value)}>
                    {CURRENCIES.map((c) => { const sym = currencySymbol(c, lang); return <option key={c} value={c}>{sym && sym !== c ? `${c} ${sym}` : c}</option>; })}
                  </select>
                </>
              )}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 10px", border: `1px solid ${f.priceFree ? ACCENT : `${ACCENT}33`}`, fontFamily: "monospace", fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" role="switch" className="ev-focus" checked={f.priceFree} onChange={(e) => setF((s) => ({ ...s, priceFree: e.target.checked, priceAmount: e.target.checked ? "" : s.priceAmount }))} style={{ width: 18, height: 18, accentColor: ACCENT }} />
                {en ? "Free" : "Brezplačno"}
              </label>
            </div>
            {fieldErr("price") && <p style={errStyle}>{fieldErr("price")}</p>}
            <label style={{ ...label, marginTop: 10 }} htmlFor="ev-price-note">{en ? "Price note" : "Opomba k ceni"} <Counter n={f.priceNote.length} max={60} /></label>
            <input id="ev-price-note" className="ev-focus" style={input} maxLength={60} value={f.priceNote} onChange={(e) => set("priceNote", e.target.value)} placeholder={en ? "per player, lunch included" : "na igralca, vključena malica"} />
            <p style={help}>{en ? "Say who the price is for, for example per player or per team. Leave empty for no price shown." : "Napiši, za koga velja cena, npr. na igralca ali na ekipo. Pusti prazno, če cene ne želiš prikazati."}</p>
            {f.oldPriceText && <p style={help}>{en ? "The old price text is replaced when you save." : "Staro besedilo cene se ob shranjevanju zamenja."}</p>}
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
