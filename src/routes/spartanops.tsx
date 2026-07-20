import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Crosshair, QrCode, Users, ClipboardList, MapPin, ArrowRight, Printer, CheckCircle2, Flag, RefreshCw, Target } from "lucide-react";
import { loadFieldsRegistryWithSystem, loadLobbies, SYSTEM_FIELD, dtoToRecord, type AllTimeFieldRecord } from "./admin-pregled";
import { getOperationalTelemetry, type OperationalTelemetry } from "@/lib/spartanops-telemetry.functions";
import { listPublishedLobbies } from "@/lib/spartanops-lobbies.functions";

export const Route = createFileRoute("/spartanops")({
  head: () => ({
    meta: [
      { title: "SpartanOps — Next-Gen Airsoft HUD" },
      {
        name: "description",
        content:
          "SpartanOps is a next-gen tactical HUD for airsoft fields. Live sector tracking, universal QR check-in, and real-time command console.",
      },
      { property: "og:title", content: "SpartanOps — Next-Gen Airsoft HUD" },
      {
        property: "og:description",
        content: "Digital immersion for fields, live sector tracking, and tactical command.",
      },
    ],
  }),
  component: SpartanOpsHome,
});

/* ---------- Tactical HUD tokens ---------- */
const BG = "#0b0d0a";
const PANEL = "#12140f";
const PANEL_2 = "#171a13";
const ACCENT = "#e89a0a";
const ACCENT_SOFT = "rgba(232,154,10,0.35)";
const INK = "#e7e3d6";
const MUTED = "rgba(231,227,214,0.60)";
const BLUE = "#4ea8ff";
const HAIRLINE = "rgba(231,227,214,0.10)";

/* ---------- Small HUD primitives ---------- */
function SectionShell({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`w-full px-4 sm:px-6 lg:px-8 py-16 md:py-24 ${className}`}>
      <div className="max-w-6xl mx-auto">{children}</div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <div className="mb-10 md:mb-14">
      {eyebrow && (
        <p
          className="font-mono uppercase mb-3"
          style={{ fontSize: 11, letterSpacing: "0.32em", color: ACCENT }}
        >
          {eyebrow}
        </p>
      )}
      <h2
        style={{
          fontFamily: "'Michroma', 'Rajdhani', monospace",
          fontSize: "clamp(22px, 3.4vw, 34px)",
          letterSpacing: "0.10em",
          color: ACCENT,
          lineHeight: 1.1,
        }}
      >
        {title}
      </h2>
      {sub && (
        <p className="mt-3 text-[14px] md:text-[15px] leading-[1.7]" style={{ color: MUTED, maxWidth: 720 }}>
          {sub}
        </p>
      )}
      <div style={{ width: 56, height: 1, background: ACCENT, marginTop: 18 }} />
    </div>
  );
}

function HudCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: PANEL,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 0,
        position: "relative",
      }}
    >
      {/* corner ticks */}
      <span style={cornerTick("tl")} />
      <span style={cornerTick("tr")} />
      <span style={cornerTick("bl")} />
      <span style={cornerTick("br")} />
      {children}
    </div>
  );
}
function cornerTick(pos: "tl" | "tr" | "bl" | "br"): React.CSSProperties {
  const size = 10;
  const base: React.CSSProperties = { position: "absolute", width: size, height: size, borderColor: ACCENT_SOFT, borderStyle: "solid", borderWidth: 0 };
  if (pos === "tl") return { ...base, top: -1, left: -1, borderTopWidth: 1, borderLeftWidth: 1 };
  if (pos === "tr") return { ...base, top: -1, right: -1, borderTopWidth: 1, borderRightWidth: 1 };
  if (pos === "bl") return { ...base, bottom: -1, left: -1, borderBottomWidth: 1, borderLeftWidth: 1 };
  return { ...base, bottom: -1, right: -1, borderBottomWidth: 1, borderRightWidth: 1 };
}

function BtnPrimary({ to, children, fullWidth = false, minWidth = 200 }: { to: string; children: ReactNode; fullWidth?: boolean; minWidth?: number }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 font-mono uppercase transition-all ${fullWidth ? "w-full" : ""}`}
      style={{
        background: ACCENT,
        color: "#0a0a0a",
        letterSpacing: "0.22em",
        fontSize: 12,
        padding: "14px 22px",
        minWidth: fullWidth ? undefined : minWidth,
        height: 48,
        borderRadius: 0,
        border: `1px solid ${ACCENT}`,
        boxShadow: `0 0 24px -8px ${ACCENT}`,
      }}
    >
      {children}
    </Link>
  );
}
function BtnOutline({ to, children, fullWidth = false, minWidth = 200 }: { to: string; children: ReactNode; fullWidth?: boolean; minWidth?: number }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 font-mono uppercase transition-all hover:brightness-125 ${fullWidth ? "w-full" : ""}`}
      style={{
        background: "transparent",
        color: ACCENT,
        letterSpacing: "0.22em",
        fontSize: 12,
        padding: "14px 22px",
        minWidth: fullWidth ? undefined : minWidth,
        height: 48,
        borderRadius: 0,
        border: `1px solid ${ACCENT_SOFT}`,
      }}
    >
      {children}
    </Link>
  );
}

/* ---------- Reticle graphic ---------- */
function Reticle() {
  return (
    <div className="relative mx-auto" style={{ width: 148, height: 148 }} aria-hidden>
      <svg viewBox="0 0 200 200" width="148" height="148">
        <defs>
          <radialGradient id="rg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.35" />
            <stop offset="70%" stopColor={ACCENT} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="90" fill="url(#rg)" />
        <circle cx="100" cy="100" r="70" fill="none" stroke={ACCENT} strokeOpacity="0.55" strokeWidth="1" />
        <circle cx="100" cy="100" r="46" fill="none" stroke={ACCENT} strokeOpacity="0.85" strokeWidth="1" />
        <circle cx="100" cy="100" r="3" fill={ACCENT} />
        <g stroke={ACCENT} strokeWidth="1" strokeOpacity="0.9">
          <line x1="100" y1="8" x2="100" y2="34" />
          <line x1="100" y1="166" x2="100" y2="192" />
          <line x1="8" y1="100" x2="34" y2="100" />
          <line x1="166" y1="100" x2="192" y2="100" />
        </g>
        <circle
          cx="100"
          cy="100"
          r="70"
          fill="none"
          stroke={ACCENT}
          strokeOpacity="0.4"
          strokeWidth="1"
          className="animate-radar-pulse"
          style={{ transformOrigin: "100px 100px" }}
        />
      </svg>
    </div>
  );
}

/* ---------- 1. HERO ---------- */
const LOGO_URL =
  "https://res.cloudinary.com/dfifiytid/image/upload/v1783784323/SpartanOps%20app%20v1.0/LOGO/spartan_ops_napis_brez_ozadja-06.webp";

const HERO_BG_URL =
  "https://res.cloudinary.com/dfifiytid/image/upload/v1784235270/SpartanOps%20app%20v1.0/GALERIJA/spartanops_homepage_image-03.webp";

function Hero() {
  return (
    <div className="relative">
      {/* Backdrop image — barely visible, fades to page BG at the bottom */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
        style={{ height: "100%", zIndex: 0 }}
      >
        <img
          src={HERO_BG_URL}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.33 }}
          loading="eager"
          decoding="async"
        />
        {/* Soft dark wash to keep foreground popping */}
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at 50% 30%, rgba(11,13,10,0.35) 0%, rgba(11,13,10,0.65) 70%, ${BG} 100%)` }}
        />
        {/* Bottom fade → page BG so it ends below the CTAs */}
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{ background: `linear-gradient(180deg, rgba(11,13,10,0) 0%, ${BG} 100%)` }}
        />
      </div>

      <SectionShell className="relative pt-16 md:pt-20 pb-24 md:pb-32">
        <div className="relative text-center" style={{ zIndex: 1 }}>
          <Reticle />
          <p
            className="font-mono uppercase mt-3 mb-2"
            style={{ fontSize: 11, letterSpacing: "0.34em", color: BLUE }}
          >
            // TACTICAL AIRSOFT HUD SYSTEM
          </p>
          <h1 className="sr-only">SpartanOps</h1>
          <img
            src={LOGO_URL}
            alt="SpartanOps"
            className="mx-auto block w-full h-auto"
            style={{ maxWidth: "min(560px, 88vw)" }}
            loading="eager"
            decoding="async"
          />
          <p
            className="mx-auto mt-2 text-[14px] md:text-[16px] leading-[1.6]"
            style={{ color: INK, maxWidth: 620 }}
          >
            The ultimate web app for live-tracking airsoft games. Download tactical
            printouts for your field and let players scan QR codes to secure victory.
          </p>
          <div className="mt-5 mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4" style={{ maxWidth: 480 }}>
            <BtnPrimary to="/admin-pregled" fullWidth>Create Mission</BtnPrimary>
            <BtnOutline to="/join" fullWidth>Join Mission</BtnOutline>
          </div>
          {/* Scroll cue — tactical down chevron */}
          <button
            type="button"
            aria-label="Scroll down"
            onClick={() =>
              window.scrollBy({ top: window.innerHeight * 0.8, behavior: "smooth" })
            }
            className="mx-auto mt-8 flex items-center justify-center animate-bounce"
            style={{ color: ACCENT, opacity: 0.9 }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                filter: "drop-shadow(0 0 4px rgba(232,154,10,0.45)) drop-shadow(0 0 10px rgba(232,154,10,0.15))",
              }}
            >
              <path
                d="M8 13L16 21L24 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="square"
                strokeLinejoin="miter"
              />
            </svg>
          </button>
        </div>
      </SectionShell>
    </div>
  );
}

/* ---------- 2. LIVE OPERATIONS TRACKER ---------- */
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function formatNumber(n: number) {
  // Use en-US style commas — matches the previous "4,821" formatting.
  return Math.round(n).toLocaleString("en-US");
}

function AnimatedCounter({ value, duration = 1500 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const visibleRef = useRef(false);
  const fromRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) visibleRef.current = true; }),
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const t0 = performance.now();
    let raf = 0;
    const run = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setDisplay(from + (to - from) * easeOutCubic(p));
      if (p < 1) raf = requestAnimationFrame(run);
      else fromRef.current = to;
    };
    // Small delay for initial visibility observer to attach.
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span ref={ref}>{formatNumber(display)}</span>;
}

function LiveTracker() {
  const fetchTelemetry = useServerFn(getOperationalTelemetry);
  const [t, setT] = useState<OperationalTelemetry>({ operators: 24, scans: 125, respawns: 115, missions: 3 });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try { const data = await fetchTelemetry(); if (alive) setT(data); } catch {}
    };
    void load();
    const id = window.setInterval(load, 20000);
    return () => { alive = false; window.clearInterval(id); };
  }, [fetchTelemetry]);

  const items: Array<{ label: string; value: number; Icon: typeof CheckCircle2; live: boolean }> = [
    { label: "Operators Deployed", value: t.operators, Icon: Users, live: false },
    { label: "QR Codes Scanned", value: t.scans, Icon: QrCode, live: false },
    { label: "Respawns Processed", value: t.respawns, Icon: RefreshCw, live: true },
    { label: "Missions Completed", value: t.missions, Icon: Target, live: false },
  ];
  return (
    <SectionShell>
      <SectionHeader eyebrow="// LIVE OPS TRACKER" title="OPERATIONAL TELEMETRY" />
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        {items.map((it) => (
          <HudCard
            key={it.label}
            className="p-4 md:p-5 h-full flex flex-col"
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="inline-flex items-center gap-2 font-mono uppercase"
                style={{ fontSize: 10, letterSpacing: "0.24em", color: ACCENT }}
              >
                <it.Icon size={13} strokeWidth={1.8} />
              </span>
              {it.live ? (
                <span
                  className="inline-flex items-center gap-1.5 font-mono uppercase"
                  style={{ fontSize: 9, letterSpacing: "0.24em", color: "#3ddc84" }}
                >
                  <span
                    className="animate-pulse-dot"
                    style={{ width: 6, height: 6, background: "#3ddc84", display: "inline-block", borderRadius: 999 }}
                  />
                  LIVE
                </span>
              ) : (
                <span
                  className="font-mono uppercase"
                  style={{ fontSize: 9, letterSpacing: "0.24em", color: MUTED }}
                >
                  TOTAL
                </span>
              )}
            </div>
            <div
              style={{
                fontFamily: "'Rajdhani', 'Michroma', monospace",
                fontSize: "clamp(28px, 5vw, 40px)",
                fontWeight: 700,
                color: INK,
                letterSpacing: "0.04em",
                lineHeight: 1,
              }}
            >
              <AnimatedCounter value={it.value} />
            </div>
            <p
              className="mt-2 font-mono uppercase"
              style={{ fontSize: 10, letterSpacing: "0.22em", color: MUTED }}
            >
              {it.label}
            </p>
          </HudCard>
        ))}
      </div>
    </SectionShell>
  );
}

/* ---------- 3. ACTIVE OPERATIONS ---------- */
function Locations() {
  const navigate = useNavigate();
  const listFn = useServerFn(listPublishedLobbies);
  const [rows, setRows] = useState<Array<{ id: string; name: string; region: string; status: "ACTIVE" | "DECOMMISSIONED" }>>([]);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const dtos = await listFn();
        if (!alive) return;
        const records = dtos
          .map(dtoToRecord)
          .filter((r) => r.id !== SYSTEM_FIELD.id)
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 3);
        setRows(records.map((r) => ({
          id: r.id,
          name: r.fieldName,
          region: r.location || "",
          status: "ACTIVE" as const,
        })));
      } catch {
        if (alive) setRows([]);
      }
    };
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => { alive = false; window.removeEventListener("focus", onFocus); };
  }, [listFn]);

  const goJoin = () => navigate({ to: "/join", search: { browse: "1" } as any });

  return (
    <SectionShell>
      <SectionHeader
        eyebrow="// RECON"
        title="ACTIVE OPERATIONS"
        sub="Latest missions currently deployed on the SpartanOps command network."
      />
      {rows.length === 0 ? (
        <HudCard className="p-8 text-center">
          <p className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: "0.24em", color: MUTED }}>
            // NO FIELDS DEPLOYED YET
          </p>
          <p className="mt-3" style={{ color: MUTED, fontSize: 14 }}>
            The first field to initialize on the network will appear here.
          </p>
        </HudCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
          {rows.map((l) => {
            const isActive = l.status === "ACTIVE";
            const badge = isActive ? "#3ddc84" : "#c86a4a";
            return (
              <div
                key={l.id}
                onClick={goJoin}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") goJoin(); }}
                style={{ cursor: "pointer" }}
              >
                <HudCard className="p-6 transition-colors hover:brightness-110">
                  <div className="flex items-start justify-between gap-3" style={{ opacity: isActive ? 1 : 0.75 }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <MapPin size={18} strokeWidth={1.6} color={ACCENT} />
                      <div className="min-w-0">
                        <h3
                          className="truncate"
                          style={{
                            fontFamily: "'Michroma', monospace",
                            fontSize: 14,
                            letterSpacing: "0.08em",
                            color: INK,
                          }}
                        >
                          {l.name}
                        </h3>
                        <p className="mt-1 font-mono" style={{ fontSize: 11, letterSpacing: "0.22em", color: MUTED }}>
                          {l.region || "—"}
                        </p>
                      </div>
                    </div>
                    <span
                      className="font-mono uppercase shrink-0"
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.24em",
                        color: badge,
                        border: `1px solid ${badge}55`,
                        padding: "4px 8px",
                      }}
                    >
                      {l.status}
                    </span>
                  </div>
                </HudCard>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-10 flex justify-center">
        <button
          type="button"
          onClick={() => navigate({ to: "/join", search: { browse: "1" } as any })}
          className="inline-flex items-center justify-center gap-2 font-mono uppercase transition-all hover:brightness-125"
          style={{
            background: "transparent",
            color: ACCENT,
            letterSpacing: "0.22em",
            fontSize: 12,
            padding: "14px 22px",
            minWidth: 200,
            height: 48,
            borderRadius: 0,
            border: `1px solid ${ACCENT_SOFT}`,
            cursor: "pointer",
          }}
        >
          ACTIVE MISSIONS LIST <ArrowRight size={14} />
        </button>
      </div>
    </SectionShell>
  );
}

/* ---------- 4. HOW IT WORKS / OPERATIONAL MANUAL ---------- */
type HowStep = {
  eyebrow: string;
  title: string;
  body: string;
  Icon: typeof QrCode;
};

function HowItWorks() {
  const steps: HowStep[] = [
    {
      eyebrow: "STEP 01 // COMMENCE OPERATION",
      title: "JOIN THE LOBBY",
      body: "Scan the Player HUD card QR (or join via website), claim your callsign, and pick your faction (RED or BLUE).",
      Icon: QrCode,
    },
    {
      eyebrow: "STEP 02 // ACTIVE MISSION",
      title: "ACTIVATE OBJECTIVES",
      body: "Move to spawn points. After the marshal starts the game it is your mission to locate physical QR points across the field and scan them to trigger tactical functions for the active game mode.",
      Icon: Crosshair,
    },
    {
      eyebrow: "STEP 03 // TRACKING",
      title: "PLAYER HUD",
      body: "Track live scores on your Player HUD and follow in-game rules and missions to secure victory.",
      Icon: Flag,
    },
  ];

  return (
    <SectionShell>
      <SectionHeader
        eyebrow="// FIELD MANUAL"
        title="HOW IT WORKS / OPERATIONAL MANUAL"
        sub="The universal QR flow that powers every SpartanOps match."
      />

      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {steps.map((s, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <li
              key={s.title}
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 20,
                paddingBottom: isLast ? 0 : 36,
              }}
            >
              {/* Icon tile + vertical connector */}
              <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    border: `1px solid ${ACCENT}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(232,154,10,0.06)",
                    color: ACCENT,
                    flexShrink: 0,
                  }}
                >
                  <s.Icon size={26} strokeWidth={1.6} />
                </div>
                {!isLast && (
                  <span
                    aria-hidden
                    style={{
                      flex: 1,
                      width: 0,
                      marginTop: 8,
                      borderLeft: `1px dashed ${ACCENT_SOFT}`,
                      minHeight: 24,
                    }}
                  />
                )}
              </div>

              {/* Text */}
              <div style={{ paddingTop: 2 }}>
                <p
                  className="font-mono uppercase"
                  style={{ fontSize: 10, letterSpacing: "0.28em", color: MUTED, marginBottom: 6 }}
                >
                  {s.eyebrow}
                </p>
                <h3
                  style={{
                    fontFamily: "'Michroma', monospace",
                    fontSize: "clamp(18px, 3.2vw, 24px)",
                    letterSpacing: "0.08em",
                    color: INK,
                    lineHeight: 1.2,
                    marginBottom: 8,
                  }}
                >
                  {s.title}
                </h3>
                <p className="text-[14px] leading-[1.7]" style={{ color: MUTED }}>
                  {s.body}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-10 flex justify-center">
        <BtnOutline to="/intel">
          Read Field Manual <ArrowRight size={14} />
        </BtnOutline>
      </div>
    </SectionShell>
  );
}




/* ---------- SECTOR SHOWCASE (right below hero) ---------- */
const SECTOR_IMG =
  "https://res.cloudinary.com/dfifiytid/image/upload/v1783854912/SpartanOps%20app%20v1.0/GALERIJA/homepage_asortiman-14.webp";

function SectorShowcase() {
  return (
    <section className="w-full px-4 sm:px-6 lg:px-8 pt-10 md:pt-16 pb-16 md:pb-24 relative overflow-hidden">
      <div className="max-w-6xl mx-auto relative">
        {/* ambient glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 55%, rgba(232,154,10,0.28) 0%, rgba(232,154,10,0.08) 35%, transparent 70%)",
            filter: "blur(20px)",
            pointerEvents: "none",
          }}
        />
        <div className="relative flex flex-col items-center text-center">
          <p
            className="font-mono uppercase mb-3"
            style={{ fontSize: 11, letterSpacing: "0.32em", color: ACCENT }}
          >
            // TACTICAL SIMPLICITY
          </p>
          <h2
            style={{
              fontFamily: "'Michroma', monospace",
              fontSize: "clamp(20px, 3.4vw, 30px)",
              letterSpacing: "0.10em",
              color: INK,
              lineHeight: 1.2,
              maxWidth: 820,
            }}
          >
            REVOLUTIONIZE YOUR AIRSOFT FIELD
          </h2>
          <img
            src={SECTOR_IMG}
            alt="SpartanOps tactical QR plate assortment"
            className="block w-full h-auto mt-8"
            style={{
              maxWidth: "min(880px, 96vw)",
              filter: "drop-shadow(0 24px 60px rgba(232,154,10,0.25)) drop-shadow(0 0 24px rgba(0,0,0,0.6))",
            }}
            loading="lazy"
            decoding="async"
          />
          <p
            className="mt-8 text-[14px] md:text-[15px] leading-[1.75]"
            style={{ color: MUTED, maxWidth: 720 }}
          >
            Airsoft games are incredibly fun, but organizing and tracking objectives on the field is often
            technically complicated. Traditional electronic props used for real-time sector tracking can be an
            immense financial burden — especially for smaller clubs and field operators.
          </p>

          <div
            className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"
            style={{ maxWidth: 820 }}
          >
            {[
              {
                k: "// ZERO ELECTRONICS",
                v: "No expensive props, no batteries, no wiring, no maintenance. Just print, weatherproof, and deploy.",
              },
              {
                k: "// LIVE TRACKING",
                v: "Real-time sector control, live scoring and instant capture feedback for every player on the field.",
              },
              {
                k: "// PURE IMMERSION",
                v: "High-visibility tactical QR plates and a battle-ready HUD built for outdoor combat scenarios.",
              },
            ].map((b) => (
              <div
                key={b.k}
                className="p-4"
                style={{
                  border: `1px solid ${ACCENT}33`,
                  background: "rgba(224,176,78,0.04)",
                }}
              >
                <p
                  className="font-mono uppercase mb-2"
                  style={{ fontSize: 10, letterSpacing: "0.24em", color: ACCENT }}
                >
                  {b.k}
                </p>
                <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{b.v}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <BtnOutline to="/print">
              <Printer size={14} /> Get Print Files
            </BtnOutline>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 5. FIELD SUPPLY ---------- */
function FieldSupply() {
  return (
    <SectionShell>
      <HudCard className="p-8 md:p-10">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-6">
          <div>
            <p
              className="font-mono uppercase mb-3"
              style={{ fontSize: 11, letterSpacing: "0.32em", color: ACCENT }}
            >
              // LOGISTICS
            </p>
            <h2
              style={{
                fontFamily: "'Michroma', monospace",
                fontSize: "clamp(20px, 3vw, 28px)",
                letterSpacing: "0.10em",
                color: ACCENT,
              }}
            >
              FIELD SUPPLY POST
            </h2>
            <p className="mt-3 text-[14px] md:text-[15px] leading-[1.7]" style={{ color: MUTED, maxWidth: 620 }}>
              Download ready-to-print field assets, sector markers, and game rules.
            </p>
          </div>
          <div className="shrink-0">
            <BtnPrimary to="/print">
              <Printer size={14} /> Access Print Files
            </BtnPrimary>
          </div>
        </div>
      </HudCard>
    </SectionShell>
  );
}

/* ---------- 6. CHANGELOG ---------- */
function Changelog() {
  const entries = [
    {
      date: "July 16, 2026",
      title: "SPARTACUS GPS ANTI-CHEAT V1.0",
      body: "Deployed the Spartacus anti-cheat module. Every objective QR code is anchored to real-world GPS coordinates on its first legitimate scan of the match. Any subsequent capture attempted more than 10 meters from that anchor is instantly flagged in the Marshal Command Center — fraudulent scans do not count towards the score until approved.",
    },
    {
      date: "July 12, 2026",
      title: "OFFICIAL APP LAUNCH // VERSION 1.0",
      body: "The wait is over. After rigorous field testing, the official SpartanOps application is live. Fully optimized, deployed on a dedicated standalone network, and battle-ready for players and fields worldwide.",
    },
    {
      date: "July 11, 2026",
      title: "NEXT-GEN UI OVERHAUL",
      body: "Redesigned the entire user interface from scratch. Engineered a high-contrast, premium tactical dark theme optimized for maximum readability under intense outdoor sunlight and high-stress field scenarios.",
    },
  ];
  return (
    <SectionShell>
      <SectionHeader
        eyebrow="// DEVLOG"
        title="SYSTEM UPDATES"
        sub="For the best user experience we are constantly testing and updating this website."
      />
      <ol
        className="relative"
        style={{
          borderLeft: `1px solid ${ACCENT_SOFT}`,
          paddingLeft: 32,
          listStyle: "none",
          margin: 0,
        }}
      >
        {entries.map((e) => (
          <li key={e.title} className="pb-10 last:pb-0 relative flex flex-col gap-2">
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: -37,
                top: 6,
                width: 10,
                height: 10,
                background: ACCENT,
                boxShadow: `0 0 12px ${ACCENT}`,
              }}
            />
            <p
              className="font-mono uppercase m-0"
              style={{ fontSize: 10, letterSpacing: "0.28em", color: ACCENT, lineHeight: 1.2 }}
            >
              {e.date}
            </p>
            <h3
              className="mt-1"
              style={{
                fontFamily: "'Michroma', monospace",
                fontSize: 14,
                letterSpacing: "0.08em",
                color: INK,
                lineHeight: 1.4,
                wordBreak: "break-word",
              }}
            >
              {e.title}
            </h3>
            <p className="mt-1 text-[14px] leading-[1.7]" style={{ color: MUTED }}>
              {e.body}
            </p>
          </li>
        ))}
      </ol>
      <div className="mt-10 flex justify-center">
        <Link
          to="/updates"
          className="inline-flex items-center gap-2 font-mono uppercase transition-all hover:brightness-110"
          style={{
            background: "transparent",
            color: ACCENT,
            border: `1px solid ${ACCENT}`,
            padding: "12px 22px",
            fontSize: 11,
            letterSpacing: "0.24em",
            textDecoration: "none",
          }}
        >
          See all updates →
        </Link>
      </div>
    </SectionShell>
  );
}


/* ---------- 7. OPERATIONAL PLANS ---------- */
function OperationalPlans() {
  const core = [
    "Domination Game Mode (Full Access)",
    "Player Limit: Up to 30 active players per lobby",
    "Standard Factions (Classic BLUE vs RED team setup)",
    "Cost: $0 / Free Forever",
  ];
  const premium = [
    "Extended Player Limits (30+ players)",
    "Search & Destroy Game Mode unlock",
    "Multiple Teams unlock (Deploy 3-5 custom factions simultaneously for multi-front operations)",
    "On-Command Auto-Balancing (Instantly balance teams with one click based on registered player experience levels)",
    "Custom field setup & dedicated branding",
  ];
  return (
    <SectionShell id="pricing">
      <SectionHeader eyebrow="// SYSTEM LICENSING" title="OPERATIONAL PLANS" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 md:items-stretch">
        {/* TIER 01 — Minimalist, no card */}
        <div className="flex flex-col py-2 md:py-4">
          <p
            className="font-mono uppercase mb-2"
            style={{ fontSize: 11, letterSpacing: "0.28em", color: MUTED }}
          >
            TIER 01 // CORE
          </p>
          <h3
            style={{
              fontFamily: "'Michroma', monospace",
              fontSize: 20,
              letterSpacing: "0.10em",
              color: INK,
              lineHeight: 1.2,
            }}
          >
            FREE TIER
          </h3>
          <div style={{ width: 40, height: 1, background: ACCENT_SOFT, marginTop: 14 }} />
          <ul className="mt-6 space-y-3 flex-1">
            {core.map((b) => (
              <li key={b} className="flex gap-3 text-[14px] leading-[1.6]" style={{ color: INK }}>
                <span style={{ marginTop: 8, width: 6, height: 6, background: MUTED, display: "inline-block", flexShrink: 0 }} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <BtnOutline to="/admin-pregled">Start Free Operation</BtnOutline>
          </div>
        </div>

        {/* TIER 02 — Featured, premium card */}
        <div
          className="relative flex flex-col p-6 md:p-8"
          style={{
            background: PANEL_2,
            border: `1px solid ${ACCENT_SOFT}`,
            borderLeft: `3px solid ${ACCENT}`,
            boxShadow: `0 0 40px -10px ${ACCENT_SOFT}`,
          }}
        >
          <span style={cornerTick("tr")} />
          <span style={cornerTick("br")} />
          <span
            className="absolute font-mono uppercase"
            style={{
              top: -10,
              right: 16,
              background: ACCENT,
              color: "#0a0a0a",
              fontSize: 10,
              letterSpacing: "0.24em",
              padding: "4px 10px",
              boxShadow: `0 0 16px -4px ${ACCENT}`,
            }}
          >
            // RECOMMENDED FOR FIELDS
          </span>
          <p
            className="font-mono uppercase mb-2 mt-2"
            style={{ fontSize: 11, letterSpacing: "0.28em", color: ACCENT }}
          >
            TIER 02 // PREMIUM
          </p>
          <h3
            style={{
              fontFamily: "'Michroma', monospace",
              fontSize: 20,
              letterSpacing: "0.10em",
              color: ACCENT,
              lineHeight: 1.2,
            }}
          >
            PREMIUM & CUSTOM MODULES
          </h3>
          <div style={{ width: 40, height: 1, background: ACCENT, marginTop: 14 }} />
          <ul className="mt-6 space-y-3 flex-1">
            {premium.map((b) => (
              <li key={b} className="flex gap-3 text-[14px] leading-[1.6]" style={{ color: INK }}>
                <span style={{ marginTop: 8, width: 6, height: 6, background: ACCENT, display: "inline-block", flexShrink: 0, boxShadow: `0 0 8px ${ACCENT}` }} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <a
              href="mailto:info@spartanopsapp.com?subject=Premium%20Access%20Request"
              className="inline-flex items-center justify-center gap-2 font-mono uppercase transition-all hover:brightness-110"
              style={{
                background: ACCENT,
                color: "#0a0a0a",
                letterSpacing: "0.22em",
                fontSize: 12,
                padding: "14px 22px",
                borderRadius: 0,
                border: `1px solid ${ACCENT}`,
                boxShadow: `0 0 32px -6px ${ACCENT}`,
              }}
            >
              Request Premium Access
            </a>
          </div>
        </div>
      </div>
      <p
        className="mt-10 text-[12px] leading-[1.7]"
        style={{ color: MUTED, letterSpacing: "0.02em", maxWidth: 820 }}
      >
        <span style={{ color: ACCENT, fontFamily: "'Rajdhani', monospace", letterSpacing: "0.18em" }}>
          SYSTEM NOTICE:
        </span>{" "}
        SpartanOps Web App is currently under active development. The developers reserve the right to
        modify features, tiers, and pricing structures at any time. For premium upgrades, custom field
        integration, or high-capacity events, please contact command network directly.
      </p>
    </SectionShell>
  );
}

/* ---------- PAGE ---------- */
function SpartanOpsHome() {
  return (
    <div style={{ background: BG, color: INK, minHeight: "100vh", paddingTop: 80 }}>
      {/* Modular sections — reorder or remove freely */}
      <Hero />
      <SectorShowcase />
      <LiveTracker />
      <Locations />
      <HowItWorks />

      <FieldSupply />
      <OperationalPlans />
      <Changelog />
    </div>
  );
}

// Silence unused imports if a section is removed
void Crosshair; void QrCode; void Flag;
