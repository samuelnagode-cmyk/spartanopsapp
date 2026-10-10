import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { PLAN_LIMITS } from "@/lib/plans";

type Audience = "marshals" | "players";

export const Route = createFileRoute("/intel")({
  validateSearch: (search: Record<string, unknown>): { for?: Audience } =>
    search.for === "players" ? { for: "players" } : {},
  head: () => ({
    meta: [
      { title: "Field manual — SpartanOps" },
      { name: "description", content: "How to set up a field and run a game with SpartanOps, and how players join and play." },
      { property: "og:title", content: "Field manual — SpartanOps" },
      { property: "og:description", content: "How to set up a field and run a game with SpartanOps, and how players join and play." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntelPage,
});

const BG = "#0b0d0a";
const PANEL = "#12140f";
const ACCENT = "#e89a0a";
const ACCENT_SOFT = "rgba(232,154,10,0.35)";
const INK = "#e7e3d6";
const MUTED = "rgba(231,227,214,0.60)";
const HAIRLINE = "rgba(231,227,214,0.10)";

type BriefingBlock = { eyebrow: string; title: string; bullets: (string | { note: string })[] };

function cornerTick(pos: "tl" | "tr" | "bl" | "br"): React.CSSProperties {
  const size = 10;
  const base: React.CSSProperties = { position: "absolute", width: size, height: size, borderColor: ACCENT_SOFT, borderStyle: "solid", borderWidth: 0 };
  if (pos === "tl") return { ...base, top: -1, left: -1, borderTopWidth: 1, borderLeftWidth: 1 };
  if (pos === "tr") return { ...base, top: -1, right: -1, borderTopWidth: 1, borderRightWidth: 1 };
  if (pos === "bl") return { ...base, bottom: -1, left: -1, borderBottomWidth: 1, borderLeftWidth: 1 };
  return { ...base, bottom: -1, right: -1, borderBottomWidth: 1, borderRightWidth: 1 };
}

function HudCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={className} style={{ background: PANEL, border: `1px solid ${HAIRLINE}`, position: "relative" }}>
      <span style={cornerTick("tl")} />
      <span style={cornerTick("tr")} />
      <span style={cornerTick("bl")} />
      <span style={cornerTick("br")} />
      {children}
    </div>
  );
}

function BriefingContent({ blocks }: { blocks: BriefingBlock[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {blocks.map((b) => (
        <div key={b.title}>
          <p className="font-mono uppercase mb-1" style={{ fontSize: 10, letterSpacing: "0.28em", color: ACCENT }}>
            {b.eyebrow}
          </p>
          <h3 style={{ fontFamily: "'Michroma', monospace", fontSize: 16, letterSpacing: "0.08em", color: INK, lineHeight: 1.3, marginBottom: 10 }}>
            {b.title}
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {b.bullets.map((raw, i) => {
              const isNote = typeof raw !== "string";
              const text = isNote ? (raw as { note: string }).note : (raw as string);
              return (
                <li key={i} className="text-[13.5px] leading-[1.7]"
                  style={{
                    color: isNote ? "rgba(231,227,214,0.55)" : MUTED,
                    fontStyle: isNote ? "italic" : "normal",
                    paddingLeft: 16,
                    position: "relative",
                  }}
                >
                  <span aria-hidden style={{
                    position: "absolute", left: 0, top: "0.55em", width: 6, height: 6,
                    background: isNote ? "transparent" : ACCENT,
                    border: isNote ? `1px solid ${ACCENT_SOFT}` : "none",
                    transform: "rotate(45deg)",
                  }} />
                  {text}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

const COPY = {
  en: {
    eyebrow: "// INTEL / FIELD MANUAL",
    title: "FIELD MANUAL",
    tabMarshals: "FOR MARSHALS",
    tabPlayers: "FOR PLAYERS",
    panelMarshals: "// MARSHAL MANUAL",
    panelPlayers: "// PLAYER MANUAL",
    back: "Back to home",
    marshals: [
      { eyebrow: "[01] ONE-TIME SETUP", title: "Set up your field", bullets: [
        "Create a free marshal account with your field's name. Add your city and country, so players can tell fields apart on the Join page.",
        "Set your field password. Players enter it the first time they join, and you can change it whenever you like.",
        "Download the print kit: one QR plate for each sector, plus the respawn plate. Print on A4 or A3, laminate with a matte film, and place the plates at chest height, out of direct sun.",
        "Test every code with your phone before the first game.",
        "Print your field poster (Marshal account → Player QR). Players scan it to find your field.",
      ] },
      { eyebrow: "[02] BEFORE EACH GAME", title: "Create the mission", bullets: [
        "Tap Create Mission and fill in the tabs: Mission, Gamemode, Rules, Extras and Map.",
        "Choose Domination, the match length, the pre-start countdown and the points needed to win. Free fields play with 2 teams; Pro and founding fields can use 3.",
        "Set the respawn rules.",
        "Upload your map and place the sectors and respawn points on it.",
        { note: "Optional: switch on the location check. Scans from the wrong place are flagged for you to approve or dismiss. Switch it on before players join, because they allow location when they check in." },
        { note: "Prepared missions stay saved. On game day you switch between them with one tap." },
      ] },
      { eyebrow: "[03] GAME DAY", title: "Run the game", bullets: [
        "Give players today's field password. They scan your poster, enter the password and check in.",
        "Watch the roster fill up. If the teams look uneven, move players between teams in Game review.",
        "Press Start Match. Players get a countdown to reach their spawn.",
        "During the game you can pause and resume the match, and follow the live leaderboard, map and event log.",
        "When the game ends, every player sees the results screen.",
        { note: `Free fields allow up to ${PLAN_LIMITS.free.maxPlayers} players per game, Pro and founding fields up to ${PLAN_LIMITS.pro.maxPlayers}.` },
      ] },
    ],
    players: [
      { eyebrow: "[01] JOIN", title: "Get into the game", bullets: [
        "Scan the marshal's poster QR with your phone, or open Join a game and pick your field from the list.",
        { note: "The first time, enter today's field password. Ask your marshal." },
        "Enter your callsign. Only the callsign is required. Your phone number is visible only to the marshal.",
        "If the mission uses the location check, tap Allow location. Then tap Enter the game.",
        "Pick your team, then wait for the countdown. The screen shows the rules and the map.",
      ] },
      { eyebrow: "[02] CAPTURE", title: "Take the sectors", bullets: [
        "When the game starts, find the QR plates placed around the field. Use the scanner inside the app, not your phone's camera app.",
        "Tap Scan code in the app and point the camera at a plate. Your team gets the sector and the score updates for everyone.",
        "If your team already holds the sector, the app tells you so.",
        { note: "If the mission uses the location check, scan while standing at the plate. Scans from somewhere else are flagged for the marshal to review." },
      ] },
      { eyebrow: "[03] DURING THE GAME", title: "Stay in the game", bullets: [
        "Keep the app open to follow the scoreboard, the capture log and the map.",
        "If you are hit, go to your respawn point and wait for the respawn timer, if the marshal turned it on.",
        "If the marshal pauses the game, scanning stops until the game resumes.",
        { note: "The marshal may move you to another team. A full-screen notice asks you to confirm." },
        { note: "Sound is off by default. You can switch music and sound effects on at check-in, and mute them with the speaker button, bottom left." },
      ] },
    ],
  },
  sl: {
    eyebrow: "// INTEL / FIELD MANUAL",
    title: "TERENSKI PRIROČNIK",
    tabMarshals: "ZA MARŠALE",
    tabPlayers: "ZA IGRALCE",
    panelMarshals: "// PRIROČNIK ZA MARŠALE",
    panelPlayers: "// PRIROČNIK ZA IGRALCE",
    back: "Nazaj na domov",
    marshals: [
      { eyebrow: "[01] ENKRATNA PRIPRAVA", title: "Pripravi svoj poligon", bullets: [
        "Ustvari brezplačen račun maršala z imenom svojega poligona. Dodaj mesto in državo, da igralci na strani za vstop ločijo poligone.",
        "Nastavi geslo poligona. Igralci ga vnesejo ob prvem vstopu, spremeniš ga lahko kadarkoli.",
        "Prenesi print kit: po eno QR ploščo za vsak sektor in ploščo za respawn. Natisni na A4 ali A3, laminiraj z mat folijo in plošče postavi v višino prsi, stran od neposredne sončne svetlobe.",
        "Pred prvo igro vsako kodo preizkusi s telefonom.",
        "Natisni plakat svojega poligona (Račun maršala → QR za igralce). Igralci ga skenirajo in najdejo tvoj poligon.",
      ] },
      { eyebrow: "[02] PRED VSAKO IGRO", title: "Ustvari misijo", bullets: [
        "Tapni Ustvari misijo in izpolni zavihke: Misija, Način igre, Pravila, Dodatki in Zemljevid.",
        "Izberi Dominacijo, dolžino tekme, odštevanje pred začetkom in točke za zmago. Brezplačni poligoni igrajo z 2 ekipama, Pro in ustanovitveni poligoni lahko uporabijo 3.",
        "Nastavi pravila za respawn.",
        "Naloži zemljevid in na njem označi sektorje in točke za respawn.",
        { note: "Po želji vklopi preverjanje lokacije. Skeni z napačnega mesta so označeni, da jih odobriš ali zavrneš. Vklopi ga, preden se igralci pridružijo, ker lokacijo dovolijo ob prijavi." },
        { note: "Pripravljene misije ostanejo shranjene. Na dan igre preklapljaš med njimi z enim dotikom." },
      ] },
      { eyebrow: "[03] DAN IGRE", title: "Vodi igro", bullets: [
        "Igralcem povej današnje geslo poligona. Skenirajo tvoj plakat, vnesejo geslo in se prijavijo.",
        "Spremljaj seznam igralcev. Če sta ekipi neuravnoteženi, igralce prestavljaš med ekipama v Pregledu igre.",
        "Pritisni Začni tekmo. Igralci dobijo odštevanje, da pridejo do svojega spawna.",
        "Med igro lahko tekmo pavziraš in nadaljuješ ter spremljaš lestvico, zemljevid in dnevnik dogodkov v živo.",
        "Ko se igra konča, vsak igralec vidi zaslon z rezultati.",
        { note: `Brezplačni poligoni dovolijo do ${PLAN_LIMITS.free.maxPlayers} igralcev na igro, Pro in ustanovitveni do ${PLAN_LIMITS.pro.maxPlayers}.` },
      ] },
    ],
    players: [
      { eyebrow: "[01] VSTOP", title: "Vstopi v igro", bullets: [
        "Skeniraj QR s plakata maršala ali odpri Vstopi v igro in s seznama izberi svoj poligon.",
        { note: "Prvič vnesi današnje geslo poligona. Vprašaj maršala." },
        "Vpiši svoj callsign. Obvezen je samo callsign. Telefonska številka je vidna samo maršalu.",
        "Če misija uporablja preverjanje lokacije, tapni Dovoli lokacijo. Nato tapni Vstopi v igro.",
        "Izberi ekipo in počakaj na odštevanje. Zaslon prikazuje pravila in zemljevid.",
      ] },
      { eyebrow: "[02] ZAVZEMANJE", title: "Zavzemi sektorje", bullets: [
        "Ko se igra začne, poišči QR plošče, postavljene po terenu. Uporabi skener v aplikaciji, ne kamere telefona.",
        "V aplikaciji tapni Skeniraj točko in usmeri kamero v ploščo. Tvoja ekipa dobi sektor in rezultat se takoj posodobi za vse.",
        "Če ima tvoja ekipa sektor že v lasti, ti aplikacija to sporoči.",
        { note: "Če misija uporablja preverjanje lokacije, skeniraj, ko stojiš ob plošči. Skene od drugje maršal pregleda." },
      ] },
      { eyebrow: "[03] MED IGRO", title: "Ostani v igri", bullets: [
        "Aplikacijo imej odprto, da spremljaš rezultat, dnevnik zavzetij in zemljevid.",
        "Če te zadenejo, pojdi na svojo točko za respawn in počakaj na odštevanje, če ga je maršal vklopil.",
        "Če maršal igro pavzira, je skeniranje onemogočeno, dokler se igra ne nadaljuje.",
        { note: "Maršal te lahko premesti v drugo ekipo. Celozaslonsko obvestilo te prosi za potrditev." },
        { note: "Zvok je privzeto izklopljen. Glasbo in zvočne efekte lahko vklopiš ob prijavi, utišaš pa jih z gumbom z zvočnikom spodaj levo." },
      ] },
    ],
  },
} satisfies Record<"en" | "sl", { marshals: BriefingBlock[]; players: BriefingBlock[]; [k: string]: unknown }>;

function IntelPage() {
  const { lang } = useLang();
  const c = lang === "en" ? COPY.en : COPY.sl;
  const search = Route.useSearch();
  const [tab, setTab] = useState<Audience>(search.for === "players" ? "players" : "marshals");
  const blocks = tab === "marshals" ? c.marshals : c.players;
  const tabs = [
    { id: "marshals" as const, label: c.tabMarshals },
    { id: "players" as const, label: c.tabPlayers },
  ];

  return (
    <div style={{ background: BG, color: INK, minHeight: "100dvh", paddingTop: 80 }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <p className="font-mono uppercase mb-3" style={{ fontSize: 11, letterSpacing: "0.32em", color: ACCENT }}>
          {c.eyebrow}
        </p>
        <h1 style={{
          fontFamily: "'Michroma', monospace",
          fontSize: "clamp(28px, 4.6vw, 44px)",
          letterSpacing: "0.10em",
          color: ACCENT,
          lineHeight: 1.1,
        }}>
          {c.title}
        </h1>
        <div style={{ width: 56, height: 1, background: ACCENT, marginTop: 18 }} />

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label={c.title}
          className="grid grid-cols-2 mt-10 mb-8"
          style={{ borderBottom: `1px solid ${HAIRLINE}` }}
        >
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                id={`intel-tab-${t.id}`}
                aria-controls="intel-panel"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                type="button"
                className="text-left px-4 py-3 transition-colors"
                style={{
                  background: active ? "rgba(232,154,10,0.06)" : "transparent",
                  borderBottom: active ? `2px solid ${ACCENT}` : "2px solid transparent",
                  marginBottom: -1,
                  color: active ? ACCENT : MUTED,
                  fontFamily: "'Rajdhani', monospace",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <span className="block text-[13px] md:text-[15px]">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id="intel-panel" aria-labelledby={`intel-tab-${tab}`}>
        <HudCard className="p-5 md:p-8">
          <p className="font-mono uppercase mb-6"
            style={{ fontSize: 10, letterSpacing: "0.28em", color: ACCENT_SOFT }}>
            {tab === "marshals" ? c.panelMarshals : c.panelPlayers}
          </p>
          <BriefingContent blocks={blocks} />
        </HudCard>
        </div>

        <div className="mt-12">
          <Link
            to="/spartanops"
            className="inline-flex items-center gap-2 font-mono uppercase"
            style={{
              fontSize: 11,
              letterSpacing: "0.24em",
              color: ACCENT,
              border: `1px solid ${ACCENT_SOFT}`,
              padding: "12px 18px",
              background: "transparent",
            }}
          >
            <ArrowLeft size={14} /> {c.back}
          </Link>
        </div>
      </div>
    </div>
  );
}
