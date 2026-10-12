import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Copy, ExternalLink, Lock, Map as MapIcon, MapPin } from "lucide-react";
import { FieldMapViewer } from "@/components/events/FieldMapViewer";
import { fieldMediaAdminRemove } from "@/lib/field-profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { COUNTRIES, flagFor } from "@/lib/countries";
import { CONTACT_EMAIL } from "@/lib/plans";
import { getMasterPw, useMasterAdmin } from "@/lib/master-admin";
import {
  SITE, appleMapsUrl, fmtLatLng, formatEventWhen, googleMapsUrl, isToday, kindInfo, useViewerTz, linkify, looksLikePhone,
  priceLabel, priceNumber, safeUrl, shortDate, wazeUrl, type LatLng, type Lang,
} from "@/lib/events";
import { eventLocationForViewer, eventsAdminHide, eventsGet, type EventFull } from "@/lib/events.functions";
import {
  ACCENT, AddToCalendar, BG, CancelledBadge, DateTile, ERR, EventStyles, FieldLogo, INK, KindBadge, MICHROMA, MUTED, PANEL,
  ShareButton, btnOutline, btnPrimary, shareLine,
} from "@/components/events/ui";
import { RsvpPanel } from "@/components/events/RsvpPanel";

const DEFAULT_IMAGE = "https://storage.googleapis.com/gpt-engineer-file-uploads/pnuEeej0s2fuaeyJ1j4H7JsWP8j1/social-images/social-1784618784760-social_m,edia_(lovable)_red_logo-27.webp";

/** ISO with the event zone's offset, e.g. 2026-07-11T10:00:00+02:00. */
function isoWithOffset(iso: string, tz: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const local = Date.UTC(+g("year"), +g("month") - 1, +g("day"), +g("hour"), +g("minute"), +g("second"));
  const off = Math.round((local - Math.floor(d.getTime() / 1000) * 1000) / 60000);
  const sign = off >= 0 ? "+" : "-";
  const a = Math.abs(off);
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

function countryName(c: string | null) {
  return c ? COUNTRIES.find((x) => x.code === c)?.name ?? c : "";
}

function jsonLd(e: EventFull): string {
  const structured = e.price_amount !== null && !!e.price_currency;
  const price = structured ? null : priceNumber(e.price_text);
  const geo = !e.locationRestricted && e.location ? { geo: { "@type": "GeoCoordinates", latitude: e.location.lat, longitude: e.location.lng } } : {};
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    startDate: isoWithOffset(e.starts_at, e.tz),
    ...(e.ends_at ? { endDate: isoWithOffset(e.ends_at, e.tz) } : {}),
    eventStatus: e.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: e.field.name, address: e.location_text || [e.field.city, countryName(e.field.country)].filter(Boolean).join(", "), ...geo },
    organizer: { "@type": "Organization", name: e.field.name },
    url: `${SITE}/events/${e.id}`,
    image: [DEFAULT_IMAGE],
    ...(e.description ? { description: e.description.slice(0, 500) } : {}),
    ...(structured ? { offers: { "@type": "Offer", price: e.price_amount, priceCurrency: e.price_currency, availability: "https://schema.org/InStock", url: `${SITE}/events/${e.id}` } } : {}),
    ...(price !== null ? { offers: { "@type": "Offer", price, priceCurrency: "EUR", url: `${SITE}/events/${e.id}` } } : {}),
  };
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export const Route = createFileRoute("/events/$eventId")({
  loader: async ({ params }) => (await eventsGet({ data: { id: params.eventId } }).catch(() => ({ event: null }))),
  head: ({ loaderData }) => {
    const e = loaderData?.event;
    if (!e) {
      return { meta: [{ title: "Event not found — SpartanOps" }, { name: "robots", content: "noindex" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] };
    }
    const k = kindInfo(e.kind);
    const when = formatEventWhen(e.starts_at, e.ends_at, e.tz, "sl", e.tz);
    const title = `${e.title} — ${e.field.name}${e.field.city ? `, ${e.field.city}` : ""} · ${shortDate(e.starts_at, e.tz, "sl")} | SpartanOps`;
    const desc = e.description ? e.description.replace(/\s+/g, " ").slice(0, 150) : `${k.sl} — ${e.field.name}, ${when}`;
    const url = `${SITE}/events/${e.id}`;
    const meta: Record<string, string>[] = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
      { property: "og:image", content: DEFAULT_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: DEFAULT_IMAGE },
    ];
    if (e.visibility === "link" || e.status === "cancelled") meta.push({ name: "robots", content: "noindex" });
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: jsonLd(e) }],
    };
  },
  component: EventPage,
});

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${ACCENT}22`, padding: "10px 12px", minWidth: 0 }}>
      <p style={{ fontFamily: MICHROMA, fontSize: 9, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", marginBottom: 5 }}>{label}</p>
      <div style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.5, wordBreak: "break-word" }}>{children}</div>
    </div>
  );
}

function EventPage() {
  const { lang: uiLang } = useLang();
  const lang: Lang = uiLang === "en" ? "en" : "sl";
  const en = lang === "en";
  const { event: e } = Route.useLoaderData();
  const isAdmin = useMasterAdmin();
  const viewerTz = useViewerTz();
  const hide = useServerFn(eventsAdminHide);
  const [adminState, setAdminState] = useState<"idle" | "hidden" | "shown" | "error">("idle");
  const [going, setGoing] = useState<number | null>(null);
  const onCounts = useCallback((n: number) => setGoing(n), []);
  const locFn = useServerFn(eventLocationForViewer);
  const [viewerLoc, setViewerLoc] = useState<LatLng | null>(null);
  const [copied, setCopied] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mediaAdmin, setMediaAdmin] = useState<"idle" | "done" | "error">("idle");
  const removeMedia = useServerFn(fieldMediaAdminRemove);
  const prefetchMap = () => { if (e?.field.mapUrl) { const i = new Image(); i.src = e.field.mapUrl; } };
  const restricted = !!e?.locationRestricted;
  const eventId = e?.id;
  // Restricted locations are fetched only for the organiser or a player who answered "going";
  // re-checked whenever the going count changes so the buttons appear without a reload.
  useEffect(() => {
    if (!restricted || !eventId) return;
    let off = false;
    (async () => {
      const t = (await supabase.auth.getSession()).data.session?.access_token;
      if (!t) { setViewerLoc(null); return; }
      try {
        const r = await locFn({ data: { eventId, accessToken: t } });
        if (!off) setViewerLoc("location" in r ? r.location : null);
      } catch { if (!off) setViewerLoc(null); }
    })();
    return () => { off = true; };
  }, [restricted, eventId, going, locFn]);

  if (!e) {
    return (
      <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "120px 16px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", background: PANEL, border: `1px solid ${ACCENT}44`, padding: 28, textAlign: "center" }}>
          <h1 style={{ fontFamily: MICHROMA, fontSize: 15, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>{en ? "Event not found" : "Dogodka ni"}</h1>
          <p style={{ fontFamily: "monospace", fontSize: 13, color: MUTED, marginBottom: 18 }}>{en ? "It may have been removed, or the link is wrong." : "Morda je bil odstranjen ali pa je povezava napačna."}</p>
          <Link to="/events" className="ev-focus" style={btnPrimary}>{en ? "All events" : "Vsi dogodki"}</Link>
        </div>
      </main>
    );
  }

  const cancelled = e.status === "cancelled";
  const gameDay = !cancelled && isToday(e.starts_at, e.tz);
  const url = `${SITE}/events/${e.id}`;
  const point = restricted ? viewerLoc : e.location;
  const maps = point ? null : safeUrl(e.maps_url);
  const priceMain = priceLabel(e, lang);
  const signup = safeUrl(e.signup_url);
  const phone = e.contact_text ? looksLikePhone(e.contact_text) : null;
  const k = kindInfo(e.kind);
  const report = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Report event ${e.id}`)}&body=${encodeURIComponent(`${url}\n\n`)}`;
  const banner = (color: string): CSSProperties => ({ border: `1px solid ${color}`, background: `${color}1a`, padding: "12px 14px", marginBottom: 14, fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 });

  return (
    <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "96px 16px 56px" }}>
      <EventStyles />
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link to="/events" className="ev-focus" style={{ color: ACCENT, fontFamily: "monospace", fontSize: 12.5, display: "inline-block", marginBottom: 14 }}>
          ← {en ? "All events" : "Vsi dogodki"}
        </Link>

        {cancelled && (
          <div role="status" style={banner(ERR)}>
            <strong>{en ? "This event is cancelled" : "Dogodek je odpovedan"}</strong>
            {e.cancel_reason && <div style={{ marginTop: 4 }}>{e.cancel_reason}</div>}
          </div>
        )}
        {gameDay && (
          <div style={{ ...banner(ACCENT), display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <strong style={{ color: ACCENT }}>{en ? "Game day: join the mission" : "Dan igre: pridruži se misiji"}</strong>
            <Link to="/field" search={{ id: e.field.id } as never} className="ev-focus" style={btnPrimary}>{en ? "Join" : "Vstopi"}</Link>
          </div>
        )}

        <section style={{ background: PANEL, border: `1px solid ${ACCENT}44`, padding: "20px 18px", display: "flex", gap: 16 }}>
          <DateTile iso={e.starts_at} tz={e.tz} kind={e.kind} lang={lang} size="lg" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ float: "right", marginLeft: 10 }}><FieldLogo url={e.field.logoUrl} name={e.field.name} size={56} /></div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
              <KindBadge kind={e.kind} lang={lang} />
              {cancelled && <CancelledBadge lang={lang} />}
            </div>
            <h1 style={{ fontFamily: MICHROMA, fontSize: "clamp(18px, 4.6vw, 26px)", lineHeight: 1.35, letterSpacing: "0.04em", margin: 0, wordBreak: "break-word", textDecoration: cancelled ? "line-through" : "none" }}>{e.title}</h1>
            <p style={{ fontFamily: "monospace", fontSize: 13, color: MUTED, margin: "8px 0 4px" }}>
              {e.field.name}{e.field.city ? ` · ${e.field.city}` : ""}{e.field.country ? ` · ${flagFor(e.field.country)}` : ""}
            </p>
            <Link to="/events" search={{ field: e.field.id }} className="ev-focus" style={{ color: ACCENT, fontFamily: "monospace", fontSize: 12 }}>
              {en ? "More events at this field" : "Več dogodkov na tem poligonu"}
            </Link>
          </div>
        </section>

        <div className="grid grid-cols-2" style={{ gap: 8, marginTop: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}><Fact label={en ? "When" : "Kdaj"}>{formatEventWhen(e.starts_at, e.ends_at, e.tz, lang, viewerTz)}</Fact></div>
          {(e.location_text || maps || point || restricted || e.field.mapUrl) && (
            <div style={{ gridColumn: "1 / -1" }}>
              <Fact label={en ? "Where" : "Kje"}>
                {e.location_text && <div>{e.location_text}</div>}
                {point && (
                  <div style={{ marginTop: 8 }}>
                    <a href={googleMapsUrl(point)} target="_blank" rel="noopener noreferrer" className="ev-focus" style={{ ...btnPrimary, minHeight: 40 }}>
                      <MapPin size={14} /> {en ? "Open in Google Maps" : "Odpri v Google Zemljevidih"}
                    </a>
                    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
                      <a href={wazeUrl(point)} target="_blank" rel="noopener noreferrer" className="ev-focus" style={{ color: ACCENT }}>Waze</a>
                      <a href={appleMapsUrl(point, e.field.name)} target="_blank" rel="noopener noreferrer" className="ev-focus" style={{ color: ACCENT }}>Apple Maps</a>
                      <button type="button" className="ev-focus" style={{ background: "none", border: "none", color: ACCENT, fontFamily: "monospace", fontSize: 13, cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 5, minHeight: 32 }}
                        onClick={async () => { try { await navigator.clipboard.writeText(fmtLatLng(point)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }}>
                        <Copy size={13} /> {copied ? (en ? "Copied" : "Kopirano") : (en ? "Copy coordinates" : "Kopiraj koordinate")}
                      </button>
                    </div>
                  </div>
                )}
                {restricted && !point && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, color: MUTED }}>
                    <Lock size={13} /> {en ? "Exact location is shared with players who are going." : "Natančna lokacija je vidna igralcem, ki pridejo."}
                  </div>
                )}
                {e.field.mapUrl && (
                  <button type="button" className="ev-focus" onClick={() => setMapOpen(true)} onPointerEnter={prefetchMap} onFocus={prefetchMap}
                    style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 44, marginTop: 4, background: "none", border: "none", padding: 0, color: ACCENT, fontFamily: "monospace", fontSize: 13, cursor: "pointer" }}>
                    <MapIcon size={14} /> {en ? "Field outline: tap to view" : "Obris poligona: tapni za ogled"}
                  </button>
                )}
                {maps && <a href={maps} target="_blank" rel="noopener noreferrer nofollow" className="ev-focus" style={{ color: ACCENT, display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4 }}><MapPin size={13} />{en ? "Open in Maps" : "Odpri v zemljevidih"}</a>}
              </Fact>
            </div>
          )}
          {(priceMain || e.price_note) && (
            <Fact label={en ? "Price" : "Cena"}>
              {priceMain && <div>{priceMain}</div>}
              {e.price_note && <div style={{ color: MUTED, fontSize: 12 }}>{e.price_note}</div>}
            </Fact>
          )}
          <Fact label={en ? "Spots" : "Mesta"}>{e.capacity ?? (en ? "No limit" : "Brez omejitve")}</Fact>
          {e.min_age && <Fact label={en ? "Minimum age" : "Najnižja starost"}>{e.min_age}+</Fact>}
          {e.contact_text && (
            <Fact label={en ? "Contact" : "Kontakt"}>
              {phone ? <a href={`tel:${phone}`} className="ev-focus" style={{ color: ACCENT }}>{e.contact_text}</a> : e.contact_text}
            </Fact>
          )}
        </div>

        {e.description && (
          <section style={{ marginTop: 18 }}>
            <div style={{ fontFamily: "monospace", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{linkify(e.description)}</div>
          </section>
        )}
        {e.rules_text && (
          <section style={{ marginTop: 18, background: PANEL, border: `1px solid ${ACCENT}33`, padding: "14px 16px" }}>
            <h2 style={{ fontFamily: MICHROMA, fontSize: 11, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", marginBottom: 8 }}>{en ? "What to bring / rules" : "Kaj prinesti / pravila"}</h2>
            <div style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{linkify(e.rules_text)}</div>
          </section>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
          <AddToCalendar event={{ ...e, geo: restricted ? null : e.location }} lang={lang} />
          <ShareButton url={url} title={e.title} text={shareLine(e, lang) + (going ? ` · ${going} ${lang === "en" ? "going" : "gre"}` : "")} lang={lang} />
          {signup && (
            <a href={signup} target="_blank" rel="noopener noreferrer nofollow" className="ev-focus" style={btnPrimary}>
              <ExternalLink size={14} /> {en ? "Sign up on the organiser's page" : "Prijava na strani organizatorja"}
              <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 0, textTransform: "none", opacity: 0.75 }}>({new URL(signup).hostname})</span>
            </a>
          )}
        </div>

        <RsvpPanel event={e} lang={lang} onCounts={onCounts} />

        <footer style={{ marginTop: 32, paddingTop: 14, borderTop: `1px solid ${ACCENT}22`, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontFamily: "monospace", fontSize: 12, color: MUTED }}>
          <span>{en ? "Organised by" : "Organizator:"} {e.field.name} · {en ? k.en : k.sl}</span>
          <a href={report} className="ev-focus" style={{ color: MUTED }}>{en ? "Report this event" : "Prijavi neprimeren dogodek"}</a>
        </footer>

        {isAdmin && (
          <button type="button" className="ev-focus" style={{ ...btnOutline, marginTop: 16, minHeight: 32, fontSize: 9.5, opacity: 0.7 }}
            onClick={async () => {
              const nextHidden = adminState !== "hidden";
              try { await hide({ data: { masterPassword: getMasterPw(), id: e.id, hidden: nextHidden } }); setAdminState(nextHidden ? "hidden" : "shown"); }
              catch { setAdminState("error"); }
            }}>
            {adminState === "hidden" ? "ADMIN: unhide event (hidden now)" : adminState === "error" ? "ADMIN: failed, retry" : "ADMIN: hide event"}
          </button>
        )}
        {isAdmin && (
          <button type="button" className="ev-focus" style={{ ...btnOutline, marginTop: 16, marginLeft: 8, minHeight: 32, fontSize: 9.5, opacity: 0.7 }}
            onClick={async () => {
              if (!window.confirm("Remove this field's logo and outline image?")) return;
              try { await removeMedia({ data: { masterPassword: getMasterPw(), accountId: e.field.id } }); setMediaAdmin("done"); }
              catch { setMediaAdmin("error"); }
            }}>
            {mediaAdmin === "done" ? "ADMIN: field images removed" : mediaAdmin === "error" ? "ADMIN: failed, retry" : "ADMIN: remove field images"}
          </button>
        )}
        {mapOpen && e.field.mapUrl && <FieldMapViewer url={e.field.mapUrl} name={e.field.name} onClose={() => setMapOpen(false)} />}
      </div>
    </main>
  );
}
