// Reserved: printed King of the Hill board QR points here. Do not rename or remove. Behaviour will be added when the game mode ships.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { spartanopsResolveSessionField } from "@/lib/spartanops-checkin.functions";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/k")({
  head: () => ({
    meta: [
      { title: "SpartanOps · King of the Hill" },
      { name: "description", content: "SpartanOps King of the Hill board." },
      { property: "og:title", content: "SpartanOps · King of the Hill" },
      { property: "og:description", content: "SpartanOps King of the Hill board." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: KingOfTheHillPage,
});

const BG = "#0b0d09";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";
const ACCENT = "#E0B04E";

function activeLobbyId(): string {
  try {
    const raw = window.localStorage.getItem("spartanops.active_session");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { lobbyId?: unknown; authenticated?: unknown };
    return parsed?.authenticated && typeof parsed.lobbyId === "string" ? parsed.lobbyId.trim() : "";
  } catch {
    return "";
  }
}

function KingOfTheHillPage() {
  const t = useT();
  const resolveSessionField = useServerFn(spartanopsResolveSessionField);
  const [field, setField] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      let f = activeLobbyId();
      if (!f) {
        try {
          const sid = window.localStorage.getItem("spartanops:session_id");
          if (sid) {
            const r = await resolveSessionField({ data: { sessionId: sid } });
            if (typeof r?.fieldId === "string") f = r.fieldId;
          }
        } catch { /* fall through to state 2 */ }
      }
      if (alive) setField(f || null);
    })();
    return () => { alive = false; };
  }, [resolveSessionField]);

  const btn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    minHeight: 48, padding: "0 28px", background: ACCENT, color: BG,
    fontFamily: "Michroma, sans-serif", fontSize: 13, letterSpacing: "0.12em",
    textTransform: "uppercase", textDecoration: "none",
  };

  return (
    <main style={{ minHeight: "100dvh", background: BG, color: INK }} className="flex items-center justify-center px-6 text-center">
      {field === undefined ? null : (
        <div className="max-w-md">
          <h1 style={{ fontFamily: "Michroma, sans-serif", fontSize: 20, lineHeight: 1.4, letterSpacing: "0.04em" }}>
            {field ? t("koth.unavailable") : t("koth.joinFirst")}
          </h1>
          {!field && <p className="mt-3" style={{ color: MUTED, fontSize: 14 }}>{t("koth.joinHint")}</p>}
          <div className="mt-8">
            {field ? (
              <Link to="/misija" search={{ field } as any} style={btn}>{t("koth.backToGame")}</Link>
            ) : (
              <Link to="/field" style={btn}>{t("koth.joinGame")}</Link>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
