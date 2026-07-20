import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lokacija")({
  head: () => ({
    meta: [
      { title: "Lokacija in dostop — Airsoft poligon Zeleni raj" },
      {
        name: "description",
        content:
          "Lokacija airsoft poligona Zeleni raj v vasi Vače nad Litijo. Navodila za parkiranje in dostop.",
      },
    ],
    links: [{ rel: "canonical", href: "https://glampingzeleniraj.si/lokacija" }],
  }),
  component: AirsoftLokacijaPage,
});

const ACCENT = "#a8954f";
const BG = "#11140f";
const INK = "#ece3c4";

function AirsoftLokacijaPage() {
  return (
    <div style={{ background: "#1b2211", color: INK, minHeight: "100vh", paddingTop: 96 }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Header */}
        <div className="text-center mb-8 md:mb-10">
          <p
            className="font-mono uppercase"
            style={{
              fontSize: 11,
              letterSpacing: "0.32em",
              color: ACCENT,
              marginBottom: 10,
            }}
          >
            Tactical Briefing
          </p>
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(24px, 4.6vw, 38px)",
              fontWeight: 600,
              letterSpacing: "0.01em",
              lineHeight: 1.15,
              color: INK,
            }}
          >
            LOKACIJA IN DOSTOP: POLIGON ZELENI RAJ
          </h1>
          <div style={{ width: 56, height: 1, background: ACCENT, margin: "18px auto 0" }} />
        </div>

        {/* Map */}
        <div
          className="rounded-xl overflow-hidden mb-3"
          style={{
            border: `1px solid ${ACCENT}33`,
            background: "#1a1f17",
          }}
        >
          <div style={{ aspectRatio: "16 / 9" }}>
            <iframe
              title="Glamping Zeleni Raj — Vače"
              src="https://maps.google.com/maps?q=Glamping+Zeleni+Raj+Va%C4%8De&t=m&z=15&output=embed&iwloc=near"
              width="100%"
              height="100%"
              style={{ border: 0, display: "block", filter: "grayscale(0.15) contrast(1.05)" }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>

        {/* Discrete Google Maps link — directly under the map */}
        <div className="text-center mb-8 md:mb-10">
          <a
            href="https://www.google.com/maps/search/?api=1&query=Glamping+Zeleni+Raj+Va%C4%8De"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] tracking-[0.16em] uppercase underline underline-offset-4 transition-colors"
            style={{ color: "rgba(236,227,196,0.55)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = ACCENT)}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(236,227,196,0.55)")}
          >
            Odpri v Google Zemljevidih ↗
          </a>
        </div>


        {/* Briefing cards */}
        <div className="grid md:grid-cols-2 gap-5 md:gap-6 mb-10">
          <article
            className="rounded-xl p-6 md:p-7"
            style={{ background: "#18191a", border: "1px solid #2a2c2a" }}
          >
            <h2
              className="font-mono uppercase mb-5"
              style={{ fontSize: 13, letterSpacing: "0.18em", color: ACCENT }}
            >
              📍 LOKACIJA POLIGONA
            </h2>
            <dl className="space-y-3 text-[14px] leading-[1.7]">
              <div>
                <dt className="font-mono uppercase text-[11px] tracking-wider" style={{ color: "rgba(236,227,196,0.55)" }}>
                  Kompleks
                </dt>
                <dd style={{ color: INK }}>
                  <strong>Glamping Zeleni raj</strong> (vrisano v Google Zemljevidih)
                </dd>
              </div>
              <div>
                <dt className="font-mono uppercase text-[11px] tracking-wider" style={{ color: "rgba(236,227,196,0.55)" }}>
                  Lokacija
                </dt>
                <dd style={{ color: INK }}>
                  <strong>100 metrov</strong> naprej od naslova Vače 49
                </dd>
              </div>
              <div>
                <dt className="font-mono uppercase text-[11px] tracking-wider" style={{ color: "rgba(236,227,196,0.55)" }}>
                  Oddaljenosti poligona od mest
                </dt>
                <dd style={{ color: INK }}>
                  <strong>Ljubljana</strong> 50 minut · <strong>Domžale</strong> 30 minut · <strong>Moravče</strong> 30 minut · <strong>Celje</strong> 40 minut
                </dd>
              </div>
            </dl>
          </article>

          <article
            className="rounded-xl p-6 md:p-7"
            style={{ background: "#18191a", border: "1px solid #2a2c2a" }}
          >
            <h2
              className="font-mono uppercase mb-5"
              style={{ fontSize: 13, letterSpacing: "0.18em", color: ACCENT }}
            >
              🚗 PROTOKOL PARKIRANJA
            </h2>
            <ul className="space-y-3.5 text-[14px] leading-[1.7]" style={{ color: INK }}>
              <li>
                <span className="font-mono uppercase text-[11px] tracking-wider block" style={{ color: "rgba(236,227,196,0.55)" }}>
                  Organizatorji
                </span>
                <strong>2 namenski mesti</strong> neposredno pri piknik prostoru.
              </li>
              <li>
                <span className="font-mono uppercase text-[11px] tracking-wider block" style={{ color: "rgba(236,227,196,0.55)" }}>
                  Igralci (glavno parkirišče)
                </span>
                Urejeno parkirišče <strong>50 metrov naprej</strong> od piknik prostora.
              </li>
              <li>
                <span className="font-mono uppercase text-[11px] tracking-wider block" style={{ color: "rgba(236,227,196,0.55)" }}>
                  Večja udeležba
                </span>
                Možnost parkiranja neposredno <strong>pred hišo Vače 49</strong>.
              </li>
            </ul>
          </article>
        </div>


      </div>
    </div>
  );
}
