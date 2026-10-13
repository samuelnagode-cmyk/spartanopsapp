import { useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { FIELD_CREATED_EVENT } from "@/lib/use-signed-in";

const db = supabase as unknown as SupabaseClient;
const BG = "#0b0d09";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const ERR = "#d97a6c";

const labelStyle: CSSProperties = {
  display: "block", fontFamily: "'Michroma', monospace", fontSize: 9.5,
  letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", marginBottom: 6,
};
const inputStyle: CSSProperties = {
  width: "100%", background: "rgba(0,0,0,0.4)", color: INK, border: `1px solid ${ACCENT}55`,
  padding: "10px 12px", fontFamily: "monospace", fontSize: 16, marginBottom: 14, boxSizing: "border-box",
};
const btnStyle: CSSProperties = {
  width: "100%", padding: "12px", background: ACCENT, color: BG, border: "none",
  fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.20em",
  textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
};
const linkBtn: CSSProperties = {
  background: "transparent", border: "none", color: ACCENT, cursor: "pointer",
  fontFamily: "monospace", fontSize: 12, textDecoration: "underline", marginTop: 14, width: "100%",
};

/**
 * A login with no field row: offer to create a field. Shared by /marshal-account and /me.
 * `collapsible` starts as a one-line card that expands into the form.
 */
export function FieldCreateCard({ user, en, onCreated, collapsible = false }: {
  user: User; en: boolean; onCreated: (name: string) => void; collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const create = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) { setErr(en ? "Business / field name is required." : "Ime podjetja / poligona je obvezno."); return; }
    setBusy(true); setErr(null);
    const { error } = await db.from("spartanops_accounts").insert({ id: user.id, business_name: n });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (typeof window !== "undefined") window.dispatchEvent(new Event(FIELD_CREATED_EVENT));
    onCreated(n);
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-expanded={false}
        style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", color: INK,
          border: `1px solid ${ACCENT}55`, padding: "12px 14px", fontFamily: "monospace", fontSize: 13, cursor: "pointer", marginBottom: 16 }}>
        {en ? "Do you run a field? Create it here" : "Vodiš poligon? Ustvari ga tukaj"} <span style={{ color: ACCENT }}>→</span>
      </button>
    );
  }

  return (
    <form onSubmit={create} style={collapsible ? { border: `1px solid ${ACCENT}55`, padding: "16px 14px", marginBottom: 16 } : undefined}>
      <p style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 10 }}>
        {en ? "This login has no field yet" : "Ta prijava še nima poligona"}
      </p>
      <p style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.8, lineHeight: 1.6, marginBottom: 14 }}>{user.email}</p>
      <label style={labelStyle}>{en ? "Business / field name" : "Ime podjetja / poligona"}</label>
      <input style={inputStyle} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      {err && <p style={{ color: ERR, fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</p>}
      <button type="submit" disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }}>{en ? "Create my field" : "Ustvari poligon"}</button>
      {collapsible ? (
        <button type="button" onClick={() => setOpen(false)} style={linkBtn}>{en ? "Not now" : "Ne zdaj"}</button>
      ) : (
        <Link to="/me" style={{ ...linkBtn, display: "block", textAlign: "center" }}>{en ? "My account →" : "Moj račun →"}</Link>
      )}
    </form>
  );
}
