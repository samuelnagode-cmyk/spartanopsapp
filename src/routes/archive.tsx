import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MapPin, Archive as ArchiveIcon, Trash2, Lock, Unlock } from "lucide-react";
import { listArchivedMissions, masterDeleteArchivedMission, type SpartanOpsArchiveRow } from "@/lib/spartanops-archive.functions";
import { verifyMasterPassword } from "@/lib/spartanops-lobbies.functions";
import { getMasterPw, setMasterPw as persistMasterPw } from "@/lib/master-admin";

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
const DANGER = "#ff6b6b";
const HAIRLINE = "rgba(236,227,196,0.10)";

function ArchivePage() {
  const navigate = useNavigate();
  const getArchive = useServerFn(listArchivedMissions);
  const deleteArchived = useServerFn(masterDeleteArchivedMission);
  const verifyMaster = useServerFn(verifyMasterPassword);
  const [rows, setRows] = useState<SpartanOpsArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [masterPw, setMasterPw] = useState<string>("");
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  // Auto-unlock if master password is cached in sessionStorage from admin-pregled
  useEffect(() => {
    try {
      const cached = getMasterPw();
      if (cached) {
        verifyMaster({ data: { password: cached } }).then((r) => {
          if (r?.ok) { setMasterPw(cached); setUnlocked(true); }
        }).catch(() => {});
      }
    } catch {}
  }, [verifyMaster]);

  const tryUnlock = async () => {
    setPwError(false);
    try {
      const r = await verifyMaster({ data: { password: pwInput } });
      if (r?.ok) {
        setMasterPw(pwInput);
        setUnlocked(true);
        setShowUnlock(false);
        setPwInput("");
        persistMasterPw(pwInput);
      } else {
        setPwError(true);
      }
    } catch {
      setPwError(true);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!unlocked) return;
    if (!confirm(`Permanently delete archived mission "${label}"? This cannot be undone.`)) return;
    setBusyId(id);
    try {
      await deleteArchived({ data: { id, masterPassword: masterPw } });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ background: BG, color: INK, minHeight: "100dvh", padding: "80px 16px 80px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <button
            onClick={() => navigate({ to: "/spartanops" })}
            style={{ background: "transparent", border: "none", color: MUTED, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <ArrowLeft size={12} /> Back to Command Center
          </button>

          <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.24em", color: ACCENT, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArchiveIcon size={11} /> ARCHIVE
          </span>
        </div>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
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

        {/* Master admin unlock */}
        <div style={{ marginBottom: 22, display: "flex", justifyContent: "center" }}>
          {unlocked ? (
            <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.22em", color: ACCENT, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${ACCENT}55`, padding: "6px 10px" }}>
              <Unlock size={11} /> Admin unlocked — permanent delete available
            </span>
          ) : showUnlock ? (
            <form
              onSubmit={(e) => { e.preventDefault(); void tryUnlock(); }}
              style={{ display: "flex", gap: 6 }}
            >
              <input
                type="password"
                value={pwInput}
                onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
                placeholder="Master password"
                autoFocus
                style={{
                  background: "rgba(0,0,0,0.4)", color: INK,
                  border: `1px solid ${pwError ? DANGER : `${ACCENT}55`}`,
                  padding: "8px 10px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em", minWidth: 220,
                }}
              />
              <button
                type="submit"
                style={{ background: ACCENT, color: BG, border: `1px solid ${ACCENT}`, padding: "8px 12px", fontFamily: "monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", fontWeight: 700 }}
              >
                Unlock
              </button>
              <button
                type="button"
                onClick={() => { setShowUnlock(false); setPwInput(""); setPwError(false); }}
                style={{ background: "transparent", color: MUTED, border: `1px solid ${HAIRLINE}`, padding: "8px 10px", fontFamily: "monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer" }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowUnlock(true)}
              style={{ background: "transparent", color: MUTED, border: `1px dashed ${HAIRLINE}`, padding: "6px 10px", fontFamily: "monospace", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Lock size={11} /> Admin: unlock permanent delete
            </button>
          )}
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
                  opacity: 0.9,
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontFamily: "monospace", fontSize: 10, letterSpacing: "0.24em",
                      color: DECOMMISSIONED, border: `1px solid ${DECOMMISSIONED}55`,
                      padding: "4px 8px", textTransform: "uppercase",
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: DECOMMISSIONED, display: "inline-block" }} />
                      Decommissioned
                    </span>
                    {unlocked && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void handleDelete(r.id, r.eventName || r.fieldName)}
                        title="Permanently delete from archive"
                        aria-label="Permanently delete from archive"
                        style={{
                          background: "transparent", color: DANGER,
                          border: `1px solid ${DANGER}55`, padding: "6px 8px",
                          cursor: busyId === r.id ? "wait" : "pointer",
                          fontFamily: "monospace", fontSize: 10, letterSpacing: "0.16em",
                          textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6,
                          opacity: busyId === r.id ? 0.5 : 1,
                        }}
                      >
                        <Trash2 size={12} /> {busyId === r.id ? "…" : "Delete"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
