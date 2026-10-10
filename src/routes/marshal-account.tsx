import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { FieldPasswordPanel } from "@/components/FieldPasswordPanel";
import { ForgotPassword } from "@/components/PlayerAuth";
import { CountrySearchInput } from "@/components/CountrySearchInput";
import { COUNTRIES, countryCodeFor } from "@/lib/countries";
import {
  CONTACT_EMAIL, FOUNDING_OFFER, daysUntil, formatFoundingDate, foundingApplicationMailto, foundingContinueMailto,
  limitsFor, resolveEffectivePlan, todayLjubljana, type PlanId, type PlanRow,
} from "@/lib/plans";

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
          {user ? (en ? "Field settings" : "Nastavitve poligona") : (en ? "Marshal Account" : "Račun maršala")}
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
  const navigate = useNavigate();
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
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setErr(error.message); return; }
      if (data.user) {
        const { data: acct } = await db
          .from("spartanops_accounts")
          .select("field_password_changed_at")
          .eq("id", data.user.id)
          .maybeSingle();
        if (acct?.field_password_changed_at) navigate({ to: "/admin-pregled" });
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
      <input style={{ ...inputStyle, marginBottom: 6 }} type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <PasswordVisibilityToggle en={en} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
      {err && <p style={{ color: ERR, fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</p>}
      <button type="submit" disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }}>
        {en ? "Log in" : "Prijava"}
      </button>
      <button type="button" onClick={onSwitch} style={linkBtn}>
        {en ? "No account yet? Sign up" : "Še nimaš računa? Registracija"}
      </button>
      <ForgotPassword en={en} initialEmail={email} />
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
  const [listed, setListed] = useState<boolean | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [countryName, setCountryName] = useState("");
  const [locBusy, setLocBusy] = useState(false);
  const [locMsg, setLocMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await db
        .from("spartanops_accounts")
        .select("business_name, listed_publicly, city, country")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) { setErr(error.message); return; }
      if (data) {
        setBusiness(data.business_name); setListed(data.listed_publicly !== false);
        setCity((data as any).city ?? "");
        const code = (data as any).country as string | null;
        setCountryName(code ? (COUNTRIES.find((c) => c.code === code)?.name ?? code) : "");
        return;
      }
      // First login after email confirmation: create the row from sign-up metadata.
      const pending = (user.user_metadata?.business_name as string | undefined)?.trim();
      if (!pending) { setBusiness(""); return; }
      const { error: insErr } = await db
        .from("spartanops_accounts")
        .insert({ id: user.id, business_name: pending });
      if (cancelled) return;
      if (insErr) setErr(insErr.message);
      else { setBusiness(pending); setListed(true); }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const toggleListed = async () => {
    if (listed === null || listBusy) return;
    const next = !listed;
    setListBusy(true);
    const { error } = await db.from("spartanops_accounts").update({ listed_publicly: next }).eq("id", user.id);
    if (!error) setListed(next); else setErr(error.message);
    setListBusy(false);
  };

  const saveLocation = async () => {
    if (locBusy) return;
    setLocMsg(null);
    const c = city.trim();
    if (c.length > 80) { setLocMsg({ ok: false, text: en ? "City must be 80 characters or fewer." : "Mesto ima lahko največ 80 znakov." }); return; }
    const cn = countryName.trim();
    const code = cn ? countryCodeFor(cn) : null;
    if (cn && !code) { setLocMsg({ ok: false, text: en ? "Pick a country from the list." : "Izberi državo s seznama." }); return; }
    setLocBusy(true);
    const { error } = await db.from("spartanops_accounts").update({ city: c || null, country: code } as any).eq("id", user.id);
    setLocBusy(false);
    if (error) setLocMsg({ ok: false, text: error.message });
    else {
      setCity(c);
      setCountryName(code ? (COUNTRIES.find((x) => x.code === code)?.name ?? code) : "");
      setLocMsg({ ok: true, text: en ? "Location saved." : "Lokacija shranjena." });
    }
  };

  const section: CSSProperties = { borderTop: `1px solid ${ACCENT}33`, paddingTop: 18, marginTop: 22 };
  const sectionTitle: CSSProperties = { fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em", color: INK, textTransform: "uppercase", marginBottom: 12 };

  if (business === "") return <NoFieldCard user={user} en={en} onCreated={(name) => { setBusiness(name); setListed(true); }} />;

  return (
    <div>
      <YourPlanCard user={user} en={en} business={business} />

      <Link to="/admin-pregled" style={{ ...btnStyle, display: "block", textAlign: "center", textDecoration: "none", marginBottom: 22 }}>
        {en ? "Missions" : "Misije"}
      </Link>
      <Link to="/events/manage" style={{ ...btnStyle, display: "block", textAlign: "center", textDecoration: "none", marginTop: -12, marginBottom: 22, background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}` }}>
        {en ? "Events" : "Dogodki"}
      </Link>


      <h2 style={sectionTitle}>{en ? "Account" : "Račun"}</h2>
      <p style={labelStyle}>Email</p>
      <p style={{ fontFamily: "monospace", fontSize: 14, marginBottom: 16 }}>{user.email}</p>
      <p style={labelStyle}>{en ? "Business / field" : "Podjetje / poligon"}</p>
      <p style={{ fontFamily: "monospace", fontSize: 14, marginBottom: 16 }}>{business === null ? "…" : business || "—"}</p>
      {err && <p style={{ color: ERR, fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</p>}

      <div style={section}>
        <h2 style={sectionTitle}>{en ? "Field location" : "Lokacija poligona"}</h2>
        <p style={{ fontFamily: "monospace", fontSize: 11.5, opacity: 0.8, lineHeight: 1.6, marginBottom: 12 }}>
          {en ? "Shown next to your field's name on the Join page so players can tell fields apart." : "Prikazano ob imenu poligona na strani za vstop, da igralci ločijo poligone."}
        </p>
        <p style={labelStyle}>{en ? "City" : "Mesto"}</p>
        <input value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} autoComplete="address-level2" />
        <p style={labelStyle}>{en ? "Country" : "Država"}</p>
        <CountrySearchInput value={countryName} onChange={setCountryName} inputStyle={inputStyle} accent={ACCENT} />
        <button type="button" onClick={saveLocation} disabled={locBusy} style={{ ...btnStyle, marginTop: 12, opacity: locBusy ? 0.6 : 1 }}>
          {locBusy ? "…" : en ? "Save" : "Shrani"}
        </button>
        {locMsg && <p style={{ color: locMsg.ok ? ACCENT : ERR, fontSize: 12, marginTop: 8, textAlign: "center" }}>{locMsg.text}</p>}
      </div>

      <div style={section}>
        <h2 style={sectionTitle}>{en ? "Field password" : "Geslo poligona"}</h2>
        <FieldPasswordPanel en={en} />
      </div>

      <div style={section}>
        <h2 style={sectionTitle}>{en ? "Player QR" : "QR za igralce"}</h2>
        <p style={{ fontFamily: "monospace", fontSize: 11.5, opacity: 0.8, lineHeight: 1.6, marginBottom: 12 }}>
          {en ? "Players scan this QR to reach your field's password page. You can also send them the URL to pre-join and get ready for missions in advance." : "Igralci skenirajo to QR kodo za vstop na stran z geslom tvojega poligona. Lahko pa jim pošlješ povezavo, da se pred pripravami vnaprej prijavijo in se pripravijo na misije."}
        </p>
        <Link to="/field-qr" style={{ ...btnStyle, display: "block", textAlign: "center", textDecoration: "none" }}>
          {en ? "SHOW QR / URL OR PRINT POSTER" : "POKAŽI QR / POVEZAVO ALI NATISNI PLAKAT"}
        </Link>
      </div>

      <div style={section}>
        <h2 style={sectionTitle}>{en ? "Listing" : "Seznam"}</h2>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "monospace", fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" role="switch" checked={listed ?? false} disabled={listed === null || listBusy} onChange={toggleListed} style={{ width: 20, height: 20, accentColor: ACCENT }} />
          {en ? "Show my field on the Join page" : "Prikaži moj poligon na strani za vstop"}
        </label>
        <p style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.7, marginTop: 6, lineHeight: 1.5 }}>
          {en ? "Players can always join with your poster QR, whether or not you are listed." : "Igralci lahko vedno vstopijo s QR kodo na plakatu, ne glede na to, ali si na seznamu."}
        </p>
      </div>

      <button type="button" onClick={() => supabase.auth.signOut()} style={{ ...btnStyle, background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}88`, marginTop: 28 }}>
        {en ? "Log out" : "Odjava"}
      </button>
    </div>
  );
}

const MUTED_C = "rgba(180,190,205,0.75)";

/** Read-only "Your plan" panel. Own plan row is readable under RLS by the signed-in owner. */
function YourPlanCard({ user, en, business }: { user: User; en: boolean; business: string | null }) {
  const lang = en ? "en" : "sl";
  const [state, setState] = useState<{ row: PlanRow; showcase: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: row }, { data: acct }] = await Promise.all([
        db.from("spartanops_field_plans").select("plan, plan_until").eq("account_id", user.id).maybeSingle(),
        db.from("spartanops_accounts").select("is_platform_showcase").eq("id", user.id).maybeSingle(),
      ]);
      if (!cancelled) setState({ row: (row as PlanRow) ?? null, showcase: !!acct?.is_platform_showcase });
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  if (!state) return null;
  const plan: PlanId = state.showcase ? "pro" : resolveEffectivePlan(state.row);
  const limits = limitsFor(plan);
  const ownUntil = state.row?.plan === "founding" ? (state.row.plan_until ?? FOUNDING_OFFER.until) : null;
  const expired = !state.showcase && ownUntil !== null && ownUntil < todayLjubljana();
  const endingSoon = plan === "founding" && ownUntil !== null && !expired && daysUntil(ownUntil) <= 30;
  const ownDate = ownUntil ? formatFoundingDate(lang, ownUntil) : "";
  const offerDate = formatFoundingDate(lang);
  const fieldName = business || undefined;

  const badge = plan === "pro" ? "PRO" : plan === "founding" ? (en ? "FOUNDING FIELD" : "USTANOVITVENI POLIGON") : (en ? "FREE" : "BREZPLAČNO");
  const amber = plan !== "free";

  let line: string;
  let action: { href: string; label: string } | null = null;
  if (expired) {
    line = en ? `Your founding period ended on ${ownDate}. You are on the Free plan.` : `Ustanovitveno obdobje se je končalo ${ownDate}. Uporabljaš brezplačni paket.`;
  } else if (plan === "founding" && endingSoon) {
    line = en ? `Your free Pro period ends on ${ownDate}. Write to us before then to keep Pro.` : `Brezplačno obdobje Pro se konča ${ownDate}. Piši nam pred tem, da obdržiš Pro.`;
    action = { href: foundingContinueMailto(lang, { fieldName, accountId: user.id, until: ownUntil! }), label: en ? "WRITE TO US" : "PIŠI NAM" };
  } else if (plan === "founding") {
    line = en ? `All Pro features are free until ${ownDate}.` : `Vse funkcije Pro so brezplačne do ${ownDate}.`;
  } else if (plan === "pro") {
    line = en ? "Questions about your plan? Write to us." : "Vprašanja o paketu? Piši nam.";
  } else {
    line = en ? `Need more? Founding fields get every Pro feature free until ${offerDate}.` : `Potrebuješ več? Ustanovitveni poligoni dobijo vse funkcije Pro brezplačno do ${offerDate}.`;
  }
  if (plan === "free") {
    action = { href: foundingApplicationMailto(lang, { fieldName, accountId: user.id }), label: en ? "APPLY AS A FOUNDING FIELD" : "PRIJAVI SE KOT USTANOVITVENI POLIGON" };
  }

  return (
    <div style={{ border: `1px solid ${ACCENT}44`, background: "rgba(0,0,0,0.25)", padding: "12px 14px", marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <span style={{ ...labelStyle, marginBottom: 0 }}>{en ? "Your plan" : "Tvoj paket"}</span>
        <span style={{
          fontFamily: "'Michroma', monospace", fontSize: 9.5, letterSpacing: "0.14em",
          color: amber ? ACCENT : MUTED_C, border: `1px solid ${amber ? ACCENT + "88" : "rgba(180,190,205,0.3)"}`,
          padding: "3px 7px", textAlign: "right",
        }}>{badge}</span>
      </div>
      <p style={{ fontFamily: "monospace", fontSize: 12.5, margin: 0, lineHeight: 1.6 }}>
        {en ? "Players per game" : "Igralcev na igro"}: <strong>{limits.maxPlayers}</strong> · {en ? "Teams" : "Ekip"}: <strong>{limits.maxTeams}</strong>
      </p>
      <p style={{ fontFamily: "monospace", fontSize: 11.5, opacity: 0.8, lineHeight: 1.5, margin: "6px 0 0" }}>
        {line}
        {plan === "pro" && <> <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: ACCENT }}>{CONTACT_EMAIL}</a></>}
      </p>
      {action && (
        <a href={action.href} style={{ ...btnStyle, display: "block", textAlign: "center", textDecoration: "none", marginTop: 10, padding: 10, fontSize: 10, textWrap: "balance" as any }}>
          {action.label}
        </a>
      )}
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

/** A login with no field row (e.g. a player account): offer to create a field, never show empty settings. */
function NoFieldCard({ user, en, onCreated }: { user: User; en: boolean; onCreated: (name: string) => void }) {
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
    if (error) setErr(error.message); else onCreated(n);
  };
  return (
    <form onSubmit={create}>
      <p style={{ fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 10 }}>
        {en ? "This login has no field yet" : "Ta prijava še nima poligona"}
      </p>
      <p style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.8, lineHeight: 1.6, marginBottom: 14 }}>{user.email}</p>
      <label style={labelStyle}>{en ? "Business / field name" : "Ime podjetja / poligona"}</label>
      <input style={inputStyle} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      {err && <p style={{ color: ERR, fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</p>}
      <button type="submit" disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }}>{en ? "Create my field" : "Ustvari poligon"}</button>
      <Link to="/me" style={{ ...linkBtn, display: "block", textAlign: "center" }}>{en ? "I am a player →" : "Sem igralec →"}</Link>
    </form>
  );
}
