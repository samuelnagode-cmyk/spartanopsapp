import { createServerFn } from "@tanstack/react-start";

/**
 * Self-service cancellation. Requires both the registrant's email AND the
 * per-registration `cancel_token` (UUID emailed at sign-up). The token is the
 * proof of ownership — an attacker who only knows a victim's email cannot
 * cancel their registration.
 *
 * Uses service-role on the server so no public DELETE policy is required.
 */
export const cancelRegistration = createServerFn({ method: "POST" })
  .inputValidator((data: { eventId: string; email: string; cancelToken: string }) => {
    if (
      typeof data?.eventId !== "string" ||
      typeof data?.email !== "string" ||
      typeof data?.cancelToken !== "string"
    ) {
      throw new Error("Invalid input");
    }
    const email = data.email.trim();
    const token = data.cancelToken.trim();
    if (!email || email.length > 200) throw new Error("Invalid email");
    if (data.eventId.length > 200) throw new Error("Invalid event");
    // UUID v4 shape, strict.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      throw new Error("Invalid cancellation token");
    }
    return { eventId: data.eventId, email, cancelToken: token };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error, count } = await supabaseAdmin
      .from("registrations")
      .delete({ count: "exact" })
      .eq("event_id", data.eventId)
      .eq("cancel_token", data.cancelToken)
      .ilike("email_phone", data.email);
    if (error) throw new Error(error.message);
    return { ok: true as const, count: count ?? 0 };
  });
