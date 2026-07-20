import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MapPin, Archive as ArchiveIcon } from "lucide-react";
import { listArchivedMissions, type SpartanOpsArchiveRow } from "@/lib/spartanops-archive.functions";

export const Route = createFileRoute("/archive")({
  head: () => ({
    meta: [
      { title: "Operation Archive — SpartanOps" },
      { name: "description", content: "Historical archive of decommissioned SpartanOps operations." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ArchivePage,
});

const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const MUTED = "rgba(236,227,196,0.55)";
const DECOMMISSIONED = "#c86a4a";
const HAIRLINE = "rgba(236,227,196,0.10)";

function ArchivePage() {
  const navigate = useNavigate();
  const getArchive = useServerFn(listArchivedMissions);
  const [rows, setRows] = useState<SpartanOpsArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      setLoading(true);
      try {
        const data = await getArchive();
        if (alive) setRows(data);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { alive = false; window.removeEventListener("focus", refresh); };
  }, [getArchive]);

  return (
    <div style={{ background: BG, color: INK, minHeight: "100vh", padding: "95px 16px 80px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <button
            onClick={() => navigate({ to: "/join" })}
            style={{ background: "transparent", border: "none", color: MUTED, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <ArrowLeft size={12} /> Back to Live Operations
          </button>
          <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.24em", color: ACCENT, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArchiveIcon size={11} /> ARCHIVE
          </span>
        </div>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.30em", color: ACCENT, marginBottom: 10, textTransform: "uppercase" }}>
            // HISTORICAL LOG
          </p>
          <h1 style={{ fontFamily: "'Michroma', monospace", fontSize: "clamp(20px, 4.4vw, 28px)", letterSpacing: "0.14em", color: INK, textTransform: "uppercase" }}>
            Operation Archive
          </h1>
          <p style={{ color: MUTED, fontSize: 13, marginTop: 10, lineHeight: 1.6 }}>
            Read-only log of concluded and decommissioned nodes.
          </p>
        </div>

        {loading ? (
          <div style={{ padding: "60px 24px", textAlign: "center", border: `1px dashed ${HAIRLINE}`, color: MUTED, fontFamily: "monospace", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            Loading archive snapshots…
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center", border: `1px dashed ${HAIRLINE}`, color: MUTED }}>
            <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.20em", color: ACCENT, marginBottom: 8, textTransform: "uppercase" }}>
              // ARCHIVE EMPTY
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>
              No operations have been decommissioned yet.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((r) => (
              <div
                key={r.id}
                style={{
                  background: PANEL,
                  border: `1px solid ${HAIRLINE}`,
                  padding: "16px 18px",
                  opacity: 0.85,
                  cursor: "default",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <MapPin size={16} color={ACCENT} strokeWidth={1.6} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: "'Michroma', monospace", fontSize: 13, letterSpacing: "0.10em", color: INK, textTransform: "uppercase" }}>
                        {r.eventName || r.fieldName}
                      </p>
                      <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.22em", color: MUTED, marginTop: 4 }}>
                        {[r.city, r.country].filter(Boolean).join(", ") || r.location || "Archived mission"} · {r.playerCount} players · {r.captureCount} captures
                      </p>
                      <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.16em", color: MUTED, marginTop: 4 }}>
                        {new Date(r.decommissionedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span style={{
                    fontFamily: "monospace", fontSize: 10, letterSpacing: "0.24em",
                    color: DECOMMISSIONED, border: `1px solid ${DECOMMISSIONED}55`,
                    padding: "4px 8px", textTransform: "uppercase",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: DECOMMISSIONED, display: "inline-block" }} />
                    Decommissioned
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
