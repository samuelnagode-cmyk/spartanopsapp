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

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section
      style={{
        border: `1px solid ${ACCENT}66`,
        borderLeft: `5px solid ${ACCENT}`,
        background: "rgba(0,0,0,0.45)",
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
          padding: "12px 14px",
          color: ACCENT,
        }}
      >
        {icon}
        <span
          style={{
            flex: 1,
            color: ACCENT,
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            textAlign: "left",
          }}
        >
          {title}
        </span>
        <ChevronDown
          size={16}
          style={{ transition: "transform 180ms ease", transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>
      {open && <div style={{ padding: "0 14px 12px" }}>{children}</div>}
    </section>
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
