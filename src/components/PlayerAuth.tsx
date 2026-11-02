import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { safeNext } from "@/lib/player-validation";
import { friendlyAuthError } from "@/lib/auth-errors";

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

export function PlayerAuth({ next, onDone, initialTab = "signin", rsvp, asMarshal = false }: { next?: string | null; onDone?: () => void; initialTab?: "signin" | "signup"; rsvp?: "going" | "maybe"; asMarshal?: boolean }) {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [business, setBusiness] = useState("");
  const en = lang === "en";
  const [tab, setTab] = useState<"signin" | "signup">(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errKind, setErrKind] = useState<"unconfirmed" | "other">("other");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [justSignedUp, setJustSignedUp] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  // One helper for both sign-up paths and the resend, so the confirmation
  // link stays byte-for-byte identical to what it was before.
  const confirmRedirect = () => {
    if (asMarshal) return `${window.location.origin}/marshal-account`;
    const n = safeNext(next);
    const qs = new URLSearchParams();
    if (n) qs.set("next", n);
    if (rsvp === "going" || rsvp === "maybe") qs.set("rsvp", rsvp);
    const q = qs.toString();
    return `${window.location.origin}/me${q ? `?${q}` : ""}`;
  };

  const resend = async () => {
    const em = email.trim();
    if (!em) { setErr(friendlyAuthError({ code: "email_address_invalid" }, en).text); return; }
    setResendBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase.auth.resend({ type: "signup", email: em, options: { emailRedirectTo: confirmRedirect() } });
    setResendBusy(false);
    if (error) { setErr(friendlyAuthError(error, en).text); return; }
    setMsg(en ? "Sent. If it does not arrive, check your spam folder." : "Poslano. Če je ni, poglej med neželeno pošto.");
    setCooldown(60);
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { if (cooldownRef.current) clearInterval(cooldownRef.current); cooldownRef.current = null; return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setMsg(null); setErrKind("other"); setJustSignedUp(false);
    if (password.length < 8) { setErr(en ? "Password must be at least 8 characters." : "Geslo mora imeti vsaj 8 znakov."); return; }
    setBusy(true);
    try {
      if (tab === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) { const f = friendlyAuthError(error, en); setErr(f.text); setErrKind(f.kind); return; }
        if (asMarshal && data.user) {
          const { data: acct } = await (supabase as unknown as SupabaseClient)
            .from("spartanops_accounts").select("field_password_changed_at").eq("id", data.user.id).maybeSingle();
          if (acct?.field_password_changed_at) navigate({ to: "/admin-pregled" });
        }
        onDone?.();
      } else if (asMarshal) {
        const b = business.trim();
        if (!b) { setErr(en ? "Field / club name is required." : "Ime poligona / kluba je obvezno."); return; }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: confirmRedirect(), data: { business_name: b } },
        });
        if (error) { const f = friendlyAuthError(error, en); setErr(f.text); setErrKind(f.kind); return; }
        if (data.session && data.user) {
          const { error: insErr } = await (supabase as unknown as SupabaseClient)
            .from("spartanops_accounts").insert({ id: data.user.id, business_name: b });
          if (insErr) { setErr(friendlyAuthError(insErr, en).text); return; }
          onDone?.();
        } else {
          setJustSignedUp(true);
          setMsg(en
            ? "Account created. Check your email and click the confirmation link before signing in. No email? Check your spam folder."
            : "Račun ustvarjen. Preveri e-pošto in klikni potrditveno povezavo, preden se prijaviš. Ni e-pošte? Poglej med neželeno pošto.");
        }
      } else {
        // No business_name in metadata: a player sign-up never creates a field.
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: confirmRedirect() },
        });
        if (error) { const f = friendlyAuthError(error, en); setErr(f.text); setErrKind(f.kind); return; }
        if (data.session) onDone?.();
        else {
          setJustSignedUp(true);
          setMsg(en
            ? "Account created. Check your email and click the confirmation link before signing in. No email? Check your spam folder."
            : "Račun ustvarjen. Preveri e-pošto in klikni potrditveno povezavo, preden se prijaviš. Ni e-pošte? Poglej med neželeno pošto.");
        }
      }
    } finally { setBusy(false); }
  };

  const tabBtn = (id: "signin" | "signup", label: string) => (
    <button type="button" onClick={() => { setTab(id); setErr(null); setMsg(null); setErrKind("other"); setJustSignedUp(false); }} aria-pressed={tab === id}
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
        {asMarshal && tab === "signup" && (
          <>
            <label style={labelStyle}>{en ? "Field / club name" : "Ime poligona / kluba"}</label>
            <input style={inputStyle} type="text" required maxLength={120} value={business} onChange={(e) => setBusiness(e.target.value)} />
          </>
        )}
        {err && <p style={{ color: ERR, fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</p>}
        {msg && <p style={{ color: OK, fontSize: 12, marginBottom: 10, textAlign: "center", fontFamily: "monospace" }}>{msg}</p>}
        {(justSignedUp || errKind === "unconfirmed") && (
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <button type="button" onClick={resend} disabled={resendBusy || cooldown > 0}
              style={{ ...linkBtn, minHeight: 44, padding: "10px 0", opacity: resendBusy || cooldown > 0 ? 0.6 : 1 }}>
              {cooldown > 0
                ? (en ? `Again in ${cooldown} s` : `Znova čez ${cooldown} s`)
                : (en ? "Send the confirmation email again" : "Pošlji potrditveno e-pošto znova")}
            </button>
          </div>
        )}
        <button type="submit" disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }}>
          {tab === "signin" ? (en ? "Sign in" : "Prijava") : (en ? "Create account" : "Ustvari račun")}
        </button>
      </form>
      <ForgotPassword en={en} initialEmail={email} />
    </div>
  );
}

export function PlayerAuthDialog({ open, onClose, onDone, next, rsvp }: { open: boolean; onClose: () => void; onDone?: () => void; next?: string | null; rsvp?: "going" | "maybe" }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: PANEL, color: INK, border: `1px solid ${ACCENT}44`, padding: "26px 20px", width: "100%", maxWidth: 420, maxHeight: "92vh", overflowY: "auto" }}>
        <PlayerAuth next={next} rsvp={rsvp} onDone={() => { onDone?.(); onClose(); }} />
      </div>
    </div>
  );
}
