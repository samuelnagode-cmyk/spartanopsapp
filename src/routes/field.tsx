import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { saveActiveSession } from "@/lib/active-session";
import { spartanopsEnterField, spartanopsGetFieldPublicInfo } from "@/lib/spartanops-checkin.functions";

type FieldSearch = { code?: string; id?: string };

export const Route = createFileRoute("/field")({
  validateSearch: (s: Record<string, unknown>): FieldSearch => ({
    code: typeof s.code === "string" ? s.code : undefined,
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Join the Field — SpartanOps" },
      { name: "description", content: "Enter your field password to join the airsoft mission that is running now." },
      { property: "og:title", content: "Join the Field — SpartanOps" },
      { property: "og:description", content: "Enter your field password to join the airsoft mission that is running now." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FieldPage,
});

const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const ERR = "#d97a6c";

const labelStyle: CSSProperties = {
  display: "block", fontFamily: "'Michroma', monospace", fontSize: 9.5,
  letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", marginBottom: 6,
};
const inputStyle: CSSProperties = {
  width: "100%", background: "rgba(0,0,0,0.4)", color: INK,
  border: `1px solid ${ACCENT}55`, padding: "12px", fontFamily: "monospace",
  fontSize: 16, marginBottom: 14, boxSizing: "border-box",
};
const btnStyle: CSSProperties = {
  width: "100%", padding: "13px", background: ACCENT, color: BG, border: "none",
  fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.20em",
  textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
};
const msgStyle: CSSProperties = { fontFamily: "monospace", fontSize: 13, lineHeight: 1.6, textAlign: "center" };

type Info =
  | { status: "loading" }
  | { status: "notfound" }
  | { status: "found"; accountId: string; name: string; hasPassword: boolean };

function FieldPage() {
  const { lang } = useLang();
  const en = lang === "en";
  const { code, id } = Route.useSearch();
  const navigate = useNavigate();
  const getInfo = useServerFn(spartanopsGetFieldPublicInfo);
  const enter = useServerFn(spartanopsEnterField);

  const [codeInput, setCodeInput] = useState("");
  const [info, setInfo] = useState<Info>({ status: "loading" });
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);

  const hasTarget = Boolean(code || id);
  const [lastField, setLastField] = useState<{ accountId: string; code: string | null; name: string } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("spartanops:last-field");
      const v = raw ? JSON.parse(raw) : null;
      if (v && typeof v.accountId === "string") setLastField({ accountId: v.accountId, code: v.code ?? null, name: v.name ?? "" });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!hasTarget) return;
    let cancelled = false;
    setInfo({ status: "loading" });
    getInfo({ data: { code, id } })
      .then((r) => {
        if (cancelled) return;
        setInfo(r.found ? { status: "found", accountId: r.accountId, name: r.name, hasPassword: r.hasPassword } : { status: "notfound" });
      })
      .catch(() => { if (!cancelled) setInfo({ status: "notfound" }); });
    return () => { cancelled = true; };
  }, [code, id, hasTarget, getInfo]);

  // Waiting screen: follow the account's active-mission broadcast (fast path),
  // plus polling + visibility re-checks so a sleeping phone can't miss the start.
  useEffect(() => {
    if (!waitingFor) return;
    let stopped = false;
    const go = (next: string) => {
      if (stopped) return;
      stopped = true;
      saveActiveSession(next);
      window.location.assign(`/misija?field=${encodeURIComponent(next)}`);
    };
    const ch = supabase
      .channel(`field:${waitingFor}`)
      .on("broadcast", { event: "active_mission_changed" }, (msg: any) => {
        const next = msg?.payload?.active_lobby_id;
        if (typeof next === "string" && next) go(next);
      })
      .subscribe();
    const recheck = () => {
      if (stopped) return;
      enter({ data: { accountId: waitingFor, password } })
        .then((r) => { if (r.ok && r.activeLobbyId) go(r.activeLobbyId); })
        .catch(() => { /* retry on next tick */ });
    };
    recheck();
    const iv = window.setInterval(recheck, 10_000);
    const onVis = () => { if (document.visibilityState === "visible") recheck(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingFor]);

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    const c = codeInput.trim().toUpperCase();
    if (c.length !== 6) return;
    navigate({ to: "/field", search: { code: c } });
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (info.status !== "found") return;
    setErr(null);
    setBusy(true);
    try {
      const r = await enter({ data: { accountId: info.accountId, password } });
      if (!r.ok) { setErr(en ? "Wrong password" : "Napačno geslo"); return; }
      try {
        localStorage.setItem("spartanops:last-field", JSON.stringify({ accountId: info.accountId, code: code ?? null, name: r.name || info.name }));
      } catch { /* storage unavailable */ }
      if (r.activeLobbyId) {
        saveActiveSession(r.activeLobbyId);
        window.location.assign(`/misija?field=${encodeURIComponent(r.activeLobbyId)}`);
      } else {
        setWaitingFor(info.accountId);
      }
    } catch {
      setErr(en ? "Connection error. Try again." : "Napaka povezave. Poskusi znova.");
    } finally {
      setBusy(false);
    }
  };

  let body: React.ReactNode;
  if (!hasTarget) {
    body = (
      <form onSubmit={submitCode}>
        {lastField && (
          <button
            type="button"
            style={{ ...btnStyle, marginBottom: 22 }}
            onClick={() => navigate({ to: "/field", search: lastField.code ? { code: lastField.code } : { id: lastField.accountId } })}
          >
            {en ? `Continue to ${lastField.name || "your field"}` : `Nadaljuj na ${lastField.name || "svoj poligon"}`}
          </button>
        )}
        <label style={labelStyle}>{en ? "Enter your field code" : "Vnesi kodo poligona"}</label>
        <input
          style={{ ...inputStyle, textAlign: "center", letterSpacing: "0.4em", fontSize: 22, textTransform: "uppercase" }}
          value={codeInput}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
        />
        <button type="submit" style={{ ...btnStyle, opacity: codeInput.length === 6 ? 1 : 0.5 }} disabled={codeInput.length !== 6}>
          {en ? "Continue" : "Nadaljuj"}
        </button>
        <p style={{ fontSize: 11, opacity: 0.7, marginTop: 12, fontFamily: "monospace", textAlign: "center" }}>
          {en ? "Find the code on the poster at your field." : "Kodo najdeš na plakatu na poligonu."}
        </p>
      </form>
    );
  } else if (info.status === "loading") {
    body = <p style={{ ...msgStyle, opacity: 0.7 }}>…</p>;
  } else if (info.status === "notfound") {
    body = <p style={{ ...msgStyle, color: ERR }}>{en ? "Field not found. Check the code on your field's poster, or ask the marshal." : "Poligon ni najden. Preveri kodo na plakatu ali vprašaj maršala."}</p>;
  } else if (!info.hasPassword) {
    body = (
      <>
        <FieldName name={info.name} />
        <p style={msgStyle}>{en ? "This field isn't ready yet. Ask the marshal." : "Ta poligon še ni pripravljen. Vprašaj maršala."}</p>
      </>
    );
  } else if (waitingFor) {
    body = (
      <>
        <FieldName name={info.name} />
        <p style={msgStyle}>
          {en
            ? "No mission is running right now. Keep this page open — you'll be taken in automatically when the marshal starts one."
            : "Trenutno ni aktivne misije. Pusti to stran odprto — samodejno boš preusmerjen, ko maršal zažene misijo."}
        </p>
      </>
    );
  } else {
    body = (
      <form onSubmit={submitPassword}>
        <FieldName name={info.name} />
        <label style={labelStyle}>{en ? "Today's password — ask the marshal" : "Današnje geslo — vprašaj maršala"}</label>
        <input style={inputStyle} type="text" required autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
        <p style={{ fontSize: 11, opacity: 0.7, marginTop: -8, marginBottom: 14, fontFamily: "monospace", lineHeight: 1.5 }}>
          {en
            ? "This is not the field code. The marshal tells you the password at the briefing, or it is written on the poster."
            : "To ni koda poligona. Geslo ti pove maršal na uvodnem pogovoru ali je zapisano na plakatu."}
        </p>
        {err && <p style={{ color: ERR, fontSize: 13, marginBottom: 10, textAlign: "center" }}>{err}</p>}
        <button type="submit" style={btnStyle} disabled={busy}>
          {busy ? "…" : en ? "Enter field" : "Vstopi na poligon"}
        </button>
      </form>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "110px 16px 48px" }}>
      <div style={{ maxWidth: 420, margin: "0 auto", background: PANEL, border: `1px solid ${ACCENT}44`, padding: "28px 22px" }}>
        {body}
      </div>
    </main>
  );
}

function FieldName({ name }: { name: string }) {
  return (
    <h1 style={{ fontFamily: "'Michroma', monospace", fontSize: 22, letterSpacing: "0.12em", color: INK, textAlign: "center", textTransform: "uppercase", marginBottom: 22, lineHeight: 1.3 }}>
      {name}
    </h1>
  );
}
