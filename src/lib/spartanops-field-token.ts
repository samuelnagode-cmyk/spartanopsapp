// Stateless field-entry tokens (server-only use; reads FIELD_ENTRY_SECRET).
// token = base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload))
// payload = { f: <field key, currently the account id>, v: <password version>, exp: <unix seconds> }

const enc = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(str)) throw new Error("bad b64");
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(secret?: string): Promise<CryptoKey> {
  const s = secret ?? process.env.FIELD_ENTRY_SECRET;
  if (!s) throw new Error("FIELD_ENTRY_SECRET missing");
  return crypto.subtle.importKey("raw", enc.encode(s), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signFieldToken(fieldKey: string, version: number, ttlSec = 48 * 3600, secret?: string): Promise<string> {
  const payload = { f: fieldKey, v: version, exp: Math.floor(Date.now() / 1000) + ttlSec };
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await getKey(secret), enc.encode(body)));
  return `${body}.${b64urlEncode(sig)}`;
}

export async function verifyFieldToken(token: string | undefined, fieldKey: string, currentVersion: number, secret?: string): Promise<boolean> {
  try {
    if (!token || typeof token !== "string" || token.length > 1000) return false;
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
    const [body, sigStr] = parts;
    const ok = await crypto.subtle.verify("HMAC", await getKey(secret), b64urlDecode(sigStr), enc.encode(body));
    if (!ok) return false;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!payload || payload.f !== fieldKey) return false;
    if (typeof payload.v !== "number" || payload.v !== currentVersion) return false;
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}
