import { useState, type CSSProperties } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FOUNDING_OFFER, todayLjubljana, type PlanId } from "@/lib/plans";
import {
  spartanopsAdminListFields, spartanopsAdminSetFieldPlan,
  type AdminFieldRow, type AdminFieldTotals,
} from "@/lib/spartanops-plan.functions";

const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";
const PANEL = "#13160f";
const ERR = "#d97a6c";

/** One calendar month after the given ISO date (or today if empty/past), clamped to month end. */
export function addOneMonth(iso: string, now = new Date()): string {
  const today = todayLjubljana(now);
  const base = /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso >= today ? iso : today;
  const [y, m, d] = base.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

type Filter = "all" | "active" | "cap" | "founding";
const mono: CSSProperties = { fontFamily: "monospace", fontSize: 12 };
const inp: CSSProperties = { background: "rgba(0,0,0,0.4)", color: INK, border: `1px solid ${ACCENT}55`, padding: "8px 10px", fontFamily: "monospace", fontSize: 12, minHeight: 36, boxSizing: "border-box" };
const btn: CSSProperties = { background: ACCENT, color: "#0b0d09", border: "none", padding: "8px 12px", fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.14em", fontWeight: 700, cursor: "pointer", minHeight: 36 };

export function AdminFieldsPlans({ masterPassword }: { masterPassword: string }) {
  const list = useServerFn(spartanopsAdminListFields);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ rows: AdminFieldRow[]; totals: AdminFieldTotals } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = async () => {
    setErr(null);
    try { setData(await list({ data: { masterPassword } })); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  };

  const toggle = () => { const n = !open; setOpen(n); if (n) void load(); };

  const rows = (data?.rows ?? []).filter((r) =>
    filter === "all" ? true : filter === "active" ? r.active : filter === "cap" ? r.cap_hits_30d > 0 : r.effective_plan === "founding");
  const t = data?.totals;

  return (
    <section style={{ marginTop: 40, border: `1px solid ${ACCENT}44`, background: PANEL }}>
      <button type="button" onClick={toggle} aria-expanded={open}
        style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", color: ACCENT, padding: "14px 16px", cursor: "pointer", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em" }}>
        {open ? "−" : "+"} FIELDS &amp; PLANS (ADMIN)
      </button>
      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          {err && <p style={{ ...mono, color: ERR }}>{err}</p>}
          {!data && !err && <p style={{ ...mono, color: MUTED }}>Loading…</p>}
          {t && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 14 }}>
              {([["Fields", t.fields], ["New 7d", t.new7d], ["New 30d", t.new30d], ["Active", t.active], ["Hit the cap", t.capHit30d], ["Founding spots", `${t.foundingUsed} / ${t.foundingSpots}`]] as const).map(([l, v]) => (
                <div key={l} style={{ border: `1px solid ${ACCENT}33`, padding: "10px 12px", background: "rgba(0,0,0,0.25)" }}>
                  <div style={{ fontFamily: "'Michroma', monospace", fontSize: 9, letterSpacing: "0.16em", color: MUTED, textTransform: "uppercase" }}>{l}</div>
                  <div style={{ fontFamily: "'Michroma', monospace", fontSize: 20, color: INK, marginTop: 4 }}>{v}</div>
                </div>
              ))}
            </div>
          )}
          {data && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {(["all", "active", "cap", "founding"] as Filter[]).map((f) => (
                  <button key={f} type="button" onClick={() => setFilter(f)}
                    style={{ ...btn, background: filter === f ? ACCENT : "transparent", color: filter === f ? "#0b0d09" : ACCENT, border: `1px solid ${ACCENT}88` }}>
                    {f === "all" ? "ALL" : f === "active" ? "ACTIVE" : f === "cap" ? "HIT THE CAP" : "FOUNDING"}
                  </button>
                ))}
              </div>
              {rows.length === 0 && <p style={{ ...mono, color: MUTED }}>No fields.</p>}
              <div style={{ display: "grid", gap: 10 }}>
                {rows.map((r) => (
                  <FieldCard key={r.id} row={r} masterPassword={masterPassword} onSaved={load} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function FieldCard({ row, masterPassword, onSaved }: { row: AdminFieldRow; masterPassword: string; onSaved: () => Promise<void> }) {
  const save = useServerFn(spartanopsAdminSetFieldPlan);
  const [plan, setPlan] = useState<PlanId>(row.plan ?? "free");
  const [until, setUntil] = useState(row.plan_until ?? (row.plan === "founding" ? FOUNDING_OFFER.until : ""));
  const [note, setNote] = useState(row.note ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const amber = row.effective_plan !== "free";
  const loc = [row.city, row.country].filter(Boolean).join(", ");
  const last = row.last_activity ? row.last_activity.slice(0, 10) : "—";

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      await save({ data: { masterPassword, accountId: row.id, plan, planUntil: until || null, note: note || null } });
      setMsg({ ok: true, text: "Saved." });
      await onSaved();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" });
    } finally { setBusy(false); }
  };

  return (
    <div style={{ border: `1px solid ${ACCENT}33`, background: "rgba(0,0,0,0.25)", padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: "'Michroma', monospace", fontSize: 12, color: INK, letterSpacing: "0.06em" }}>{row.business_name}</div>
          {loc && <div style={{ ...mono, color: MUTED, marginTop: 2 }}>{loc}</div>}
        </div>
        <span style={{ fontFamily: "'Michroma', monospace", fontSize: 9, letterSpacing: "0.14em", color: amber ? ACCENT : MUTED, border: `1px solid ${amber ? ACCENT + "88" : "rgba(180,190,205,0.3)"}`, padding: "3px 7px", whiteSpace: "nowrap" }}>
          {row.effective_plan.toUpperCase()}{row.plan_until && row.effective_plan !== "free" ? ` · ${row.plan_until}` : ""}
        </span>
      </div>
      <p style={{ ...mono, color: INK, margin: "8px 0 0" }}>
        Games 30d {row.games_30d} · Peak players {row.peak_players_30d ?? "—"} · Cap hits {row.cap_hits_30d} · Last activity {last}
      </p>
      {row.note && <p style={{ ...mono, color: MUTED, margin: "4px 0 0" }}>{row.note}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
        <select aria-label="Plan" value={plan} style={inp}
          onChange={(e) => { const p = e.target.value as PlanId; setPlan(p); if (p === "founding" && !until) setUntil(FOUNDING_OFFER.until); }}>
          <option value="free">Free</option>
          <option value="founding">Founding</option>
          <option value="pro">Pro</option>
        </select>
        <input aria-label="Until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} style={inp} />
        <button type="button" onClick={() => setUntil(addOneMonth(until))} style={{ ...btn, background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}88` }}>+1 month</button>
        <input aria-label="Note" placeholder="Note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} style={{ ...inp, flex: "1 1 160px" }} />
        <button type="button" onClick={submit} disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>{busy ? "…" : "SAVE"}</button>
      </div>
      {msg && <p style={{ ...mono, color: msg.ok ? ACCENT : ERR, margin: "6px 0 0" }}>{msg.text}</p>}
    </div>
  );
}
