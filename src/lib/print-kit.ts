export type PrintLang = "sl" | "en";
export type PrintGroup = "domination" | "snd" | "respawn" | "extras";

export type PrintItem = {
  id: string;
  group: PrintGroup;
  /** false = kept in reserve, NOT rendered. Flip to true when the feature ships. */
  published: boolean;
  /** Used as the saved file name, language suffix is added automatically (-SL / -EN). */
  downloadName: string;
  title: { en: string; sl: string };
  hint?: { en: string; sl: string };
  files: Record<PrintLang, string>;
};

export const PRINT_GROUPS_ORDER: PrintGroup[] = ["domination", "snd", "respawn"]; // "extras" is never rendered for now

export const PRINT_ITEMS: PrintItem[] = [
  {
    id: "dom-alpha",
    group: "domination",
    published: true,
    downloadName: "SpartanOps-Domination-Alpha",
    title: { en: "Sector Alpha", sl: "Sektor Alpha" },
    hint: { en: "Place at the sector. Players scan it to capture.", sl: "Postavi na sektor. Igralci ga skenirajo za zavzetje." },
    files: {
      sl: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487586/SpartanOps%20app%20v2.0/Print%20kit%20v2/Slovenian/Dominacija/Domination-alpha-slo.jpg",
      en: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487517/SpartanOps%20app%20v2.0/Print%20kit%20v2/English/Dominacija/Domination-alpha-eng.jpg",
    },
  },
  {
    id: "dom-beta",
    group: "domination",
    published: true,
    downloadName: "SpartanOps-Domination-Beta",
    title: { en: "Sector Beta", sl: "Sektor Beta" },
    hint: { en: "Place at the sector. Players scan it to capture.", sl: "Postavi na sektor. Igralci ga skenirajo za zavzetje." },
    files: {
      sl: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487587/SpartanOps%20app%20v2.0/Print%20kit%20v2/Slovenian/Dominacija/Domination-beta-slo.jpg",
      en: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487517/SpartanOps%20app%20v2.0/Print%20kit%20v2/English/Dominacija/Domination-beta-eng.jpg",
    },
  },
  {
    id: "dom-gamma",
    group: "domination",
    published: true,
    downloadName: "SpartanOps-Domination-Gamma",
    title: { en: "Sector Gamma", sl: "Sektor Gamma" },
    hint: { en: "Place at the sector. Players scan it to capture.", sl: "Postavi na sektor. Igralci ga skenirajo za zavzetje." },
    files: {
      sl: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487592/SpartanOps%20app%20v2.0/Print%20kit%20v2/Slovenian/Dominacija/Domination-gama-slo.jpg",
      en: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487519/SpartanOps%20app%20v2.0/Print%20kit%20v2/English/Dominacija/Domination-gama-eng.jpg",
    },
  },
  {
    id: "dom-delta",
    group: "domination",
    published: true,
    downloadName: "SpartanOps-Domination-Delta",
    title: { en: "Sector Delta", sl: "Sektor Delta" },
    hint: { en: "Place at the sector. Players scan it to capture.", sl: "Postavi na sektor. Igralci ga skenirajo za zavzetje." },
    files: {
      sl: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487588/SpartanOps%20app%20v2.0/Print%20kit%20v2/Slovenian/Dominacija/Domination-delta-slo.jpg",
      en: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487517/SpartanOps%20app%20v2.0/Print%20kit%20v2/English/Dominacija/Domination-delta-eng.jpg",
    },
  },
  {
    id: "dom-epsilon",
    group: "domination",
    published: true,
    downloadName: "SpartanOps-Domination-Epsilon",
    title: { en: "Sector Epsilon", sl: "Sektor Epsilon" },
    hint: { en: "Place at the sector. Players scan it to capture.", sl: "Postavi na sektor. Igralci ga skenirajo za zavzetje." },
    files: {
      sl: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487591/SpartanOps%20app%20v2.0/Print%20kit%20v2/Slovenian/Dominacija/Domination-epsilon-slo.jpg",
      en: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487518/SpartanOps%20app%20v2.0/Print%20kit%20v2/English/Dominacija/Domination-epsilon-eng.jpg",
    },
  },
  {
    id: "snd-a",
    group: "snd",
    published: true,
    downloadName: "SpartanOps-Search-and-Destroy-Site-A",
    title: { en: "Site A", sl: "Točka A" },
    hint: { en: "Place at bomb site A.", sl: "Postavi na bombno točko A." },
    files: {
      sl: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487572/SpartanOps%20app%20v2.0/Print%20kit%20v2/Slovenian/Search%20and%20destroy/Search-A-slo.jpg",
      en: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487486/SpartanOps%20app%20v2.0/Print%20kit%20v2/English/Search%20and%20destrox/Search-A-eng.jpg",
    },
  },
  {
    id: "snd-b",
    group: "snd",
    published: true,
    downloadName: "SpartanOps-Search-and-Destroy-Site-B",
    title: { en: "Site B", sl: "Točka B" },
    hint: { en: "Place at bomb site B.", sl: "Postavi na bombno točko B." },
    files: {
      sl: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487575/SpartanOps%20app%20v2.0/Print%20kit%20v2/Slovenian/Search%20and%20destroy/Search-B-slo.jpg",
      en: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487487/SpartanOps%20app%20v2.0/Print%20kit%20v2/English/Search%20and%20destrox/Search-B-eng.jpg",
    },
  },
  {
    id: "snd-c",
    group: "snd",
    published: true,
    downloadName: "SpartanOps-Search-and-Destroy-Site-C",
    title: { en: "Site C", sl: "Točka C" },
    hint: { en: "Place at bomb site C.", sl: "Postavi na bombno točko C." },
    files: {
      sl: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487578/SpartanOps%20app%20v2.0/Print%20kit%20v2/Slovenian/Search%20and%20destroy/Search-C-slo.jpg",
      en: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487489/SpartanOps%20app%20v2.0/Print%20kit%20v2/English/Search%20and%20destrox/Search-C-eng.jpg",
    },
  },
  {
    id: "snd-bomb",
    group: "snd",
    published: true,
    downloadName: "SpartanOps-Search-and-Destroy-Bomb",
    title: { en: "The Bomb", sl: "Bomba" },
    hint: { en: "Strap it to a suitcase or wrap it in paper. Players carry it.", sl: "Pritrdi na kovček ali zavij v papir. Igralci jo nosijo." },
    files: {
      sl: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487573/SpartanOps%20app%20v2.0/Print%20kit%20v2/Slovenian/Search%20and%20destroy/Search-bomb-slo.jpg",
      en: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487487/SpartanOps%20app%20v2.0/Print%20kit%20v2/English/Search%20and%20destrox/Search-bomb-eng.jpg",
    },
  },
  {
    id: "respawn",
    group: "respawn",
    published: true,
    downloadName: "SpartanOps-Respawn-Banner",
    title: { en: "Respawn banner", sl: "Respawn baner" },
    hint: { en: "Hang at the respawn zone. Players scan it after being hit.", sl: "Obesi v respawn coni. Igralci ga skenirajo po zadetku." },
    files: {
      sl: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487557/SpartanOps%20app%20v2.0/Print%20kit%20v2/Slovenian/Dodatki/respawn-slo.jpg",
      en: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487536/SpartanOps%20app%20v2.0/Print%20kit%20v2/English/Extras/respawn-eng.jpg",
    },
  },
  {
    id: "intel",
    group: "extras",
    published: false,
    downloadName: "SpartanOps-Intel-Suitcase",
    title: { en: "Intel suitcase", sl: "Obveščevalni kovček" },
    files: {
      sl: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487552/SpartanOps%20app%20v2.0/Print%20kit%20v2/Slovenian/Dodatki/intel-suitcase-slo.jpg",
      en: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487532/SpartanOps%20app%20v2.0/Print%20kit%20v2/English/Extras/intel-suitcase-eng.jpg",
    },
  },
  {
    id: "mystery",
    group: "extras",
    published: false,
    downloadName: "SpartanOps-Mystery-Box",
    title: { en: "Mystery box", sl: "Skrivnostna skrinja" },
    files: {
      sl: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487556/SpartanOps%20app%20v2.0/Print%20kit%20v2/Slovenian/Dodatki/mystery-box-slo.jpg",
      en: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487535/SpartanOps%20app%20v2.0/Print%20kit%20v2/English/Extras/mysterybox-eng.jpg",
    },
  },
  {
    id: "koth",
    group: "extras",
    published: false,
    downloadName: "SpartanOps-King-of-the-Hill-Fortress",
    title: { en: "King of the Hill: fortress", sl: "King of the Hill: trdnjava" },
    files: {
      sl: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487554/SpartanOps%20app%20v2.0/Print%20kit%20v2/Slovenian/Dodatki/koth-fortress-slo.jpg",
      en: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487533/SpartanOps%20app%20v2.0/Print%20kit%20v2/English/Extras/koth-fortress-eng.jpg",
    },
  },
  {
    id: "secret",
    group: "extras",
    published: false,
    downloadName: "SpartanOps-King-of-the-Hill-Secret-Entrance",
    title: { en: "King of the Hill: secret entrance", sl: "King of the Hill: skrivni vhod" },
    files: {
      sl: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487555/SpartanOps%20app%20v2.0/Print%20kit%20v2/Slovenian/Dodatki/koth-secret-entrance-slo.jpg",
      en: "https://res.cloudinary.com/dfifiytid/image/upload/v1791487533/SpartanOps%20app%20v2.0/Print%20kit%20v2/English/Extras/koth-secret-entrance-eng.jpg",
    },
  },
];

/** Insert a Cloudinary transformation right after /image/upload/. */
function withTransform(src: string, transform: string): string {
  const marker = "/image/upload/";
  if (!src.includes(marker)) {
    if (import.meta.env?.DEV) console.warn("[print-kit] not a Cloudinary upload URL:", src);
    return src;
  }
  return src.replace(marker, `${marker}${transform}/`);
}

/** Small sharp preview: f_auto,q_auto,w_<width>. Never use for downloads. */
export const previewUrl = (src: string, width: number) => withTransform(src, `f_auto,q_auto,w_${width}`);

/** Forces a file download with a clean name. The file itself is untouched: no resize, no recompression. */
export const downloadUrl = (src: string, name: string, lang: PrintLang) =>
  withTransform(src, `fl_attachment:${name}-${lang.toUpperCase()}`);
