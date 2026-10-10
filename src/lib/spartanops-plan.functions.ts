import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";
import { FOUNDING_OFFER, resolveEffectivePlan, todayLjubljana, type PlanId, type PlanRow } from "./plans";

/** Master-admin only. Same constant-time master-password check as the other admin functions. */
function checkMaster(pw: unknown): boolean {
  const master = process.env.SPARTANOPS_MASTER_PASSWORD;
  if (!master) return false;
  if (typeof pw !== "string" || pw.length === 0 || pw.length > 200) return false;
  const a = createHash("sha256").update(pw, "utf8").digest();
  const b = createHash("sha256").update(master, "utf8").digest();
  return timingSafeEqual(a, b);
}

export type AdminFieldRow = {
  id: string;
  business_name: string;
  country: string | null;
  city: string | null;
  created_at: string;
  plan: PlanId | null;
  plan_until: string | null;
  effective_plan: PlanId;
  note: string | null;
  games_30d: number;
  active: boolean;
  peak_players_30d: number | null;
  cap_hits_30d: number;
  last_activity: string | null;
};

export type AdminFieldTotals = {
  fields: number; new7d: number; new30d: number; active: number; capHit30d: number;
  foundingUsed: number; foundingSpots: number;
};

const DAY = 86400000;
const maxIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

export const spartanopsAdminListFields = createServerFn({ method: "POST" })
  .inputValidator((d: { masterPassword: string }) => ({ masterPassword: String(d?.masterPassword ?? "") }))
  .handler(async ({ data }) => {
    if (!checkMaster(data.masterPassword)) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = Date.now();
    const since30 = new Date(now - 30 * DAY).toISOString();
    const since7 = new Date(now - 7 * DAY).toISOString();

    const [{ data: accts }, { data: plans }, { data: lobbies }, { data: events }] = await Promise.all([
      supabaseAdmin.from("spartanops_accounts").select("id, business_name, country, city, created_at"),
      supabaseAdmin.from("spartanops_field_plans").select("account_id, plan, plan_until, note"),
      supabaseAdmin.from("spartanops_lobbies").select("id, account_id, started_at"),
      supabaseAdmin.from("spartanops_plan_events").select("account_id, lobby_id, kind, detail, created_at"),
    ]);
    const lobbyIds = (lobbies ?? []).map((l) => l.id);
    // Only field_id + created_at: no names, phones or callsigns.
    const { data: checkins } = lobbyIds.length
      ? await supabaseAdmin.from("spartanops_checkins").select("field_id, created_at").in("field_id", lobbyIds)
      : { data: [] as { field_id: string; created_at: string }[] };

    const checkinCount = new Map<string, number>();
    const checkinLast = new Map<string, string>();
    for (const c of checkins ?? []) {
      checkinCount.set(c.field_id, (checkinCount.get(c.field_id) ?? 0) + 1);
      checkinLast.set(c.field_id, maxIso(checkinLast.get(c.field_id) ?? null, c.created_at)!);
    }
    const planBy = new Map((plans ?? []).map((p) => [p.account_id, p]));
    const today = todayLjubljana();

    const rows: AdminFieldRow[] = (accts ?? []).map((a) => {
      const p = planBy.get(a.id);
      const myLobbies = (lobbies ?? []).filter((l) => l.account_id === a.id);
      const myEvents = (events ?? []).filter((e) => e.account_id === a.id);
      const recentGames = myLobbies.filter((l) => l.started_at && l.started_at >= since30);
      let peak: number | null = null;
      for (const l of recentGames) {
        const ev = myEvents.filter((e) => e.kind === "game_started" && e.lobby_id === l.id && e.created_at >= since30);
        let n: number | null = null;
        for (const e of ev) {
          const v = Number((e.detail as any)?.players);
          if (Number.isFinite(v)) n = Math.max(n ?? 0, v);
        }
        if (n === null && checkinCount.has(l.id)) n = checkinCount.get(l.id)!;
        if (n !== null) peak = Math.max(peak ?? 0, n);
      }
      let last: string | null = null;
      for (const l of myLobbies) { last = maxIso(last, l.started_at); last = maxIso(last, checkinLast.get(l.id) ?? null); }
      for (const e of myEvents) last = maxIso(last, e.created_at);
      const row: PlanRow = p ? { plan: p.plan as PlanId, plan_until: p.plan_until } : null;
      return {
        id: a.id, business_name: a.business_name, country: a.country, city: a.city, created_at: a.created_at,
        plan: (p?.plan as PlanId) ?? null, plan_until: p?.plan_until ?? null,
        effective_plan: resolveEffectivePlan(row), note: p?.note ?? null,
        games_30d: recentGames.length, active: recentGames.length >= 3,
        peak_players_30d: peak,
        cap_hits_30d: myEvents.filter((e) => e.kind === "cap_hit" && e.created_at >= since30).length,
        last_activity: last,
      };
    });

    const totals: AdminFieldTotals = {
      fields: rows.length,
      new7d: rows.filter((r) => r.created_at >= since7).length,
      new30d: rows.filter((r) => r.created_at >= since30).length,
      active: rows.filter((r) => r.active).length,
      capHit30d: rows.filter((r) => r.cap_hits_30d > 0).length,
      foundingUsed: rows.filter((r) =>
        r.plan === "founding" && (r.plan_until ?? FOUNDING_OFFER.until) >= today && r.note !== "beta tester").length,
      foundingSpots: FOUNDING_OFFER.spots,
    };
    rows.sort((x, y) => (y.last_activity ?? y.created_at).localeCompare(x.last_activity ?? x.created_at));
    return { rows, totals };
  });

export function validatePlanInput(d: { plan?: unknown; planUntil?: unknown; note?: unknown }) {
  const plan = d?.plan;
  if (plan !== "free" && plan !== "founding" && plan !== "pro") throw new Error("Invalid plan");
  let planUntil: string | null = null;
  if (d?.planUntil !== null && d?.planUntil !== undefined && d.planUntil !== "") {
    const s = String(d.planUntil);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Invalid date");
    const t = new Date(`${s}T00:00:00Z`);
    if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== s) throw new Error("Invalid date");
    planUntil = s;
  }
  const noteRaw = d?.note === null || d?.note === undefined ? "" : String(d.note);
  if (noteRaw.length > 200) throw new Error("Note too long");
  if (plan === "founding" && !planUntil) planUntil = FOUNDING_OFFER.until;
  return { plan: plan as PlanId, planUntil, note: noteRaw.trim() || null };
}

export const spartanopsAdminSetFieldPlan = createServerFn({ method: "POST" })
  .inputValidator((d: { masterPassword: string; accountId: string; plan: string; planUntil: string | null; note: string | null }) => {
    const accountId = String(d?.accountId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(accountId)) throw new Error("Invalid account");
    return { masterPassword: String(d?.masterPassword ?? ""), accountId, ...validatePlanInput(d) };
  })
  .handler(async ({ data }) => {
    if (!checkMaster(data.masterPassword)) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("spartanops_field_plans")
      .upsert({ account_id: data.accountId, plan: data.plan, plan_until: data.planUntil, note: data.note, updated_at: new Date().toISOString() }, { onConflict: "account_id" })
      .select("account_id, plan, plan_until, note")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
