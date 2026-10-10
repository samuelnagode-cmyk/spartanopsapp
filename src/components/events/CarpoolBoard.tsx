import { ArrowUp, Car } from "lucide-react";
import type { RideGroup } from "@/lib/events-visibility";
import type { Lang } from "@/lib/events";
import { ACCENT, INK, MICHROMA, MUTED, PANEL } from "./ui";
import { ContactButtons } from "./ContactButtons";

export function CarpoolBoard({ rides, lang }: { rides: RideGroup[]; lang: Lang }) {
  const en = lang === "en";
  return (
    <section style={{ marginTop: 18, background: PANEL, border: `1px solid ${ACCENT}33`, padding: 14 }}>
      <h2 style={{ fontFamily: MICHROMA, fontSize: 11, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 8 }}>
        <Car size={15} /> {en ? "Car pool" : "Skupni prevoz"}
      </h2>
      {rides.length === 0 ? (
        <p style={{ fontFamily: "monospace", fontSize: 12.5, color: MUTED, display: "flex", alignItems: "center", gap: 6 }}>
          <ArrowUp size={14} color={ACCENT} /> {en ? "No rides yet. Be the first to offer one." : "Še ni prevozov. Bodi prvi, ki ga ponudi."}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rides.map((g) => (
            <div key={g.town} style={{ border: `1px solid ${g.match ? ACCENT : `${ACCENT}22`}`, padding: 10, background: "rgba(0,0,0,0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <strong style={{ fontFamily: "monospace", fontSize: 14, color: INK }}>{g.town}</strong>
                {g.match && <span style={{ background: ACCENT, color: "#0b0d09", fontFamily: MICHROMA, fontSize: 9, letterSpacing: "0.16em", padding: "2px 6px" }}>{en ? "MATCH" : "UJEMANJE"}</span>}
                {g.seatsOffered > 0 && <span style={{ fontFamily: "monospace", fontSize: 11.5, color: MUTED }}>{en ? `${g.seatsOffered} seats` : `${g.seatsOffered} mest`}</span>}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                {[...g.drivers.map((d) => ({ ...d, driver: true })), ...g.riders.map((r) => ({ ...r, driver: false }))].map((p) => (
                  <li key={p.key} style={{ fontFamily: "monospace", fontSize: 12.5, lineHeight: 1.5 }}>
                    <div><strong>{p.callsign}</strong> <span style={{ color: MUTED }}>({p.first_name})</span> · <span style={{ color: p.driver ? ACCENT : INK }}>{p.driver ? (en ? `drives, ${p.seats} free seats` : `vozi, prostih mest: ${p.seats}`) : (en ? "needs a ride" : "potrebuje prevoz")}</span></div>
                    {p.note && <div style={{ color: MUTED, wordBreak: "break-word" }}>{p.note}</div>}
                    {p.phone && <div style={{ marginTop: 6 }}><ContactButtons phone={p.phone} lang={lang} /></div>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
