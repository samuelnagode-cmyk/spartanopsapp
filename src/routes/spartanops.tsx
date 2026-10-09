import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { Crosshair, QrCode, ArrowRight, Printer, Flag, ZapOff, Scale, Repeat, Trophy, Smartphone } from "lucide-react";
import { useT, useLang } from "@/lib/i18n";
import { PLAN_LIMITS, FOUNDING_OFFER, foundingApplicationMailto, eventLicenceMailto, formatFoundingDate } from "@/lib/plans";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import FeatureShowcase from "@/components/FeatureShowcase";
import { useSignedIn } from "@/lib/use-signed-in";


const PAGE_TITLE = "SpartanOps — Live-scored airsoft games, no electronic props";
const PAGE_DESC =
  "Run airsoft domination games with printed QR codes and players' phones. Live scoring, optional anti-cheat, free to start. No hardware, no app to install.";

export const Route = createFileRoute("/spartanops")({
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESC },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
    <div className="mb-7 md:mb-14">
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
          fontSize: "clamp(18px, 2.4vw, 26px)",
          letterSpacing: "0.08em",
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
  const t = useT();
  const startTo = useStartFreeTarget();
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
          style={{ opacity: 0.18 }}
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

      <SectionShell className="relative pt-16 md:pt-20 pb-2 md:pb-6">
        <div className="relative text-center" style={{ zIndex: 1 }}>
          <div className="origin-top scale-[0.6] -mb-[59px] md:scale-100 md:mb-0">
            <Reticle />
          </div>
          <div className="relative mx-auto" style={{ maxWidth: "min(560px, 88vw)", width: "100%" }}>
            <img
              src={LOGO_URL}
              alt="SpartanOps"
              className="mx-auto block w-full h-auto"
              loading="eager"
              decoding="async"
            />
          </div>
          <h1
            className="mx-auto mt-5"
            style={{ fontFamily: "'Michroma', monospace", fontSize: "clamp(22px, 3.4vw, 34px)", letterSpacing: "0.04em", color: INK, lineHeight: 1.25, maxWidth: 760, textWrap: "balance" }}
          >
            {t("spartan.heroHeadline")}
          </h1>
          <p
            className="mx-auto mt-4 max-w-[300px] md:max-w-[560px] text-[14px] md:text-[16px] leading-[1.6]"
            style={{ color: MUTED, textWrap: "balance" }}
          >
            {t("spartan.heroSubtext")}
          </p>
          <div className="mt-8 md:mt-9 mx-auto" style={{ maxWidth: 360 }}>
            <BtnPrimary to={startTo} fullWidth>{t("spartan.btnStartFreeCta")}</BtnPrimary>
          </div>
          <Link
            to="/join"
            className="inline-flex items-center min-h-[44px] mt-1 font-mono text-[13px] no-underline underline-offset-4 hover:underline"
            style={{ color: MUTED, letterSpacing: "0.04em" }}
          >
            {t("spartan.heroJoinLink")}
          </Link>
        </div>
      </SectionShell>
    </div>
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
  const t = useT();
  const steps: HowStep[] = [
    {
      eyebrow: t("spartan.step1Tag"),
      title: t("spartan.step1Title"),
      body: t("spartan.step1Desc"),
      Icon: QrCode,
    },
    {
      eyebrow: t("spartan.step2Tag"),
      title: t("spartan.step2Title"),
      body: t("spartan.step2Desc"),
      Icon: Crosshair,
    },
    {
      eyebrow: t("spartan.step3Tag"),
      title: t("spartan.step3Title"),
      body: t("spartan.step3Desc"),
      Icon: Flag,
    },
  ];

  return (
    <SectionShell>
      <SectionHeader
        eyebrow={t("spartan.tagManual")}
        title={t("spartan.titleManual")}
        sub={t("spartan.descManual")}
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
function SectorShowcase() {
  const t = useT();
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
            {t("spartan.tagSimplicity")}
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
            {t("spartan.titleRevolutionize")}
          </h2>
          <p className="mt-3 text-[14px] md:text-[15px] leading-[1.7]" style={{ color: MUTED, maxWidth: 620 }}>
            {t("spartan.showcaseLead")}
          </p>
          <div className="mt-8 w-full">
            <FeatureShowcase />
          </div>

          <div className="mt-8">
            <BtnOutline to="/print">
              <Printer size={14} /> {t("spartan.btnGetPrintFiles")}
            </BtnOutline>
          </div>

        </div>
      </div>
    </section>
  );
}

/* ---------- 7. PRICING ---------- */
function OperationalPlans() {
  const t = useT();
  const { lang } = useLang();
  const startTo = useStartFreeTarget();
  const fill = (s: string, v: Record<string, string | number>) =>
    Object.entries(v).reduce((acc, [k, val]) => acc.split(`{${k}}`).join(String(val)), s);
  const free = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => fill(t(`pricing.free${i}`), { n: PLAN_LIMITS.free.maxPlayers }));
  const now = [
    fill(t("pricing.now1"), { n: PLAN_LIMITS.founding.maxPlayers }),
    t("pricing.now2"),
    t("pricing.now4"),
  ];
  // Auto-balance currently only opens the upgrade notice, so it is listed as coming soon.
  const soon = [t("pricing.soonBalance"), t("pricing.soon1"), t("pricing.soon2"), t("pricing.soon3"), t("pricing.soon4")];
  const founding = fill(t("pricing.foundingText"), {
    date: formatFoundingDate(lang),
    pct: FOUNDING_OFFER.discountPercent,
    spots: FOUNDING_OFFER.spots,
  });
  const titleStyle = { fontFamily: "'Michroma', monospace", fontSize: 20, letterSpacing: "0.10em", lineHeight: 1.2 } as const;
  const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E0B04E]";
  return (
    <SectionShell id="pricing">
      <SectionHeader eyebrow={t("pricing.eyebrow")} title={t("spartan.titlePlans")} sub={t("pricing.sub")} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:grid-rows-[1fr_auto] lg:gap-x-8 lg:gap-y-0">
        {/* FREE — quiet card */}
        <div className="min-w-0 border p-6 lg:row-span-2 lg:grid lg:grid-rows-subgrid lg:p-8" style={{ borderColor: HAIRLINE }}>
          <div>
            <p className="font-mono uppercase mb-2 mt-3 text-balance" style={{ fontSize: 11, letterSpacing: "0.28em", color: MUTED }}>
              {t("pricing.freeTag")}
            </p>
            <h3 style={{ ...titleStyle, color: INK }}>{t("pricing.freeTitle")}</h3>
            <div style={{ width: 40, height: 1, background: ACCENT_SOFT, marginTop: 14 }} />
            <ul className="mt-6 space-y-3">
              {free.map((b) => (
                <li key={b} className="flex gap-3 text-[14px] leading-[1.6]" style={{ color: INK }}>
                  <span style={{ marginTop: 8, width: 6, height: 6, background: MUTED, display: "inline-block", flexShrink: 0 }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8 lg:mt-0 lg:pt-8">
            <div className="[&>a]:w-full sm:[&>a]:w-auto [&>a:focus-visible]:outline [&>a:focus-visible]:outline-2 [&>a:focus-visible]:outline-offset-2 [&>a:focus-visible]:outline-[#E0B04E]">
              <BtnOutline to={startTo}>{t("spartan.btnStartFreeCta")}</BtnOutline>
            </div>
            <p className="mt-3 text-[12.5px] leading-[1.6]" style={{ color: MUTED }}>{t("pricing.freeFootnote")}</p>
          </div>
        </div>

        {/* PRO — featured */}
        <div
          className="relative min-w-0 p-6 lg:row-span-2 lg:grid lg:grid-rows-subgrid lg:p-8"
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
              maxWidth: "calc(100% - 32px)",
            }}
          >
            {t("pricing.proBadge")}
          </span>
          <div>
            <p className="font-mono uppercase mb-2 mt-3 text-balance" style={{ fontSize: 11, letterSpacing: "0.28em", color: ACCENT }}>
              {t("pricing.proTag")}
            </p>
            <h3 style={{ ...titleStyle, color: ACCENT }}>{t("pricing.proTitle")}</h3>
            <div style={{ width: 40, height: 1, background: ACCENT, marginTop: 14 }} />
            <div className="mt-6" style={{ background: "rgba(224,176,78,0.08)", border: `1px solid ${ACCENT_SOFT}`, padding: "14px 16px" }}>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: INK }}>
                <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: "0.2em", color: ACCENT }}>
                  {t("pricing.foundingLabel")}
                </span>{" "}
                {founding}
              </p>
            </div>
            <p className="mt-6 text-[14px]" style={{ color: MUTED }}>{t("pricing.leadIn")}</p>
            <ul className="mt-3 space-y-3">
              {now.map((b) => (
                <li key={b} className="flex gap-3 text-[14px] leading-[1.6]" style={{ color: INK }}>
                  <span style={{ marginTop: 8, width: 6, height: 6, background: ACCENT, display: "inline-block", flexShrink: 0, boxShadow: `0 0 8px ${ACCENT}` }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <p className="font-mono uppercase mt-6" style={{ fontSize: 10.5, letterSpacing: "0.28em", color: MUTED }}>
              {t("pricing.soonLabel")}
            </p>
            <ul className="mt-3 space-y-3">
              {soon.map((b) => (
                <li key={b} className="flex gap-3 text-[14px] leading-[1.6]" style={{ color: MUTED }}>
                  <span style={{ marginTop: 8, width: 6, height: 6, border: `1px solid ${MUTED}`, display: "inline-block", flexShrink: 0 }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8 lg:mt-0 lg:pt-8">
            <a
              href={foundingApplicationMailto(lang)}
              className={`inline-flex w-full sm:w-auto items-center justify-center text-center font-mono uppercase transition-all hover:brightness-110 tracking-[0.12em] sm:tracking-[0.22em] ${focus}`}
              style={{
                background: ACCENT,
                color: "#0a0a0a",
                fontSize: 12,
                lineHeight: 1.35,
                padding: "8px 18px",
                minHeight: 48,
                borderRadius: 0,
                border: `1px solid ${ACCENT}`,
                boxShadow: `0 0 32px -6px ${ACCENT}`,
              }}
            >
              {t("pricing.proButton")}
            </a>
            <p className="mt-3 text-[12.5px] leading-[1.6]" style={{ color: MUTED }}>{t("pricing.proUnder")}</p>
          </div>
        </div>
      </div>
      <p className="mt-10 text-[13.5px] leading-[1.7]" style={{ color: INK, maxWidth: 820 }}>
        {t("pricing.eventsText")}{" "}
        <a href={eventLicenceMailto(lang)} className={`underline underline-offset-4 ${focus}`} style={{ color: ACCENT }}>
          {t("pricing.eventsLink")}
        </a>
      </p>
      <p className="mt-3 text-[12px] leading-[1.7]" style={{ color: MUTED, letterSpacing: "0.02em", maxWidth: 820 }}>
        {t("pricing.beta")}
      </p>
    </SectionShell>
  );
}

/* ---------- PAGE ---------- */
function SpartanOpsHome() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, []);

  return (
    <div style={{ background: BG, color: INK, minHeight: "100dvh", paddingTop: 80 }}>
      {/* Modular sections — reorder or remove freely */}
      <Hero />
      <Benefits />
      <SectorShowcase />
      <HowItWorks />
      <OperationalPlans />
      <Faq />
      <FinalCta />
    </div>
  );
}

/* ---------- Signed-in aware "START FREE" target ---------- */
function useStartFreeTarget(): string {
  const signedIn = useSignedIn();
  return signedIn ? "/admin-pregled" : "/marshal-account";
}

/* ---------- BENEFITS ---------- */
function Benefits() {
  const t = useT();
  const reduce = useReducedMotion();
  const icons = [ZapOff, Scale, Repeat, Trophy, Smartphone];
  const items = [1, 2, 3, 4, 5].map((n, i) => ({
    title: t(`spartan.benefit${n}Title`),
    body: t(`spartan.benefit${n}Desc`),
    Icon: icons[i],
  }));
  return (
    <SectionShell>
      <SectionHeader title={t("spartan.benefitsTitle")} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((it, i) => {
          const featured = i === 0;
          return (
            <motion.div
              key={it.title}
              className={featured ? "col-span-2 md:col-span-4" : ""}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
            >
              <HudCard className="h-full p-4 md:p-5">
                <div className={featured ? "md:flex md:items-start md:gap-5" : ""}>
                  <it.Icon size={22} strokeWidth={1.6} color={ACCENT} style={{ marginBottom: 12, flexShrink: 0 }} />
                  <div className="min-w-0">
                    <h3
                      style={{ fontFamily: "'Michroma', monospace", fontSize: featured ? 14 : 13, letterSpacing: "0.04em", color: INK, lineHeight: 1.35, overflowWrap: "normal", wordBreak: "normal", hyphens: "manual" }}
                    >
                      {it.title}
                    </h3>
                    <p style={{ color: MUTED, fontSize: featured ? 14 : 13, lineHeight: 1.55, marginTop: 6 }}>{it.body}</p>
                  </div>
                </div>
              </HudCard>
            </motion.div>
          );
        })}
      </div>
    </SectionShell>
  );
}

/* ---------- FAQ ---------- */
function Faq() {
  const t = useT();
  return (
    <SectionShell>
      <SectionHeader title={t("spartan.faqTitle")} />
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <details key={n} className="group" style={{ background: PANEL, border: `1px solid ${HAIRLINE}` }}>
            <summary
              className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-4"
              style={{ color: INK, fontSize: 15 }}
            >
              <span>{t(`spartan.faqQ${n}`)}</span>
              <span className="font-mono transition-transform group-open:rotate-45" style={{ color: ACCENT, fontSize: 18 }} aria-hidden>+</span>
            </summary>
            <p className="px-4 pb-4 text-[14px] leading-[1.7]" style={{ color: MUTED }}>{t(`spartan.faqA${n}`)}</p>
          </details>
        ))}
      </div>
    </SectionShell>
  );
}

/* ---------- FINAL CTA ---------- */
function FinalCta() {
  const t = useT();
  const startTo = useStartFreeTarget();
  return (
    <SectionShell className="text-center pb-28 md:pb-36">
      <h2
        style={{ fontFamily: "'Michroma', monospace", fontSize: "clamp(20px, 3.4vw, 30px)", letterSpacing: "0.08em", color: INK, lineHeight: 1.3 }}
      >
        {t("spartan.finalCtaTitle")}
      </h2>
      <div className="mt-6 flex justify-center">
        <BtnPrimary to={startTo}>{t("spartan.btnStartFreeCta")}</BtnPrimary>
      </div>
    </SectionShell>
  );
}

// Silence unused imports if a section is removed
void Crosshair; void QrCode; void Flag;
