import { createServerFn } from "@tanstack/react-start";

async function verifyPrijavePassword(password: string): Promise<boolean> {
  if (typeof password !== "string" || password.length > 200) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("verify_field_password" as any, {
    p_field_id: "prijave",
    p_password: password,
  });
  if (error) return false;
  return data === true;
}

export const setEventCancellation = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; eventId: string; cancelled: boolean }) => {
    if (
      typeof data?.password !== "string" ||
      typeof data?.eventId !== "string" ||
      typeof data?.cancelled !== "boolean"
    )
      throw new Error("Invalid input");
    return { password: data.password, eventId: data.eventId, cancelled: data.cancelled };
  })
  .handler(async ({ data }) => {
    if (!(await verifyPrijavePassword(data.password))) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.cancelled) {
      const { error } = await supabaseAdmin
        .from("event_cancellations")
        .upsert({ event_id: data.eventId });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("event_cancellations")
        .delete()
        .eq("event_id", data.eventId);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });
