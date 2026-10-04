import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { saveActiveSession } from "@/lib/active-session";
import { spartanopsEnterField, spartanopsGetFieldPublicInfo, spartanopsResumeField } from "@/lib/spartanops-checkin.functions";

const RECENT_KEY = "spartanops:recent-fields";
function rememberField(accountId: string, name: string) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list: { accountId: string; name: string }[] = raw ? JSON.parse(raw) : [];
    const next = [{ accountId, name }, ...(Array.isArray(list) ? list : []).filter((f) => f && f.accountId !== accountId)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* storage unavailable */ }
}
function readEntryToken(accountId: string): string | null {
  try {
    const v = JSON.parse(localStorage.getItem("spartanops:field-entry") ?? "null");
    return v && v.accountId === accountId && typeof v.token === "string" ? v.token : null;
  } catch { return null; }
}

type FieldSearch = { code?: string; id?: string; notice?: string };

export const Route = createFileRoute("/field")({
  validateSearch: (s: Record<string, unknown>): FieldSearch => ({
    code: typeof s.code === "string" ? s.code : undefined,
    id: typeof s.id === "string" ? s.id : undefined,
    notice: typeof s.notice === "string" ? s.notice : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (!search.code && !search.id) throw redirect({ to: "/join", replace: true });
  },
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
  const { code, id, notice } = Route.useSearch();
  const getInfo = useServerFn(spartanopsGetFieldPublicInfo);
  const enter = useServerFn(spartanopsEnterField);
  const resume = useServerFn(spartanopsResumeField);

  const [info, setInfo] = useState<Info>({ status: "loading" });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);
  const enteredByTokenRef = useRef(false);

  const hasTarget = Boolean(code || id);
  useEffect(() => {
    if (!hasTarget) return;
    let cancelled = false;
    setInfo({ status: "loading" });
    getInfo({ data: { code, id } })
      .then((r) => {
        if (cancelled) return;
        if (!r.found) { setInfo({ status: "notfound" }); return; }
        const found = { status: "found" as const, accountId: r.accountId, name: r.name, hasPassword: r.hasPassword };
        const token = r.hasPassword ? readEntryToken(r.accountId) : null;
        if (!token) { setInfo(found); return; }
        setResuming(true);
        setInfo(found);
        resume({ data: { accountId: r.accountId, token } })
          .then((res) => {
            if (cancelled) return;
            if (!res.ok) { setResuming(false); return; }
            enteredByTokenRef.current = true;
            afterEntry(r.accountId, res.name || r.name, res.token, res.activeLobbyId);
          })
          .catch(() => { if (!cancelled) setResuming(false); });
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
      const p = enteredByTokenRef.current
        ? resume({ data: { accountId: waitingFor, token: readEntryToken(waitingFor) ?? "" } })
        : enter({ data: { accountId: waitingFor, password } });
      p.then((r) => {
          if (!r.ok) return;
          if (enteredByTokenRef.current && "token" in r && r.token) {
            try { localStorage.setItem("spartanops:field-entry", JSON.stringify({ accountId: waitingFor, token: r.token })); } catch { /* ignore */ }
          }
          if (r.activeLobbyId) go(r.activeLobbyId);
        })
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

  const afterEntry = (accountId: string, name: string, token: string, activeLobbyId: string | null) => {
    try {
      localStorage.setItem("spartanops:field-entry", JSON.stringify({ accountId, token }));
    } catch { /* storage unavailable */ }
    try {
      localStorage.setItem("spartanops:last-field", JSON.stringify({ accountId, code: code ?? null, name }));
    } catch { /* storage unavailable */ }
    rememberField(accountId, name);
    if (activeLobbyId) {
      saveActiveSession(activeLobbyId);
      window.location.assign(`/misija?field=${encodeURIComponent(activeLobbyId)}`);
    } else {
      setResuming(false);
      setWaitingFor(accountId);
    }
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (info.status !== "found") return;
    setErr(null);
    setBusy(true);
    try {
      const r = await enter({ data: { accountId: info.accountId, password } });
      if (!r.ok) {
        if ("throttled" in r && r.throttled) {
          setErr(en ? "Too many wrong attempts. Try again in a few minutes." : "Preveč napačnih poskusov. Poskusi znova čez nekaj minut.");
        } else {
          setErr(en ? "Wrong password" : "Napačno geslo");
        }
        return;
      }
      enteredByTokenRef.current = false;
      afterEntry(info.accountId, r.name || info.name, r.token, r.activeLobbyId);
    } catch {
      setErr(en ? "Connection error. Try again." : "Napaka povezave. Poskusi znova.");
    } finally {
      setBusy(false);
    }
  };

  let body: React.ReactNode;
  if (!hasTarget || info.status === "loading" || resuming) {
    body = <p style={{ ...msgStyle, opacity: 0.7 }}>…</p>;
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
        {notice === "entry" && (
          <p style={{ color: ACCENT, fontFamily: "monospace", fontSize: 12, textAlign: "center", marginBottom: 14 }}>
            {en ? "Enter the field password to join." : "Za vstop vnesi geslo poligona."}
          </p>
        )}
        <label style={labelStyle}>{en ? "Today's password — ask the marshal" : "Današnje geslo — vprašaj maršala"}</label>
        <input style={{ ...inputStyle, marginBottom: 6 }} type={showPassword ? "text" : "password"} required autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          aria-pressed={showPassword}
          style={{ background: "transparent", border: "none", color: ACCENT, cursor: "pointer", fontFamily: "monospace", fontSize: 12, textDecoration: "underline", padding: 0, marginBottom: 14 }}
        >
          {showPassword ? (en ? "Hide password" : "Skrij geslo") : (en ? "See password" : "Pokaži geslo")}
        </button>
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
