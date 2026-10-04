import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QrCode } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { QRScanner } from "@/components/QRScanner";
import { parseFieldLink } from "@/lib/field-link";
import { spartanopsListFields } from "@/lib/spartanops-checkin.functions";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join a Game — SpartanOps" },
      { name: "description", content: "Scan your field's poster QR or pick your airsoft field from the list to join the game." },
      { property: "og:title", content: "Join a Game — SpartanOps" },
      { property: "og:description", content: "Scan your field's poster QR or pick your airsoft field from the list to join the game." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const ERR = "#d97a6c";
const RECENT_KEY = "spartanops:recent-fields";

type FieldRow = { id: string; name: string };
type Recent = { accountId: string; name: string };

const labelStyle: CSSProperties = {
  display: "block", fontFamily: "'Michroma', monospace", fontSize: 9.5,
  letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", margin: "22px 0 8px",
};
const rowStyle: CSSProperties = {
  display: "block", width: "100%", textAlign: "left", background: "rgba(0,0,0,0.35)",
  color: INK, border: `1px solid ${ACCENT}44`, padding: "13px 12px", marginBottom: 8,
  fontFamily: "monospace", fontSize: 15, cursor: "pointer",
};
const msgStyle: CSSProperties = { fontFamily: "monospace", fontSize: 12, opacity: 0.75, lineHeight: 1.6 };

function readRecent(): Recent[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    let list: Recent[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    if (!raw) {
      const old = JSON.parse(localStorage.getItem("spartanops:last-field") ?? "null");
      if (old && typeof old.accountId === "string") {
        list = [{ accountId: old.accountId, name: String(old.name ?? "") }];
        localStorage.setItem(RECENT_KEY, JSON.stringify(list));
      }
    }
    return list.filter((f) => f && typeof f.accountId === "string").slice(0, 5);
  } catch {
    return [];
  }
}

function JoinPage() {
  const { lang } = useLang();
  const en = lang === "en";
  const navigate = useNavigate();
  const listFields = useServerFn(spartanopsListFields);

  const [scanOpen, setScanOpen] = useState(false);
  const [cameraErr, setCameraErr] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ mode: "all" | "prompt" | "search"; fields: FieldRow[] } | null>(null);
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => { setRecent(readRecent()); }, []);

  useEffect(() => {
    let cancelled = false;
    const h = window.setTimeout(() => {
      listFields({ data: { q } })
        .then((r) => { if (!cancelled) { setResult({ mode: r.mode, fields: r.fields }); setLoadErr(false); } })
        .catch(() => { if (!cancelled) setLoadErr(true); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(h); };
  }, [q, listFields]);

  const openScanner = () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraErr(true);
      return;
    }
    setCameraErr(false);
    setScanOpen(true);
  };

  const goField = (id: string) => navigate({ to: "/field", search: { id } });

  return (
    <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "110px 16px 48px" }}>
      <div style={{ maxWidth: 440, margin: "0 auto", background: PANEL, border: `1px solid ${ACCENT}44`, padding: "28px 22px" }}>
        <h1 style={{ fontFamily: "'Michroma', monospace", fontSize: 22, letterSpacing: "0.12em", textAlign: "center", textTransform: "uppercase", marginBottom: 22 }}>
          {en ? "Join a game" : "Vstopi v igro"}
        </h1>

        <button
          type="button"
          onClick={openScanner}
          style={{
            width: "100%", padding: "16px", background: ACCENT, color: BG, border: "none",
            fontFamily: "'Michroma', monospace", fontSize: 12, letterSpacing: "0.20em",
            textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          <QrCode size={18} /> {en ? "Scan poster QR" : "Skeniraj QR s plakata"}
        </button>
        {cameraErr && (
          <p style={{ ...msgStyle, color: ERR, opacity: 1, marginTop: 10, textAlign: "center" }}>
            {en ? "Camera unavailable — pick your field from the list." : "Kamera ni na voljo — izberi poligon s seznama."}
          </p>
        )}

        {recent.length > 0 && (
          <>
            <span style={labelStyle}>{en ? "Your fields" : "Tvoji poligoni"}</span>
            {recent.map((f) => (
              <button key={f.accountId} type="button" style={{ ...rowStyle, borderColor: ACCENT }} onClick={() => goField(f.accountId)}>
                {f.name || (en ? "Your field" : "Tvoj poligon")}
              </button>
            ))}
          </>
        )}

        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={en ? "Search fields…" : "Išči poligone…"}
          autoComplete="off"
          style={{
            width: "100%", background: "rgba(0,0,0,0.4)", color: INK, border: `1px solid ${ACCENT}55`,
            padding: "12px", fontFamily: "monospace", fontSize: 16, marginTop: 22, boxSizing: "border-box",
          }}
        />

        {loadErr ? (
          <p style={{ ...msgStyle, color: ERR, marginTop: 12 }}>{en ? "Connection error. Try again." : "Napaka povezave. Poskusi znova."}</p>
        ) : !result ? (
          <p style={{ ...msgStyle, marginTop: 12 }}>…</p>
        ) : result.mode === "prompt" ? (
          <p style={{ ...msgStyle, marginTop: 12 }}>{en ? "Type at least 2 letters to find your field." : "Vpiši vsaj 2 črki, da najdeš svoj poligon."}</p>
        ) : result.mode === "search" && result.fields.length === 0 ? (
          <p style={{ ...msgStyle, marginTop: 12 }}>{en ? "No fields found. Ask your marshal for the poster QR." : "Ni najdenih poligonov. Vprašaj maršala za QR plakat."}</p>
        ) : (
          <>
            {result.mode === "all" && <span style={labelStyle}>{en ? "All fields" : "Vsi poligoni"}</span>}
            <div style={{ marginTop: result.mode === "search" ? 12 : 0 }}>
              {result.fields.map((f) => (
                <button key={f.id} type="button" style={rowStyle} onClick={() => goField(f.id)}>{f.name}</button>
              ))}
            </div>
          </>
        )}

        <p style={{ textAlign: "center", marginTop: 26 }}>
          <Link to="/marshal-account" style={{ color: ACCENT, fontFamily: "monospace", fontSize: 12, textDecoration: "none", opacity: 0.85 }}>
            {en ? "Run a field? Start free →" : "Vodiš poligon? Začni brezplačno →"}
          </Link>
        </p>
      </div>

      <QRScanner
        open={scanOpen}
        mode="field"
        onClose={() => setScanOpen(false)}
        onCameraError={() => { setScanOpen(false); setCameraErr(true); }}
        onRaw={(raw) => {
          const path = parseFieldLink(raw);
          if (!path) return false;
          setScanOpen(false);
          window.location.assign(path);
          return true;
        }}
      />
    </main>
  );
}
