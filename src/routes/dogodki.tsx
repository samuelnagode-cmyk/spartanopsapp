import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, MapPin, CalendarDays, Link as LinkIcon, Crosshair } from "lucide-react";
import { externalSupabase } from "@/integrations/supabase/externalClient";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import AirsoftRegistrationModal from "@/components/AirsoftRegistrationModal";
import AirsoftAttendeeList from "@/components/AirsoftAttendeeList";
import { makeEventKey } from "@/lib/event-key";

export const Route = createFileRoute("/dogodki")({
  head: () => ({
    meta: [
      { title: "Airsoft Dogodki — Spartan @ Zeleni raj" },
      {
        name: "description",
        content:
          "Prihajajoči airsoft scenariji in dogodki na poligonu Zeleni raj (Vače). Spartan organizirane igre, prijave in seznam udeležencev.",
      },
      { property: "og:title", content: "Airsoft Dogodki — Spartan @ Zeleni raj" },
      {
        property: "og:description",
        content: "Prihajajoči airsoft scenariji in odprte prijave na poligonu Zeleni raj.",
      },
      { property: "og:url", content: "https://glampingzeleniraj.si/dogodki" },
    ],
    links: [{ rel: "canonical", href: "https://glampingzeleniraj.si/dogodki" }],
  }),
  component: AirsoftDogodkiPage,
});

const ACCENT = "#a8954f";
const BG = "#11140f";
const PANEL = "#1a1f17";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";

type TimeFilter = "upcoming" | "past" | "all";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

function AirsoftDogodkiPage() {
  const { lang } = useLang();
  const en = lang === "en";
  const t = (sl: string, en2: string) => (en ? en2 : sl);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("upcoming");
  const [openId, setOpenId] = useState<string | null>(null);
  const [registerForId, setRegisterForId] = useState<{ id: string; title: string } | null>(null);
  const [refreshTokens, setRefreshTokens] = useState<Record<string, number>>({});
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setLoading(true);
    externalSupabase
      .from("events")
      .select("*")
      .eq("category", "airsoft")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error("[airsoft events] fetch error", error);
        setRows(data ?? []);
        setLoading(false);
      });
    // Cancellation list is not client-readable; fetch via trusted server fn.
    import("@/lib/spartanops-checkin.functions").then(({ listEventCancellations }) => {
      listEventCancellations()
        .then((res) => {
          if (!active || !res?.ok) return;
          setCancelledIds(new Set(res.ids));
        })
        .catch(() => {});
    });
    return () => {
      active = false;
    };
  }, []);

  const monthsSL = ["januar", "februar", "marec", "april", "maj", "junij", "julij", "avgust", "september", "oktober", "november", "december"];
  const monthsEN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const resolveImageUrl = (raw?: string | null): string | undefined => {
    if (!raw) return undefined;
    const v = raw.trim();
    if (!v) return undefined;
    return v;
  };

  // Split a stored image_url string into one-or-more URLs. Supports
  // comma- or newline-separated values, trims whitespace, drops empties.
  const parseImages = (raw?: string | null): string[] => {
    if (!raw) return [];
    return raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  const events = rows.map((r) => {
    const d = new Date(r.date + "T00:00:00");
    const day = String(d.getDate()).padStart(2, "0");
    const monthName = (en ? monthsEN : monthsSL)[d.getMonth()];
    const title = en ? r.title_en : r.title_sl;
    return {
      id: makeEventKey(r),
      slug: slugify(title || ""),
      iso: r.date as string,
      day,
      monthYear: `${monthName} ${d.getFullYear()}`,
      title: title as string,
      subtitle: (en ? r.subtitle_en : r.subtitle_sl) ?? undefined,
      location: (en ? r.location_en : r.location_sl) ?? r.location ?? undefined,
      description: (en ? r.description_en : r.description_sl) as string,
      images: [r.image_url_1, r.image_url_2, r.image_url_3]
        .filter((u): u is string => typeof u === "string" && u.trim() !== "")
        .map((u) => resolveImageUrl(u)!)
        .filter(Boolean),
    };
  });


  const filtered = events
    .filter((e) => {
      if (timeFilter === "all") return true;
      if (timeFilter === "upcoming") return e.iso >= todayIso;
      return e.iso < todayIso;
    })
    .sort((a, b) =>
      timeFilter === "past" ? b.iso.localeCompare(a.iso) : a.iso.localeCompare(b.iso),
    );

  const handleAddToCalendar = (e: typeof events[number]) => {
    const d = new Date(e.iso + "T00:00:00");
    const start = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const end = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, "0")}${String(next.getDate()).padStart(2, "0")}`;
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: e.title,
      dates: `${start}/${end}`,
      details: (e.description ?? "").slice(0, 200),
      location: e.location ?? "",
    });
    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = useCallback(async (slug: string) => {
    try {
      const url = `${window.location.origin}/dogodki#${slug}`;
      await navigator.clipboard.writeText(url);
      setCopiedSlug(slug);
      window.setTimeout(() => setCopiedSlug((s) => (s === slug ? null : s)), 2000);
    } catch (err) {
      console.error("copy failed", err);
    }
  }, []);

  const filters: { key: TimeFilter; label: string }[] = [
    { key: "upcoming", label: t("PRIHAJAJOČI DOGODKI", "UPCOMING EVENTS") },
    { key: "past", label: t("PRETEKLI DOGODKI", "PAST EVENTS") },
  ];

  return (
    <div style={{ background: BG, color: INK, minHeight: "100vh", paddingTop: 90 }}>
      {/* Tactical noise/texture */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.08,
          backgroundImage:
            "radial-gradient(circle at 20% 0%, rgba(168,149,79,0.25), transparent 50%), radial-gradient(circle at 80% 100%, rgba(168,149,79,0.15), transparent 60%)",
        }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-14 relative">
        {/* Back nav lives in the header (back arrow). No duplicate link here. */}


        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <p style={{ fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: ACCENT, marginBottom: 12 }}>
            {t("Spartan @ Zeleni Raj", "Spartan @ Zeleni Raj")}
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display, serif)",
              fontSize: "clamp(28px, 5vw, 44px)",
              fontWeight: 600,
              letterSpacing: "0.02em",
              color: INK,
              lineHeight: 1.1,
            }}
          >
            {t("Koledar airsoft dogodkov", "Airsoft events calendar")}
          </h1>
          <div style={{ width: 60, height: 1, background: ACCENT, margin: "20px auto" }} />
          <p style={{ color: MUTED, maxWidth: 520, margin: "0 auto", fontSize: 14, lineHeight: 1.7 }}>
            {t(
              "Scenariji, organizirane igre in odprte prijave na poligonu Zeleni raj.",
              "Scenarios, organized games and open registrations at the Zeleni raj field.",
            )}
          </p>
        </div>

        {/* Filter buttons — flex-wrap to prevent text clipping on narrow screens */}
        <div
          className="flex flex-wrap items-center justify-center gap-2 w-full px-2"
          style={{ marginBottom: 28 }}
        >
          {filters.map((f) => {
            const active = timeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => {
                  setTimeFilter(f.key);
                  setOpenId(null);
                }}
                className="text-[11px] sm:text-xs"
                style={{
                  flex: "1 1 auto",
                  minWidth: 0,
                  padding: "10px 12px",
                  background: active ? ACCENT : "transparent",
                  color: active ? BG : INK,
                  border: `1px solid ${active ? ACCENT : "rgba(236,227,196,0.25)"}`,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontWeight: active ? 700 : 500,
                  transition: "all 200ms",
                  whiteSpace: "nowrap",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>


        {/* Events list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <AnimatePresence mode="popLayout">
            {filtered.map((e, i) => {
              const isOpen = openId === e.id;
              const isCancelled = cancelledIds.has(e.id);
              return (
                <motion.div
                  key={e.id}
                  id={e.slug}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.35, delay: i * 0.04 }}
                  style={{
                    background: PANEL,
                    border: `1px solid ${isCancelled ? "#c0392b80" : isOpen ? ACCENT + "60" : "rgba(236,227,196,0.10)"}`,
                    overflow: "hidden",
                    scrollMarginTop: 110,
                    position: "relative",
                  }}
                >
                  {isCancelled && (
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        zIndex: 3,
                        background: "#c0392b",
                        color: "#fff",
                        padding: "6px 14px",
                        fontSize: 11,
                        letterSpacing: "0.24em",
                        textTransform: "uppercase",
                        fontWeight: 800,
                        border: "2px solid #ffb3a8",
                        transform: "rotate(-6deg)",
                        boxShadow: "0 2px 10px rgba(192,57,43,0.5)",
                        pointerEvents: "none",
                      }}
                    >
                      {t("Odpovedano", "Cancelled")}
                    </div>
                  )}
                  <button
                    onClick={() => setOpenId(isOpen ? null : e.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      color: INK,
                      border: "none",
                      padding: "16px 18px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    <div style={{ width: 58, textAlign: "center", flexShrink: 0 }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: ACCENT, lineHeight: 1, fontFamily: "var(--font-display, serif)" }}>
                        {e.day}
                      </div>
                      <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED, marginTop: 4 }}>
                        {e.monthYear}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 600, color: INK, lineHeight: 1.3, fontFamily: "var(--font-display, serif)" }}>
                        {e.title}
                      </h3>
                      {e.subtitle && (
                        <p style={{ fontSize: 12, color: MUTED, marginTop: 4, fontStyle: "italic" }}>{e.subtitle}</p>
                      )}
                      {e.location && (
                        <p style={{ fontSize: 11, color: MUTED, marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <MapPin size={11} /> {e.location}
                        </p>
                      )}
                    </div>
                    <motion.div
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        border: `1px solid ${ACCENT}50`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: ACCENT,
                        flexShrink: 0,
                      }}
                    >
                      <Plus size={14} />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={{ padding: "0 18px 22px", borderTop: `1px solid ${ACCENT}20`, paddingTop: 18 }}>
                          {/* Dynamic image gallery — 1 / 2 / 3+ layout, mirrors /dogodki */}
                          {e.images.length > 0 ? (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  e.images.length === 1
                                    ? "1fr"
                                    : e.images.length === 2
                                      ? "repeat(2, minmax(0, 1fr))"
                                      : "repeat(3, minmax(0, 1fr))",
                                gap: 8,
                                marginBottom: 18,
                              }}
                            >
                              {e.images.map((src, idx) => (
                                <img
                                  key={src + idx}
                                  src={src}
                                  alt={`${e.title} — ${idx + 1}`}
                                  loading="lazy"
                                  style={{
                                    width: "100%",
                                    aspectRatio: e.images.length === 1 ? "16 / 9" : "1 / 1",
                                    objectFit: "cover",
                                    display: "block",
                                    background: "#0a0c08",
                                    borderRadius: 4,
                                  }}
                                  onError={(ev) => {
                                    (ev.currentTarget as HTMLImageElement).style.visibility = "hidden";
                                  }}
                                />
                              ))}
                            </div>
                          ) : (
                            <div
                              aria-hidden
                              style={{
                                width: "100%",
                                aspectRatio: "16 / 9",
                                background: `linear-gradient(135deg, ${PANEL}, ${BG})`,
                                border: `1px solid ${ACCENT}20`,
                                marginBottom: 18,
                                borderRadius: 4,
                              }}
                            />
                          )}

                          <p
                            style={{
                              fontSize: 14,
                              color: "rgba(236,227,196,0.85)",
                              lineHeight: 1.75,
                              whiteSpace: "pre-line",
                              margin: 0,
                            }}
                          >
                            {e.description}
                          </p>

                          {/* Register CTA + disclaimer */}
                          <div style={{ marginTop: 18 }}>
                            <button
                              type="button"
                              onClick={() => !isCancelled && setRegisterForId({ id: e.id, title: e.title })}
                              disabled={isCancelled}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 10,
                                background: isCancelled ? "transparent" : ACCENT,
                                color: isCancelled ? MUTED : BG,
                                border: isCancelled ? `1px solid ${MUTED}` : "none",
                                padding: "12px 22px",
                                fontSize: 12,
                                letterSpacing: "0.2em",
                                textTransform: "uppercase",
                                fontWeight: 700,
                                cursor: isCancelled ? "not-allowed" : "pointer",
                                textDecoration: isCancelled ? "line-through" : "none",
                              }}
                            >
                              <Crosshair size={14} />
                              {isCancelled
                                ? t("Dogodek odpovedan", "Event cancelled")
                                : t("Prijava na dogodek (10€)", "Register for Event (10€)")}
                            </button>
                            {!isCancelled && (
                              <p style={{ fontSize: 11, color: MUTED, marginTop: 8, fontStyle: "italic" }}>
                                {t(
                                  "Cena na dan dogodka brez spletne prijave je 15€.",
                                  "Price on the day of the event without online registration is 15€.",
                                )}
                              </p>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <ActionBtn onClick={() => handleAddToCalendar(e)} icon={<CalendarDays size={13} />}>
                              + Google Calendar
                            </ActionBtn>
                            <ActionBtn onClick={() => handleCopyLink(e.slug)} icon={<LinkIcon size={13} />}>
                              {copiedSlug === e.slug
                                ? t("✓ Kopirano!", "✓ Copied!")
                                : t("Kopiraj povezavo", "Copy link")}
                            </ActionBtn>
                          </div>

                          {/* Public attendee list — lazy: only rendered when card is open */}
                          <AirsoftAttendeeList
                            eventId={e.id}
                            refreshToken={refreshTokens[e.id] ?? 0}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {loading && (
            <div style={{ textAlign: "center", padding: 36 }}>
              <div
                style={{
                  display: "inline-block",
                  width: 28,
                  height: 28,
                  border: `2px solid ${ACCENT}30`,
                  borderTopColor: ACCENT,
                  borderRadius: "50%",
                  animation: "spin 800ms linear infinite",
                }}
              />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <p style={{ textAlign: "center", color: MUTED, fontStyle: "italic", padding: "32px 0" }}>
              {t("Trenutno ni dogodkov.", "No events at the moment.")}
            </p>
          )}
        </div>

        {/* Tactical CTA */}
        <div style={{ marginTop: 60, marginBottom: 20 }}>
          <div
            style={{
              border: `1px solid ${ACCENT}40`,
              background: `linear-gradient(135deg, ${PANEL}, ${BG})`,
              padding: "32px 24px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: ACCENT, marginBottom: 10 }}>
              {t("Najem terena", "Field rental")}
            </p>
            <h3
              style={{
                fontFamily: "var(--font-display, serif)",
                fontSize: "clamp(18px, 3vw, 24px)",
                color: INK,
                lineHeight: 1.3,
                maxWidth: 560,
                margin: "0 auto 20px",
                fontWeight: 600,
              }}
            >
              {t(
                "Organiziraš airsoft dogodke ali iščeš vrhunski teren za svoj klub?",
                "Are you organizing airsoft events or looking for a premium field for your club?",
              )}
            </h3>
            <Link
              to="/rezervacije"
              hash="povprasevanje"
              style={{
                display: "inline-block",
                background: ACCENT,
                color: BG,
                padding: "12px 28px",
                fontSize: 12,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {t("Rezerviraj poligon", "Reserve the Field")}
            </Link>
          </div>
        </div>
      </div>

      {registerForId && (
        <AirsoftRegistrationModal
          eventId={registerForId.id}
          eventTitle={registerForId.title}
          onClose={() => setRegisterForId(null)}
          onSuccess={() => {
            const id = registerForId.id;
            setOpenId(id);
            setRefreshTokens((r) => ({ ...r, [id]: (r[id] ?? 0) + 1 }));
            // Second tick to catch any replication lag
            window.setTimeout(() => {
              setRefreshTokens((r) => ({ ...r, [id]: (r[id] ?? 0) + 1 }));
            }, 600);
          }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ActionBtn({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "transparent",
        color: INK,
        border: `1px solid rgba(236,227,196,0.25)`,
        padding: "8px 14px",
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {icon}
      {children}
    </button>
  );
}
