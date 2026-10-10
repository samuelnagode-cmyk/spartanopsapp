import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { buildIcs } from "@/lib/events";
import { queryPublicEvents } from "@/lib/events.functions";

export const Route = createFileRoute("/events.ics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const country = (url.searchParams.get("country") ?? "").toUpperCase().slice(0, 2);
        const field = (url.searchParams.get("field") ?? "").slice(0, 40);
        let events: Awaited<ReturnType<typeof queryPublicEvents>> = [];
        try {
          events = await queryPublicEvents({ sinceMs: Date.now() - 30 * 86400000, limit: 500 });
        } catch { /* empty calendar on failure */ }
        const filtered = events
          .filter((e) => (!country || e.field.country === country) && (!field || e.field.id === field))
          .slice(0, 200);
        return new Response(buildIcs(filtered, { name: "SpartanOps — airsoft events" }), {
          headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=900" },
        });
      },
    },
  },
});
