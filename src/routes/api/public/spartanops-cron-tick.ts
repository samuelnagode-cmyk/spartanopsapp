// spartanops-cron-tick
// External-scheduler entrypoint: advances scoring for every active SpartanOps match.
// Server-to-server only. Requires the x-cron-secret header matching the CRON_SECRET secret.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/spartanops-cron-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => handleTick(request),
      GET: async ({ request }) => handleTick(request),
    },
  },
});

async function handleTick(request: Request): Promise<Response> {
  // 1) Auth check — before any DB work.
  const cronSecret = process.env["CRON_SECRET"] ?? "";
  const provided = request.headers.get("x-cron-secret") ?? "";
  if (!cronSecret || !provided || provided !== cronSecret) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 2) Service-role client — required because spartanops_tick_scores has EXECUTE
  // revoked from anon/authenticated; only service-role can invoke it.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 3) Fetch all active matches.
  const { data: activeRows, error: queryError } = await supabaseAdmin
    .from("spartanops_game_state")
    .select("field_id")
    .eq("status", "active");

  if (queryError) {
    return Response.json({ ok: false, error: queryError.message }, { status: 500 });
  }

  // 4) Tick each active field; one failure must not stop the others.
  const results: Array<Record<string, unknown>> = [];
  for (const row of activeRows ?? []) {
    try {
      const { data, error } = await supabaseAdmin.rpc("spartanops_tick_scores", {
        p_field_id: row.field_id,
      });
      if (error) {
        results.push({ field_id: row.field_id, ok: false, error: error.message });
      } else {
        const d = data as Record<string, unknown> | null;
        results.push({
          field_id: row.field_id,
          ok: d?.ok ?? true,
          ticks: d?.ticks ?? 0,
          ended: d?.ended ?? false,
        });
      }
    } catch (err) {
      results.push({
        field_id: row.field_id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return Response.json(
    { ok: true, checked: (activeRows ?? []).length, results },
    { status: 200 },
  );
}
