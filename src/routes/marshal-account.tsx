import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { FieldPasswordPanel } from "@/components/FieldPasswordPanel";

// Same shared client; untyped view because the generated types do not yet include spartanops_accounts.
const db = supabase as unknown as SupabaseClient;

export const Route = createFileRoute("/marshal-account")({
  head: () => ({
    meta: [
      { title: "Marshal Account — SpartanOps" },
      { name: "description", content: "Sign up or log in to your SpartanOps field-operator account." },
      { property: "og:title", content: "Marshal Account — SpartanOps" },
      { property: "og:description", content: "Sign up or log in to your SpartanOps field-operator account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarshalAccountPage,
});

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
  width: "100%", background: "rgba(0,0,0,0.4)", color: INK,
  border: `1px solid ${ACCENT}55`, padding: "10px 12px",
  fontFamily: "monospace", fontSize: 13, marginBottom: 14, boxSizing: "border-box",
};
const btnStyle: CSSProperties = {
  width: "100%", padding: "12px", background: ACCENT, color: BG, border: "none",
  fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.20em",
  textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
};
const linkBtn: CSSProperties = {
  background: "transparent", border: "none", color: ACCENT, cursor: "pointer",
  fontFamily: "monospace", fontSize: 12, textDecoration: "underline", marginTop: 14,
  width: "100%",
};

function MarshalAccountPage() {
  const { lang } = useLang();
  const en = lang === "en";
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"signup" | "login">("signup");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "110px 16px 48px" }}>
      <div style={{ maxWidth: 420, margin: "0 auto", background: PANEL, border: `1px solid ${ACCENT}44`, padding: "28px 22px" }}>
        <h1 style={{ fontFamily: "'Michroma', monospace", fontSize: 15, letterSpacing: "0.18em", color: INK, textAlign: "center", textTransform: "uppercase", marginBottom: 22 }}>
          {en ? "Marshal Account" : "Račun maršala"}
        </h1>
        {!ready ? (
          <p style={{ textAlign: "center", fontFamily: "monospace", fontSize: 12, opacity: 0.7 }}>…</p>
        ) : user ? (
          <LoggedIn user={user} en={en} />
        ) : mode === "signup" ? (
          <SignUpForm en={en} onSwitch={() => setMode("login")} />
        ) : (
          <LoginForm en={en} onSwitch={() => setMode("signup")} />
        )}
      </div>
    </main>
  );
}

function SignUpForm({ en, onSwitch }: { en: boolean; onSwitch: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [business, setBusiness] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (password !== confirm) { setErr(en ? "Passwords do not match." : "Gesli se ne ujemata."); return; }
    if (!business.trim()) { setErr(en ? "Business / field name is required." : "Ime podjetja / poligona je obvezno."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/marshal-account`,
          data: { business_name: business.trim() },
        },
      });
      if (error) { setErr(error.message); return; }
      if (data.session && data.user) {
        const { error: insErr } = await db
          .from("spartanops_accounts")
          .insert({ id: data.user.id, business_name: business.trim() });
        if (insErr) { setErr(insErr.message); return; }
        setMsg(en ? "Account created." : "Račun ustvarjen.");
      } else {
        setMsg(en
          ? "Account created. Check your email and click the confirmation link before logging in."
          : "Račun ustvarjen. Preveri e-pošto in klikni potrditveno povezavo, preden se prijaviš.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <label style={labelStyle}>Email</label>
      <input style={inputStyle} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label style={labelStyle}>{en ? "Password" : "Geslo"}</label>
      <input style={{ ...inputStyle, marginBottom: 6 }} type={showPassword ? "text" : "password"} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <label style={labelStyle}>{en ? "Confirm password" : "Potrdi geslo"}</label>
      <input style={{ ...inputStyle, marginBottom: 6 }} type={showPassword ? "text" : "password"} required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <PasswordVisibilityToggle en={en} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
      <label style={labelStyle}>{en ? "Business / field name" : "Ime podjetja / poligona"}</label>
      <input style={inputStyle} type="text" required maxLength={120} value={business} onChange={(e) => setBusiness(e.target.value)} />
      {err && <p style={{ color: ERR, fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</p>}
      {msg && <p style={{ color: OK, fontSize: 12, marginBottom: 10, textAlign: "center", fontFamily: "monospace" }}>{msg}</p>}
      <button type="submit" disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }}>
        {en ? "Sign up" : "Registracija"}
      </button>
      <button type="button" onClick={onSwitch} style={linkBtn}>
        {en ? "Already have an account? Log in" : "Že imaš račun? Prijava"}
      </button>
    </form>
  );
}

function LoginForm({ en, onSwitch }: { en: boolean; onSwitch: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <label style={labelStyle}>Email</label>
      <input style={inputStyle} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label style={labelStyle}>{en ? "Password" : "Geslo"}</label>
      <input style={{ ...inputStyle, marginBottom: 6 }} type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <PasswordVisibilityToggle en={en} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
      {err && <p style={{ color: ERR, fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</p>}
      <button type="submit" disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }}>
        {en ? "Log in" : "Prijava"}
      </button>
      <button type="button" onClick={onSwitch} style={linkBtn}>
        {en ? "No account yet? Sign up" : "Še nimaš računa? Registracija"}
      </button>
    </form>
  );
}

function PasswordVisibilityToggle({ en, visible, onToggle }: { en: boolean; visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={visible}
      style={{ ...linkBtn, marginTop: 0, marginBottom: 14, textAlign: "left", width: "auto" }}
    >
      {visible ? (en ? "Hide password" : "Skrij geslo") : (en ? "See password" : "Pokaži geslo")}
    </button>
  );
}

function LoggedIn({ user, en }: { user: User; en: boolean }) {
  const [business, setBusiness] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await db
        .from("spartanops_accounts")
        .select("business_name")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) { setErr(error.message); return; }
      if (data) { setBusiness(data.business_name); return; }
      // First login after email confirmation: create the row from sign-up metadata.
      const pending = (user.user_metadata?.business_name as string | undefined)?.trim();
      if (!pending) { setBusiness(""); return; }
      const { error: insErr } = await db
        .from("spartanops_accounts")
        .insert({ id: user.id, business_name: pending });
      if (cancelled) return;
      if (insErr) setErr(insErr.message);
      else setBusiness(pending);
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div>
      <p style={labelStyle}>Email</p>
      <p style={{ fontFamily: "monospace", fontSize: 14, marginBottom: 16 }}>{user.email}</p>
      <p style={labelStyle}>{en ? "Business / field" : "Podjetje / poligon"}</p>
      <p style={{ fontFamily: "monospace", fontSize: 14, marginBottom: 20 }}>{business === null ? "…" : business || "—"}</p>
      {err && <p style={{ color: ERR, fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</p>}
      <Link to="/admin-pregled" style={{ ...btnStyle, display: "block", textAlign: "center", textDecoration: "none", marginBottom: 12 }}>
        {en ? "Go to your missions" : "Pojdi na svoje misije"}
      </Link>
      <button type="button" onClick={() => supabase.auth.signOut()} style={btnStyle}>
        {en ? "Log out" : "Odjava"}
      </button>
      <FieldPasswordPanel en={en} />
      <Link to="/field-qr" style={{ ...btnStyle, display: "block", textAlign: "center", textDecoration: "none", marginTop: 14 }}>
        {en ? "Player QR" : "QR za igralce"}
      </Link>
      <p style={{ marginTop: 18, padding: "10px 12px", border: `1px dashed ${ACCENT}55`, fontFamily: "monospace", fontSize: 11.5, lineHeight: 1.6, color: INK, opacity: 0.85 }}>
        <span style={{ color: ACCENT }}>ⓘ </span>
        {en
          ? "This account will soon let you manage all of your fields and missions in one place. That part is coming in the next update."
          : "Ta račun ti bo kmalu omogočil upravljanje vseh tvojih poligonov in misij na enem mestu. Ta del prihaja v naslednji posodobitvi."}
      </p>
    </div>
  );
}

type OwnedLobby = { id: string; field_name: string; event_name: string | null };

function MissionsBlock({ user, en }: { user: User; en: boolean }) {
  const [missions, setMissions] = useState<OwnedLobby[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [claimErr, setClaimErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadMissions = async () => {
    const { data, error } = await db
      .from("spartanops_lobbies")
      .select("id, field_name, event_name")
      .eq("account_id", user.id)
      .order("created_at", { ascending: false });
    if (error) { setListErr(error.message); return; }
    setListErr(null);
    setMissions((data ?? []) as OwnedLobby[]);
  };

  useEffect(() => { void loadMissions(); }, [user.id]);

  const claim = async () => {
    setClaimMsg(null); setClaimErr(null); setBusy(true);
    try {
      const { data, error } = await db
        .from("spartanops_lobbies")
        .update({ account_id: user.id })
        .is("account_id", null)
        .select("id");
      if (error) { setClaimErr(error.message); return; }
      const n = data?.length ?? 0;
      setClaimMsg(en ? `Imported ${n} mission(s).` : `Uvoženih misij: ${n}.`);
      await loadMissions();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <button type="button" onClick={claim} disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.6 : 1, marginBottom: 10 }}>
        {en ? "Import existing missions" : "Uvozi obstoječe misije"}
      </button>
      {claimErr && <p style={{ color: ERR, fontSize: 12, marginBottom: 10, textAlign: "center" }}>{claimErr}</p>}
      {claimMsg && <p style={{ color: OK, fontSize: 12, marginBottom: 10, textAlign: "center", fontFamily: "monospace" }}>{claimMsg}</p>}
      <p style={{ ...labelStyle, marginTop: 10 }}>{en ? "Your missions" : "Tvoje misije"}</p>
      {listErr ? (
        <p style={{ color: ERR, fontSize: 12, textAlign: "center" }}>{listErr}</p>
      ) : missions === null ? (
        <p style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.7 }}>…</p>
      ) : missions.length === 0 ? (
        <p style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.7 }}>{en ? "No missions linked yet." : "Še ni povezanih misij."}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {missions.map((m) => (
            <li key={m.id} style={{ border: `1px solid ${ACCENT}33`, background: "rgba(0,0,0,0.25)", padding: "8px 10px", marginBottom: 6, fontFamily: "monospace", fontSize: 13 }}>
              <div>{m.field_name}</div>
              {m.event_name && <div style={{ fontSize: 11.5, opacity: 0.7 }}>{m.event_name}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
