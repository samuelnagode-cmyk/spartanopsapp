import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MapPin, Archive as ArchiveIcon, Trash2, Lock, Unlock } from "lucide-react";
import { listArchivedMissions, listMyArchivedMissions, masterDeleteArchivedMission, type SpartanOpsArchiveRow } from "@/lib/spartanops-archive.functions";
import { verifyMasterPassword } from "@/lib/spartanops-lobbies.functions";
import { getMasterPw, setMasterPw as persistMasterPw } from "@/lib/master-admin";
import { useLang } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/archive")({
  head: () => ({
    meta: [
      { title: "Past missions — SpartanOps" },
      { name: "description", content: "Missions you have finished at your field." },
      { property: "og:title", content: "Past missions — SpartanOps" },
      { property: "og:description", content: "Missions you have finished at your field." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
const DECOMMISSIONED = "#8fb07a";
const DANGER = "#ff6b6b";
const HAIRLINE = "rgba(236,227,196,0.10)";

function ArchivePage() {
  const { lang } = useLang();
  const en = lang === "en";
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
  const [showPassword, setShowPassword] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const getMine = useServerFn(listMyArchivedMissions);
  // "out" = signed out, "nofield" = signed in without a field, "field" = marshal
  const [status, setStatus] = useState<"loading" | "out" | "nofield" | "field">("loading");
  const [adminAvailable, setAdminAvailable] = useState(false);
  useEffect(() => { try { setAdminAvailable(!!getMasterPw()); } catch {} }, []);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      setLoading(true);
      try {
        if (unlocked) {
          const data = await getArchive();
          if (alive) setRows(data);
          return;
        }
        const { data: s } = await supabase.auth.getSession();
        const token = s.session?.access_token;
        if (!token) { if (alive) { setStatus("out"); setRows([]); } return; }
        const r = await getMine({ data: { accessToken: token } });
        if (alive) { setStatus(r.hasField ? "field" : "nofield"); setRows(r.rows); }
      } catch {
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN" || e === "SIGNED_OUT") void refresh(); });
    window.addEventListener("focus", refresh);
    return () => { alive = false; sub.subscription.unsubscribe(); window.removeEventListener("focus", refresh); };
  }, [getArchive, getMine, unlocked]);

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
    if (!confirm(en ? `Permanently delete "${label}"? This cannot be undone.` : `Trajno izbrišem "${label}"? Tega ni mogoče razveljaviti.`)) return;
    setBusyId(id);
    try {
      await deleteArchived({ data: { id, masterPassword: masterPw } });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      alert(e?.message || (en ? "Delete failed" : "Brisanje ni uspelo"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ background: BG, color: INK, minHeight: "100dvh", padding: "80px 16px 80px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <button
            onClick={() => navigate({ to: status === "field" ? "/admin-pregled" : "/spartanops" })}
            style={{ background: "transparent", border: "none", color: MUTED, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <ArrowLeft size={12} /> {en ? "Back to Command Center" : "Nazaj v komandni center"}
          </button>

          <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.24em", color: ACCENT, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArchiveIcon size={11} /> {en ? "ARCHIVE" : "ARHIV"}
          </span>
        </div>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.30em", color: ACCENT, marginBottom: 10, textTransform: "uppercase" }}>
            {unlocked ? (en ? "// PLATFORM SHOWCASE (ADMIN)" : "// PRIKAZ PLATFORME (ADMIN)") : (en ? "// YOUR FIELD" : "// TVOJ POLIGON")}
          </p>
          <h1 style={{ fontFamily: "'Michroma', monospace", fontSize: "clamp(20px, 4.4vw, 28px)", letterSpacing: "0.14em", color: INK, textTransform: "uppercase" }}>
            {en ? "Past missions" : "Pretekle misije"}
          </h1>
          <p style={{ color: MUTED, fontSize: 13, marginTop: 10, lineHeight: 1.6 }}>
            {en ? "Missions you have finished at your field." : "Misije, ki si jih zaključil na svojem poligonu."}
          </p>
        </div>

        {/* Master admin unlock */}
        {(adminAvailable || unlocked) && <div style={{ marginBottom: 22, display: "flex", justifyContent: "center" }}>
          {unlocked ? (
            <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.22em", color: ACCENT, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${ACCENT}55`, padding: "6px 10px" }}>
              <Unlock size={11} /> {en ? "Platform showcase (admin)" : "Prikaz platforme (admin)"}
            </span>
          ) : showUnlock ? (
            <form
              onSubmit={(e) => { e.preventDefault(); void tryUnlock(); }}
              style={{ display: "flex", gap: 6 }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={pwInput}
                  onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
                  placeholder={en ? "Master password" : "Glavno geslo"}
                  autoFocus
                  style={{
                    background: "rgba(0,0,0,0.4)", color: INK,
                    border: `1px solid ${pwError ? DANGER : `${ACCENT}55`}`,
                    padding: "8px 10px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em", minWidth: 220,
                  }}
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-pressed={showPassword}
                  style={{ alignSelf: "flex-start", background: "transparent", border: "none", color: ACCENT, padding: 0, fontFamily: "monospace", fontSize: 10, textDecoration: "underline", cursor: "pointer" }}>
                  {showPassword ? (en ? "Hide password" : "Skrij geslo") : (en ? "See password" : "Pokaži geslo")}
                </button>
              </div>
              <button
                type="submit"
                style={{ background: ACCENT, color: BG, border: `1px solid ${ACCENT}`, padding: "8px 12px", fontFamily: "monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", fontWeight: 700 }}
              >
                {en ? "Unlock" : "Odkleni"}
              </button>
              <button
                type="button"
                onClick={() => { setShowUnlock(false); setShowPassword(false); setPwInput(""); setPwError(false); }}
                style={{ background: "transparent", color: MUTED, border: `1px solid ${HAIRLINE}`, padding: "8px 10px", fontFamily: "monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer" }}
              >
                {en ? "Cancel" : "Prekliči"}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowUnlock(true)}
              style={{ background: "transparent", color: MUTED, border: `1px dashed ${HAIRLINE}`, padding: "6px 10px", fontFamily: "monospace", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Lock size={11} /> {en ? "Admin: platform showcase" : "Admin: prikaz platforme"}
            </button>
          )}
        </div>}

        {loading ? (
          <div style={{ padding: "60px 24px", textAlign: "center", border: `1px dashed ${HAIRLINE}`, color: MUTED, fontFamily: "monospace", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            {en ? "Loading…" : "Nalaganje…"}
          </div>
        ) : !unlocked && status === "out" ? (
          <div style={{ padding: "40px 24px", textAlign: "center", border: `1px dashed ${HAIRLINE}`, color: MUTED }}>
            <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>{en ? "Sign in to see the missions you have finished at your field." : "Prijavi se, da vidiš misije, zaključene na tvojem poligonu."}</p>
            <Link to="/me" style={{ display: "inline-block", background: ACCENT, color: BG, padding: "12px 20px", fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, textDecoration: "none" }}>{en ? "Sign in" : "Prijava"}</Link>
          </div>
        ) : !unlocked && status === "nofield" ? (
          <div style={{ padding: "40px 24px", textAlign: "center", border: `1px dashed ${HAIRLINE}`, color: MUTED }}>
            <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{en ? "Past missions appear here once you run a field." : "Pretekle misije se prikažejo tukaj, ko vodiš poligon."}</p>
            <Link to="/me" style={{ color: ACCENT, textDecoration: "underline", fontSize: 13 }}>{en ? "My account →" : "Moj račun →"}</Link>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center", border: `1px dashed ${HAIRLINE}`, color: MUTED }}>
            <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.20em", color: ACCENT, marginBottom: 8, textTransform: "uppercase" }}>
              {en ? "// EMPTY" : "// PRAZNO"}
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>
              {en ? "No finished missions yet." : "Še ni zaključenih misij."}
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
                        {[r.city, r.country].filter(Boolean).join(", ") || r.location || (en ? "Mission" : "Misija")} · {r.playerCount} {en ? "players" : "igralcev"} · {r.captureCount} {en ? "captures" : "zavzetij"}
                      </p>
                      <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.16em", color: MUTED, marginTop: 4 }}>
                        {new Date(r.decommissionedAt).toLocaleString(en ? "en-GB" : "sl-SI")}
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
                      {en ? "Finished" : "Zaključena"}
                    </span>
                    {unlocked && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void handleDelete(r.id, r.eventName || r.fieldName)}
                        title={en ? "Delete permanently" : "Trajno izbriši"}
                        aria-label={en ? "Delete permanently" : "Trajno izbriši"}
                        style={{
                          background: "transparent", color: DANGER,
                          border: `1px solid ${DANGER}55`, padding: "6px 8px",
                          cursor: busyId === r.id ? "wait" : "pointer",
                          fontFamily: "monospace", fontSize: 10, letterSpacing: "0.16em",
                          textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6,
                          opacity: busyId === r.id ? 0.5 : 1,
                        }}
                      >
                        <Trash2 size={12} /> {busyId === r.id ? "…" : (en ? "Delete" : "Izbriši")}
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
