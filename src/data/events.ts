/**
 * Airsoft Event Archive
 * ─────────────────────
 * Single source of truth for events shown on /arhiv.
 *
 * IMAGES: All event gallery images are hosted on Cloudinary.
 * Use FULL Cloudinary URLs in both `previewImage` and `images[]`.
 * Do NOT reference /public/images/events — that path is no longer used
 * for event galleries.
 *
 * Cloudinary folder convention:
 *   https://res.cloudinary.com/dfifiytid/image/upload/v<version>/
 *     Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/<Event-Folder>/<file>.webp
 *
 * TO ADD A NEW EVENT:
 * 1. Upload images to the matching Cloudinary folder.
 * 2. Add a new object below (newest first).
 * 3. Set `previewImage` to the hero/cover Cloudinary URL.
 * 4. List the remaining gallery URLs in `images[]`.
 */

export interface AirsoftEvent {
  id: string; // slug-style identifier, used for URL hashes
  title: string; // display name shown on the site
  date: string; // ISO format YYYY-MM-DD
  previewImage?: string; // Cloudinary URL used as the event cover (single)
  previewImages?: string[]; // Optional Cloudinary URLs shown on the archive card (first 3)
  images: string[]; // full Cloudinary URLs for the gallery
}

export const events: AirsoftEvent[] = [
  {
    id: "spartan-turnir-2026-04",
    title: "Spartan airsoft turnir",
    date: "2026-04-19",
    previewImages: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780305995/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/spartan-airsoft-turnir-2026-04/Preview_1.webp",

      "https://res.cloudinary.com/dfifiytid/image/upload/v1780305995/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/spartan-airsoft-turnir-2026-04/Preview_2.webp",

      "https://res.cloudinary.com/dfifiytid/image/upload/v1780305995/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/spartan-airsoft-turnir-2026-04/Preview_3.webp",
    ],

    images: Array.from({ length: 39 }, (_, i) => {
      const num = String(i + 1).padStart(3, "0");
      return `https://res.cloudinary.com/dfifiytid/image/upload/v1780303729/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/spartan-airsoft-turnir-2026-04/airsoft_turnir_4.2026-${num}.webp`;
    }),
  },
  {
    id: "spomladanski-turnir-2025-04",
    title: "Spomladanski turnir",
    date: "2025-04-06",
    previewImages: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780302804/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/spomladanski-turnir-2025-04/Preview_1.webp",

      "https://res.cloudinary.com/dfifiytid/image/upload/v1780302804/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/spomladanski-turnir-2025-04/Preview_2.webp",

      "https://res.cloudinary.com/dfifiytid/image/upload/v1780302804/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/spomladanski-turnir-2025-04/Preview_3.webp",
    ],
    images: Array.from({ length: 18 }, (_, i) => {
      const num = String(i + 1).padStart(3, "0");
      return `https://res.cloudinary.com/dfifiytid/image/upload/v1780297810/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/spomladanski-turnir-2025-04/turnir-2025-4-${num}.webp`;
    }),
  },
  {
    id: "obramba-crno-zlato-2025-02",
    title: "Obramba: Črno zlato",
    date: "2025-02-23",
    previewImages: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780250506/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/obramba-crno-zlato-2025-02/Preview_1.webp",

      "https://res.cloudinary.com/dfifiytid/image/upload/v1780250506/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/obramba-crno-zlato-2025-02/Preview_2.webp",

      "https://res.cloudinary.com/dfifiytid/image/upload/v1780250506/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/obramba-crno-zlato-2025-02/Preview_3.webp",
    ],
    images: Array.from({ length: 81 }, (_, i) => {
      const num = String(i + 1).padStart(3, "0");
      return `https://res.cloudinary.com/dfifiytid/image/upload/v1780250124/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/obramba-crno-zlato-2025-02/obramba-crno-zlato-2025-02-${num}.webp`;
    }),
  },
  {
    id: "halloween-2024-10",
    title: "Halloween scenarij",
    date: "2024-10-31",
    previewImages: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1779734855/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/Halloween-scenarij-2024-10/Preview_1.webp",

      "https://res.cloudinary.com/dfifiytid/image/upload/v1779734855/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/Halloween-scenarij-2024-10/Preview_2.webp",

      "https://res.cloudinary.com/dfifiytid/image/upload/v1779734855/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/Halloween-scenarij-2024-10/Preview_3.webp",
    ],

    images: Array.from({ length: 81 }, (_, i) => {
      const num = String(i + 1).padStart(3, "0");
      return `https://res.cloudinary.com/dfifiytid/image/upload/v1779738603/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/Halloween-scenarij-2024-10/halloween-scenarij-2024-10-${num}.webp`;
    }),
  },
  {
    id: "ats-vs-spartan-2024-09",
    title: "ATS proti SPARTAN",
    date: "2024-09-29",
    previewImages: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780258592/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/ats-vs-spartan-2024-09/Preview_1.webp",

      "https://res.cloudinary.com/dfifiytid/image/upload/v1780258592/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/ats-vs-spartan-2024-09/Preview_2.webp",

      "https://res.cloudinary.com/dfifiytid/image/upload/v1780258592/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/ats-vs-spartan-2024-09/Preview_3.webp",
    ],
    images: Array.from({ length: 142 }, (_, i) => {
      const num = String(i + 1).padStart(3, "0");
      return `https://res.cloudinary.com/dfifiytid/image/upload/v1780257088/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/ats-vs-spartan-2024-09/ats-vs-spartan-2024-09-${num}.webp`;
    }),
  },
  {
    id: "spartan-airsoft-spopad-2024-05",
    title: "SPARTAN AIRSOFT SPOMINI",
    date: "2024-05-05",
    previewImages: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1782380614/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/AIRSOFT%20RAZNE%20SLIKE%202/Preview_1.webp",

      "https://res.cloudinary.com/dfifiytid/image/upload/v1782380614/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/AIRSOFT%20RAZNE%20SLIKE%202/Preview_2.webp",

      "https://res.cloudinary.com/dfifiytid/image/upload/v1782380614/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/AIRSOFT%20RAZNE%20SLIKE%202/Preview_3.webp",
    ],
    images: Array.from({ length: 54 }, (_, i) => {
      const num = String(i + 1).padStart(3, "0");
      return `https://res.cloudinary.com/dfifiytid/image/upload/v1782378909/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/AIRSOFT%20RAZNE%20SLIKE%202/razne-slike-airsoft-${num}.webp`;
    }),
  },
  {
    id: "jesenski-turnir-2023-09",
    title: "Jesenski turnir",
    date: "2023-09-30",
    previewImages: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780296984/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/jesenski-turnir-2023-09/Preview_1.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780296984/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/jesenski-turnir-2023-09/Preview_2.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780296984/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/jesenski-turnir-2023-09/Preview_3.webp",
    ],
    images: Array.from({ length: 87 }, (_, i) => {
      const num = String(i + 1).padStart(3, "0");
      return `https://res.cloudinary.com/dfifiytid/image/upload/v1780264105/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/jesenski-turnir-2023-09/airsoft-turnir-2023-9-${num}.webp`;
    }),
  },
  {
    id: "avgustovski-spopad-2023-08",
    title: "Avgustovski spopad",
    date: "2023-08-12",
    previewImages: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780297573/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/avgustovski-spopad-2023-08/Preview_1.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780297573/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/avgustovski-spopad-2023-08/Preview_2.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780297573/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/avgustovski-spopad-2023-08/Preview_3.webp",
    ],
    images: Array.from({ length: 14 }, (_, i) => {
      const num = String(i + 1).padStart(3, "0");
      return `https://res.cloudinary.com/dfifiytid/image/upload/v1780297468/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/avgustovski-spopad-2023-08/avgustovski-spopad-2023-8-${num}.webp`;
    }),
  },
  {
    id: "junijski-spopad-2023-06",
    title: "Junijski spopad",
    date: "2023-06-24",
    previewImages: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780303222/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/junijski-spopad-2023-06/Preview_1.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780303222/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/junijski-spopad-2023-06/Preview_2.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780303222/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/junijski-spopad-2023-06/Preview_3.webp",
    ],
    images: Array.from({ length: 6 }, (_, i) => {
      const num = String(i + 1).padStart(3, "0");
      return `https://res.cloudinary.com/dfifiytid/image/upload/v1780303104/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/junijski-spopad-2023-06/junijski-spopad-2023-6-${num}.webp`;
    }),
  },
  {
    id: "zimski-spopad-2023-01",
    title: "Zimski spopad",
    date: "2023-01-28",
    previewImages: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1779862901/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/zimski-spopad-2023-01/Preview_1.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1779862902/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/zimski-spopad-2023-01/Preview_2.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1779862902/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/zimski-spopad-2023-01/Preview_3.webp",
    ],
    images: Array.from({ length: 14 }, (_, i) => {
      const num = String(i + 1).padStart(3, "0");
      return `https://res.cloudinary.com/dfifiytid/image/upload/v1779862903/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/zimski-spopad-2023-01/Zimski-spopad-2023-1-${num}.webp`;
    }),
  },
  {
    id: "pomladni-spopad-2022-03",
    title: "Otvoritveni spopad",
    date: "2022-03-20",
    previewImages: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780262871/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/pomladni-spopad-2022-03/Preview_1.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780262871/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/pomladni-spopad-2022-03/Preview_2.webp",
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780262871/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/pomladni-spopad-2022-03/Preview_3.webp",
    ],
    images: Array.from({ length: 95 }, (_, i) => {
      const num = String(i + 1).padStart(3, "0");
      return `https://res.cloudinary.com/dfifiytid/image/upload/v1780262490/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/pomladni-spopad-2022-03/otvoritveni-spopad-2022-03-${num}.webp`;
    }),
  },
  {
    id: "SPARTAN AIRSOFT RAZNE SLIKE",
    title: "SPARTAN AIRSOFT RAZNO 2022-2026",
    date: "2022-01-01",
    previewImages: [
      "https://res.cloudinary.com/dfifiytid/image/upload/v1780340011/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/AIRSOFT%20RAZNE%20SLIKE/Preview_1.webp",

      "https://res.cloudinary.com/dfifiytid/image/upload/v1780340011/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/AIRSOFT%20RAZNE%20SLIKE/Preview_2.webp",

      "https://res.cloudinary.com/dfifiytid/image/upload/v1780340011/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/AIRSOFT%20RAZNE%20SLIKE/Preview_3.webp",
    ],
    images: Array.from({ length: 30 }, (_, i) => {
      const num = String(i + 1).padStart(3, "0");
      return `https://res.cloudinary.com/dfifiytid/image/upload/v1780339391/Spletna%20stran%20GLAMPINGZELENIRAJ.SI/AIRSOFT/AIRSOFT%20RAZNE%20SLIKE/airsoft-razno-${num}.webp`;
    }),
  },
];

export const getEventCount = (): number => events.length;
