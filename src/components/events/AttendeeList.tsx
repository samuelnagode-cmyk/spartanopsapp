import { useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import type { AttendeeView } from "@/lib/events-visibility";
import type { Lang } from "@/lib/events";
import { ExperienceBadge, type ExperienceLevel } from "@/components/ExperienceBadge";
import { ACCENT, INK, MICHROMA, MUTED, PANEL, btnPrimary, smallChip } from "./ui";
import { ContactButtons } from "./ContactButtons";

const h2 = { fontFamily: MICHROMA, fontSize: 11, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase" as const, margin: "0 0 10px" };

function colourFor(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 38%)`;
}

function Card({ a, lang, organiser }: { a: AttendeeView; lang: Lang; organiser: boolean }) {
  const [open, setOpen] = useState(false);
  const en = lang === "en";
  const name = a.last_name ? `${a.first_name} ${a.last_name}` : `${a.first_name}${a.last_initial ? ` ${a.last_initial}` : ""}`;
  const loadout = [a.primary_weapon, a.secondary_weapon, a.sidearm].filter(Boolean) as string[];
  const hasMore = loadout.length > 0 || !!a.gear_notes;
  return (
    <li style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${a.self ? ACCENT : `${ACCENT}22`}`, padding: 10 }}>
      <button type="button" className="ev-focus" aria-expanded={open} onClick={() => hasMore && setOpen((v) => !v)}
        style={{ display: "flex", gap: 10, alignItems: "center", width: "100%", background: "none", border: "none", color: INK, textAlign: "left", padding: 0, cursor: hasMore ? "pointer" : "default", minHeight: 44 }}>
        <span aria-hidden style={{ width: 36, height: 36, borderRadius: "50%", background: colourFor(a.callsign), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MICHROMA, fontSize: 13, flexShrink: 0, color: INK }}>
          {a.callsign.charAt(0).toUpperCase()}
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ fontFamily: "monospace", fontSize: 14, display: "block", wordBreak: "break-word" }}>{a.callsign}{a.self && <span style={{ color: ACCENT, fontWeight: 400 }}> · {en ? "you" : "ti"}</span>}</strong>
          <span style={{ fontFamily: "monospace", fontSize: 12, color: MUTED }}>{name}</span>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>
            <ExperienceBadge level={a.experience_level as ExperienceLevel} size={12} color={ACCENT} />
            {a.operator_type && <span style={smallChip}>{a.operator_type}</span>}
            {a.club && <span style={smallChip}>{a.club}</span>}
          </span>
        </span>
        {hasMore && <ChevronDown size={16} color={ACCENT} style={{ transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }} />}
      </button>
      {open && (
        <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, marginTop: 8, paddingLeft: 46, color: INK }}>
          {loadout.map((l) => <div key={l}>· {l}</div>)}
          {a.gear_notes && <div style={{ color: MUTED }}>{a.gear_notes}</div>}
        </div>
      )}
      {a.phone && !a.self && (
        <div style={{ marginTop: 8, paddingLeft: 46 }}>
          {organiser && <div style={{ fontFamily: "monospace", fontSize: 12, marginBottom: 6 }}>{a.phone}</div>}
          <ContactButtons phone={a.phone} lang={lang} />
        </div>
      )}
    </li>
  );
}

export function AttendeeList({ attendees, organiser, going, maybe, lang }: { attendees: AttendeeView[]; organiser: boolean; going: number; maybe: number; lang: Lang }) {
  const en = lang === "en";
  const [showMaybe, setShowMaybe] = useState(false);
  const g = attendees.filter((a) => a.status === "going");
  const m = attendees.filter((a) => a.status === "maybe");
  return (
    <section style={{ marginTop: 18, background: PANEL, border: `1px solid ${ACCENT}33`, padding: "14px 14px" }}>
      {organiser && (
        <div style={{ background: `${ACCENT}1a`, border: `1px solid ${ACCENT}55`, padding: "8px 10px", marginBottom: 12, fontFamily: "monospace", fontSize: 12 }}>
          <strong style={{ color: ACCENT }}>{en ? "Organiser view" : "Pogled organizatorja"}</strong> · {en ? `${going} going · ${maybe} maybe` : `${going} pride · ${maybe} morda`}
        </div>
      )}
      <h2 style={h2}>{en ? "Who is going" : "Kdo pride"} ({g.length})</h2>
      {g.length === 0 ? <p style={{ fontFamily: "monospace", fontSize: 12.5, color: MUTED }}>{en ? "Nobody yet." : "Še nihče."}</p> : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>{g.map((a) => <Card key={a.key} a={a} lang={lang} organiser={organiser} />)}</ul>
      )}
      {m.length > 0 && (
        <>
          <button type="button" className="ev-focus" aria-expanded={showMaybe} onClick={() => setShowMaybe((v) => !v)}
            style={{ marginTop: 12, minHeight: 44, background: "none", border: "none", color: ACCENT, fontFamily: MICHROMA, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
            {en ? "Maybe" : "Morda"} ({m.length}) <ChevronDown size={14} style={{ transform: showMaybe ? "rotate(180deg)" : "none" }} />
          </button>
          {showMaybe && <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>{m.map((a) => <Card key={a.key} a={a} lang={lang} organiser={organiser} />)}</ul>}
        </>
      )}
    </section>
  );
}

/** Signed-out teaser: decorative placeholders only, no data. */
export function LockedAttendees({ lang, onSignIn }: { lang: Lang; onSignIn: () => void }) {
  const en = lang === "en";
  return (
    <section style={{ marginTop: 18, background: PANEL, border: `1px solid ${ACCENT}33`, padding: 14, position: "relative", overflow: "hidden" }}>
      <h2 style={h2}>{en ? "Who is going" : "Kdo pride"}</h2>
      <div aria-hidden style={{ display: "grid", gap: 8, filter: "blur(3px)", opacity: 0.35 }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ height: 48, background: `${ACCENT}22` }} />)}
      </div>
      <div style={{ position: "absolute", inset: "40px 0 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 12, textAlign: "center" }}>
        <Lock size={18} color={ACCENT} />
        <p style={{ fontFamily: "monospace", fontSize: 13 }}>{en ? "Sign in to see who is going." : "Prijavi se, da vidiš, kdo pride."}</p>
        <button type="button" className="ev-focus" style={btnPrimary} onClick={onSignIn}>{en ? "Sign in" : "Prijava"}</button>
      </div>
    </section>
  );
}
