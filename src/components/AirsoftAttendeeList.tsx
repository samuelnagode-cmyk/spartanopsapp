import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AvatarIcon } from "./AirsoftRegistrationModal";
import { ExperienceBadge, type ExperienceLevel } from "./ExperienceBadge";
import { useLang } from "@/lib/i18n";

type Row = {
  id: string;
  event_id: string;
  callsign: string;
  gear_type: string;
  avatar: string;
  team_club: string | null;
  first_name: string | null;
  last_initial: string | null;
  experience_level: ExperienceLevel | null;
};

const ACCENT = "#a8954f";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";

export default function AirsoftAttendeeList({
  eventId,
  refreshToken,
}: {
  eventId: string;
  refreshToken: number;
}) {
  const { lang } = useLang();
  const en = lang === "en";
  const t = (sl: string, en2: string) => (en ? en2 : sl);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from("registrations_public")
      .select("id, event_id, callsign, gear_type, avatar, team_club, first_name, last_initial, experience_level")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error("[attendees] fetch error", error);
        setRows((data as Row[]) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventId, refreshToken]);

  const total = rows.length;

  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${ACCENT}30` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: INK, fontWeight: 600 }}>
          {t("Kdo vse pride?", "Who's coming?")}
        </h4>
        <p style={{ fontSize: 11, color: MUTED, letterSpacing: "0.06em" }}>
          {t("Skupaj", "Total")}: <span style={{ color: ACCENT, fontWeight: 600 }}>{total}</span>
        </p>
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: MUTED, fontStyle: "italic" }}>{t("Nalagam...", "Loading...")}</p>
      ) : total === 0 ? (
        <p style={{ fontSize: 12, color: MUTED, fontStyle: "italic" }}>
          {t("Še ni prijavljenih. Bodi prvi!", "No registrations yet. Be the first!")}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((r) => {
            const displayName = r.first_name
              ? `${r.first_name}${r.last_initial ? ` ${r.last_initial}.` : ""}`
              : null;
            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto minmax(0,1fr) auto",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  background: "rgba(10,10,10,0.72)",
                  border: `1px solid ${ACCENT}33`,
                  borderRadius: 4,
                }}
              >
                {/* LEFT: avatar + experience */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: `${ACCENT}1a`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: ACCENT,
                      border: `1px solid ${ACCENT}55`,
                      flexShrink: 0,
                    }}
                  >
                    <AvatarIcon id={r.avatar} size={18} />
                  </div>
                  {r.experience_level && (
                    <span style={{ color: ACCENT, opacity: 0.9, display: "inline-flex" }}>
                      <ExperienceBadge level={r.experience_level} size={11} color={ACCENT} />
                    </span>
                  )}
                </div>

                {/* CENTER: callsign + real name */}
                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                  <span
                    style={{
                      fontSize: 13,
                      color: "#f4ecd0",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.callsign}
                  </span>
                  {displayName && (
                    <span
                      style={{
                        fontSize: 10.5,
                        color: "rgba(236,227,196,0.45)",
                        fontStyle: "italic",
                        letterSpacing: "0.02em",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {displayName}
                    </span>
                  )}
                </div>

                {/* RIGHT: gear + team */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    lineHeight: 1.2,
                    flexShrink: 0,
                    maxWidth: "45%",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Michroma', monospace",
                      fontSize: 9.5,
                      color: ACCENT,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
                  >
                    {r.gear_type}
                  </span>
                  {r.team_club && (
                    <span
                      style={{
                        fontSize: 10,
                        color: MUTED,
                        letterSpacing: "0.04em",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 140,
                      }}
                    >
                      {r.team_club}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
