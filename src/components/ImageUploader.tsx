import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fieldMediaRemove, fieldMediaUpload } from "@/lib/field-profile.functions";
import { useLang } from "@/lib/i18n";
import { ACCENT, BG, ERR, FieldLogo, INK, MICHROMA, MUTED, PANEL, btnOutline, btnPrimary } from "@/components/events/ui";
import { FieldMapViewer } from "@/components/events/FieldMapViewer";

type Kind = "logo" | "map";
type Ready = { blob: Blob; url: string; warn: string | null };

const MAX_FILE = 12 * 1024 * 1024;
const FRAME = 260;

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob(async (b) => {
    if (b && b.type === "image/webp") return res(b);
    // WebP encoding unsupported: fall back to JPEG.
    canvas.toBlob((j) => (j ? res(j) : rej(new Error("encode"))), "image/jpeg", quality);
  }, "image/webp", quality));
}

function scaled(bmp: ImageBitmap, longSide: number): HTMLCanvasElement {
  const k = Math.min(1, longSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export function ImageUploader({ kind, currentUrl, fieldName, onChange }: {
  kind: Kind; currentUrl: string | null; fieldName: string; onChange: (url: string | null) => void;
}) {
  const { lang } = useLang();
  const en = lang === "en";
  const uploadFn = useServerFn(fieldMediaUpload);
  const removeFn = useServerFn(fieldMediaRemove);
  const fileRef = useRef<HTMLInputElement>(null);
  const [bmp, setBmp] = useState<ImageBitmap | null>(null); // logo crop step
  const [ready, setReady] = useState<Ready | null>(null);
  const [busy, setBusy] = useState<"" | "processing" | "uploading" | "removing">("");
  const [err, setErr] = useState<string | null>(null);
  const [viewer, setViewer] = useState(false);

  useEffect(() => () => { if (ready) URL.revokeObjectURL(ready.url); }, [ready]);

  const msg = (code: string) => ({
    too_large: en ? "The image is too large after processing. Try a smaller image." : "Slika je po obdelavi prevelika. Poskusi z manjšo.",
    bad_image: en ? "This file is not a supported image (JPEG, PNG or WebP)." : "Ta datoteka ni podprta slika (JPEG, PNG ali WebP).",
    bad_dimensions: en ? "The image size is not allowed." : "Velikost slike ni dovoljena.",
    too_fast: en ? "Please wait a few seconds and try again." : "Počakaj nekaj sekund in poskusi znova.",
    login_required: en ? "Please sign in again." : "Ponovno se prijavi.",
    account_required: en ? "Only field accounts can upload images." : "Slike lahko nalagajo le računi poligonov.",
  } as Record<string, string>)[code] ?? (en ? "Could not save the image. Please try again." : "Slike ni bilo mogoče shraniti. Poskusi znova.");

  const pick = async (file: File) => {
    setErr(null); setReady(null); setBmp(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setErr(en ? "Use a JPEG, PNG or WebP image." : "Uporabi sliko JPEG, PNG ali WebP."); return; }
    if (file.size > MAX_FILE) { setErr(en ? "This file is larger than 12 MB." : "Datoteka je večja od 12 MB."); return; }
    setBusy("processing");
    try {
      const b = await createImageBitmap(file, { imageOrientation: "from-image" });
      if (b.width > 8000 || b.height > 8000) { setErr(en ? "This image is wider or taller than 8000 px." : "Slika je širša ali višja od 8000 px."); return; }
      if (kind === "logo") { setBmp(b); return; }
      const ratio = b.width / b.height;
      if (ratio > 2.5 || ratio < 1 / 2.5) { setErr(en ? "Use an image that is not extremely wide or tall." : "Uporabi sliko, ki ni izjemno široka ali visoka."); return; }
      const warn = Math.max(b.width, b.height) < 600 ? (en ? "This image is small and may look blurry." : "Slika je majhna in je lahko zamegljena.") : null;
      let c = scaled(b, 1600);
      let blob = await encode(c, 0.82);
      if (blob.size > 400 * 1024) blob = await encode(c, 0.6);
      if (blob.size > 400 * 1024) { c = scaled(b, 1280); blob = await encode(c, 0.6); }
      setReady({ blob, url: URL.createObjectURL(blob), warn });
    } catch {
      setErr(en ? "Could not read this image." : "Slike ni bilo mogoče prebrati.");
    } finally { setBusy(""); }
  };

  const save = async () => {
    if (!ready) return;
    setBusy("uploading"); setErr(null);
    try {
      const t = (await supabase.auth.getSession()).data.session?.access_token ?? "";
      const r = await uploadFn({ data: { accessToken: t, kind, contentType: ready.blob.type, base64: await blobToBase64(ready.blob) } });
      setReady(null); onChange(r.url);
    } catch (e) { setErr(msg(String((e as Error)?.message ?? ""))); }
    finally { setBusy(""); }
  };

  const remove = async () => {
    setBusy("removing"); setErr(null);
    try {
      const t = (await supabase.auth.getSession()).data.session?.access_token ?? "";
      await removeFn({ data: { accessToken: t, kind } });
      onChange(null);
    } catch (e) { setErr(msg(String((e as Error)?.message ?? ""))); }
    finally { setBusy(""); }
  };

  const small: CSSProperties = { ...btnOutline, minHeight: 36, padding: "6px 12px", fontSize: 9.5 };
  const help: CSSProperties = { fontFamily: "monospace", fontSize: 11.5, color: MUTED, lineHeight: 1.6, marginTop: 6 };
  const shown = ready?.url ?? currentUrl;

  return (
    <div style={{ border: `1px solid ${ACCENT}33`, padding: 12, background: "rgba(0,0,0,0.25)" }}>
      <p style={{ fontFamily: MICHROMA, fontSize: 9.5, letterSpacing: "0.16em", color: ACCENT, textTransform: "uppercase", marginBottom: 10 }}>
        {kind === "logo" ? (en ? "Club logo" : "Logo kluba") : (en ? "Field outline image" : "Slika obrisa poligona")}
      </p>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pick(f); }} />

      {bmp && (
        <LogoCropper bmp={bmp} en={en} onCancel={() => setBmp(null)}
          onDone={async (canvas, warn) => {
            const blob = await encode(canvas, 0.85);
            setBmp(null); setReady({ blob, url: URL.createObjectURL(blob), warn });
          }} />
      )}

      {!bmp && shown && (
        kind === "logo" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
            <FieldLogo url={shown} name={fieldName} size={22} />
            <FieldLogo url={shown} name={fieldName} size={56} />
            <span style={{ fontFamily: "monospace", fontSize: 11, color: MUTED }}>{en ? "Card and event page size" : "Velikost na kartici in strani dogodka"}</span>
          </div>
        ) : (
          <button type="button" className="ev-focus" onClick={() => setViewer(true)}
            style={{ display: "block", width: "100%", height: 160, background: "#050605", border: `1px solid ${ACCENT}33`, padding: 0, cursor: "zoom-in", marginBottom: 10 }}>
            <img src={shown} alt={fieldName} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </button>
        )
      )}
      {!bmp && !shown && kind === "logo" && <div style={{ marginBottom: 10 }}><FieldLogo url={null} name={fieldName} size={56} /></div>}

      {ready?.warn && <p style={{ ...help, color: ACCENT }}>{ready.warn}</p>}
      {err && <p role="alert" style={{ ...help, color: ERR }}>{err}</p>}

      {!bmp && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          {ready ? (
            <>
              <button type="button" className="ev-focus" style={{ ...btnPrimary, minHeight: 40 }} disabled={!!busy} onClick={save}>{busy === "uploading" ? (en ? "Saving…" : "Shranjujem…") : (en ? "Save image" : "Shrani sliko")}</button>
              <button type="button" className="ev-focus" style={small} disabled={!!busy} onClick={() => setReady(null)}>{en ? "Cancel" : "Prekliči"}</button>
            </>
          ) : (
            <button type="button" className="ev-focus" style={small} disabled={!!busy} onClick={() => fileRef.current?.click()}>
              <ImagePlus size={13} /> {busy === "processing" ? "…" : currentUrl ? (en ? "Replace" : "Zamenjaj") : (en ? "Choose image" : "Izberi sliko")}
            </button>
          )}
          {currentUrl && !ready && (
            <button type="button" className="ev-focus" style={{ ...small, color: ERR, borderColor: `${ERR}88` }} disabled={!!busy} onClick={remove}>
              <Trash2 size={13} /> {busy === "removing" ? "…" : (en ? "Remove" : "Odstrani")}
            </button>
          )}
        </div>
      )}

      <p style={help}>{kind === "logo"
        ? (en ? "Square works best. A simple logo on a plain background looks best at small sizes." : "Najbolje deluje kvadrat. Preprost logo na enobarvnem ozadju je najlepši v majhni velikosti.")
        : (en ? "Best: a top-down map or screenshot with the field boundary drawn. Avoid dark photos and photos of people." : "Najbolje: zemljevid od zgoraj ali posnetek zaslona z narisano mejo poligona. Izogibaj se temnim fotografijam in fotografijam ljudi.")}</p>
      <p style={help}>{en ? "Only upload images you have the right to use." : "Nalagaj samo slike, za katere imaš pravico uporabe."}</p>

      {viewer && shown && <FieldMapViewer url={shown} name={fieldName} onClose={() => setViewer(false)} />}
    </div>
  );
}

/** Square crop: drag to move, slider or pinch to zoom; outputs 256 x 256. */
function LogoCropper({ bmp, en, onDone, onCancel }: { bmp: ImageBitmap; en: boolean; onDone: (c: HTMLCanvasElement, warn: string | null) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const base = FRAME / Math.min(bmp.width, bmp.height); // cover scale
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);

  const clamp = (o: { x: number; y: number }, z: number) => {
    const w = bmp.width * base * z, h = bmp.height * base * z;
    const mx = Math.max(0, (w - FRAME) / 2), my = Math.max(0, (h - FRAME) / 2);
    return { x: Math.max(-mx, Math.min(mx, o.x)), y: Math.max(-my, Math.min(my, o.y)) };
  };

  const draw = (c: HTMLCanvasElement, size: number) => {
    const k = size / FRAME;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#13160f"; ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = "high";
    const w = bmp.width * base * zoom * k, h = bmp.height * base * zoom * k;
    ctx.drawImage(bmp, (size - w) / 2 + off.x * k, (size - h) / 2 + off.y * k, w, h);
  };

  useEffect(() => { if (canvasRef.current) draw(canvasRef.current, FRAME); });

  const down = (e: RPointerEvent) => { (e.target as Element).setPointerCapture(e.pointerId); pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); };
  const move = (e: RPointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (!pinch.current) pinch.current = { d, z: zoom };
      const z = Math.max(1, Math.min(4, pinch.current.z * (d / pinch.current.d)));
      setZoom(z); setOff((o) => clamp(o, z));
      return;
    }
    setOff((o) => clamp({ x: o.x + e.clientX - prev.x, y: o.y + e.clientY - prev.y }, zoom));
  };
  const up = (e: RPointerEvent) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = null; };

  return (
    <div>
      <div style={{ position: "relative", width: FRAME, height: FRAME, maxWidth: "100%", touchAction: "none", cursor: "grab", border: `1px solid ${ACCENT}66` }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <canvas ref={canvasRef} width={FRAME} height={FRAME} style={{ display: "block", width: FRAME, height: FRAME }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: `0 0 0 9999px rgba(0,0,0,0.45)`, border: `1px dashed ${ACCENT}`, pointerEvents: "none" }} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontFamily: "monospace", fontSize: 12, color: INK }}>
        {en ? "Zoom" : "Povečava"}
        <input type="range" min={1} max={4} step={0.01} value={zoom} style={{ flex: 1, accentColor: ACCENT }}
          onChange={(e) => { const z = Number(e.target.value); setZoom(z); setOff((o) => clamp(o, z)); }} />
      </label>
      <p style={{ fontFamily: "monospace", fontSize: 11, color: MUTED, marginTop: 4 }}>{en ? "Drag to move. The circle shows the safe area." : "Povleci za premik. Krog kaže varno območje."}</p>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="button" className="ev-focus" style={{ ...btnPrimary, minHeight: 40, background: ACCENT, color: BG }}
          onClick={() => {
            const c = document.createElement("canvas"); c.width = 256; c.height = 256; draw(c, 256);
            onDone(c, Math.min(bmp.width, bmp.height) < 128 ? (en ? "This logo is small and may look blurry." : "Ta logo je majhen in je lahko zamegljen.") : null);
          }}>{en ? "Use this crop" : "Uporabi ta izrez"}</button>
        <button type="button" className="ev-focus" style={{ ...btnOutline, minHeight: 40, background: PANEL }} onClick={onCancel}>{en ? "Cancel" : "Prekliči"}</button>
      </div>
    </div>
  );
}
