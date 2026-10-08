import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useLang, useT } from "@/lib/i18n";
import { useSignedIn } from "@/lib/use-signed-in";
import {
  PRINT_GROUPS_ORDER,
  PRINT_ITEMS,
  downloadUrl,
  previewUrl,
  type PrintGroup,
  type PrintItem,
  type PrintLang,
} from "@/lib/print-kit";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import posterBackground from "@/assets/field-poster-background.jpg.asset.json";

const OG_ITEM = PRINT_ITEMS.find((i) => i.id === "dom-alpha")!;
const OG_IMAGE = previewUrl(OG_ITEM.files.en, 1200);
const TITLE = "Print kit — SpartanOps";
const DESC =
  "Free printable QR plates for airsoft games: Domination, Search & Destroy and respawn. A4 or A3, English and Slovenian.";

export const Route = createFileRoute("/print")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:image", content: OG_IMAGE },
    ],
  }),
  component: PrintKit,
});

const BG = "#0b0d0a";
const PANEL = "#12140f";
const ACCENT = "#e89a0a";
const INK = "#e7e3d6";
const MUTED = "rgba(231,227,214,0.60)";
const HAIRLINE = "rgba(231,227,214,0.10)";
const MICHROMA = "'Michroma', monospace";

const GROUP_KEYS: Record<PrintGroup, { title: string; desc: string }> = {
  domination: { title: "print.groupDominationTitle", desc: "print.groupDominationDesc" },
  snd: { title: "print.groupSndTitle", desc: "print.groupSndDesc" },
  respawn: { title: "print.groupRespawnTitle", desc: "print.groupRespawnDesc" },
  extras: { title: "", desc: "" },
};

const CSS = `
.pk-focus:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; }
.pk-preview { border: 1px solid ${HAIRLINE}; transition: border-color .15s; }
.pk-preview:hover, .pk-preview:focus-visible { border-color: ${ACCENT}; }
.pk-dl { border: 1px solid ${ACCENT}; color: ${ACCENT}; background: transparent; transition: background-color .15s, color .15s; }
.pk-dl:hover, .pk-dl:focus-visible { background: ${ACCENT}; color: #0a0a0a; }
@media (prefers-reduced-motion: reduce) { .pk-preview, .pk-dl { transition: none; } }
`;

function posterImage(src: string) {
  const m = "/image/upload/";
  return src.includes(m) ? src.replace(m, `${m}f_auto,q_auto,w_900/`) : src;
}

function PrintKit() {
  const t = useT();
  const { lang: appLang } = useLang();
  const [printLang, setPrintLang] = useState<PrintLang>(appLang);
  const [touched, setTouched] = useState(false);
  // Follow the app language until the user picks one here (handles hydration of saved language).
  useEffect(() => {
    if (!touched) setPrintLang(appLang);
  }, [appLang, touched]);
  const [open, setOpen] = useState<PrintItem | null>(null);

  const langName = (l: PrintLang) => t(l === "sl" ? "print.langNameSl" : "print.langNameEn");
  const ariaFor = (item: PrintItem) =>
    t("print.downloadAria").replace("{title}", item.title[appLang]).replace("{language}", langName(printLang));

  return (
    <div style={{ background: BG, color: INK, minHeight: "100dvh", paddingTop: 80, overflowX: "hidden" }}>
      <style>{CSS}</style>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Header + language switch */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div className="min-w-0">
            <p className="font-mono uppercase mb-3" style={{ fontSize: 11, letterSpacing: "0.32em", color: ACCENT }}>
              {t("print.kicker")}
            </p>
            <h1 style={{ fontFamily: MICHROMA, fontSize: "clamp(22px, 4.2vw, 40px)", letterSpacing: "0.08em", color: ACCENT, lineHeight: 1.2, textWrap: "balance" }}>
              {t("print.title")}
            </h1>
            <div style={{ width: 56, height: 1, background: ACCENT, marginTop: 18 }} />
            <p className="mt-4 text-[14px] md:text-[15px] leading-[1.7]" style={{ color: MUTED, maxWidth: 620 }}>
              {t("print.lead")}
            </p>
          </div>
          <div className="shrink-0">
            <p id="pk-lang-label" className="font-mono uppercase mb-2" style={{ fontSize: 10, letterSpacing: "0.28em", color: MUTED }}>
              {t("print.langLabel")}
            </p>
            <div role="radiogroup" aria-labelledby="pk-lang-label" className="flex">
              {(["sl", "en"] as PrintLang[]).map((l) => {
                const active = printLang === l;
                return (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => { setTouched(true); setPrintLang(l); }}
                    className="pk-focus font-mono uppercase"
                    style={{
                      minHeight: 44, padding: "0 18px", fontSize: 12, letterSpacing: "0.14em",
                      background: active ? ACCENT : "transparent", color: active ? "#0a0a0a" : INK,
                      border: `1px solid ${active ? ACCENT : "rgba(231,227,214,0.35)"}`, borderRadius: 0,
                      marginLeft: l === "en" ? -1 : 0,
                    }}
                  >
                    {t(l === "sl" ? "print.langSl" : "print.langEn")}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Steps */}
        <ol className="grid grid-cols-1 md:grid-cols-3" style={{ border: `1px solid ${HAIRLINE}` }}>
          {[1, 2, 3].map((n) => (
            <li key={n} className="p-5" style={{ borderTop: n > 1 ? `1px solid ${HAIRLINE}` : undefined }}>
              <div className="flex items-baseline gap-3">
                <span className="font-mono" style={{ color: ACCENT, fontSize: 13 }}>0{n}</span>
                <h2 style={{ fontFamily: MICHROMA, fontSize: 13, letterSpacing: "0.08em", color: INK }}>{t(`print.step${n}Title`)}</h2>
              </div>
              <p className="mt-2 text-[13px] leading-[1.6]" style={{ color: MUTED }}>{t(`print.step${n}Desc`)}</p>
            </li>
          ))}
        </ol>
        <style>{`@media (min-width:768px){ol > li + li{border-top:0 !important;border-left:1px solid ${HAIRLINE};}}`}</style>

        <PosterTile />

        {PRINT_GROUPS_ORDER.map((g) => {
          const items = PRINT_ITEMS.filter((i) => i.group === g && i.published && i.files[printLang]);
          if (!items.length) return null;
          return (
            <section key={g} className="mt-14">
              <h2 style={{ fontFamily: MICHROMA, fontSize: "clamp(16px, 2vw, 20px)", letterSpacing: "0.08em", color: ACCENT }}>
                {t(GROUP_KEYS[g].title)}
              </h2>
              <p className="mt-2 text-[14px]" style={{ color: MUTED }}>{t(GROUP_KEYS[g].desc)}</p>
              <div className="mt-4 mb-5" style={{ height: 1, background: HAIRLINE }} />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-5 items-start">
                {items.map((item) => (
                  <PlateCard
                    key={item.id}
                    item={item}
                    lang={appLang}
                    printLang={printLang}
                    langLabel={langName(printLang)}
                    aria={ariaFor(item)}
                    onOpen={() => setOpen(item)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {/* Tips */}
        <section className="mt-16 p-6 md:p-8" style={{ border: `1px solid ${HAIRLINE}`, background: PANEL }}>
          <p className="font-mono uppercase mb-5" style={{ fontSize: 11, letterSpacing: "0.32em", color: ACCENT }}>
            {t("print.tipsKicker")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
            {[1, 2, 3].map((n) => (
              <p key={n} className="text-[13.5px] leading-[1.7]" style={{ color: MUTED }}>{t(`print.tip${n}`)}</p>
            ))}
          </div>
        </section>
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        {open && (
          <DialogContent
            className="max-w-none sm:max-w-3xl w-screen sm:w-auto h-[100dvh] sm:h-auto rounded-none sm:rounded-none border p-5 flex flex-col"
            style={{ background: PANEL, color: INK, borderColor: HAIRLINE }}
          >
            <DialogTitle style={{ fontFamily: MICHROMA, fontSize: 14, letterSpacing: "0.08em", color: INK }}>
              {open.title[appLang]}
            </DialogTitle>
            <DialogDescription className="text-[13px]" style={{ color: MUTED }}>
              {open.hint?.[appLang] ?? t("print.preview")}
            </DialogDescription>
            <div className="flex-1 min-h-0 grid place-items-center" style={{ background: "#0d0f0b", padding: 10 }}>
              <img
                src={previewUrl(open.files[printLang], 1400)}
                alt={`${open.title[appLang]} — ${langName(printLang)}`}
                style={{ maxHeight: "80dvh", maxWidth: "100%", objectFit: "contain" }}
              />
            </div>
            <a
              href={downloadUrl(open.files[printLang], open.downloadName, printLang)}
              download
              rel="noopener"
              aria-label={ariaFor(open)}
              className="pk-dl pk-focus font-mono uppercase flex items-center justify-center gap-2"
              style={{ minHeight: 44, fontSize: 12, letterSpacing: "0.18em", textDecoration: "none" }}
            >
              <Download size={15} /> {t("print.download")}
            </a>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function PlateCard({
  item, lang, printLang, langLabel, aria, onOpen,
}: {
  item: PrintItem; lang: PrintLang; printLang: PrintLang; langLabel: string; aria: string; onOpen: () => void;
}) {
  const t = useT();
  const file = item.files[printLang];
  return (
    <article className="flex flex-col h-full" style={{ background: PANEL, border: `1px solid ${HAIRLINE}` }}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${t("print.preview")}: ${item.title[lang]}`}
        className="pk-preview pk-focus block w-full"
        style={{ aspectRatio: "5 / 7", background: "#0d0f0b", padding: 10, margin: -1, width: "calc(100% + 2px)" }}
      >
        <img
          src={previewUrl(file, 600)}
          alt={`${item.title[lang]} — ${langLabel}`}
          loading="lazy"
          decoding="async"
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      </button>
      <div className="p-3 md:p-4 flex flex-col flex-1">
        <h3 style={{ fontFamily: MICHROMA, fontSize: 11.5, letterSpacing: "0.06em", color: INK, lineHeight: 1.4 }}>
          {item.title[lang]}
        </h3>
        <p
          className="mt-2"
          style={{
            fontSize: 12.5, lineHeight: 1.5, color: MUTED, minHeight: "4.5em",
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}
        >
          {item.hint?.[lang] ?? ""}
        </p>
        <a
          href={downloadUrl(file, item.downloadName, printLang)}
          download
          rel="noopener"
          aria-label={aria}
          className="pk-dl pk-focus mt-3 font-mono uppercase flex items-center justify-center gap-2"
          style={{ minHeight: 44, fontSize: 11, letterSpacing: "0.12em", textDecoration: "none" }}
        >
          <Download size={14} /> {t("print.download")}
        </a>
      </div>
    </article>
  );
}

function PosterTile() {
  const t = useT();
  const signedIn = useSignedIn();
  return (
    <section
      className="mt-10 grid grid-cols-1 md:grid-cols-[1fr_minmax(0,320px)] overflow-hidden"
      style={{
        border: `1px solid ${ACCENT}`,
        background: "radial-gradient(ellipse at center, rgba(232,154,10,0.10) 0%, rgba(0,0,0,0) 70%), #12140f",
        boxShadow: "0 0 0 1px rgba(232,154,10,0.25), 0 0 28px rgba(232,154,10,0.25)",
      }}
    >
      <div className="order-2 md:order-1 p-6 md:p-10 flex flex-col justify-center">
        <p className="font-mono uppercase mb-3" style={{ fontSize: 11, letterSpacing: "0.32em", color: ACCENT }}>
          {t("print.posterKicker")}
        </p>
        <h2 style={{ fontFamily: MICHROMA, fontSize: "clamp(18px, 2.6vw, 26px)", letterSpacing: "0.08em", color: INK, lineHeight: 1.25 }}>
          {t("print.posterTitle")}
        </h2>
        <p className="mt-3 text-[14px] md:text-[15px] leading-[1.7]" style={{ color: MUTED, maxWidth: 520 }}>
          {t("print.posterDesc")}
        </p>
        <div className="mt-6">
          <Link
            to={signedIn ? "/field-qr" : "/marshal-account"}
            className="pk-focus inline-flex items-center justify-center font-mono uppercase"
            style={{
              background: ACCENT, color: "#0a0a0a", letterSpacing: "0.18em", fontSize: 12,
              minHeight: 48, padding: "0 24px", textDecoration: "none", boxShadow: "0 0 24px rgba(232,154,10,0.35)",
            }}
          >
            {t(signedIn ? "print.posterCtaOpen" : "print.posterCtaCreate")}
          </Link>
        </div>
      </div>
      <div className="order-1 md:order-2 relative" style={{ minHeight: 200 }}>
        <img
          src={posterImage(posterBackground.url)}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: "cover", objectPosition: "center 30%" }}
        />
      </div>
    </section>
  );
}
