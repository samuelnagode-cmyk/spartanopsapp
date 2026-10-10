import { limitsFor, resolveEffectivePlan, type PlanId, type PlanRow } from "./plans";

/** Server-only plan helpers. Import dynamically from server function handlers. */

export type AccountLimits = { plan: PlanId; maxPlayers: number; maxTeams: number };

export async function getAccountLimits(accountId: string): Promise<AccountLimits> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: acct }, { data: row }] = await Promise.all([
    supabaseAdmin.from("spartanops_accounts").select("is_platform_showcase").eq("id", accountId).maybeSingle(),
    supabaseAdmin.from("spartanops_field_plans").select("plan, plan_until").eq("account_id", accountId).maybeSingle(),
  ]);
  const plan: PlanId = acct?.is_platform_showcase ? "pro" : resolveEffectivePlan((row as PlanRow) ?? null);
  const l = limitsFor(plan);
  return { plan, maxPlayers: l.maxPlayers, maxTeams: l.maxTeams };
}

/** Owning account of a mission, or null for legacy fixed fields (no limits). */
export async function lobbyAccountId(lobbyId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(lobbyId)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("spartanops_lobbies").select("account_id").eq("id", lobbyId).maybeSingle();
  return (data?.account_id as string | undefined) ?? null;
}

export async function countCheckins(lobbyId: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("spartanops_checkins").select("id", { count: "exact", head: true }).eq("field_id", lobbyId);
  return count ?? 0;
}

/** Throws player_cap_reached:<n> when a new check-in would exceed the plan. */
export async function enforcePlayerCap(lobbyId: string): Promise<void> {
  const accountId = await lobbyAccountId(lobbyId);
  if (!accountId) return;
  const limits = await getAccountLimits(accountId);
  const count = await countCheckins(lobbyId);
  if (count < limits.maxPlayers) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recent } = await supabaseAdmin
    .from("spartanops_plan_events").select("id", { count: "exact", head: true })
    .eq("lobby_id", lobbyId).eq("kind", "cap_hit").gte("created_at", since);
  if (!recent) {
    await supabaseAdmin.from("spartanops_plan_events").insert({
      account_id: accountId, lobby_id: lobbyId, kind: "cap_hit",
      detail: { plan: limits.plan, limit: limits.maxPlayers, count },
    });
  }
  throw new Error("player_cap_reached:" + limits.maxPlayers);
}

/** Throws team_limit when the requested team count exceeds the account's plan. */
export async function enforceTeamLimit(accountId: string, requested: unknown, stored?: unknown): Promise<void> {
  if (requested === undefined || requested === null) return;
  const n = Number(requested);
  if (!Number.isFinite(n)) return;
  if (stored !== undefined && Number(stored ?? 2) === n) return;
  const limits = await getAccountLimits(accountId);
  if (n > limits.maxTeams) throw new Error("team_limit");
}

/** Records one game_started event per fresh start (deduped within 2 minutes). Never throws. */
export async function recordGameStarted(lobbyId: string): Promise<void> {
  try {
    const accountId = await lobbyAccountId(lobbyId);
    if (!accountId) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { count: recent } = await supabaseAdmin
      .from("spartanops_plan_events").select("id", { count: "exact", head: true })
      .eq("lobby_id", lobbyId).eq("kind", "game_started").gte("created_at", since);
    if (recent) return;
    const [limits, players] = await Promise.all([getAccountLimits(accountId), countCheckins(lobbyId)]);
    await supabaseAdmin.from("spartanops_plan_events").insert({
      account_id: accountId, lobby_id: lobbyId, kind: "game_started", detail: { plan: limits.plan, players },
    });
  } catch {
    /* recording must never block a match start */
  }
}
