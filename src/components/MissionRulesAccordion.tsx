/**
 * MissionRulesAccordion
 * Two collapsible briefing cards shown on the pre-start screen and in the player HUD:
 *  1) ☠  Respawn protocol      — full respawn rules (localized, from RespawnProtocolBlock)
 *  2) 🔫 Replica power & shooting rules — marshal-defined weapon limits and fire modes
 */
import { useState } from "react";
import { Skull, Crosshair, ChevronDown } from "lucide-react";
import { buildRespawnProtocolLines, type RespawnProtocolSettings } from "./RespawnProtocolBlock";
import { WEAPON_CLASSES, hasWeaponRules, type WeaponRules } from "./WeaponRulesEditor";

const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";

export function TankIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="13" width="17" height="6" rx="3" />
      <circle cx="6" cy="16" r="1" />
      <circle cx="10.5" cy="16" r="1" />
      <circle cx="15" cy="16" r="1" />
      <path d="M4 13V9.5h9V13" />
      <path d="M13 10.5h4.5V8H22" />
    </svg>
  );
}

function Card({
  icon,
  title,
  children,
  emphasis = false,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section
      style={{
        border: `1px solid ${emphasis ? ACCENT : `${ACCENT}66`}`,
        borderLeft: `${emphasis ? 6 : 5}px solid ${ACCENT}`,
        background: emphasis ? "rgba(224,176,78,0.07)" : "rgba(0,0,0,0.45)",
        boxShadow: emphasis ? `0 0 22px -12px ${ACCENT}` : "none",
        textAlign: "left",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: emphasis ? "15px 16px" : "12px 14px",
          color: ACCENT,
        }}
      >
        {icon}
        <span
          style={{
            flex: 1,
            color: ACCENT,
            fontFamily: "monospace",
            fontSize: emphasis ? 12 : 10,
            fontWeight: emphasis ? 700 : 400,
            letterSpacing: emphasis ? "0.2em" : "0.22em",
            textTransform: "uppercase",
            textAlign: "left",
          }}
        >
          {title}
        </span>
        <ChevronDown
          size={emphasis ? 18 : 16}
          style={{ transition: "transform 180ms ease", transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>
      {open && <div style={{ padding: emphasis ? "0 16px 14px" : "0 14px 12px" }}>{children}</div>}
    </section>
  );
}

export function MissionDescriptionCard({ description, en = false }: { description?: string | null; en?: boolean }) {
  const text = (description ?? "").trim();
  if (!text) return null;
  return (
    <div style={{ width: "min(640px, 100%)", margin: "14px auto 0" }}>
      <Card
        emphasis
        icon={<TankIcon size={20} />}
        title={en ? "MISSION DESCRIPTION / INSTRUCTIONS" : "OPIS MISIJE / NAVODILA"}
      >
        <p style={{ color: INK, fontFamily: "monospace", fontSize: 12.5, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>
          {text}
        </p>
      </Card>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li
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
      {children}
    </li>
  );
}

export function MissionRulesAccordion({
  respawn,
  weaponRules,
  en = false,
}: {
  respawn?: RespawnProtocolSettings | null;
  weaponRules?: WeaponRules | null;
  en?: boolean;
}) {
  const showRespawn = !!respawn?.enabled;
  const showWeapons = hasWeaponRules(weaponRules);
  if (!showRespawn && !showWeapons) return null;

  const [intro, ...rest] = showRespawn ? buildRespawnProtocolLines(respawn!, en) : [];
  const modes = weaponRules?.fireModes;
  const modeList = [
    modes?.single ? (en ? "Singlefire" : "Posamično") : null,
    modes?.burst ? (en ? "Burst" : "Rafal") : null,
    modes?.auto ? (en ? "Auto" : "Avtomatsko") : null,
  ].filter(Boolean) as string[];

  return (
    <div style={{ width: "min(640px, 100%)", margin: "14px auto 0", display: "grid", gap: 10 }}>
      {showRespawn && (
        <Card icon={<Skull size={16} />} title={en ? "RESPAWN PROTOCOL" : "PROTOKOL OŽIVLJANJA"}>
          <p style={{ color: INK, fontFamily: "monospace", fontSize: 12, lineHeight: 1.7, margin: 0 }}>{intro}</p>
          <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
            {rest.map((line, i) => (
              <Bullet key={i}>{line}</Bullet>
            ))}
          </ul>
        </Card>
      )}

      {showWeapons && (
        <Card
          icon={<Crosshair size={16} />}
          title={en ? "REPLICA POWER AND SHOOTING RULES" : "MOČ REPLIK IN PRAVILA STRELJANJA"}
        >
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {WEAPON_CLASSES.map((c) => {
              const j = (weaponRules?.[c.key]?.joules ?? "").trim();
              const r = (weaponRules?.[c.key]?.range ?? "").trim();
              if (!j && !r) return null;
              return (
                <Bullet key={c.key}>
                  {en ? `Max replica power ${c.label}: ` : `Maks. moč replike ${c.label}: `}
                  <span style={{ color: INK }}>{j ? `${j} J` : "—"}</span>
                  {en ? ", max fire range: " : ", maks. domet: "}
                  <span style={{ color: INK }}>{r ? `${r} m` : "—"}</span>
                </Bullet>
              );
            })}
            {modeList.length > 0 && (
              <Bullet>
                {en ? "Mode of fire: " : "Način streljanja: "}
                <span style={{ color: INK }}>{modeList.join(" / ")}</span>
              </Bullet>
            )}
          </ul>
          {(weaponRules?.additionalRules ?? "").trim() && (
            <p
              style={{
                color: INK,
                fontFamily: "monospace",
                fontSize: 11.5,
                lineHeight: 1.7,
                marginTop: 10,
                whiteSpace: "pre-wrap",
              }}
            >
              {weaponRules!.additionalRules}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

export default MissionRulesAccordion;
