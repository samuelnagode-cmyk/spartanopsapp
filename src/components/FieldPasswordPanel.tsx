import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

const BG = "#0b0d09";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const ERR = "#d97a6c";

const labelStyle: CSSProperties = {
  display: "block", fontFamily: "'Michroma', monospace", fontSize: 9.5,
  letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", marginBottom: 6,
};
const inputStyle: CSSProperties = {
  flex: 1, minWidth: 0, background: "rgba(0,0,0,0.4)", color: INK,
  border: `1px solid ${ACCENT}55`, padding: "10px 12px",
  fontFamily: "monospace", fontSize: 13, boxSizing: "border-box",
};
const btnStyle: CSSProperties = {
  width: "100%", padding: "12px", background: ACCENT, color: BG, border: "none",
  fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.20em",
  textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
};
const ghostBtn: CSSProperties = {
  padding: "0 12px", background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}88`,
  fontFamily: "'Michroma', monospace", fontSize: 9.5, letterSpacing: "0.14em",
  textTransform: "uppercase", cursor: "pointer",
};

// Short, unambiguous, easy-to-say words for generated field passwords.
const WORDS = [
  "tiger", "eagle", "falcon", "wolf", "bear", "lion", "shark", "cobra", "viper", "hawk",
  "raven", "fox", "bison", "moose", "otter", "panda", "rhino", "zebra", "lynx", "puma",
  "river", "forest", "stone", "storm", "thunder", "canyon", "desert", "glacier", "island", "meadow",
  "rocket", "anchor", "arrow", "badge", "cannon", "comet", "delta", "ember", "flint", "harbor",
  "jungle", "lemon", "mango", "nova", "orbit", "pepper", "quartz", "radar", "saber", "summit",
  "turbo", "union", "valley", "winter", "yankee", "zulu", "bravo", "echo", "hotel", "sierra",
];

function generatePassword(): string {
  const r = crypto.getRandomValues(new Uint32Array(2));
  const word = WORDS[r[0] % WORDS.length];
  const digits = String(r[1] % 100).padStart(2, "0");
  return `${word}-${digits}`;
}

export function FieldPasswordPanel({ en }: { en: boolean }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [changedAt, setChangedAt] = useState<string | null | undefined>(undefined);

  const loadChangedAt = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setChangedAt(null); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("spartanops_accounts") as any)
      .select("field_password_changed_at")
      .eq("id", user.id)
      .maybeSingle();
    setChangedAt((data?.field_password_changed_at as string | null) ?? null);
  };

  useEffect(() => { void loadChangedAt(); }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setSaved(null);
    const normalized = value.trim().toLowerCase();
    if (normalized.length < 4 || normalized.length > 64) {
      setErr(en ? "Password must be 4–64 characters." : "Geslo mora imeti 4–64 znakov.");
      return;
    }
    setBusy(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)("spartanops_set_field_password", { p_password: normalized });
    setBusy(false);
    if (error) {
      setErr(String(error.message).includes("password_length")
        ? (en ? "Password must be 4–64 characters." : "Geslo mora imeti 4–64 znakov.")
        : error.message);
      return;
    }
    setValue("");
    setSaved(normalized); // component state only — never persisted
    void loadChangedAt();
  };

  const changedLabel = changedAt === undefined
    ? "…"
    : changedAt
      ? new Date(changedAt).toLocaleString(en ? "en-GB" : "sl-SI")
      : (en ? "Not set yet" : "Še ni nastavljeno");

  return (
    <form onSubmit={save} style={{ marginTop: 20 }}>
      <label style={labelStyle}>{en ? "Field password (for players)" : "Geslo poligona (za igralce)"}</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          style={inputStyle}
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={64}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="button" style={ghostBtn} onClick={() => setValue(generatePassword())}>
          {en ? "Generate" : "Ustvari"}
        </button>
      </div>
      <p style={{ fontSize: 11, opacity: 0.7, marginBottom: 6, fontFamily: "monospace", color: INK }}>
        {en ? "Not case-sensitive. Saving a new password replaces the old one." : "Ne razlikuje velikih in malih črk. Shranjevanje novega gesla zamenja prejšnjega."}
      </p>
      <p style={{ fontSize: 11, opacity: 0.7, marginBottom: 12, fontFamily: "monospace", color: INK }}>
        {en ? "Last changed: " : "Nazadnje spremenjeno: "}{changedLabel}
      </p>
      {err && <p style={{ color: ERR, fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</p>}
      {saved && (
        <div style={{ border: `1px solid ${ACCENT}`, padding: "12px", marginBottom: 12, textAlign: "center" }}>
          <div style={{ fontFamily: "monospace", fontSize: 28, color: ACCENT, letterSpacing: "0.06em", wordBreak: "break-all" }}>{saved}</div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: INK, opacity: 0.8, marginTop: 4 }}>
            {en ? "Write it on your poster" : "Zapiši ga na plakat"}
          </div>
        </div>
      )}
      <button type="submit" disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }}>
        {en ? "Save" : "Shrani"}
      </button>
    </form>
  );
}
