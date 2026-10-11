/** Field logo / outline image helpers. Pure: shared by server functions, the media route and the browser. */
export const FIELD_MEDIA_BUCKET = "spartanops-field-media";
export type MediaKind = "logo" | "map";
export const MEDIA_LIMITS: Record<MediaKind, number> = { logo: 150 * 1024, map: 700 * 1024 };
export const MEDIA_PATH_RE = /^[0-9a-f-]{36}\/(logo|map)-[0-9a-f-]{36}\.(webp|jpg|png)$/i;

/** Stable public URL (served by /api/public/field-media). Never exposes anything but the object name. */
export function fieldMediaUrl(path: string | null | undefined): string | null {
  return path && MEDIA_PATH_RE.test(path) ? `/api/public/field-media/${path}` : null;
}

/** Real file type from magic bytes, plus pixel size when the header gives it. */
export function sniffImage(b: Uint8Array): { type: "image/webp" | "image/jpeg" | "image/png"; width: number | null; height: number | null } | null {
  const ascii = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  if (b.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8X") return { type: "image/webp", width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    if (chunk === "VP8 " && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return { type: "image/webp", width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
    if (chunk === "VP8L" && b[20] === 0x2f) {
      const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { type: "image/webp", width: (v & 0x3fff) + 1, height: ((v >>> 14) & 0x3fff) + 1 };
    }
    return { type: "image/webp", width: null, height: null };
  }
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { type: "image/png", width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    // Walk segments to the first SOFn marker.
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      const len = (b[i + 2] << 8) | b[i + 3];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { type: "image/jpeg", height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + len;
    }
    return { type: "image/jpeg", width: null, height: null };
  }
  return null;
}
