import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface PageHeroProps {
  image: string;
  title: string;
  subtitle?: string;
  dark?: boolean;
  fullscreen?: boolean;
  scrollCue?: boolean;
  heightClass?: string;
  titleOffsetClass?: string;
  topGradient?: boolean;
  bottomFadeColor?: string;
  hideDefaultOverlay?: boolean;
}

export default function PageHero({
  image,
  title,
  subtitle,
  dark = false,
  fullscreen = false,
  scrollCue = false,
  heightClass,
  titleOffsetClass,
  topGradient = false,
  bottomFadeColor,
  hideDefaultOverlay = false,
}: PageHeroProps) {
  const sizeClass = heightClass
    ? titleOffsetClass
      ? `${heightClass} items-start ${titleOffsetClass}`
      : `${heightClass} items-center`
    : fullscreen
    ? "min-h-screen items-start pt-[18vh] md:pt-[20vh]"
    : "h-[50vh] min-h-[360px] items-center";
  return (
    <section
      className={`relative ${sizeClass} flex justify-center overflow-hidden`}
      style={fullscreen && !heightClass ? { minHeight: "100svh" } : undefined}
    >
      <img
        src={image}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
      {!hideDefaultOverlay && (
        <div className={`absolute inset-0 ${dark ? "bg-airsoft-bg/70" : "bg-brown/40"}`} />
      )}
      {fullscreen && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-[16%] z-10"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(245,241,232,0.35) 65%, var(--background, #f5f1e8) 100%)",
          }}
        />
      )}
      {bottomFadeColor && (
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-[18%] z-10"
          style={{
            background: `linear-gradient(180deg, transparent 0%, ${bottomFadeColor} 100%)`,
          }}
        />
      )}
      <div className="relative z-10 text-center px-4">
        {topGradient && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[220px] max-w-[90vw]"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.18) 45%, rgba(0,0,0,0) 75%)",
            }}
          />
        )}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative font-display text-4xl md:text-5xl lg:text-6xl font-bold text-cream mb-1"
          style={{ textShadow: "0 1px 8px rgba(0, 0, 0, 0.4)" }}
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative font-body text-lg md:text-xl text-gold max-w-2xl mx-auto"
            style={{ textShadow: "0 1px 8px rgba(0, 0, 0, 0.4)" }}
          >
            {subtitle}
          </motion.p>
        )}
      </div>


      {scrollCue && (
        <motion.button
          type="button"
          aria-label="Pomakni navzdol"
          onClick={() =>
            window.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" })
          }
          className="absolute left-1/2 -translate-x-1/2 bottom-24 md:bottom-28 z-20 flex items-center justify-center text-white/85 hover:text-white transition-colors"
          style={{ filter: "drop-shadow(0 1px 4px rgba(0, 0, 0, 0.3))" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 8, 0] }}
          transition={{
            opacity: { duration: 0.6, delay: 0.6 },
            y: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
          }}
        >
          <ChevronDown size={26} strokeWidth={2} />
        </motion.button>
      )}
    </section>
  );
}
