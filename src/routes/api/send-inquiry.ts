import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { z } from "zod";
import { checkEmailRateLimit } from "@/lib/email-rate-limit";


const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "Zeleni raj <onboarding@resend.dev>";
const OWNER = "samuel.nagode@gmail.com";

const InquirySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  dates: z.string().trim().max(200).optional().default(""),
  message: z.string().trim().min(1).max(2000),
});

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const nl = (s: string) => esc(s).replace(/\n/g, "<br/>");

const wrap = (inner: string, footer: string) => `
<div style="background:#f3ede0;padding:24px;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px;background:#FAF6EC;border-radius:12px;color:#3A4A3D;font-size:15px;line-height:1.6;">
    ${inner}
    <div style="margin-top:24px;border-top:1px solid rgba(139,115,85,0.2);padding-top:16px;font-size:13px;color:#8B7355;font-style:italic;">${footer}</div>
  </div>
</div>`;

export const Route = createFileRoute("/api/send-inquiry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
          return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500 });
        }

        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
        }
        const parsed = InquirySchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten() }), { status: 400 });
        }
        const d = parsed.data;
        const datesDisplay = d.dates || "Ni podan";
        const firstName = d.name.split(/\s+/)[0] || "spoštovani";

        const ownerInner = `
          <h2 style="font-family:Georgia,'Times New Roman',serif;color:#3A4A3D;font-size:22px;margin:0 0 16px;">Novo povpraševanje za Glamping Zeleni raj</h2>
          <p style="margin:0 0 6px;"><span style="font-weight:600;">Ime:</span> ${esc(d.name)}</p>
          <p style="margin:0 0 6px;"><span style="font-weight:600;">E-pošta:</span> ${esc(d.email)}</p>
          <p style="margin:0 0 16px;"><span style="font-weight:600;">Predviden termin:</span> ${esc(datesDisplay)}</p>
          <p style="margin:0 0 6px;font-weight:600;">Sporočilo:</p>
          <p style="margin:0;">${nl(d.message)}</p>
        `;
        const ownerHtml = wrap(ownerInner, "Prejeto preko spletne strani glampingzeleniraj.si");

        const guestInner = `
          <h2 style="font-family:Georgia,'Times New Roman',serif;color:#3A4A3D;font-size:22px;margin:0 0 16px;">Spoštovani ${esc(firstName)},</h2>
          <p style="margin:0 0 14px;">Hvala vam za vaše povpraševanje! Prejeli smo ga in vam bomo odgovorili v najkrajšem možnem času, najpozneje v 24 urah.</p>
          <p style="margin:0 0 6px;font-weight:600;">Povzetek vašega sporočila:</p>
          <p style="margin:0 0 6px;"><span style="font-weight:600;">Predviden termin:</span> ${esc(datesDisplay)}</p>
          <p style="margin:0 0 6px;font-weight:600;">Vaše sporočilo:</p>
          <p style="margin:0 0 16px;">${nl(d.message)}</p>
          <p style="margin:0 0 14px;">Med tem si lahko ogledate naše enote in fotografije:<br/>
            <a href="https://glampingzeleniraj.si/glamping" style="color:#1E3F20;">glampingzeleniraj.si/glamping</a>
          </p>
          <p style="margin:0;">Lepo vas pozdravljam,<br/>Samuel<br/>Glamping Zeleni raj<br/>tel: 070 761 455<br/>Vače 49, 1252 Vače</p>
        `;
        const guestHtml = wrap(guestInner, "Glamping Zeleni raj — glampingzeleniraj.si");

        const send = (payload: Record<string, unknown>) =>
          fetch(`${GATEWAY_URL}/emails`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": RESEND_API_KEY,
            },
            body: JSON.stringify(payload),
          });

        const ownerRes = await send({
          from: FROM,
          to: [OWNER],
          reply_to: d.email,
          subject: "Novo povpraševanje — Glamping Zeleni raj",
          html: ownerHtml,
        });
        if (!ownerRes.ok) {
          const data = await ownerRes.json().catch(() => ({}));
          return new Response(JSON.stringify({ error: "Send failed", status: ownerRes.status, data }), { status: 502 });
        }

        // Best-effort confirmation to guest
        await send({
          from: FROM,
          to: [d.email],
          reply_to: OWNER,
          subject: "Hvala za vaše povpraševanje — Glamping Zeleni raj",
          html: guestHtml,
        }).catch(() => null);

        return Response.json({ success: true });
      },
    },
  },
});
