import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { z } from "zod";
import { checkEmailRateLimit } from "@/lib/email-rate-limit";


const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

const ReservationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(50).optional().default(""),
  arrival: z.string().trim().max(20).optional().default(""),
  departure: z.string().trim().max(20).optional().default(""),
  adults: z.string().trim().max(5).optional().default(""),
  children: z.string().trim().max(5).optional().default(""),
  unit: z.string().trim().max(100).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
});

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const Route = createFileRoute("/api/send-reservation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
          return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
        }

        const parsed = ReservationSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten() }), { status: 400 });
        }
        const d = parsed.data;

        const rl = checkEmailRateLimit(request, [d.email.toLowerCase()]);
        if (!rl.ok) {
          return new Response(JSON.stringify({ error: "Too many requests" }), {
            status: 429,
            headers: { "Retry-After": String(rl.retryAfter), "Content-Type": "application/json" },
          });
        }


        const html = `
          <h2>Nova rezervacija — Zeleni raj</h2>
          <table style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">
            <tr><td><b>Ime:</b></td><td>${escape(d.name)}</td></tr>
            <tr><td><b>Email:</b></td><td>${escape(d.email)}</td></tr>
            <tr><td><b>Telefon:</b></td><td>${escape(d.phone)}</td></tr>
            <tr><td><b>Prihod:</b></td><td>${escape(d.arrival)}</td></tr>
            <tr><td><b>Odhod:</b></td><td>${escape(d.departure)}</td></tr>
            <tr><td><b>Odrasli:</b></td><td>${escape(d.adults)}</td></tr>
            <tr><td><b>Otroci:</b></td><td>${escape(d.children)}</td></tr>
            <tr><td><b>Enota:</b></td><td>${escape(d.unit)}</td></tr>
          </table>
          <p style="font-family: Arial, sans-serif; font-size: 14px;"><b>Sporočilo:</b><br/>${escape(d.message).replace(/\n/g, "<br/>")}</p>
        `;

        const res = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: "Zeleni raj <onboarding@resend.dev>",
            to: ["samuel.nagode@gmail.com"],
            reply_to: d.email,
            subject: `Nova rezervacija: ${d.name}`,
            html,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return new Response(JSON.stringify({ error: "Send failed", status: res.status, data }), { status: 502 });
        }
        return Response.json({ success: true });
      },
    },
  },
});
