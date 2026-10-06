/**
 * MissionSettingsTabs — shared, controlled mission settings editor (five tabs).
 * Used by the create-mission form; the live console adopts it next.
 * The value shape mirrors the stored lobby settings; no keys are renamed.
 */
import { useId, useRef, useState, type CSSProperties } from "react";
import { Upload, X, ChevronDown } from "lucide-react";
import {
  Pane,
  Field as FieldRow,
  NodePlacer,
  ConfigToggle,
  SpartacusRadiusControl,
  DEFAULT_RESPAWN,
  inputStyle,
  selectStyle,
  type GameSettings,
} from "@/components/SpartanOpsConsole";
import { WeaponRulesEditor, type WeaponRules } from "@/components/WeaponRulesEditor";
import { usePremium } from "@/lib/premium";

const ACCENT = "#E0B04E";
const BG = "#11140f";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";
const WARN = "#e8833a";

export type GameModeKey = "domination" | "search_destroy";

export const GAME_MODES: { key: string; label: string; subEn?: string; subSl?: string; locked?: boolean }[] = [
  { key: "domination", label: "Domination", subEn: "Point capture", subSl: "Zavzemanje točk" },
  { key: "search_destroy", label: "Search & Destroy", locked: true },
  { key: "infection", label: "Infection", locked: true },
  { key: "king_of_the_hill", label: "King of the Hill", locked: true },
];

export type MissionSettingsValue = {
  missionName: string;
  eventName: string;
  missionDescription: string;
  afterGameInstructions: string;
  marshalName: string;
  marshalPhone: string;
  gamemode: GameModeKey;
  duration: number;
  countdown: number; // seconds
  pointTarget: number;
  /** Stored settings JSON parts: respawn, capturePointsScoring, spartacus*, teamCount, teamNames. */
  settings: GameSettings;
  weaponRules: WeaponRules;
  mapUrl: string;
  nodePositions: Record<string, { x: number; y: number } | null>;
};

export type MissionTabKey = "mission" | "gamemode" | "rules" | "extras" | "map";

/** Which tab each required field lives in. */
const REQUIRED_TAB: Record<string, MissionTabKey> = {
  missionName: "mission",
  marshalName: "mission",
};

function foldEvent(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function GameModeButtons({ active, isPremium, openPremiumModal, en, onPick }: {
  active: GameModeKey;
  isPremium: boolean;
  openPremiumModal: () => void;
  en: boolean;
  onPick: (key: GameModeKey) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {GAME_MODES.map((m) => {
        if (m.locked) {
          return (
            <button key={m.key} type="button" onClick={() => { if (!isPremium) openPremiumModal(); }}
              style={{
                background: "rgba(255,255,255,0.03)", color: MUTED,
                border: "1px dashed rgba(236,227,196,0.18)",
                padding: "10px 8px", fontFamily: "monospace", fontSize: 11,
                letterSpacing: "0.08em", textTransform: "uppercase",
                cursor: "pointer", textAlign: "left", opacity: 0.75,
              }}>
              <span style={{ whiteSpace: "nowrap" }}>🔒 {m.label}</span>
              <br /><span style={{ fontSize: 9 }}>{en ? "Coming soon" : "Prihaja kmalu"}</span>
            </button>
          );
        }
        const isActive = active === m.key;
        return (
          <button key={m.key} type="button" onClick={() => onPick(m.key as GameModeKey)}
            style={{
              background: isActive ? `${ACCENT}22` : "transparent",
              color: isActive ? ACCENT : INK,
              border: `1px solid ${isActive ? ACCENT : "rgba(236,227,196,0.18)"}`,
              padding: "10px 8px", fontFamily: "monospace", fontSize: 11,
              letterSpacing: "0.08em", textTransform: "uppercase",
              cursor: "pointer", textAlign: "left",
            }}>
            <span style={{ whiteSpace: "nowrap" }}>● {m.label}</span>
            <br /><span style={{ fontSize: 9, color: MUTED }}>{en ? m.subEn : m.subSl}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TeamConfigSection({ settings, onPatch, en, hideHeading = false }: { settings: any; onPatch: (s: any) => void; en: boolean; hideHeading?: boolean }) {
  const teamNames = (settings?.teamNames ?? {}) as Record<string, string>;
  const teamCount = Number(settings?.teamCount ?? 2);
  const { isPremium, openPremiumModal } = usePremium();
  const update = (patch: any) => onPatch({ ...settings, ...patch });
  const setName = (key: string, value: string) =>
    onPatch({ ...settings, teamNames: { ...teamNames, [key]: value } });
  return (
    <div style={{ marginTop: 22, padding: 14, border: `1px solid ${ACCENT}44`, background: "rgba(0,0,0,0.25)" }}>
      <div style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em", color: ACCENT, textTransform: "uppercase", marginBottom: 4 }}>
        {en ? "TEAMS" : "EKIPE"}
      </div>
      {!hideHeading && (
        <p style={{ fontSize: 10.5, color: MUTED, fontFamily: "monospace", lineHeight: 1.6, marginBottom: 12 }}>
          {en
            ? "Number of teams and their faction names. Faction names replace the default BLUE/RED labels in the roster and scoreboards."
            : "Število ekip in imena frakcij. Imena zamenjajo privzete oznake MODRA/RDEČA v roster-ju in scoreboardih."}
        </p>
      )}
      <div style={{ marginBottom: 10, marginTop: hideHeading ? 8 : 0 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, marginBottom: 4, fontFamily: "monospace" }}>
          {en ? "Number of teams" : "Število ekip"}
        </div>
        <select
          value={teamCount > 2 && !isPremium ? 2 : teamCount}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (next > 2 && !isPremium) {
              openPremiumModal();
              return;
            }
            update({ teamCount: next });
          }}
          style={{
            width: "100%", background: "rgba(0,0,0,0.35)", color: INK,
            border: `1px solid ${ACCENT}55`, padding: "10px 12px",
            fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.12em",
          }}
        >
          <option value={2}>2</option>
          <option value={3}>3 — 🔒 {en ? "Premium feature" : "Premium funkcija"}</option>
          <option value={4}>4 — 🔒 {en ? "Premium feature" : "Premium funkcija"}</option>
          <option value={5}>5 — 🔒 {en ? "Premium feature" : "Premium funkcija"}</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "#3b82f6", marginBottom: 4, fontFamily: "monospace" }}>
            {en ? "Blue faction name" : "Ime modre ekipe"}
          </div>
          <input
            value={teamNames.modra ?? ""}
            onChange={(e) => setName("modra", e.target.value)}
            maxLength={24}
            placeholder={en ? "e.g. Lions" : "npr. Levi"}
            style={{ width: "100%", background: "rgba(0,0,0,0.35)", color: INK, border: `1px solid #3b82f655`, padding: "10px 12px", fontFamily: "monospace", fontSize: 13 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "#ef4444", marginBottom: 4, fontFamily: "monospace" }}>
            {en ? "Red faction name" : "Ime rdeče ekipe"}
          </div>
          <input
            value={teamNames.rdeca ?? ""}
            onChange={(e) => setName("rdeca", e.target.value)}
            maxLength={24}
            placeholder={en ? "e.g. Spartans" : "npr. Spartanci"}
            style={{ width: "100%", background: "rgba(0,0,0,0.35)", color: INK, border: `1px solid #ef444455`, padding: "10px 12px", fontFamily: "monospace", fontSize: 13 }}
          />
        </div>
      </div>
    </div>
  );
}

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      style={{
        width: 46, height: 26, borderRadius: 999, flexShrink: 0, position: "relative", cursor: "pointer",
        background: on ? ACCENT : "rgba(236,227,196,0.12)",
        border: `1px solid ${on ? ACCENT : "rgba(236,227,196,0.3)"}`,
        transition: "background 150ms ease",
      }}
    >
      <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: 999, background: on ? BG : INK, transition: "left 150ms ease" }} />
    </button>
  );
}

function SwitchCard({ title, desc, on, onToggle, children }: { title: string; desc: string; on: boolean; onToggle: () => void; children?: React.ReactNode }) {
  return (
    <section style={{ border: `1px solid ${on ? ACCENT : `${ACCENT}44`}`, background: on ? "rgba(224,176,78,0.06)" : "rgba(0,0,0,0.25)", padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase" }}>{title}</div>
          <p style={{ fontSize: 11, color: MUTED, fontFamily: "monospace", lineHeight: 1.5, margin: "4px 0 0" }}>{desc}</p>
        </div>
        <Switch on={on} onToggle={onToggle} label={title} />
      </div>
      {on && children && <div style={{ marginTop: 12 }}>{children}</div>}
    </section>
  );
}

export function MissionSettingsTabs({
  en,
  value,
  onChange,
  mode,
  existingEvents,
  missingRequired = [],
}: {
  en: boolean;
  value: MissionSettingsValue;
  onChange: (patch: Partial<MissionSettingsValue>) => void;
  mode: "create" | "live";
  existingEvents: string[];
  missingRequired?: string[];
}) {
  void mode;
  const { isPremium, openPremiumModal } = usePremium();
  const [tab, setTab] = useState<MissionTabKey>("mission");
  const [mapErr, setMapErr] = useState("");
  const [howOpen, setHowOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listId = `evt-list-${useId().replace(/:/g, "")}`;
  const s = value.settings;
  const patchSettings = (next: GameSettings) => onChange({ settings: next });
  const respawn = { ...DEFAULT_RESPAWN, ...(s.respawn ?? {}) };
  const updateRespawn = (p: Partial<typeof respawn>) => patchSettings({ ...s, respawn: { ...respawn, ...p } });
  const YN = [{ v: "da", l: en ? "YES" : "DA" }, { v: "ne", l: en ? "NO" : "NE" }];

  const tabsWithMissing = new Set(missingRequired.map((k) => REQUIRED_TAB[k]).filter(Boolean));
  const tabs: { k: MissionTabKey; l: string }[] = [
    { k: "mission", l: en ? "Mission" : "Misija" },
    { k: "gamemode", l: en ? "Gamemode" : "Način igre" },
    { k: "rules", l: en ? "Rules" : "Pravila" },
    { k: "extras", l: en ? "Extras" : "Dodatki" },
    { k: "map", l: en ? "Map" : "Zemljevid" },
  ];

  const handleEvent = (v: string) => {
    const k = foldEvent(v);
    const match = k ? existingEvents.find((e) => foldEvent(e) === k) : undefined;
    onChange({ eventName: match && !v.endsWith(" ") ? match : v });
  };

  const onMapFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setMapErr(en ? "Please upload an image file." : "Naloži slikovno datoteko.");
      return;
    }
    setMapErr("");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onChange({ mapUrl: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const helper: CSSProperties = { fontSize: 10.5, color: MUTED, fontFamily: "monospace", lineHeight: 1.5, marginTop: 6 };
  const textarea: CSSProperties = { ...inputStyle, minHeight: 72, resize: "vertical" };

  return (
    <div>
      {/* Tab bar: 3 columns on phones (two rows), 5 on wider screens. */}
      <div className="grid grid-cols-3 sm:grid-cols-5" style={{ gap: 6, marginBottom: 18 }}>
        {tabs.map((t) => {
          const active = tab === t.k;
          const warn = tabsWithMissing.has(t.k);
          return (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              style={{
                minWidth: 0,
                background: active ? ACCENT : "transparent",
                color: active ? BG : INK,
                border: `1px solid ${active ? ACCENT : "rgba(224,176,78,0.35)"}`,
                padding: "10px 4px",
                fontFamily: "'Michroma', monospace",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontWeight: active ? 700 : 500,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                whiteSpace: "nowrap", overflow: "hidden",
              }}
            >
              {t.l}
              {warn && <span aria-label={en ? "Missing required field" : "Manjka obvezno polje"} style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: WARN }} />}
            </button>
          );
        })}
      </div>

      {/* ── MISSION ─────────────────────────────────────────── */}
      {tab === "mission" && (
        <Pane title={en ? "MISSION" : "MISIJA"}>
          <FieldRow label={en ? "Mission name (required)" : "Ime misije (obvezno)"}>
            <input value={value.missionName} onChange={(e) => onChange({ missionName: e.target.value })} style={inputStyle} placeholder={en ? "Operation Fallen Angel" : "Operacija Fallen Angel"} />
          </FieldRow>
          <FieldRow label={en ? "Event (optional)" : "Dogodek (neobvezno)"}>
            <input value={value.eventName} list={listId} onChange={(e) => handleEvent(e.target.value)} style={inputStyle} placeholder={en ? "e.g. Operation Sparta" : "npr. Operacija Sparta"} />
            <datalist id={listId}>
              {existingEvents.map((e) => <option key={e} value={e} />)}
            </datalist>
            <p style={helper}>
              {en ? "If you enter the name of an existing event, this mission is added to it." : "Če vneseš ime obstoječega dogodka, bo misija dodana vanj."}
            </p>
          </FieldRow>
          <FieldRow label={en ? "Mission description (optional)" : "Opis misije (neobvezno)"}>
            <textarea value={value.missionDescription} onChange={(e) => onChange({ missionDescription: e.target.value })} style={textarea} />
            <p style={helper}>{en ? "Players see this before and during the game." : "Igralci to vidijo pred igro in med njo."}</p>
          </FieldRow>
          <FieldRow label={en ? "After-game instructions (optional)" : "Navodila po igri (neobvezno)"}>
            <textarea
              value={value.afterGameInstructions}
              onChange={(e) => onChange({ afterGameInstructions: e.target.value })}
              style={textarea}
              placeholder={en ? "The players will see this text in the debriefing screen (after the mission is finished)." : "Igralci bodo to besedilo videli na zaključnem zaslonu (po koncu misije)."}
            />
          </FieldRow>
          <div style={{ marginTop: 18, padding: 12, border: `1px solid ${ACCENT}44`, background: "rgba(0,0,0,0.25)" }}>
            <div style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em", color: ACCENT, textTransform: "uppercase", marginBottom: 8 }}>
              {en ? "Marshal on duty" : "Dežurni maršal"}
            </div>
            <FieldRow label={en ? "Marshal name (required)" : "Ime maršala (obvezno)"}>
              <input value={value.marshalName} onChange={(e) => onChange({ marshalName: e.target.value })} style={inputStyle} placeholder={en ? "e.g. Luka" : "npr. Luka"} />
            </FieldRow>
            <FieldRow label={en ? "Marshal phone (optional)" : "Telefon maršala (neobvezno)"}>
              <input value={value.marshalPhone} onChange={(e) => onChange({ marshalPhone: e.target.value })} style={inputStyle} placeholder="+386 40 123 456" inputMode="tel" />
            </FieldRow>
          </div>
        </Pane>
      )}

      {/* ── GAMEMODE ────────────────────────────────────────── */}
      {tab === "gamemode" && (
        <Pane title={en ? "GAMEMODE" : "NAČIN IGRE"}>
          <GameModeButtons active={value.gamemode} isPremium={isPremium} openPremiumModal={openPremiumModal} en={en} onPick={(k) => onChange({ gamemode: k })} />
          <div className="grid grid-cols-2 gap-3" style={{ marginTop: 14 }}>
            <FieldRow label={en ? "Duration (min)" : "Trajanje (min)"}>
              <select value={value.duration} onChange={(e) => onChange({ duration: Number(e.target.value) })} style={selectStyle}>
                {Array.from({ length: 24 }, (_, i) => (i + 1) * 5).map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label={en ? "Pre-start" : "Pred-štart"}>
              <select value={value.countdown} onChange={(e) => onChange({ countdown: Number(e.target.value) })} style={selectStyle}>
                {Array.from({ length: 30 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m * 60}>{m} min</option>
                ))}
              </select>
            </FieldRow>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: MUTED, marginBottom: 4, fontFamily: "monospace" }}>
              {en ? "Target points (win when reached)" : "Ciljne točke (zmaga ob doseženem številu)"}
            </div>
            <select value={value.pointTarget} onChange={(e) => onChange({ pointTarget: Number(e.target.value) })} style={selectStyle}>
              {Array.from({ length: 30 }, (_, i) => (i + 1) * 10).map((p) => (
                <option key={p} value={p}>{p} {en ? "pts" : "točk"}</option>
              ))}
            </select>
            <p style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", lineHeight: 1.55, marginTop: 8, fontStyle: "italic" }}>
              {en
                ? `Each sector held earns 1 point every 30 seconds. With 3 sectors held, ${value.pointTarget} points takes about ${Math.ceil(value.pointTarget / 6)} minutes.`
                : `Vsak zadržan sektor prinese 1 točko na 30 sekund. Pri 3 zadržanih sektorjih je za ${value.pointTarget} točk potrebnih približno ${Math.ceil(value.pointTarget / 6)} minut.`}
            </p>
          </div>
          <TeamConfigSection settings={s} onPatch={patchSettings} en={en} hideHeading />
        </Pane>
      )}

      {/* ── RULES ───────────────────────────────────────────── */}
      {tab === "rules" && (
        <Pane title={en ? "RULES" : "PRAVILA"}>
          <WeaponRulesEditor value={value.weaponRules} onChange={(w) => onChange({ weaponRules: w })} hideHeading />
        </Pane>
      )}

      {/* ── EXTRAS ──────────────────────────────────────────── */}
      {tab === "extras" && (
        <div style={{ display: "grid", gap: 10 }}>
          <SwitchCard
            title={en ? "Respawn QR codes" : "Respawn QR kode"}
            desc={en ? "QR codes at spawn points that show a player their respawn timer." : "QR kode na spawn točkah, ki igralcu pokažejo njegov respawn čas."}
            on={!!respawn.enabled}
            onToggle={() => updateRespawn({ enabled: !respawn.enabled })}
          >
            <FieldRow label={en ? "Countdown mode" : "Način odštevanja časa"}>
              <ConfigToggle value={respawn.mode} onChange={(v) => updateRespawn({ mode: v })} options={[
                { v: "linear", l: en ? "Linear time" : "Linearni čas" },
                { v: "dynamic", l: en ? "Dynamic time" : "Dinamični čas" },
              ]} />
            </FieldRow>
            {respawn.mode === "linear" ? (
              <FieldRow label={en ? "Respawn duration (seconds)" : "Trajanje respawna (sekunde)"}>
                <input type="number" min={1} max={600} value={respawn.linearSec} onChange={(e) => updateRespawn({ linearSec: Number(e.target.value) })} style={inputStyle} />
              </FieldRow>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <FieldRow label={en ? "Game start (min)" : "Začetek igre (min)"}>
                  <input type="number" min={0} step={0.25} value={respawn.dynStartMin} onChange={(e) => updateRespawn({ dynStartMin: Number(e.target.value) })} style={inputStyle} />
                </FieldRow>
                <FieldRow label={en ? "Game end (min)" : "Konec igre (min)"}>
                  <input type="number" min={0} step={0.25} value={respawn.dynEndMin} onChange={(e) => updateRespawn({ dynEndMin: Number(e.target.value) })} style={inputStyle} />
                </FieldRow>
              </div>
            )}
            <FieldRow label={en ? "Respawn time display" : "Prikaz respawn časovnika"}>
              <ConfigToggle value={respawn.visibility} onChange={(v) => updateRespawn({ visibility: v })} options={[
                { v: "all", l: en ? "All players" : "Vsi igralci" },
                { v: "team", l: en ? "Team only" : "Samo ekipa" },
              ]} />
            </FieldRow>
            <FieldRow label={en ? "Count deaths and show them publicly" : "Beleži smrti in jih javno prikaži"}>
              <ConfigToggle value={respawn.publicDeaths ? "da" : "ne"} onChange={(v) => updateRespawn({ publicDeaths: v === "da" })} options={YN} />
            </FieldRow>
          </SwitchCard>

          <SwitchCard
            title={en ? "Player scoring display" : "Prikaz točk igralcev"}
            desc={en ? "Show each player's points on the scoreboard and crown the top three at the end." : "Prikaži točke vsakega igralca na semaforju in ob koncu okronaj najboljše tri."}
            on={!!s.capturePointsScoring}
            onToggle={() => patchSettings({ ...s, capturePointsScoring: !s.capturePointsScoring })}
          />

          <SwitchCard
            title={en ? "Spartacus anti-cheat" : "Spartacus proti goljufanju"}
            desc={en
              ? "Locks each QR code to its spot using GPS. Scans from the wrong place are flagged for you to approve or dismiss."
              : "Z GPS-om zaklene vsako QR kodo na njeno mesto. Skeni z napačnega mesta so označeni, da jih odobriš ali zavrneš."}
            on={!!s.spartacusEnabled}
            onToggle={() => patchSettings({ ...s, spartacusEnabled: !s.spartacusEnabled })}
          >
            <SpartacusRadiusControl settings={s} onPatch={patchSettings} en={en} enabled />
            <button type="button" onClick={() => setHowOpen((o) => !o)} style={{ marginTop: 10, background: "transparent", border: "none", color: ACCENT, fontFamily: "monospace", fontSize: 11, cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
              {en ? "How it works" : "Kako deluje"}
              <ChevronDown size={13} style={{ transform: howOpen ? "rotate(180deg)" : "none" }} />
            </button>
            {howOpen && (
              <p style={{ fontSize: 11, color: MUTED, fontFamily: "monospace", lineHeight: 1.6, marginTop: 6 }}>
                {en
                  ? "The first scan of each physical QR code anchors its GPS position. Later scans must fall within the chosen radius, with tolerance for phone GPS accuracy. A scan from somewhere else (for example a photo of the code) is flagged on your console, where you can approve the capture or dismiss it."
                  : "Prvi sken vsake fizične QR kode zabeleži njen GPS položaj. Kasnejši skeni morajo biti znotraj izbranega radija, z upoštevanjem natančnosti GPS-a telefonov. Sken z drugega mesta (na primer s fotografije kode) se označi na tvoji konzoli, kjer zavzetje odobriš ali zavrneš."}
              </p>
            )}
          </SwitchCard>
        </div>
      )}

      {/* ── MAP ─────────────────────────────────────────────── */}
      {tab === "map" && (
        <Pane title={en ? "MAP" : "ZEMLJEVID"}>
          <p style={{ fontSize: 11, color: MUTED, fontFamily: "monospace", lineHeight: 1.55, marginBottom: 12 }}>
            {en ? "Upload the image of your field or playing area." : "Naloži sliko svojega poligona ali igralne površine."}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onMapFile(f);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: "transparent", color: ACCENT,
                border: `1px dashed ${ACCENT}`, padding: "12px 14px",
                fontFamily: "'Michroma', monospace", fontSize: 11,
                letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <Upload size={14} /> [ {en ? "UPLOAD IMAGE FROM DEVICE" : "NALOŽI SLIKO Z NAPRAVE"} ]
            </button>
            <input
              value={value.mapUrl.startsWith("data:") ? "" : value.mapUrl}
              onChange={(e) => onChange({ mapUrl: e.target.value })}
              style={inputStyle}
              placeholder="https://.../map.webp"
            />
            {mapErr && <p style={{ color: "#d97a6c", fontSize: 12 }}>{mapErr}</p>}
            {value.mapUrl && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, border: `1px solid ${ACCENT}33`, background: "rgba(224,176,78,0.04)" }}>
                <img src={value.mapUrl} alt="Map preview" style={{ width: 72, height: 54, objectFit: "cover", border: `1px solid ${ACCENT}55` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.18em", color: ACCENT, textTransform: "uppercase", marginBottom: 2 }}>
                    // {en ? "MAP READY" : "ZEMLJEVID PRIPRAVLJEN"}
                  </p>
                  <p style={{ fontSize: 11, color: MUTED, wordBreak: "break-all", lineHeight: 1.4 }}>
                    {value.mapUrl.startsWith("data:") ? (en ? "Uploaded from device" : "Naloženo z naprave") : value.mapUrl}
                  </p>
                </div>
                <button type="button" onClick={() => onChange({ mapUrl: "" })} aria-label="Clear map" style={{ background: "transparent", border: "none", color: MUTED, cursor: "pointer" }}>
                  <X size={14} />
                </button>
              </div>
            )}
            <p style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", lineHeight: 1.5, fontStyle: "italic" }}>
              {en
                ? "Recommended: Upload compressed .webp images for the fastest loading speeds during live gameplay on the field."
                : "Priporočeno: naloži stisnjene .webp slike za najhitrejše nalaganje med igro na terenu."}
            </p>
          </div>
          <NodePlacer
            mapUrl={value.mapUrl || null}
            positions={value.nodePositions}
            onChange={(p) => onChange({ nodePositions: p })}
            en={en}
            teamCount={Number(s.teamCount ?? 2)}
          />
        </Pane>
      )}
    </div>
  );
}

export default MissionSettingsTabs;
