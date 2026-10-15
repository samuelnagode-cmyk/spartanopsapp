import type { CSSProperties } from "react";
import { MessageCircle, MessageSquare, Phone } from "lucide-react";
import { ACCENT, MICHROMA } from "./ui";
import type { Lang } from "@/lib/events";
import { methodsOrDefault, type ContactMethod } from "@/lib/player-validation";

const row: CSSProperties = { display: "flex", flexWrap: "nowrap", gap: 6, width: "100%" };
const btn: CSSProperties = {
  flex: "1 1 0", minWidth: 0, maxWidth: 150, minHeight: 44, padding: "4px 4px",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
  border: `1px solid ${ACCENT}88`, color: ACCENT, background: "transparent", fontFamily: MICHROMA, fontSize: 9,
  letterSpacing: "0.06em", whiteSpace: "nowrap", textTransform: "uppercase", textDecoration: "none", boxSizing: "border-box",
};

export type ContactLink = { method: ContactMethod; href: string; label: string; external: boolean };

/** Chosen methods only, fixed order call, sms, viber, whatsapp; null/empty means the default three. */
export function contactLinks(phone: string, methods: ContactMethod[] | null | undefined, lang: Lang): ContactLink[] {
  const digits = phone.replace(/[^0-9]/g, "");
  const all: Record<ContactMethod, ContactLink> = {
    call: { method: "call", href: `tel:${phone}`, label: lang === "en" ? "Call" : "Pokliči", external: false },
    sms: { method: "sms", href: `sms:${phone}`, label: "SMS", external: false },
    viber: { method: "viber", href: `viber://chat?number=%2B${digits}`, label: "Viber", external: false },
    whatsapp: { method: "whatsapp", href: `https://wa.me/${digits}`, label: "WhatsApp", external: true },
  };
  return methodsOrDefault(methods).map((m) => all[m]);
}

const ICON = { call: Phone, sms: MessageSquare, viber: MessageCircle, whatsapp: MessageCircle } as const;

/** Contact buttons for a phone the server already decided is visible. Always one row. */
export function ContactButtons({ phone, lang, methods }: { phone: string | null; lang: Lang; methods?: ContactMethod[] | null }) {
  if (!phone) return null;
  return (
    <div style={row} data-contact-row>
      {contactLinks(phone, methods, lang).map((l) => {
        const Icon = ICON[l.method];
        return (
          <a key={l.method} href={l.href} aria-label={l.label} className="ev-focus" style={btn}
            {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            <Icon size={14} aria-hidden />
            <span>{l.label}</span>
          </a>
        );
      })}
    </div>
  );
}
