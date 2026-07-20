import { createFileRoute } from "@tanstack/react-router";
import { X, ChevronLeft, ChevronRight, Crosshair, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { events as ALL_EVENTS } from "@/data/events";
import { formatSlovenianDate } from "@/utils/formatDate";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/arhiv")({
  head: () => ({
    meta: [
      { title: "Terenska poročila — Airsoft Zeleni raj" },
      { name: "description", content: "Arhiv preteklih airsoft dogodkov in scenarijev." },
    ],
  }),
  component: AirsoftArchivePage,
});

type GridState = { eventId: string } | null;
type LightboxState = { eventId: string; index: number } | null;

function AirsoftArchivePage() {
  const { lang } = useLang();
  const en = lang === "en";
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const events = useMemo(
    () => [...ALL_EVENTS].sort((a, b) => b.date.localeCompare(a.date)),
    [],
  );

  const [grid, setGrid] = useState<GridState>(null);
  const [lightbox, setLightbox] = useState<LightboxState>(null);

  const activeEventId = lightbox?.eventId ?? grid?.eventId ?? null;
  const activeEvent = useMemo(
    () => (activeEventId ? events.find((e) => e.id === activeEventId) : undefined),
    [events, activeEventId],
  );

  const openGrid = useCallback((eventId: string) => {
    setGrid({ eventId });
  }, []);

  const closeGrid = useCallback(() => {
    setGrid(null);
    setLightbox(null);
  }, []);

  const openLightbox = useCallback((eventId: string, index: number) => {
    setLightbox({ eventId, index });
  }, []);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  const navigate = useCallback(
    (dir: 1 | -1) => {
      setLightbox((prev) => {
        if (!prev) return prev;
        const ev = events.find((e) => e.id === prev.eventId);
        if (!ev || ev.images.length === 0) return prev;
        const total = ev.images.length;
        return { eventId: prev.eventId, index: (prev.index + dir + total) % total };
      });
    },
    [events],
  );

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightbox) closeLightbox();
        else if (grid) closeGrid();
      }
      if (lightbox) {
        if (e.key === "ArrowRight") navigate(1);
        if (e.key === "ArrowLeft") navigate(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, grid, navigate, closeLightbox, closeGrid]);


  const hasEvents = events.length > 0;

  return (
    <div className="min-h-screen bg-airsoft-bg text-cream">
      {/* HEADER */}
      <section className="max-w-5xl mx-auto px-5 md:px-8 pt-10 md:pt-14">
        <div className="text-center">
          <h1
            className="font-display text-cream leading-tight"
            style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 400 }}
          >
            {en ? "Field reports" : "Terenska poročila"}
          </h1>

          <p
            className="mt-4 mx-auto font-body"
            style={{
              fontSize: "clamp(15px, 1.8vw, 17px)",
              color: "rgba(245, 241, 232, 0.75)",
              maxWidth: 520,
            }}
          >
            {en
              ? "Past scenarios, tournaments and fights at airsoft field Zeleni raj."
              : "Pretekli scenariji, turnirji in spopadi na poligonu Zeleni raj."}
          </p>

          <div className="flex items-center justify-center gap-[10px] mt-8 mb-16" aria-hidden="true">
            <span className="block h-px w-8" style={{ backgroundColor: "#8b9d6e" }} />
            <Crosshair size={12} style={{ color: "#8b9d6e" }} strokeWidth={1.5} />
            <span className="block h-px w-8" style={{ backgroundColor: "#8b9d6e" }} />
          </div>
        </div>
      </section>

      {/* CARDS */}
      <section className="max-w-3xl mx-auto px-5 md:px-8 pb-20 md:pb-28" style={{ marginTop: 24 }}>
        {!hasEvents ? (
          <div className="py-20 text-center">
            <p
              className="font-body mx-auto"
              style={{ color: "rgba(245, 241, 232, 0.7)", maxWidth: 460, fontSize: 16 }}
            >
              Arhiv se gradi. Slike s prihodnjih dogodkov bodo objavljene tukaj.
            </p>
          </div>
        ) : (
          <ul className="space-y-6">
            {events.map((e) => {
              const hasImages = e.images.length > 0;
              const previews =
                e.previewImages && e.previewImages.length > 0
                  ? e.previewImages.slice(0, 3)
                  : hasImages
                    ? [e.images[0]]
                    : [];
              const overflow = Math.max(0, e.images.length - previews.length);

              const cardInner = (
                <>
                  <div className="flex flex-col gap-1">
                    <h2
                      className="font-display text-cream"
                      style={{ fontSize: "clamp(18px, 2.4vw, 22px)", fontWeight: 400 }}
                    >
                      {e.title}
                    </h2>
                    <span
                      className="font-accent uppercase"
                      style={{
                        fontSize: 12,
                        letterSpacing: "0.2em",
                        color: "rgba(139, 157, 110, 0.9)",
                      }}
                    >
                      {formatSlovenianDate(e.date)}
                    </span>
                  </div>

                  <div
                    className="mt-4 mb-4 h-px w-full"
                    style={{ backgroundColor: "rgba(139, 157, 110, 0.2)" }}
                  />

                  {hasImages ? (
                    <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        {previews.map((src, i) => (
                          <div
                            key={src}
                            className="relative overflow-hidden rounded-md"
                            style={{ aspectRatio: "4 / 3" }}
                          >
                            <img
                              src={src}
                              alt={`${e.title} — predogled ${i + 1}`}
                              loading="lazy"
                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              onError={(ev) => {
                                (ev.currentTarget as HTMLImageElement).style.visibility = "hidden";
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      {overflow > 0 && (
                        <div className="flex justify-end md:justify-center md:min-w-[110px]">
                          <span
                            className="inline-flex items-center gap-2 font-accent uppercase"
                            style={{
                              fontSize: 12,
                              letterSpacing: "0.2em",
                              color: "rgba(245, 241, 232, 0.85)",
                            }}
                          >
                            +{overflow}
                            <ArrowRight
                              size={14}
                              className="transition-transform duration-200 group-hover:translate-x-[3px]"
                            />
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className="rounded-md py-6 text-center"
                      style={{
                        backgroundColor: "rgba(139, 157, 110, 0.05)",
                        border: "1px dashed rgba(139, 157, 110, 0.25)",
                      }}
                    >
                      <span
                        className="font-accent uppercase"
                        style={{
                          fontSize: 11,
                          letterSpacing: "0.2em",
                          color: "rgba(245, 241, 232, 0.55)",
                        }}
                      >
                        Fotografije bodo objavljene kmalu
                      </span>
                    </div>
                  )}
                </>
              );

              const baseCardStyle = {
                padding: "24px",
                backgroundColor: "rgba(139, 157, 110, 0.04)",
                border: "1px solid rgba(139, 157, 110, 0.15)",
                borderRadius: 10,
              } as const;

              return (
                <li key={e.id}>
                  {hasImages ? (
                    <motion.button
                      type="button"
                      onClick={() => openGrid(e.id)}
                      whileHover={{ y: -2, borderColor: "rgba(139, 157, 110, 0.4)" }}
                      transition={{ duration: 0.2 }}
                      className="group w-full text-left p-4 md:p-6"
                      style={baseCardStyle}
                    >
                      {cardInner}
                    </motion.button>
                  ) : (
                    <div className="w-full p-4 md:p-6" style={baseCardStyle}>
                      {cardInner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* GRID OVERVIEW (Instagram-style) */}
      <AnimatePresence>
        {grid && !lightbox && activeEvent && activeEvent.images.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 overflow-y-auto"
            style={{ backgroundColor: "rgba(10, 12, 8, 0.97)" }}
            onClick={closeGrid}
          >
            {/* Floating close (top-right, below global header) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeGrid();
              }}
              aria-label={en ? "Close" : "Zapri"}
              className="fixed top-[88px] right-3 md:right-5 z-50 rounded-full p-2.5 text-cream/90 hover:text-cream transition-colors"
              style={{ backgroundColor: "rgba(0,0,0,0.6)", border: "1px solid rgba(168,149,79,0.35)" }}
            >
              <X size={22} />
            </button>

            {/* Grid */}
            <div
              className="max-w-5xl mx-auto px-2 md:px-4 pt-[96px] pb-[96px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1 md:gap-2">
                {activeEvent.images.map((src, i) => (
                  <button
                    key={src + i}
                    type="button"
                    onClick={() => openLightbox(activeEvent.id, i)}
                    className="relative overflow-hidden group focus:outline-none"
                    style={{ aspectRatio: "1 / 1", backgroundColor: "#0a0c08" }}
                    aria-label={`${activeEvent.title} — ${i + 1}`}
                  >
                    <img
                      src={src}
                      alt={`${activeEvent.title} — ${i + 1}`}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      onError={(ev) => {
                        (ev.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Always-visible bottom bar with title/date/count */}
            <div
              className="fixed bottom-0 left-0 right-0 z-50 px-4 md:px-8 py-3.5 text-center"
              style={{
                backgroundColor: "rgba(10, 12, 8, 0.94)",
                backdropFilter: "blur(10px)",
                borderTop: "1px solid rgba(168, 149, 79, 0.22)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p
                className="font-display uppercase text-cream"
                style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.08em", lineHeight: 1.3 }}
              >
                {activeEvent.title} — {formatSlovenianDate(activeEvent.date)}
              </p>
              <p
                className="font-accent uppercase mt-1"
                style={{ fontSize: 10.5, letterSpacing: "0.18em", color: "rgba(168, 149, 79, 0.9)" }}
              >
                {activeEvent.images.length} {en ? "photos" : "fotografij"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* LIGHTBOX */}

      <AnimatePresence>
        {lightbox && activeEvent && activeEvent.images.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.97)" }}
            onClick={closeLightbox}
            onTouchStart={(e) => {
              const t0 = e.touches[0];
              touchStart.current = { x: t0.clientX, y: t0.clientY };
            }}
            onTouchEnd={(e) => {
              if (!touchStart.current) return;
              const t0 = e.changedTouches[0];
              const dx = t0.clientX - touchStart.current.x;
              const dy = t0.clientY - touchStart.current.y;
              if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0) navigate(1);
                else navigate(-1);
              }
              touchStart.current = null;
            }}
          >
            {/* Floating close (top-right, below global header) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeLightbox();
              }}
              aria-label="Zapri"
              className="fixed top-[88px] right-3 md:right-5 z-50 rounded-full p-2.5 text-cream/90 hover:text-cream transition-colors"
              style={{ backgroundColor: "rgba(0,0,0,0.6)", border: "1px solid rgba(168,149,79,0.35)" }}
            >
              <X size={22} />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(-1);
              }}
              aria-label="Prejšnja"
              className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 text-cream/70 hover:text-cream p-3 z-50"
            >
              <ChevronLeft size={36} />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(1);
              }}
              aria-label="Naslednja"
              className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 text-cream/70 hover:text-cream p-3 z-50"
            >
              <ChevronRight size={36} />
            </button>

            <div
              className="flex items-center justify-center w-full h-full px-4 pt-[100px] pb-[110px]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={activeEvent.images[lightbox.index]}
                alt={`${activeEvent.title} — ${lightbox.index + 1}/${activeEvent.images.length}`}
                className="block max-h-full max-w-full w-auto h-auto object-contain"
              />
            </div>

            {/* Always-visible bottom bar with title/date/counter */}
            <div
              className="fixed bottom-0 left-0 right-0 z-50 px-4 md:px-8 py-3.5 text-center"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.92)",
                backdropFilter: "blur(10px)",
                borderTop: "1px solid rgba(168, 149, 79, 0.22)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p
                className="font-display uppercase text-cream"
                style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "0.08em", lineHeight: 1.3 }}
              >
                {activeEvent.title} — {formatSlovenianDate(activeEvent.date)}
              </p>
              <p
                className="font-accent uppercase mt-1"
                style={{ fontSize: 10.5, letterSpacing: "0.18em", color: "rgba(168, 149, 79, 0.9)" }}
              >
                {lightbox.index + 1} / {activeEvent.images.length}
              </p>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
