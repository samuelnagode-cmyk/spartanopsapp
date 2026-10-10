import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { queryPublicEvents } from "@/lib/events.functions";

const BASE_URL = "https://spartanopsapp.com";

const paths = [
  { path: "/", priority: "1.0", changefreq: "weekly" as const },
  { path: "/spartanops", priority: "1.0", changefreq: "weekly" as const },
  { path: "/intel", priority: "0.8", changefreq: "monthly" as const },
  { path: "/join", priority: "0.9", changefreq: "weekly" as const },
  { path: "/events", priority: "0.9", changefreq: "daily" as const },
  { path: "/updates", priority: "0.6", changefreq: "weekly" as const },
  { path: "/archive", priority: "0.5", changefreq: "monthly" as const },
  { path: "/print", priority: "0.6", changefreq: "monthly" as const },
  { path: "/privacy", priority: "0.3", changefreq: "yearly" as const },
  { path: "/terms", priority: "0.3", changefreq: "yearly" as const },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const staticUrls = paths.map(
          (e) =>
            `  <url>\n    <loc>${BASE_URL}${e.path}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
        );
        let eventUrls: string[] = [];
        try {
          const events = await queryPublicEvents({ limit: 500 });
          eventUrls = events
            .filter((e) => e.status === "published")
            .slice(0, 500)
            .map((e) => `  <url>\n    <loc>${BASE_URL}/events/${e.id}</loc>\n    <lastmod>${new Date(e.updated_at).toISOString()}</lastmod>\n  </url>`);
        } catch { /* static part still renders */ }
        const urls = [...staticUrls, ...eventUrls].join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
