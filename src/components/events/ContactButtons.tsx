import type { CSSProperties } from "react";
import { MessageCircle, Phone } from "lucide-react";
import { ACCENT, MICHROMA } from "./ui";
import type { Lang } from "@/lib/events";

const btn: CSSProperties = {
  minHeight: 44, minWidth: 44, padding: "0 12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  border: `1px solid ${ACCENT}88`, color: ACCENT, background: "transparent", fontFamily: MICHROMA, fontSize: 9.5,
  letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none",
};

/** Call / Viber / WhatsApp for a phone the server already decided is visible. */
export function ContactButtons({ phone, lang }: { phone: string | null; lang: Lang }) {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <a href={`tel:${phone}`} className="ev-focus" style={btn}><Phone size={14} />{lang === "en" ? "Call" : "Pokliči"}</a>
      <a href={`viber://chat?number=%2B${digits}`} className="ev-focus" style={btn}><MessageCircle size={14} />Viber</a>
      <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="ev-focus" style={btn}><MessageCircle size={14} />WhatsApp</a>
    </div>
  );
}
