import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT, useLang } from "@/lib/i18n";

type Review = {
  sl: string;
  en: string;
  author: { sl: string; en: string };
  score: string;
};

const reviews: Review[] = [
  {
    sl: "Čudovit kraj, super čist, tih. Zelo prijazno in ustrežljivo osebje. Imela sem se čudovito.",
    en: "A wonderful place, beautifully clean and quiet. Very kind and attentive hosts. I had a lovely time.",
    author: { sl: "Susannah, Francija", en: "Susannah, France" },
    score: "10/10",
  },
  {
    sl: "Soba je bila res lepa in prijetna. Gostitelj je bil zelo ustrežljiv in prijazen.",
    en: "The room was truly lovely and welcoming. The host was very attentive and kind.",
    author: { sl: "Andrada, Velika Britanija", en: "Andrada, United Kingdom" },
    score: "9.0/10",
  },
  {
    sl: "Kabina sama je bila nova in dobro izolirana. Imela je udobno posteljo in električni kamin. Gostitelj, Samuel, je bil izjemno ustrežljiv.",
    en: "The cabin itself was new and well insulated. It had a comfortable bed and an electric fireplace. The host, Samuel, was exceptionally helpful.",
    author: { sl: "Thomas, Avstralija", en: "Thomas, Australia" },
    score: "10/10",
  },
  {
    sl: "Nastanitev je bila zelo čista, z odlično lokacijo sredi gozda. Skupna kuhinja je dobro opremljena in celoten kraj je čarobno edinstven in prijeten.",
    en: "The accommodation was very clean, with a great location in the middle of the forest. The shared kitchen is well equipped and the whole place is magically unique and welcoming.",
    author: { sl: "Krammer, Madžarska", en: "Krammer, Hungary" },
    score: "10/10",
  },
  {
    sl: "Odlična izkušnja glampinga. Noč v gozdu, dobro opremljena in lepo urejena koča. Bonus za zajtrk z lokalnimi izdelki.",
    en: "An excellent glamping experience. A night in the forest, a well-equipped and beautifully arranged cabin. Bonus for the breakfast with local products.",
    author: { sl: "Vincent, Francija", en: "Vincent, France" },
    score: "5/5",
  },
  {
    sl: "Všeč mi je bil sprejem, predstavitev, ogled, hiška, jutranji sonček, mir, družba drugih popotnikov, zajtrk, skrb za moje dobro počutje in prijeten spanec.",
    en: "I loved the welcome, the introduction, the tour, the cabin, the morning sun, the peace, the company of other travellers, the breakfast, the care for my well-being and the lovely sleep.",
    author: { sl: "Nina, Slovenija", en: "Nina, Slovenia" },
    score: "10/10",
  },
];

export default function TestimonialsCarousel() {
  const t = useT();
  const { lang } = useLang();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);

  const go = (delta: number) => {
    setDir(delta);
    setI((p) => (p + delta + reviews.length) % reviews.length);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    (e.currentTarget as any)._x = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = (e.currentTarget as any)._x as number | undefined;
    if (start == null) return;
    const dx = e.changedTouches[0].clientX - start;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  };

  const r = reviews[i];

  return (
    <section
      aria-label={t("testimonials.title")}
      className="relative px-4 sm:px-6 lg:px-8 pt-28 pb-12 md:pt-20 md:pb-16 -mt-px"
      style={{
        background:
          "linear-gradient(180deg, rgba(245,241,232,0.55) 0%, #f5f1e8 35%, #f1ead6 100%)",
      }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-center gap-3 mb-10 md:mb-12" aria-hidden="true">
          <span className="block h-px w-6" style={{ backgroundColor: "rgba(184,134,11,0.35)" }} />
          <span
            className="font-accent uppercase tracking-[0.35em] text-[10px]"
            style={{ color: "rgba(138,122,85,0.85)" }}
          >
            {t("testimonials.title")}
          </span>
          <span className="block h-px w-6" style={{ backgroundColor: "rgba(184,134,11,0.35)" }} />
        </div>

        <div
          className="relative min-h-[180px] md:min-h-[170px] flex items-center"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous review"
            className="absolute -left-2 md:-left-6 top-1/2 -translate-y-1/2 p-2 rounded-full transition-opacity opacity-50 hover:opacity-100"
            style={{ color: "#3d4a2a" }}
          >
            <ChevronLeft size={22} strokeWidth={1.5} />
          </button>

          <div className="w-full px-8 md:px-10 text-center overflow-hidden">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.figure
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <blockquote
                  className="font-display italic leading-relaxed text-balance"
                  style={{
                    color: "#2a2418",
                    fontSize: "clamp(1rem, 1.4vw, 1.25rem)",
                    lineHeight: 1.7,
                  }}
                >
                  {lang === "sl" ? r.sl : r.en}
                </blockquote>
                <figcaption className="mt-5 flex items-center justify-center gap-2.5 flex-wrap">
                  <span
                    className="font-accent text-xs tracking-wide"
                    style={{ color: "#6b6258" }}
                  >
                    — {lang === "sl" ? r.author.sl : r.author.en}
                  </span>
                  <span
                    aria-hidden="true"
                    className="block w-1 h-1 rounded-full"
                    style={{ backgroundColor: "rgba(138,122,85,0.4)" }}
                  />
                  <span
                    className="font-accent text-xs tracking-wider"
                    style={{ color: "rgba(138,122,85,0.9)" }}
                  >
                    {r.score}
                  </span>
                </figcaption>
              </motion.figure>
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next review"
            className="absolute -right-2 md:-right-6 top-1/2 -translate-y-1/2 p-2 rounded-full transition-opacity opacity-50 hover:opacity-100"
            style={{ color: "#3d4a2a" }}
          >
            <ChevronRight size={22} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-6 flex justify-center gap-1.5">
          {reviews.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setDir(idx > i ? 1 : -1);
                setI(idx);
              }}
              aria-label={`Go to review ${idx + 1}`}
              className="h-[3px] rounded-full transition-all duration-500"
              style={{
                width: idx === i ? 22 : 6,
                backgroundColor:
                  idx === i ? "rgba(61,74,42,0.7)" : "rgba(138,122,85,0.3)",
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
