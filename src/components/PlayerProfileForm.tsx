import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { EXPERIENCE_LEVELS, ExperienceBadge, type ExperienceLevel } from "@/components/ExperienceBadge";
import { playerDeleteMine, playerExportMine, playerSaveMine } from "@/lib/player.functions";
import { OPERATOR_TYPES, normalizePhone, validatePlayer, type AgeChoice } from "@/lib/player-validation";

const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const ERR = "#d97a6c";
const OK = "#9eff3d";
const MUTED = "rgba(236,227,196,0.65)";

const card: CSSProperties = { background: PANEL, border: `1px solid ${ACCENT}44`, padding: "20px 18px", marginBottom: 14 };
const cardTitle: CSSProperties = { fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em", color: INK, textTransform: "uppercase", marginBottom: 14 };
const label: CSSProperties = { display: "block", fontFamily: "'Michroma', monospace", fontSize: 9.5, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", marginBottom: 6 };
const input: CSSProperties = { width: "100%", background: "rgba(0,0,0,0.4)", color: INK, border: `1px solid ${ACCENT}55`, padding: "10px 12px", fontFamily: "monospace", fontSize: 16, marginBottom: 14, boxSizing: "border-box" };
const help: CSSProperties = { fontFamily: "monospace", fontSize: 11.5, color: MUTED, lineHeight: 1.6, marginTop: -8, marginBottom: 14 };
const btn: CSSProperties = { width: "100%", padding: 12, background: ACCENT, color: BG, border: "none", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer" };
const outlineBtn: CSSProperties = { ...btn, background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}` };

export type PlayerProfile = {
  nickname: string; first_name: string; last_name: string | null; show_full_last_name: boolean;
  age_group: "16_17" | "18_plus"; phone: string | null; club: string | null; experience_level: string;
  operator_type: string | null; primary_weapon: string | null; secondary_weapon: string | null;
  sidearm: string | null; gear_notes: string | null;
};

const ERRORS: Record<string, [string, string]> = {
  "validation:nickname": ["Callsign: 2–24 characters, letters, digits, space and . _ - ' only.", "Vzdevek: 2–24 znakov, samo črke, številke, presledek in . _ - '."],
  "validation:first_name": ["First name: letters, space, - and ' only.", "Ime: samo črke, presledek, - in '."],
  "validation:last_name": ["Surname: letters, space, - and ' only.", "Priimek: samo črke, presledek, - in '."],
  "validation:phone": ["Phone number is not valid.", "Telefonska številka ni veljavna."],
  "validation:age_group": ["Choose your age group.", "Izberi starostno skupino."],
  "validation:under_16": ["Profiles are for players aged 16 and over.", "Profili so za igralce od 16. leta naprej."],
  "validation:privacy": ["Please confirm the Privacy notice and the Terms.", "Potrdi obvestilo o zasebnosti in pogoje."],
  login_required: ["Please sign in again.", "Ponovno se prijavi."],
};
const errText = (code: string, en: boolean) => {
  const key = Object.keys(ERRORS).find((k) => code.includes(k));
  return key ? ERRORS[key][en ? 0 : 1] : en ? "Could not save. Please try again." : "Shranjevanje ni uspelo. Poskusi znova.";
};

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section style={card}><h2 style={cardTitle}>{title}</h2>{children}</section>;
}

export function ProfilePreview({ p, en }: { p: PlayerProfile; en: boolean }) {
  const surname = p.last_name ? (p.show_full_last_name ? ` ${p.last_name}` : ` ${p.last_name[0]}.`) : "";
  return (
    <section style={{ ...card, borderColor: ACCENT }}>
      <p style={{ ...label, marginBottom: 12 }}>{en ? "How other players see you" : "Kako te vidijo drugi igralci"}</p>
      <p style={{ fontFamily: "'Michroma', monospace", fontSize: 22, letterSpacing: "0.08em", color: INK, wordBreak: "break-word" }}>{p.nickname}</p>
      <p style={{ fontFamily: "monospace", fontSize: 14, marginTop: 6 }}>{p.first_name}{surname}{p.club ? ` · ${p.club}` : ""}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <ExperienceBadge level={p.experience_level as ExperienceLevel} size={16} color={ACCENT} />
        {p.operator_type && <span style={{ border: `1px solid ${ACCENT}`, color: ACCENT, fontFamily: "monospace", fontSize: 11, padding: "3px 8px", letterSpacing: "0.1em" }}>{p.operator_type}</span>}
      </div>
    </section>
  );
}

export function PlayerProfileForm({ en, initial, needsConsent, onSaved, onDeleted }: {
  en: boolean; initial: PlayerProfile | null; needsConsent: boolean;
  onSaved: (p: PlayerProfile) => void; onDeleted: (keptLogin: boolean) => void;
}) {
  const save = useServerFn(playerSaveMine);
  const exportFn = useServerFn(playerExportMine);
  const del = useServerFn(playerDeleteMine);
  const [f, setF] = useState({
    nickname: initial?.nickname ?? "", first_name: initial?.first_name ?? "", last_name: initial?.last_name ?? "",
    show_full_last_name: initial?.show_full_last_name ?? false, age: (initial?.age_group ?? "") as AgeChoice | "",
    phone: initial?.phone ?? "", club: initial?.club ?? "", experience_level: initial?.experience_level ?? "dobro",
    operator_type: initial?.operator_type ?? "", primary_weapon: initial?.primary_weapon ?? "",
    secondary_weapon: initial?.secondary_weapon ?? "", sidearm: initial?.sidearm ?? "", gear_notes: initial?.gear_notes ?? "",
  });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const adult = f.age === "18_plus";
  const under16 = f.age === "under_16";

  const onSave = async () => {
    setStatus(null);
    const profile = {
      nickname: f.nickname, first_name: f.first_name, age_group: f.age, club: f.club, experience_level: f.experience_level,
      operator_type: f.operator_type || null, primary_weapon: f.primary_weapon, secondary_weapon: f.secondary_weapon,
      sidearm: f.sidearm, gear_notes: f.gear_notes,
      ...(adult ? { last_name: f.last_name, phone: f.phone, show_full_last_name: f.show_full_last_name } : {}),
    };
    const v = validatePlayer(profile);
    if (!v.ok) { setStatus({ ok: false, text: errText(v.error, en) }); return; }
    if (needsConsent && !consent) { setStatus({ ok: false, text: errText("validation:privacy", en) }); return; }
    setBusy(true);
    try {
      const res = await save({ data: { accessToken: await token(), profile, privacyAccepted: consent } });
      setStatus({ ok: true, text: en ? "Saved." : "Shranjeno." });
      onSaved(res.profile as PlayerProfile);
    } catch (e) {
      setStatus({ ok: false, text: errText(String((e as Error)?.message ?? ""), en) });
    } finally { setBusy(false); }
  };

  const onExport = async () => {
    const data = await exportFn({ data: { accessToken: await token() } });
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = "spartanops-my-data.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const chip = (active: boolean): CSSProperties => ({
    padding: "10px 12px", background: active ? `${ACCENT}22` : "transparent", color: active ? ACCENT : INK,
    border: `1px solid ${active ? ACCENT : `${ACCENT}33`}`, fontFamily: "monospace", fontSize: 13, cursor: "pointer",
  });
  const radio = (v: AgeChoice, text: string) => (
    <label key={v} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "monospace", fontSize: 14, marginBottom: 10, cursor: "pointer" }}>
      <input type="radio" name="age" checked={f.age === v} onChange={() => set("age", v)} style={{ width: 18, height: 18, accentColor: ACCENT }} />
      {text}
    </label>
  );
  const phonePreview = f.phone.trim() ? normalizePhone(f.phone) : null;

  return (
    <div style={{ paddingBottom: 90 }}>
      <Card title={en ? "Identity" : "Identiteta"}>
        <label style={label}>{en ? "Callsign *" : "Vzdevek (callsign) *"}</label>
        <input style={input} maxLength={24} value={f.nickname} onChange={(e) => set("nickname", e.target.value)} />
        <label style={label}>{en ? "First name *" : "Ime *"}</label>
        <input style={input} maxLength={40} autoComplete="given-name" value={f.first_name} onChange={(e) => set("first_name", e.target.value)} />
        <p style={label}>{en ? "Age group *" : "Starostna skupina *"}</p>
        {radio("18_plus", en ? "18 or older" : "18 ali več")}
        {radio("16_17", en ? "16 or 17" : "16 ali 17")}
        {radio("under_16", en ? "Under 16" : "Manj kot 16")}
        {under16 && <p style={{ ...help, marginTop: 4, color: ERR }}>{en ? "SpartanOps profiles are for players aged 16 and over. You can still play games without a profile." : "Profili SpartanOps so za igralce od 16. leta naprej. Igre lahko še vedno igraš brez profila."}</p>}
        {adult && (
          <>
            <label style={{ ...label, marginTop: 10 }}>{en ? "Surname (optional)" : "Priimek (neobvezno)"}</label>
            <input style={input} maxLength={40} autoComplete="family-name" value={f.last_name} onChange={(e) => set("last_name", e.target.value)} />
            <p style={help}>{en ? "Organisers of events you join can see it. Other players only see your initial." : "Vidijo ga organizatorji dogodkov, na katere se prijaviš. Drugi igralci vidijo le začetnico."}</p>
            <label style={{ display: "flex", gap: 10, alignItems: "center", fontFamily: "monospace", fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={f.show_full_last_name} onChange={(e) => set("show_full_last_name", e.target.checked)} style={{ width: 18, height: 18, accentColor: ACCENT }} />
              {en ? "Show my full surname to other players going" : "Drugim prijavljenim igralcem pokaži celoten priimek"}
            </label>
          </>
        )}
      </Card>

      <Card title={en ? "Loadout" : "Oprema"}>
        <p style={label}>{en ? "Operator type" : "Tip operaterja"}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {OPERATOR_TYPES.map((o) => (
            <button key={o} type="button" aria-pressed={f.operator_type === o} style={chip(f.operator_type === o)} onClick={() => set("operator_type", f.operator_type === o ? "" : o)}>
              {o === "SNIPER" ? "Sniper" : o === "PUMP" ? "Pump" : o}
            </button>
          ))}
        </div>
        <label style={label}>{en ? "Primary weapon" : "Primarno orožje"}</label>
        <input style={input} maxLength={60} value={f.primary_weapon} onChange={(e) => set("primary_weapon", e.target.value)} />
        <label style={label}>{en ? "Secondary weapon" : "Sekundarno orožje"}</label>
        <input style={input} maxLength={60} value={f.secondary_weapon} onChange={(e) => set("secondary_weapon", e.target.value)} />
        <label style={label}>{en ? "Sidearm" : "Pištola"}</label>
        <input style={input} maxLength={60} value={f.sidearm} onChange={(e) => set("sidearm", e.target.value)} />
        <label style={label}>{en ? "Notes" : "Opombe"}</label>
        <textarea style={{ ...input, minHeight: 70, marginBottom: 4 }} maxLength={140} value={f.gear_notes} onChange={(e) => set("gear_notes", e.target.value)} />
        <p style={{ ...help, marginTop: 0, textAlign: "right" }}>{f.gear_notes.length}/140</p>
      </Card>

      <Card title={en ? "About you" : "O tebi"}>
        <label style={label}>{en ? "Club / team" : "Klub / ekipa"}</label>
        <input style={input} maxLength={60} value={f.club} onChange={(e) => set("club", e.target.value)} />
        <p style={label}>{en ? "Experience" : "Izkušnje"}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {EXPERIENCE_LEVELS.map((l) => (
            <button key={l.value} type="button" aria-pressed={f.experience_level === l.value} onClick={() => set("experience_level", l.value)}
              style={{ ...chip(f.experience_level === l.value), display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 11 }}>
              <ExperienceBadge level={l.value} size={16} color={f.experience_level === l.value ? ACCENT : MUTED} />
              {en ? l.labelEn : l.labelSl}
            </button>
          ))}
        </div>
      </Card>

      {adult && (
        <Card title={en ? "Contact" : "Kontakt"}>
          <label style={label}>{en ? "Phone" : "Telefon"}</label>
          <input style={input} type="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)}
            onBlur={() => { const n = f.phone.trim() ? normalizePhone(f.phone) : null; if (n?.ok) set("phone", n.value); }} />
          {phonePreview && !phonePreview.ok && <p style={{ ...help, color: ERR }}>{errText("validation:phone", en)}</p>}
          <p style={help}>{en ? "Never public. You choose per event whether to share it, and with whom." : "Nikoli javno. Pri vsakem dogodku izbereš, ali jo deliš in s kom."}</p>
          <p style={help}>{en ? "Numbers starting with 0 are treated as Slovenian (+386)." : "Številke, ki se začnejo z 0, štejemo za slovenske (+386)."}</p>
        </Card>
      )}

      {needsConsent && (
        <Card title={en ? "Privacy consent" : "Privolitev"}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontFamily: "monospace", fontSize: 13, lineHeight: 1.6, cursor: "pointer" }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 18, height: 18, accentColor: ACCENT, flexShrink: 0, marginTop: 2 }} />
            <span>
              {en ? "I have read the " : "Prebral sem "}
              <a href="/privacy" target="_blank" rel="noopener" style={{ color: ACCENT }}>{en ? "Privacy notice" : "obvestilo o zasebnosti"}</a>
              {en ? " and the " : " in "}
              <a href="/terms" target="_blank" rel="noopener" style={{ color: ACCENT }}>{en ? "Terms" : "pogoje uporabe"}</a>.
            </span>
          </label>
        </Card>
      )}

      {status && <p role="status" style={{ color: status.ok ? OK : ERR, fontFamily: "monospace", fontSize: 13, textAlign: "center", margin: "10px 0" }}>{status.text}</p>}

      <div style={{ position: "sticky", bottom: 0, background: BG, padding: "12px 0", zIndex: 5 }}>
        <button type="button" onClick={onSave} disabled={busy || under16 || !f.age} style={{ ...btn, opacity: busy || under16 || !f.age ? 0.5 : 1 }}>
          {busy ? "…" : en ? "Save profile" : "Shrani profil"}
        </button>
      </div>

      {initial && (
        <Card title={en ? "Your data" : "Tvoji podatki"}>
          <button type="button" onClick={onExport} style={{ ...outlineBtn, marginBottom: 10 }}>{en ? "Download my data" : "Prenesi moje podatke"}</button>
          <button type="button" onClick={() => setDelOpen(true)} style={{ ...outlineBtn, color: ERR, borderColor: ERR }}>{en ? "Delete my profile" : "Izbriši profil"}</button>
        </Card>
      )}

      <button type="button" onClick={() => supabase.auth.signOut()} style={{ ...outlineBtn, marginTop: 6 }}>{en ? "Sign out" : "Odjava"}</button>
      <p style={{ textAlign: "center", marginTop: 18, fontFamily: "monospace", fontSize: 12 }}>
        <Link to="/privacy" style={{ color: ACCENT }}>{en ? "Privacy" : "Zasebnost"}</Link>{"  ·  "}
        <Link to="/terms" style={{ color: ACCENT }}>{en ? "Terms" : "Pogoji"}</Link>
      </p>

      {delOpen && <DeleteDialog en={en} onClose={() => setDelOpen(false)} onConfirm={async () => {
        const r = await del({ data: { accessToken: await token(), confirm: "DELETE" } });
        if (!r.keptLogin) await supabase.auth.signOut().catch(() => {});
        onDeleted(r.keptLogin);
      }} />}
    </div>
  );
}

function DeleteDialog({ en, onClose, onConfirm }: { en: boolean; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, maxWidth: 420, width: "100%", borderColor: ERR }}>
        <h2 style={{ ...cardTitle, color: ERR }}>{en ? "Delete my profile" : "Izbriši profil"}</h2>
        <p style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
          {en ? "This removes your player profile and your event answers. It cannot be undone. Type DELETE to confirm." : "S tem izbrišeš igralski profil in odgovore na dogodke. Tega ni mogoče razveljaviti. Za potrditev vpiši DELETE."}
        </p>
        <input style={input} value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="characters" aria-label="DELETE" />
        {err && <p style={{ color: ERR, fontSize: 12, marginBottom: 10 }}>{en ? "Could not delete. Please try again." : "Brisanje ni uspelo. Poskusi znova."}</p>}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ ...outlineBtn, flex: 1 }}>{en ? "Cancel" : "Prekliči"}</button>
          <button type="button" disabled={text !== "DELETE" || busy} onClick={async () => { setBusy(true); setErr(false); try { await onConfirm(); } catch { setErr(true); setBusy(false); } }}
            style={{ ...btn, flex: 1, background: ERR, opacity: text !== "DELETE" || busy ? 0.5 : 1 }}>
            {en ? "Delete" : "Izbriši"}
          </button>
        </div>
      </div>
    </div>
  );
}
