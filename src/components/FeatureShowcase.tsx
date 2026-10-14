import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "@/lib/i18n";

/**
 * Self-contained tactical feature showcase.
 * All styling is inline / scoped — nothing leaks into global CSS.
 *
 * FUTURE-PROOFING: to add a new game mode / expansion, simply append a new
 * object to the TABS array below. The tab bar is a horizontal scroll-snap
 * slider, so any number of tabs renders without breaking the layout.
 */

const GOLD = "#FFB800";

type L = { en: string; sl: string };

type Tab = {
  id: string;
  tab: L;
  lead: L;
  detail: L;
  alt: L;
  images: string[];
  soon?: boolean;
  hidden?: boolean;
};

const ALL_TABS: Tab[] = [
  {
    id: "domination",
    tab: { en: "Domination", sl: "Domination" },
    lead: {
      en: "One plate per sector. Scan it to capture the sector for your team.",
      sl: "Ena plošča na sektor. Skeniraj jo in sektor je vaš.",
    },
    detail: {
      en: "Points keep adding up while your team holds it, and the score updates live on every phone.",
      sl: "Točke se seštevajo, dokler ga ekipa drži, rezultat pa se v živo posodablja na vsakem telefonu.",
    },
    alt: {
      en: "A printed Domination sector plate with a QR code, hung on a tree",
      sl: "Natisnjena plošča sektorja z QR kodo, obešena na drevo",
    },
    images: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355389/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786203286218_36894f6b_1786203286437_a202ec79.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355381/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786354633574_ac1bab2f_1786354633674_8be57f8a.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355390/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786203144016_71aa04e1_1786203144150_9d56b15b.webp",
    ],
  },
  {
    id: "hud",
    tab: { en: "Player HUD", sl: "HUD" },
    lead: {
      en: "The whole game on your phone: score, timers and who holds which sector.",
      sl: "Cela igra na telefonu: rezultat, časovniki in kdo drži kateri sektor.",
    },
    detail: {
      en: "Every capture is logged in the event history. It opens in the browser, so there is nothing to install.",
      sl: "Vsak zavzem se zabeleži v zgodovini dogodkov. Odpre se v brskalniku, namestitev ni potrebna.",
    },
    alt: {
      en: "A player checking the game on a phone in the forest",
      sl: "Igralec v gozdu spremlja igro na telefonu",
    },
    images: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355380/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786355203407_cd45f6b0_1786355203483_a44363c0.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355380/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786354921514_f2ba1793_1786354921591_bf1dc959.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355380/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786354859400_4337f100_1786354859894_070b83ea.webp",
    ],
  },
  {
    id: "respawn",
    tab: { en: "Respawn", sl: "Respawn" },
    lead: {
      en: "Hit? Walk to your respawn zone and scan the banner.",
      sl: "Zadet? Pojdi v respawn cono in skeniraj baner.",
    },
    detail: {
      en: "Your phone counts down the wait, so there is no stopwatch and nothing to argue about. The marshal sets a fixed or a growing respawn time.",
      sl: "Telefon odšteva čakanje, zato štoparica in prepiri niso potrebni. Maršal nastavi fiksen ali naraščajoč čas respawna.",
    },
    alt: {
      en: "A player scanning the respawn banner and seeing the countdown on the phone",
      sl: "Igralec skenira respawn baner in na telefonu vidi odštevanje",
    },
    images: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355383/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786353433561_f3d68779_1786353433689_a92770e0.webp",
    ],
  },
  {
    // Hidden: the card/patch claims are not true today. Old text kept as-is.
    id: "identity",
    hidden: true,
    tab: { en: "Access", sl: "Oprema" },
    lead: {
      en: "Additions for in-match simplicity",
      sl: "Dodatki za navigiranje",
    },
    detail: {
      en: "Seamlessly bridge physical gear with digital tracking. Scan specialized cards and patches to easily register and access the webapp.",
      sl: "Povežite fizično opremo z digitalnim svetom. Skenirajte specializirane kartice in patche za hitro registracijo in dostop do spletne strani.",
    },
    alt: { en: "Quick and easy", sl: "Dostop" },
    images: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355383/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786353114421_b94b2538_1786353114802_a4f5b99e.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355387/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786352410300_940e0913_1786352410704_d4b8c306.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355396/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786201484471_9dd88656_1786201484562_a80e36f8.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355395/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786201927717_e1f548c3_1786201927861_84515e37.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786448093/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786448052924_7f40bda3_1786448052980_244f08ec.webp",
    ],
  },
  {
    id: "sd",
    tab: { en: "Search & Destroy", sl: "Search & Destroy" },
    lead: {
      en: "Carry the bomb to a site and scan both codes to plant it.",
      sl: "Odnesi bombo na točko in skeniraj obe kodi, da jo aktiviraš.",
    },
    detail: {
      en: "The bomb is a printed code you strap to a suitcase, so there are no props to buy.",
      sl: "Bomba je natisnjena koda, ki jo pritrdiš na kovček. Rekvizitov ni treba kupovati.",
    },
    alt: {
      en: "A Search & Destroy bomb site plate with a QR code",
      sl: "Plošča bombne točke z QR kodo",
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
    tab: { en: "More modes", sl: "Več načinov" },
    lead: {
      en: "Mystery boxes, intel suitcases and King of the Hill are in the works.",
      sl: "Skrivnostne skrinje, obveščevalni kovčki in King of the Hill so v pripravi.",
    },
    detail: {
      en: "The idea stays the same: print a plate, place it, players scan it.",
      sl: "Ideja ostaja ista: natisni ploščo, jo postavi, igralci jo skenirajo.",
    },
    alt: {
      en: "A Mystery Box plate with a QR code",
      sl: "Plošča Mystery Box z QR kodo",
    },
    soon: true,
    images: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355392/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786202542809_f2416ccf_1786202543017_cc4f2dd3.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1786355393/SpartanOps%20app%20v1.0/PROMO%20AI%20IMAGES/SLOVENIAN/openart-image_1786202363217_f0e11faf_1786202363285_fc4b408c.webp",
    ],
  },
];

const TABS: Tab[] = ALL_TABS.filter((t) => !t.hidden);

export default function FeatureShowcase() {
  const { lang } = useLang();
  const en = lang === "en";
  const [active, setActive] = useState(0);
  const [slide, setSlide] = useState(0);
  const [fade, setFade] = useState(true);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const tab = TABS[active];

  const updateEdges = () => {
    const el = tabsRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  };

  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, []);

  useEffect(() => {
    setSlide(0);
    setFade(false);
    const id = window.setTimeout(() => setFade(true), 30);
    btnRefs.current[active]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
    return () => window.clearTimeout(id);
  }, [active]);

  const pick = (i: number) => setActive(i);
  const go = (dir: number) =>
    setSlide((s) => (s + dir + tab.images.length) % tab.images.length);

  return (
    <div style={{ width: "100%", maxWidth: 980, margin: "0 auto" }}>
      {/* Tab bar — horizontal tactical slider */}
      <div className={`so-fs-tabwrap${atStart ? " at-start" : ""}${atEnd ? " at-end" : ""}`}>
        <div
          ref={tabsRef}
          role="tablist"
          aria-label={en ? "Feature tabs" : "Zavihki funkcij"}
          className="so-fs-tabs"
          onScroll={updateEdges}
        >
          {TABS.map((tb, i) => {
            const on = i === active;
            return (
              <button
                key={tb.id}
                ref={(el) => {
                  btnRefs.current[i] = el;
                }}
                role="tab"
                id={`so-fs-tab-${tb.id}`}
                aria-selected={on}
                type="button"
                onClick={() => pick(i)}
                className="fs-tab"
                style={{
                  cursor: "pointer",
                  background: on ? "rgba(255,184,0,0.12)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${on ? GOLD : "rgba(255,184,0,0.22)"}`,
                  color: on ? GOLD : "rgba(236,227,196,0.65)",
                  fontFamily: "'Michroma', monospace",
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
      </div>

      {/* Panel */}
      <div
        role="tabpanel"
        aria-labelledby={`so-fs-tab-${tab.id}`}
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
                  alt={
                    (en ? tab.alt.en : tab.alt.sl) +
                    (tab.images.length > 1
                      ? en
                        ? ` (${i + 1} of ${tab.images.length})`
                        : ` (${i + 1} od ${tab.images.length})`
                      : "")
                  }
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
          <div className="so-fs-copy" style={{ padding: "22px 20px 24px", textAlign: "left" }}>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(236,227,196,0.7)", margin: 0 }}>
              <span style={{ color: "#ece3c4", fontSize: 15 }}>
                {en ? tab.lead.en : tab.lead.sl}
              </span>{" "}
              {en ? tab.detail.en : tab.detail.sl}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .so-fs-tabwrap { position: relative; }
        .so-fs-tabwrap::before,
        .so-fs-tabwrap::after {
          content: "";
          position: absolute;
          top: 0;
          width: 56px; height: 100%;
          pointer-events: none;
          opacity: 1;
          transition: opacity 220ms ease;
        }
        .so-fs-tabwrap::before {
          left: 0;
          background: linear-gradient(to right, rgba(0,0,0,0.95), rgba(0,0,0,0));
        }
        .so-fs-tabwrap::after {
          right: 0;
          background: linear-gradient(to left, rgba(0,0,0,0.95), rgba(0,0,0,0));
        }
        .so-fs-tabwrap.at-start::before { opacity: 0; }
        .so-fs-tabwrap.at-end::after { opacity: 0; }
        .so-fs-tabs {
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          gap: 6px;
          overflow-x: auto;
          white-space: nowrap;
          scroll-behavior: smooth;
          scroll-snap-type: x proximity;
          scroll-padding-inline: 8px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          padding: 2px 2px 10px;
        }
        .so-fs-tabs::-webkit-scrollbar { display: none; }
        .so-fs-copy { min-height: 160px; }
        .fs-tab {
          flex: 0 0 auto;
          scroll-snap-align: center;
          padding: 10px 14px;
          font-size: 9px;
          letter-spacing: 0.12em;
        }
        @media (min-width: 900px) {
          .so-fs-grid { grid-template-columns: 1.15fr 1fr !important; align-items: stretch; }
          .fs-tab { font-size: 10px; letter-spacing: 0.16em; }
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
