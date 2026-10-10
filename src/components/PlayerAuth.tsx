import { useState, type CSSProperties, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { safeNext } from "@/lib/player-validation";

const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const ERR = "#d97a6c";
const OK = "#9eff3d";

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
  fontFamily: "monospace", fontSize: 12, textDecoration: "underline", padding: 0,
};

/** "Forgot password?" link + inline email form. Neutral reply whether or not the email exists. */
export function ForgotPassword({ en, initialEmail = "" }: { en: boolean; initialEmail?: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` }).catch(() => {});
    setBusy(false);
    setSent(true);
  };
  if (!open) {
    return (
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <button type="button" style={linkBtn} onClick={() => { setEmail(initialEmail); setOpen(true); }}>
          {en ? "Forgot password?" : "Pozabljeno geslo?"}
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={send} style={{ marginTop: 14, borderTop: `1px solid ${ACCENT}33`, paddingTop: 14 }}>
      {sent ? (
        <p style={{ color: OK, fontFamily: "monospace", fontSize: 12, textAlign: "center" }}>
          {en ? "If this email has an account, we sent a link." : "Če ima ta e-pošta račun, smo poslali povezavo."}
        </p>
      ) : (
        <>
          <label style={labelStyle}>Email</label>
          <input style={inputStyle} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }}>
            {en ? "Send reset link" : "Pošlji povezavo"}
          </button>
        </>
      )}
    </form>
  );
}

export function PlayerAuth({ next, onDone }: { next?: string | null; onDone?: () => void }) {
  const { lang } = useLang();
  const en = lang === "en";
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (password.length < 8) { setErr(en ? "Password must be at least 8 characters." : "Geslo mora imeti vsaj 8 znakov."); return; }
    setBusy(true);
    try {
      if (tab === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) { setErr(error.message); return; }
        onDone?.();
      } else {
        const n = safeNext(next);
        // No business_name in metadata: a player sign-up never creates a field.
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: `${window.location.origin}/me${n ? `?next=${encodeURIComponent(n)}` : ""}` },
        });
        if (error) { setErr(error.message); return; }
        if (data.session) onDone?.();
        else setMsg(en
          ? "Account created. Check your email and click the confirmation link before signing in."
          : "Račun ustvarjen. Preveri e-pošto in klikni potrditveno povezavo, preden se prijaviš.");
      }
    } finally { setBusy(false); }
  };

  const tabBtn = (id: "signin" | "signup", label: string) => (
    <button type="button" onClick={() => { setTab(id); setErr(null); setMsg(null); }} aria-pressed={tab === id}
      style={{ flex: 1, padding: "10px 6px", background: tab === id ? `${ACCENT}22` : "transparent", color: tab === id ? ACCENT : INK,
        border: `1px solid ${tab === id ? ACCENT : `${ACCENT}33`}`, fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {tabBtn("signin", en ? "Sign in" : "Prijava")}
        {tabBtn("signup", en ? "Create account" : "Ustvari račun")}
      </div>
      <form onSubmit={submit}>
        <label style={labelStyle}>Email</label>
        <input style={inputStyle} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label style={labelStyle}>{en ? "Password" : "Geslo"}</label>
        <input style={{ ...inputStyle, marginBottom: 6 }} type={show ? "text" : "password"} required minLength={8}
          autoComplete={tab === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} style={{ ...linkBtn, marginBottom: 14 }}>
          {show ? (en ? "Hide password" : "Skrij geslo") : (en ? "See password" : "Pokaži geslo")}
        </button>
        {err && <p style={{ color: ERR, fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</p>}
        {msg && <p style={{ color: OK, fontSize: 12, marginBottom: 10, textAlign: "center", fontFamily: "monospace" }}>{msg}</p>}
        <button type="submit" disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }}>
          {tab === "signin" ? (en ? "Sign in" : "Prijava") : (en ? "Create account" : "Ustvari račun")}
        </button>
      </form>
      <ForgotPassword en={en} initialEmail={email} />
    </div>
  );
}

export function PlayerAuthDialog({ open, onClose, onDone, next }: { open: boolean; onClose: () => void; onDone?: () => void; next?: string | null }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: PANEL, color: INK, border: `1px solid ${ACCENT}44`, padding: "26px 20px", width: "100%", maxWidth: 420, maxHeight: "92vh", overflowY: "auto" }}>
        <PlayerAuth next={next} onDone={() => { onDone?.(); onClose(); }} />
      </div>
    </div>
  );
}
