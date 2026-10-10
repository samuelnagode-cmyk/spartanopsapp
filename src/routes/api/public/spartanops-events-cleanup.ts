// spartanops-events-cleanup
// Daily hygiene: clears phone sharing and ride details on RSVPs of events that ended
// more than 3 days ago. The read-time rule in events-visibility.ts is the real guarantee.
// Server-to-server only. Requires the x-cron-secret header matching the CRON_SECRET secret.
import { createFileRoute } from "@tanstack/react-router";
import { CONTACT_DAYS_AFTER, eventEndMs } from "@/lib/events-visibility";

export const Route = createFileRoute("/api/public/spartanops-events-cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request): Promise<Response> {
  const cronSecret = process.env["CRON_SECRET"] ?? "";
  const provided = request.headers.get("x-cron-secret") ?? "";
  if (!cronSecret || !provided || provided !== cronSecret) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = Date.now() - CONTACT_DAYS_AFTER * 86400_000;
  // Candidates: started before the cutoff (an event cannot end before it starts).
  const { data: evs, error } = await supabaseAdmin.from("spartanops_events")
    .select("id, starts_at, ends_at").lt("starts_at", new Date(cutoff).toISOString()).limit(5000);
  if (error) return Response.json({ ok: false, error: "query_failed" }, { status: 500 });
  const ids = (evs ?? []).filter((e) => eventEndMs(e) < cutoff).map((e) => e.id);
  let changed = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error: upErr } = await supabaseAdmin.from("spartanops_event_rsvps")
      .update({ phone_share: "none", ride_role: "none", ride_from: null, ride_seats: null, ride_note: null })
      .in("event_id", ids.slice(i, i + 200))
      .or("phone_share.neq.none,ride_role.neq.none,ride_note.not.is.null")
      .select("event_id");
    if (upErr) return Response.json({ ok: false, error: "update_failed", changed }, { status: 500 });
    changed += data?.length ?? 0;
  }
  return Response.json({ ok: true, changed }, { status: 200 });
}
