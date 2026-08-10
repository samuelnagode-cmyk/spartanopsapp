import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "@/lib/i18n";

/**
 * Self-contained tactical feature showcase.
 * All styling is inline / scoped — nothing leaks into global CSS.
 */

const GOLD = "#FFB800";

type Tab = {
  id: string;
  tab: { en: string; sl: string };
  title: { en: string; sl: string };
  desc: { en: string; sl: string };
  images: string[];
  soon?: boolean;
};

const TABS: Tab[] = [
  {
    id: "domination",
    tab: { en: "Domination", sl: "Sektorji" },
    title: { en: "Domination Sectors", sl: "Domination Sektorji" },
    desc: {
      en: "Real-world tactical field control. Physical QR targets placed across the forest or field. Scan to capture, defend and hold, and generate real-time points for your faction.",
      sl: "Nadzor nad igro v realnem času. Fizične QR table so razporejene po poligonu/terenu. Skenirajte jih za prevzem, branite položaj in generirajte točke za svojo ekipo.",
    },
    images: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355389/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786203286218_36894f6b_1786203286437_a202ec79.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355381/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786354633574_ac1bab2f_1786354633674_8be57f8a.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355390/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786203144016_71aa04e1_1786203144150_9d56b15b.webp",
    ],
  },
  {
    id: "hud",
    tab: { en: "Player HUD", sl: "Pregled Igre" },
    title: { en: "Player HUD & Live Overview", sl: "Player HUD & Pregled Igre" },
    desc: {
      en: "Live operational telemetry in the palm of your hand. Track match timers, active faction points, and objective status without slowing down your advance.",
      sl: "Vpogled v stanje igre – kadarkoli in kjerkoli. Spremljajte časovne števce tekme, točke frakcij in stanje taktičnih ciljev in dodatnih funkcij.",
    },
    images: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355380/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786355203407_cd45f6b0_1786355203483_a44363c0.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355380/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786354921514_f2ba1793_1786354921591_bf1dc959.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355380/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786354859400_4337f100_1786354859894_070b83ea.webp",
    ],
  },
  {
    id: "respawn",
    tab: { en: "Respawn", sl: "Oživljanje" },
    title: { en: "Smart Respawn System", sl: "Pametni Respawn Sistem" },
    desc: {
      en: "Eliminate time cheating and human error. Players scan automated QR checkpoints at spawn zones to trigger precise cooldown countdowns straight to their device.",
      sl: "Odstranite goljufanje na spawnih in omogočite lažji nadzor nad časovniki v igri. Igralci skenirajo table z QR kodami na respawn conah, aplikacija pa sproži natančno odštevanje do respawna.",
    },
    images: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355383/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786353433561_f3d68779_1786353433689_a92770e0.webp",
    ],
  },
  {
    id: "identity",
    tab: { en: "Identity", sl: "Kartice" },
    title: { en: "Gear, Cards & Marshal Identity", sl: "Oprema, Kartice & Maršali" },
    desc: {
      en: "Seamlessly bridge physical gear with digital tracking. Scan specialized cards and patches to easily register and access the webapp.",
      sl: "Povežite fizično opremo z digitalnim svetom. Skenirajte specializirane kartice in patche za hitro registracijo in dostop do spletne strani.",
    },
    images: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355383/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786353114421_b94b2538_1786353114802_a4f5b99e.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355387/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786352410300_940e0913_1786352410704_d4b8c306.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355396/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786201484471_9dd88656_1786201484562_a80e36f8.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355395/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786201927717_e1f548c3_1786201927861_84515e37.webp",
    ],
  },
  {
    id: "sd",
    tab: { en: "Search & Destroy", sl: "Search & Destroy" },
    title: { en: "Search & Destroy", sl: "Search & Destroy" },
    desc: {
      en: "High-stakes bomb defusal scenarios. Plant bombs on different points via the bomb prop that you create yourself. Advancing airsoft mechanics to unmatched levels.",
      sl: "Scenariji za iskanje in aktivacijo bombe na različnih lokacijah.",
    },
    soon: true,
    images: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355392/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786202620582_a9007992_1786202620680_be688184.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786375854/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786375533793_79c378af_1786375533840_eef312d2.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786375853/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786375750837_8935df24_1786375751447_809c7f7a.webp",
    ],
  },
  {
    id: "expansions",
    tab: { en: "Expansions", sl: "Razširitve" },
    title: { en: "Tactical Expansions", sl: "Taktične Razširitve" },
    desc: {
      en: "Unlock strategic game variables. Interact with physical prop features like mystery boxes and secure intel suitcases.",
      sl: "Odklenite strateške dodatke znotraj igre. Integracija QR kod in fizičnih rekvizitov na terenu omogoča dodatke, kot so skrivnostne škatle (mystery box) in intel kovčki z obveščevalnimi podatki.",
    },
    soon: true,
    images: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355392/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786202542809_f2416ccf_1786202543017_cc4f2dd3.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355393/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786202363217_f0e11faf_1786202363285_fc4b408c.webp",
    ],
  },
];

export default function FeatureShowcase() {
  const { lang } = useLang();
  const en = lang === "en";
  const [active, setActive] = useState(0);
  const [slide, setSlide] = useState(0);
  const [fade, setFade] = useState(true);
  const tabsRef = useRef<HTMLDivElement | null>(null);

  const tab = TABS[active];

  useEffect(() => {
    setSlide(0);
    setFade(false);
    const id = window.setTimeout(() => setFade(true), 30);
    return () => window.clearTimeout(id);
  }, [active]);

  const pick = (i: number) => setActive(i);
  const go = (dir: number) =>
    setSlide((s) => (s + dir + tab.images.length) % tab.images.length);

  return (
    <div style={{ width: "100%", maxWidth: 980, margin: "0 auto" }}>
      {/* Tab bar */}
      <div
        ref={tabsRef}
        role="tablist"
        aria-label={en ? "Feature tabs" : "Zavihki funkcij"}
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          padding: "2px 2px 10px",
          scrollbarWidth: "none",
          justifyContent: "flex-start",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {TABS.map((tb, i) => {
          const on = i === active;
          return (
            <button
              key={tb.id}
              role="tab"
              aria-selected={on}
              type="button"
              onClick={() => pick(i)}
              style={{
                flex: "0 0 auto",
                cursor: "pointer",
                padding: "10px 14px",
                background: on ? "rgba(255,184,0,0.12)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${on ? GOLD : "rgba(255,184,0,0.22)"}`,
                color: on ? GOLD : "rgba(236,227,196,0.65)",
                fontFamily: "'Michroma', monospace",
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                transition: "all 220ms ease",
                boxShadow: on ? "0 0 18px -6px rgba(255,184,0,0.55)" : "none",
              }}
            >
              {en ? tb.tab.en : tb.tab.sl}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div
        style={{
          border: `1px solid rgba(255,184,0,0.28)`,
          background: "rgba(0,0,0,0.55)",
          padding: 0,
          opacity: fade ? 1 : 0,
          transform: fade ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 300ms ease, transform 300ms ease",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 0,
          }}
          className="so-fs-grid"
        >
          {/* Image area */}
          <div style={{ position: "relative", background: "#000", overflow: "hidden" }}>
            <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3" }}>
              {tab.images.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt={(en ? tab.title.en : tab.title.sl) + ` ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: i === slide ? 1 : 0,
                    transition: "opacity 500ms ease",
                  }}
                />
              ))}
              {tab.soon && (
                <span
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    padding: "5px 10px",
                    background: "rgba(0,0,0,0.7)",
                    border: "1px solid rgba(236,227,196,0.3)",
                    color: "rgba(236,227,196,0.72)",
                    fontFamily: "'Michroma', monospace",
                    fontSize: 9,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                  }}
                >
                  {en ? "Coming Soon" : "Prihaja kmalu"}
                </span>
              )}

              {tab.images.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label={en ? "Previous image" : "Prejšnja slika"}
                    onClick={() => go(-1)}
                    style={arrowStyle("left")}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={en ? "Next image" : "Naslednja slika"}
                    onClick={() => go(1)}
                    style={arrowStyle("right")}
                  >
                    <ChevronRight size={16} />
                  </button>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 10,
                      left: "50%",
                      transform: "translateX(-50%)",
                      display: "flex",
                      gap: 6,
                    }}
                  >
                    {tab.images.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`${i + 1}`}
                        onClick={() => setSlide(i)}
                        style={{
                          width: i === slide ? 18 : 6,
                          height: 6,
                          background: i === slide ? GOLD : "rgba(255,184,0,0.35)",
                          border: "none",
                          cursor: "pointer",
                          transition: "all 250ms ease",
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Copy area */}
          <div style={{ padding: "22px 20px 24px", textAlign: "left" }}>
            <p
              style={{
                fontFamily: "'Michroma', monospace",
                fontSize: 9,
                letterSpacing: "0.28em",
                color: GOLD,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              // {en ? tab.tab.en : tab.tab.sl}
            </p>
            <h3
              style={{
                fontFamily: "'Michroma', monospace",
                fontSize: "clamp(15px, 2.2vw, 19px)",
                letterSpacing: "0.06em",
                color: "#ece3c4",
                lineHeight: 1.35,
                marginBottom: 12,
              }}
            >
              {en ? tab.title.en : tab.title.sl}
            </h3>
            <p style={{ fontSize: 14, lineHeight: 1.75, color: "rgba(236,227,196,0.7)" }}>
              {en ? tab.desc.en : tab.desc.sl}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .so-fs-grid { grid-template-columns: 1.15fr 1fr !important; align-items: stretch; }
        }
      `}</style>
    </div>
  );
}

function arrowStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    [side]: 10,
    transform: "translateY(-50%)",
    width: 34,
    height: 34,
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,184,0,0.45)",
    color: GOLD,
    cursor: "pointer",
    transition: "background 200ms ease",
  } as React.CSSProperties;
}
