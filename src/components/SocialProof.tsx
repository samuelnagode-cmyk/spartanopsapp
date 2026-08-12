import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { reviews, aggregateScore, featuredReviewIndices } from "@/data/reviews";

function Stars({ size = 18, value = 5 }: { size?: number; value?: number }) {
  return (
    <div className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          size={size}
          strokeWidth={1.2}
          className=""
          style={{
            color: "#C9A24B",
            fill: i < value ? "#C9A24B" : "transparent",
          }}
        />
      ))}
    </div>
  );
}

export default function SocialProof() {
  const { lang } = useLang();
  const en = lang === "en";
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  const featured = featuredReviewIndices.map((idx) => reviews[idx]);
  const total = featured.length;

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setI((p) => (p + 1) % total), 8000);
    return () => clearInterval(id);
  }, [paused, total]);

  const prev = () => setI((p) => (p - 1 + total) % total);
  const next = () => setI((p) => (p + 1) % total);

  const onTouchStart = (e: React.TouchEvent) => {
    (e.currentTarget as any)._x = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = (e.currentTarget as any)._x as number | undefined;
    if (start == null) return;
    const dx = e.changedTouches[0].clientX - start;
    if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
  };

  const r = featured[i];
  const text = en ? r.text_en : r.text_sl;
  const country = en ? r.country_en : r.country_sl;

  const navBtn =
    "absolute top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ease-out active:scale-[0.92] focus:outline-none focus-visible:shadow-[0_0_0_2px_rgba(0,0,0,0.25)]";
  const navStyle: React.CSSProperties = {
    background: "rgba(0, 0, 0, 0.28)",
    border: "0.5px solid rgba(255, 255, 255, 0.18)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  };

  return (
    <section
      className="px-6"
      style={{
        background: "#FAF6EC",
        paddingTop: "clamp(56px, 8vw, 80px)",
        paddingBottom: "clamp(56px, 8vw, 80px)",
      }}
      aria-label={en ? "What guests say" : "Kaj pravijo gosti"}
    >
      <div className="max-w-[720px] mx-auto text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className="block h-px w-6" style={{ backgroundColor: "#8B7355" }} />
          <span
            className="font-accent"
            style={{
              color: "#8B7355",
              fontSize: 11,
              letterSpacing: "2.5px",
              fontWeight: 500,
              textTransform: "uppercase",
            }}
          >
            {en ? "What guests say" : "Kaj pravijo gosti"}
          </span>
          <span className="block h-px w-6" style={{ backgroundColor: "#8B7355" }} />
        </div>

        <Stars size={18} value={5} />
        <div
          className="font-display"
          style={{
            color: "#3A4A3D",
            fontWeight: 500,
            fontSize: "clamp(28px, 4vw, 32px)",
            marginTop: 12,
          }}
        >
          {aggregateScore.toFixed(1)} / 10
        </div>
        <div
          className="font-accent"
          style={{ color: "#8B7355", fontSize: 14, marginTop: 4 }}
        >
          {en
            ? `from ${reviews.length} guest reviews`
            : `iz ${reviews.length} ocen gostov`}
        </div>

        <div
          className="relative mt-12"
          style={{ minHeight: 200 }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <button
            type="button"
            onClick={prev}
            aria-label={en ? "Previous review" : "Prejšnja ocena"}
            style={navStyle}
            className={`${navBtn} -left-2 md:-left-6 hover:[background:rgba(0,0,0,0.4)] hover:[border-color:rgba(255,255,255,0.25)]`}
          >
            <ChevronLeft size={14} strokeWidth={1.5} className="text-white/95" />
          </button>

          <div className="px-10 md:px-12">
            <blockquote
              key={i}
              className="font-display italic mx-auto"
              style={{
                color: "#3A4A3D",
                fontSize: "clamp(16px, 1.4vw, 18px)",
                lineHeight: 1.7,
                maxWidth: 560,
              }}
            >
              «{text}»
            </blockquote>
            <div
              className="font-accent"
              style={{ color: "#8B7355", fontSize: 13, marginTop: 16 }}
            >
              — {r.name}, {country} · {r.score}/10
            </div>
          </div>

          <button
            type="button"
            onClick={next}
            aria-label={en ? "Next review" : "Naslednja ocena"}
            style={navStyle}
            className={`${navBtn} -right-2 md:-right-6 hover:[background:rgba(0,0,0,0.4)] hover:[border-color:rgba(255,255,255,0.25)]`}
          >
            <ChevronRight size={14} strokeWidth={1.5} className="text-white/95" />
          </button>
        </div>

        <div className="mt-6 flex justify-center gap-1.5">
          {featured.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Review ${idx + 1}`}
              className="h-[3px] rounded-full transition-all duration-500"
              style={{
                width: idx === i ? 22 : 6,
                backgroundColor:
                  idx === i ? "rgba(45, 92, 63, 0.7)" : "rgba(139, 115, 85, 0.3)",
              }}
            />
          ))}
        </div>

        <div className="mt-10">
          <a
              href="/ocene"
            className="font-accent transition-all hover:underline"
            style={{ color: "#1E3F20", fontSize: 14, fontWeight: 500 }}
          >
            {en ? "See all reviews →" : "Glej vse ocene →"}
          </a>
        </div>
      </div>
    </section>
  );
}
