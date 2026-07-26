/**
 * RespawnProtocolBlock
 * Self-contained, fully localized (EN/SL) respawn protocol briefing.
 * Rendered on the pre-start screen and inside the in-game HUD.
 * Adapts to: timer type (dynamic vs fixed), visibility (all vs team) and
 * death scoring (enabled vs disabled). Only shown when respawn QR is enabled.
 */

const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";

export type RespawnProtocolSettings = {
  enabled?: boolean;
  mode?: "linear" | "dynamic";
  linearSec?: number;
  visibility?: "all" | "team";
  publicDeaths?: boolean;
};

function formatTime(totalSeconds: number, en: boolean): string {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m > 0 && rest > 0) return en ? `${m} min ${rest} s` : `${m} min ${rest} s`;
  if (m > 0) return en ? `${m} min` : `${m} min`;
  return en ? `${rest} s` : `${rest} s`;
}

export function buildRespawnProtocolLines(r: RespawnProtocolSettings, en: boolean): string[] {
  const lines: string[] = [];
  lines.push(
    en
      ? "Respawn protocol is active: When you are hit, go to your spawn where you will scan the respawn QR code, which will display your respawn time."
      : "Protokol oživljanja je aktiven: Ko ste zadeti, pojdite na svojo izhodiščno točko (spawn), kjer boste skenirali QR kodo za oživljanje, ki vam bo prikazala čas do vrnitve v igro.",
  );

  if (r.mode === "dynamic") {
    lines.push(
      en
        ? "This mission has a dynamic timer, which means the longer the mission lasts, the longer the respawn time."
        : "Ta misija ima dinamični časovnik, kar pomeni, da dlje kot misija traja, daljši bo čas oživljanja.",
    );
  } else {
    const t = formatTime(r.linearSec ?? 60, en);
    lines.push(
      en
        ? `This mission has a respawn time of ${t}. After being hit, go to your respawn, scan the respawn QR code and the time will be displayed.`
        : `Ta misija ima določen čas oživljanja, ki znaša ${t}. Po zadetku pojdite na svoj spawn, skenirajte QR kodo in prikazal se bo čas do oživitve.`,
    );
  }

  if (r.visibility === "team") {
    lines.push(en ? "Only your team will see your respawn time." : "Samo vaša ekipa bo videla vaš čas oživljanja.");
  } else {
    lines.push(en ? "All players will see your respawn times." : "Vsi igralci bodo videli vaše čase oživljanja.");
  }

  if (r.publicDeaths) {
    lines.push(
      en
        ? "Deaths are scored and will be displayed at the end of the game."
        : "Smrti se štejejo in bodo prikazane ob koncu igre.",
    );
  } else {
    lines.push(
      en
        ? "Death scoring is disabled, no player will see your death count."
        : "Beleženje smrti je onemogočeno, noben igralec ne bo videl vašega števila smrti.",
    );
  }

  return lines;
}

export function RespawnProtocolBlock({
  settings,
  en = false,
}: {
  settings?: RespawnProtocolSettings | null;
  en?: boolean;
}) {
  if (!settings?.enabled) return null;
  const [intro, ...rest] = buildRespawnProtocolLines(settings, en);
  return (
    <section
      aria-label={en ? "Respawn protocol" : "Protokol oživljanja"}
      style={{
        width: "min(640px, 100%)",
        margin: "14px auto 0",
        border: `1px solid ${ACCENT}66`,
        borderLeft: `5px solid ${ACCENT}`,
        background: "rgba(0,0,0,0.45)",
        padding: "12px 14px",
        textAlign: "left",
      }}
    >
      <p
        style={{
          color: ACCENT,
          fontFamily: "monospace",
          fontSize: 9.5,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          margin: "0 0 8px",
        }}
      >
        {en ? "// RESPAWN PROTOCOL" : "// PROTOKOL OŽIVLJANJA"}
      </p>
      <p style={{ color: INK, fontFamily: "monospace", fontSize: 12, lineHeight: 1.7, margin: 0 }}>{intro}</p>
      <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
        {rest.map((line, i) => (
          <li
            key={i}
            style={{
              color: MUTED,
              fontFamily: "monospace",
              fontSize: 11.5,
              lineHeight: 1.65,
              paddingLeft: 12,
              position: "relative",
              marginTop: 5,
            }}
          >
            <span style={{ position: "absolute", left: 0, color: ACCENT }}>›</span>
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default RespawnProtocolBlock;
