import { useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarPlus, Share2 } from "lucide-react";
import { flagFor } from "@/lib/countries";
import {
  buildIcs, dateTileParts, formatTimeRange, googleCalendarUrl, kindInfo, shortDate, slugify, type IcsEvent, type Lang,
} from "@/lib/events";
import type { EventListItem } from "@/lib/events.functions";

export const BG = "#0b0d09";
export const PANEL = "#13160f";
export const ACCENT = "#E0B04E";
export const INK = "#ece3c4";
export const ERR = "#d97a6c";
export const OK = "#9eff3d";
export const MUTED = "rgba(236,227,196,0.62)";
export const MICHROMA = "'Michroma', monospace";

export const chipStyle = (active = false, color = ACCENT): CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", minHeight: 36, padding: "6px 12px",
  background: active ? `${ACCENT}22` : "rgba(0,0,0,0.3)", color: active ? ACCENT : INK,
  border: `1px solid ${active ? ACCENT : `${color === ACCENT ? ACCENT : color}44`}`, fontFamily: "monospace", fontSize: 12.5, cursor: "pointer",
});
export const smallChip: CSSProperties = { border: `1px solid ${ACCENT}33`, padding: "2px 7px", fontFamily: "monospace", fontSize: 11, color: INK, whiteSpace: "nowrap" };
export const btnPrimary: CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, padding: "10px 18px", background: ACCENT, color: BG,
  border: "none", fontFamily: MICHROMA, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer", textDecoration: "none",
};
export const btnOutline: CSSProperties = { ...btnPrimary, background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}` };

export function KindBadge({ kind, lang }: { kind: string; lang: Lang }) {
  const k = kindInfo(kind);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "monospace", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: k.color }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: k.color }} />
      {lang === "en" ? k.en : k.sl}
    </span>
  );
}

export function CancelledBadge({ lang }: { lang: Lang }) {
  return <span style={{ fontFamily: "monospace", fontSize: 10.5, letterSpacing: "0.12em", color: BG, background: ERR, padding: "1px 6px" }}>{lang === "en" ? "CANCELLED" : "ODPOVEDANO"}</span>;
}

export function DateTile({ iso, tz, kind, lang, size = "md" }: { iso: string; tz: string; kind: string; lang: Lang; size?: "md" | "lg" }) {
  const p = dateTileParts(iso, tz, lang);
  const c = kindInfo(kind).color;
  const lg = size === "lg";
  return (
    <div aria-hidden style={{ width: lg ? 84 : 62, flexShrink: 0, textAlign: "center", border: `1px solid ${c}66`, background: `${c.startsWith("#") ? c + "14" : "rgba(236,227,196,0.06)"}`, padding: lg ? "10px 4px" : "7px 2px", alignSelf: "flex-start" }}>
      <div style={{ fontFamily: "monospace", fontSize: lg ? 11 : 10, letterSpacing: "0.12em", color: c }}>{p.weekday}</div>
      <div style={{ fontFamily: MICHROMA, fontSize: lg ? 30 : 22, lineHeight: 1.2, color: INK }}>{p.day}</div>
      <div style={{ fontFamily: "monospace", fontSize: lg ? 11 : 10, letterSpacing: "0.12em", color: MUTED }}>{p.month}</div>
    </div>
  );
}

export function EventCard({ e, lang }: { e: EventListItem; lang: Lang }) {
  const cancelled = e.status === "cancelled";
  const en = lang === "en";
  return (
    <Link to="/events/$eventId" params={{ eventId: e.id }} className="event-card"
      style={{ display: "flex", gap: 14, padding: 14, background: PANEL, border: `1px solid ${ACCENT}33`, color: INK, textDecoration: "none", minHeight: 44 }}>
      <DateTile iso={e.starts_at} tz={e.tz} kind={e.kind} lang={lang} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
          <KindBadge kind={e.kind} lang={lang} />
          {cancelled && <CancelledBadge lang={lang} />}
        </div>
        <h3 style={{ fontFamily: MICHROMA, fontSize: 14, lineHeight: 1.4, letterSpacing: "0.04em", margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textDecoration: cancelled ? "line-through" : "none", opacity: cancelled ? 0.65 : 1 }}>
          {e.title}
        </h3>
        <p style={{ fontFamily: "monospace", fontSize: 12, color: MUTED, margin: "5px 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {e.field.country ? `${flagFor(e.field.country)} ` : ""}{e.field.name}{e.field.city ? ` · ${e.field.city}` : ""}
        </p>
        <p style={{ fontFamily: "monospace", fontSize: 12, margin: "0 0 6px" }}>{formatTimeRange(e.starts_at, e.ends_at, e.tz)}</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {e.price_text && <span style={smallChip}>{e.price_text}</span>}
          {e.min_age && <span style={smallChip}>min. {e.min_age}</span>}
          {e.capacity && <span style={smallChip}>{e.capacity} {en ? "spots" : "mest"}</span>}
          {/* STEP 3: going count and car pool seats */}
        </div>
      </div>
    </Link>
  );
}

export function SkeletonCard() {
  return <div className="event-skeleton" style={{ height: 120, background: PANEL, border: `1px solid ${ACCENT}1f` }} />;
}

/** Card styles: hover/focus and the skeleton pulse, with reduced-motion respected. */
export function EventStyles() {
  return (
    <style>{`
      .event-card { transition: border-color .15s ease; }
      .event-card:hover { border-color: ${ACCENT}aa !important; }
      .event-card:focus-visible, .ev-focus:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; }
      .event-skeleton { animation: evpulse 1.4s ease-in-out infinite; }
      @keyframes evpulse { 0%,100% { opacity: .55 } 50% { opacity: .9 } }
      .ev-chips { scrollbar-width: none; } .ev-chips::-webkit-scrollbar { display: none; }
      @media (prefers-reduced-motion: reduce) { .event-card, .event-skeleton { transition: none; animation: none; } }
    `}</style>
  );
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AddToCalendar({ event, lang }: { event: IcsEvent; lang: Lang }) {
  const [open, setOpen] = useState(false);
  const en = lang === "en";
  const item: CSSProperties = { display: "block", width: "100%", textAlign: "left", padding: "12px 14px", background: "transparent", color: INK, border: "none", borderTop: `1px solid ${ACCENT}22`, fontFamily: "monospace", fontSize: 13, cursor: "pointer", textDecoration: "none" };
  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="ev-focus" style={btnOutline} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <CalendarPlus size={15} /> {en ? "Add to calendar" : "Dodaj v koledar"}
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", zIndex: 30, top: "calc(100% + 4px)", left: 0, minWidth: 220, background: PANEL, border: `1px solid ${ACCENT}66` }}>
          <a role="menuitem" className="ev-focus" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" style={{ ...item, borderTop: "none" }} onClick={() => setOpen(false)}>Google Calendar</a>
          <button role="menuitem" type="button" className="ev-focus" style={item}
            onClick={() => { download(`${slugify(event.title)}.ics`, buildIcs([event]), "text/calendar;charset=utf-8"); setOpen(false); }}>
            Apple / Outlook (.ics)
          </button>
        </div>
      )}
    </div>
  );
}

export function ShareButton({ url, title, text, lang, style }: { url: string; title: string; text: string; lang: Lang; style?: CSSProperties }) {
  const [copied, setCopied] = useState(false);
  const en = lang === "en";
  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title, text, url }); return; } catch (e) { if ((e as Error)?.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch { /* ignore */ }
  };
  return (
    <button type="button" className="ev-focus" style={style ?? btnOutline} onClick={share}>
      <Share2 size={15} /> {copied ? (en ? "Link copied" : "Povezava kopirana") : (en ? "Share" : "Deli")}
    </button>
  );
}

export function shareLine(e: { title: string; starts_at: string; tz: string; kind: string; field: { name: string } }, lang: Lang): string {
  const k = kindInfo(e.kind);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: e.tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(e.starts_at));
  return `${shortDate(e.starts_at, e.tz, lang)} · ${time} · ${e.field.name} — ${e.title} (${lang === "en" ? k.en : k.sl})`;
}
