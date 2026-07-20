import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://spartanopsapp.com";

const paths = [
  { path: "/", priority: "1.0", changefreq: "weekly" as const },
  { path: "/spartanops", priority: "1.0", changefreq: "weekly" as const },
  { path: "/intel", priority: "0.8", changefreq: "monthly" as const },
  { path: "/join", priority: "0.9", changefreq: "weekly" as const },
  { path: "/updates", priority: "0.6", changefreq: "weekly" as const },
  { path: "/archive", priority: "0.5", changefreq: "monthly" as const },
  { path: "/print", priority: "0.4", changefreq: "monthly" as const },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const urls = paths
          .map(
            (e) =>
              `  <url>\n    <loc>${BASE_URL}${e.path}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
          )
          .join("\n");
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
