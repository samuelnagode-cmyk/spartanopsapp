import { useRef, useState, type CSSProperties } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Crosshair, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtLatLng, googleMapsUrl, parseLocationInput, type LatLng, type Lang } from "@/lib/events";
import { resolveMapsLink } from "@/lib/events.functions";
import { ACCENT, ERR, INK, MICHROMA, MUTED, OK, btnOutline } from "./ui";

const labelStyle: CSSProperties = { display: "block", fontFamily: MICHROMA, fontSize: 9.5, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", marginBottom: 6 };
const inputStyle: CSSProperties = { width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.4)", color: INK, border: `1px solid ${ACCENT}55`, padding: "10px 12px", fontFamily: "monospace", fontSize: 16, colorScheme: "dark" };
const helpStyle: CSSProperties = { fontFamily: "monospace", fontSize: 11.5, color: MUTED, lineHeight: 1.6, marginTop: 6 };
const small: CSSProperties = { ...btnOutline, minHeight: 36, padding: "6px 12px", fontSize: 9.5 };

/** A set point: coordinates with a check link. Shared by the input and the event form's "At the field" option. */
export function PointCard({ value, lang, actions }: { value: LatLng; lang: Lang; actions?: React.ReactNode }) {
  const en = lang === "en";
  return (
    <div style={{ border: `1px solid ${OK}66`, background: `${OK}12`, padding: "12px 12px" }}>
      <p style={{ fontFamily: "monospace", fontSize: 15, color: INK, marginBottom: 10 }}>{fmtLatLng(value)}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href={googleMapsUrl(value)} target="_blank" rel="noopener noreferrer" className="ev-focus" style={small}>
          <ExternalLink size={13} /> {en ? "Check in Google Maps ↗" : "Preveri v Google Zemljevidih ↗"}
        </a>
        {actions}
      </div>
    </div>
  );
}

export function LocationInput({ value, onChange, label, helper, lang, id = "loc-input" }: {
  value: LatLng | null; onChange: (v: LatLng | null) => void; label: string; helper?: string; lang: Lang; id?: string;
}) {
  const en = lang === "en";
  const resolveFn = useServerFn(resolveMapsLink);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const parse = async (raw: string) => {
    setErr(null); setInfo(null);
    if (!raw.trim()) return;
    const r = parseLocationInput(raw);
    if (r.kind === "point") { onChange({ lat: r.lat, lng: r.lng }); setText(""); return; }
    if (r.kind === "error") {
      setErr(r.error === "range"
        ? (en ? "These coordinates are not a valid place." : "Te koordinate niso veljavno mesto.")
        : (en ? "Could not read this. Paste a Google Maps link or coordinates like 46.0569, 14.5058." : "Tega ni mogoče prebrati. Prilepi povezavo iz Google Zemljevidov ali koordinate, npr. 46.0569, 14.5058."));
      return;
    }
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await resolveFn({ data: { accessToken: data.session?.access_token ?? "", url: r.url } });
      if ("lat" in res) { onChange({ lat: res.lat, lng: res.lng }); setText(""); }
      else setErr(en ? "Could not read this link. Paste the coordinates instead." : "Te povezave ni mogoče prebrati. Namesto nje prilepi koordinate.");
    } catch {
      setErr(en ? "Could not read this link. Paste the coordinates instead." : "Te povezave ni mogoče prebrati. Namesto nje prilepi koordinate.");
    } finally { setBusy(false); }
  };

  const useMine = () => {
    setErr(null); setInfo(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) { setErr(en ? "This browser cannot share location." : "Ta brskalnik ne more deliti lokacije."); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const acc = Math.round(pos.coords.accuracy);
        if (acc > 100) { setErr(`±${acc} m. ${en ? "Low accuracy: go outside and try again." : "Nizka natančnost: pojdi ven in poskusi znova."}`); return; }
        setInfo(`±${acc} m`);
        onChange({ lat: Math.round(pos.coords.latitude * 1e6) / 1e6, lng: Math.round(pos.coords.longitude * 1e6) / 1e6 });
      },
      (e) => {
        setBusy(false);
        setErr(e.code === e.PERMISSION_DENIED
          ? (en ? "Location permission was denied. Allow it in the browser, or paste coordinates." : "Dovoljenje za lokacijo je zavrnjeno. Dovoli ga v brskalniku ali prilepi koordinate.")
          : (en ? "Could not get your location. Try again or paste coordinates." : "Lokacije ni bilo mogoče dobiti. Poskusi znova ali prilepi koordinate."));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  return (
    <div>
      <p style={labelStyle}>{label}</p>
      {value ? (
        <>
          <PointCard value={value} lang={lang} actions={<>
            <button type="button" className="ev-focus" style={small} onClick={() => { setText(fmtLatLng(value)); onChange(null); setTimeout(() => ref.current?.focus(), 0); }}>{en ? "Change" : "Spremeni"}</button>
            <button type="button" className="ev-focus" style={{ ...small, color: ERR, borderColor: `${ERR}88` }} onClick={() => { setText(""); onChange(null); }}>{en ? "Remove" : "Odstrani"}</button>
          </>} />
          {info && <p style={{ ...helpStyle, color: OK }}>{info}</p>}
        </>
      ) : (
        <>
          <input id={id} ref={ref} className="ev-focus" style={inputStyle} value={text} maxLength={2000} disabled={busy}
            aria-label={en ? "Paste a Google Maps link or coordinates" : "Prilepi povezavo iz Google Zemljevidov ali koordinate"}
            placeholder={en ? "Paste a Google Maps link or coordinates" : "Prilepi povezavo iz Google Zemljevidov ali koordinate"}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => { const t = e.clipboardData.getData("text"); if (t) { e.preventDefault(); setText(t); void parse(t); } }}
            onBlur={() => void parse(text)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void parse(text); } }} />
          <button type="button" className="ev-focus" style={{ ...small, marginTop: 8 }} disabled={busy} onClick={useMine}>
            <Crosshair size={13} /> {busy ? "…" : en ? "Use my current location" : "Uporabi mojo trenutno lokacijo"}
          </button>
          {err && <p role="alert" style={{ ...helpStyle, color: ERR }}>{err}</p>}
          <p style={helpStyle}>{en ? "In Google Maps, press and hold on the spot, then tap the coordinates to copy them." : "V Google Zemljevidih pridrži prst na mestu, nato tapni koordinate, da jih kopiraš."}</p>
        </>
      )}
      {helper && <p style={helpStyle}>{helper}</p>}
    </div>
  );
}
