/**
 * WeaponRulesEditor
 * Marshal-side inputs for replica power limits, fire modes and extra rules.
 * Stored in the lobby settings JSON under `weaponRules`.
 */
import { useLang } from "@/lib/i18n";

const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";

export type WeaponClassRule = { joules?: string; range?: string };
export type WeaponRules = {
  aeg?: WeaponClassRule;
  dmr?: WeaponClassRule;
  pistol?: WeaponClassRule;
  sniper?: WeaponClassRule;
  fireModes?: { single?: boolean; burst?: boolean; auto?: boolean };
  additionalRules?: string;
};

export const WEAPON_CLASSES: Array<{ key: keyof WeaponRules & ("aeg" | "dmr" | "pistol" | "sniper"); label: string }> = [
  { key: "aeg", label: "AEG" },
  { key: "dmr", label: "DMR" },
  { key: "pistol", label: "PISTOL" },
  { key: "sniper", label: "SNIPER" },
];

export function hasWeaponRules(r?: WeaponRules | null): boolean {
  if (!r) return false;
  const anyClass = WEAPON_CLASSES.some((c) => (r[c.key]?.joules ?? "").trim() || (r[c.key]?.range ?? "").trim());
  const anyMode = !!(r.fireModes?.single || r.fireModes?.burst || r.fireModes?.auto);
  return anyClass || anyMode || !!(r.additionalRules ?? "").trim();
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(0,0,0,0.4)",
  border: `1px solid ${ACCENT}40`,
  color: INK,
  fontFamily: "monospace",
  fontSize: 12,
  padding: "8px 10px",
  outline: "none",
};

export function WeaponRulesEditor({
  value,
  onChange,
}: {
  value?: WeaponRules | null;
  onChange: (next: WeaponRules) => void;
}) {
  const { lang } = useLang();
  const en = lang === "en";
  const v: WeaponRules = value ?? {};

  const setClass = (key: "aeg" | "dmr" | "pistol" | "sniper", patch: WeaponClassRule) =>
    onChange({ ...v, [key]: { ...(v[key] ?? {}), ...patch } });

  const toggleMode = (mode: "single" | "burst" | "auto") =>
    onChange({ ...v, fireModes: { ...(v.fireModes ?? {}), [mode]: !v.fireModes?.[mode] } });

  const modeLabels: Record<"single" | "burst" | "auto", string> = {
    single: en ? "SINGLEFIRE" : "POSAMIČNO",
    burst: en ? "BURST" : "RAFAL",
    auto: en ? "AUTO" : "AVTOMATSKO",
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.2em", color: ACCENT, textTransform: "uppercase" }}>
        // {en ? "REPLICA POWER AND SHOOTING RULES" : "MOČ REPLIK IN PRAVILA STRELJANJA"}
      </p>

      {WEAPON_CLASSES.map((c) => (
        <div key={c.key} style={{ display: "grid", gap: 6 }}>
          <span style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em", color: MUTED, textTransform: "uppercase" }}>
            {en ? `Max replica power ${c.label}` : `Maks. moč replike ${c.label}`}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              value={v[c.key]?.joules ?? ""}
              onChange={(e) => setClass(c.key, { joules: e.target.value })}
              style={inputStyle}
              inputMode="decimal"
              placeholder={en ? "Joules (J)" : "Jouli (J)"}
            />
            <input
              value={v[c.key]?.range ?? ""}
              onChange={(e) => setClass(c.key, { range: e.target.value })}
              style={inputStyle}
              inputMode="decimal"
              placeholder={en ? "Max fire range (m)" : "Maks. domet streljanja (m)"}
            />
          </div>
        </div>
      ))}

      <div style={{ display: "grid", gap: 6 }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em", color: MUTED, textTransform: "uppercase" }}>
          {en ? "Mode of fire" : "Način streljanja"}
        </span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["single", "burst", "auto"] as const).map((m) => {
            const on = !!v.fireModes?.[m];
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMode(m)}
                style={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  padding: "8px 14px",
                  cursor: "pointer",
                  border: `1px solid ${on ? ACCENT : `${ACCENT}35`}`,
                  background: on ? `${ACCENT}22` : "transparent",
                  color: on ? ACCENT : MUTED,
                  boxShadow: on ? `0 0 12px ${ACCENT}33` : "none",
                }}
              >
                {modeLabels[m]}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em", color: MUTED, textTransform: "uppercase" }}>
          {en ? "Additional rules" : "Dodatna pravila"}
        </span>
        <textarea
          value={v.additionalRules ?? ""}
          onChange={(e) => onChange({ ...v, additionalRules: e.target.value })}
          rows={3}
          style={{ ...inputStyle, minHeight: 76, resize: "vertical" }}
          placeholder={
            en
              ? "The players will see this text before and during the game."
              : "Igralci bodo ta zapis videli pred igro in med njo."
          }
        />
      </div>
    </div>
  );
}

export default WeaponRulesEditor;
