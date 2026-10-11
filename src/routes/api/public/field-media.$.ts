import { createFileRoute } from "@tanstack/react-router";
import { FIELD_MEDIA_BUCKET, MEDIA_PATH_RE } from "@/lib/field-media";

/**
 * Public read of field logos / outline images from the private bucket.
 * Only object names matching the strict path pattern are served; names change on every upload, so they cache forever.
 */
export const Route = createFileRoute("/api/public/field-media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!MEDIA_PATH_RE.test(path)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from(FIELD_MEDIA_BUCKET).download(path);
        if (error || !data) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
        const type = path.endsWith(".webp") ? "image/webp" : path.endsWith(".png") ? "image/png" : "image/jpeg";
        return new Response(data, {
          headers: {
            "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'",
          },
        });
      },
    },
  },
});
