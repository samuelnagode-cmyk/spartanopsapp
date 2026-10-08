/*
Reserved: the printed King of the Hill "SECRET" QR points here. Do not rename or remove.
Planned behaviour (NOT implemented yet):
- An attacker who scans it "finds a secret entrance into the castle" (success screen for the scanner).
- The defenders' next respawn screen then shows: "Someone found a secret passage into your
  fortress to sabotage you. Your respawn timer is X."
Open design questions: which respawns are affected (next one only, next N, or a time window),
a cooldown so it cannot be spammed, once per player per round, defenders scanning their own
secret should get a neutral message with no effect, and whether X is added to or replaces
the normal respawn time.
*/
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { spartanopsResolveSessionField } from "@/lib/spartanops-checkin.functions";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/s")({
  head: () => ({
    meta: [
      { title: "SpartanOps · Secret" },
      { name: "description", content: "SpartanOps King of the Hill secret." },
      { property: "og:title", content: "SpartanOps · Secret" },
      { property: "og:description", content: "SpartanOps King of the Hill secret." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: KothSecretPage,
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

function KothSecretPage() {
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
            {field ? t("koth.secretUnavailable") : t("koth.joinFirst")}
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
