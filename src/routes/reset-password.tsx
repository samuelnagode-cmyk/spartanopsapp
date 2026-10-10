import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { playerGetMine } from "@/lib/player.functions";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — SpartanOps" },
      { name: "description", content: "Choose a new password for your SpartanOps login." },
      { property: "og:title", content: "Reset password — SpartanOps" },
      { property: "og:description", content: "Choose a new password for your SpartanOps login." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const ERR = "#d97a6c";
const label: CSSProperties = { display: "block", fontFamily: "'Michroma', monospace", fontSize: 9.5, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", marginBottom: 6 };
const input: CSSProperties = { width: "100%", background: "rgba(0,0,0,0.4)", color: INK, border: `1px solid ${ACCENT}55`, padding: "10px 12px", fontFamily: "monospace", fontSize: 16, marginBottom: 14, boxSizing: "border-box" };

function ResetPasswordPage() {
  const { lang } = useLang();
  const en = lang === "en";
  const navigate = useNavigate();
  const getMine = useServerFn(playerGetMine);
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) { setErr(en ? "Password must be at least 8 characters." : "Geslo mora imeti vsaj 8 znakov."); return; }
    if (pw !== pw2) { setErr(en ? "Passwords do not match." : "Gesli se ne ujemata."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { setBusy(false); setErr(error.message); return; }
    const { data } = await supabase.auth.getSession();
    let hasProfile = false;
    try { hasProfile = !!(await getMine({ data: { accessToken: data.session?.access_token ?? "" } })).profile; } catch { /* fall through */ }
    navigate({ to: hasProfile ? "/me" : "/marshal-account" });
  };

  return (
    <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "110px 16px 48px" }}>
      <div style={{ maxWidth: 420, margin: "0 auto", background: PANEL, border: `1px solid ${ACCENT}44`, padding: "28px 22px" }}>
        <h1 style={{ fontFamily: "'Michroma', monospace", fontSize: 15, letterSpacing: "0.18em", textAlign: "center", textTransform: "uppercase", marginBottom: 22 }}>
          {en ? "New password" : "Novo geslo"}
        </h1>
        {!ready ? (
          <p style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.75, textAlign: "center", lineHeight: 1.6 }}>
            {en ? "Open this page from the link in your email." : "To stran odpri s povezavo iz e-pošte."}
          </p>
        ) : (
          <form onSubmit={submit}>
            <label style={label}>{en ? "New password" : "Novo geslo"}</label>
            <input style={input} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
            <label style={label}>{en ? "Repeat password" : "Ponovi geslo"}</label>
            <input style={input} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
            {err && <p style={{ color: ERR, fontSize: 12, marginBottom: 10, textAlign: "center" }}>{err}</p>}
            <button type="submit" disabled={busy} style={{ width: "100%", padding: 12, background: ACCENT, color: BG, border: "none", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
              {en ? "Save password" : "Shrani geslo"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
