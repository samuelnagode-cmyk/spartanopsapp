import { Link } from "@tanstack/react-router";
import { Phone, Mail, MapPin } from "lucide-react";
import { useLang } from "@/lib/i18n";

export default function GlampingCTA() {
  const { lang } = useLang();
  const en = lang === "en";

  const primary =
    "inline-flex items-center justify-center font-accent transition-all duration-200 rounded-full hover:scale-[1.02]";
  const secondary =
    "inline-flex items-center justify-center font-accent transition-all duration-200 rounded-full";

  return (
    <section
      className="px-6"
      style={{
        background: "#1E3F20",
        paddingTop: "clamp(64px, 8vw, 80px)",
        paddingBottom: "clamp(64px, 8vw, 80px)",
      }}
      aria-label={en ? "Booking" : "Rezervacija"}
    >
      <div className="max-w-[720px] mx-auto text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <span
            className="block h-px w-6"
            style={{ backgroundColor: "rgba(250, 246, 236, 0.5)" }}
          />
          <span
            className="font-accent"
            style={{
              color: "#FAF6EC",
              fontSize: 11,
              letterSpacing: "2.5px",
              fontWeight: 500,
              textTransform: "uppercase",
            }}
          >
            {en ? "Booking" : "Rezervacija"}
          </span>
          <span
            className="block h-px w-6"
            style={{ backgroundColor: "rgba(250, 246, 236, 0.5)" }}
          />
        </div>

        <h2
          className="font-display"
          style={{
            color: "#FAF6EC",
            fontWeight: 500,
            fontSize: "clamp(26px, 4vw, 32px)",
            marginBottom: 16,
          }}
        >
          {en ? "Ready for your escape?" : "Pripravljeni na svoj odmik?"}
        </h2>
        <p
          style={{
            color: "rgba(250, 246, 236, 0.8)",
            fontSize: "clamp(15px, 1.4vw, 16px)",
            marginBottom: 40,
          }}
        >
          {en
            ? "Write to us or book directly — no middlemen."
            : "Pišite nam ali rezervirajte neposredno — brez posrednikov."}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <a
              href="/rezervacije"
            className={primary}
            style={{
              background: "#FAF6EC",
              color: "#1E3F20",
              padding: "14px 28px",
              fontSize: 15,
              fontWeight: 500,
              maxWidth: 280,
              width: "100%",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#FFFFFF")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FAF6EC")}
          >
            {en ? "Book your stay →" : "Rezerviraj oddih →"}
          </a>
          <a
              href="/rezervacije"
            className={secondary}
            style={{
              background: "transparent",
              color: "#FAF6EC",
              border: "1px solid rgba(250, 246, 236, 0.6)",
              padding: "14px 28px",
              fontSize: 15,
              fontWeight: 500,
              maxWidth: 280,
              width: "100%",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(250, 246, 236, 1)";
              e.currentTarget.style.background = "rgba(250, 246, 236, 0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(250, 246, 236, 0.6)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            {en ? "Send an inquiry" : "Pošlji povpraševanje"}
          </a>
        </div>

        <div
          className="mt-8 flex flex-col md:flex-row md:flex-wrap items-center justify-center gap-y-2 md:gap-x-4"
          style={{ color: "rgba(250, 246, 236, 0.75)", fontSize: 14 }}
        >
          <a
            href="tel:+38670761455"
            className="inline-flex items-center gap-2 hover:underline"
          >
            <Phone size={16} strokeWidth={1.6} /> 070 761 455
          </a>
          <span aria-hidden="true" className="hidden md:inline">·</span>
          <a
            href="mailto:info@glampingzeleniraj.si"
            className="inline-flex items-center gap-2 hover:underline"
          >
            <Mail size={16} strokeWidth={1.6} /> info@glampingzeleniraj.si
          </a>
          <span
            aria-hidden="true"
            className="hidden md:block w-full"
            style={{ height: 0 }}
          />
          <span className="inline-flex items-center gap-2">
            <MapPin size={16} strokeWidth={1.6} /> Vače 49, 1252 Vače
          </span>
        </div>
      </div>
    </section>
  );
}
