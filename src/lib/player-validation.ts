/** Shared player-profile rules: used by the form and the server, so they cannot drift. */
export const PRIVACY_VERSION = "2026-10";

export const OPERATOR_TYPES = ["AEG", "SNIPER", "DMR", "PUMP"] as const;
export const EXPERIENCE_VALUES = ["slabo", "dobro", "zelo_dobro"] as const;
export type AgeGroup = "16_17" | "18_plus";
export type AgeChoice = AgeGroup | "under_16";

export function cleanText(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

const NICK_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u;
const NAME_RE = /^[\p{L}][\p{L} '-]*$/u;
const PHONE_RE = /^\+[1-9][0-9]{7,14}$/;

export function normalizePhone(raw: string): { ok: true; value: string } | { ok: false } {
  let p = raw.replace(/[\s\-.()]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  else if (/^0[1-9]/.test(p)) p = "+386" + p.slice(1);
  return PHONE_RE.test(p) ? { ok: true, value: p } : { ok: false };
}

export type PlayerInput = {
  nickname?: unknown; first_name?: unknown; last_name?: unknown; show_full_last_name?: unknown;
  age_group?: unknown; phone?: unknown; club?: unknown; experience_level?: unknown; operator_type?: unknown;
  primary_weapon?: unknown; secondary_weapon?: unknown; sidearm?: unknown; gear_notes?: unknown;
};

export type PlayerProfileData = {
  nickname: string; first_name: string; last_name: string | null; show_full_last_name: boolean;
  age_group: AgeGroup; phone: string | null; club: string | null; experience_level: (typeof EXPERIENCE_VALUES)[number];
  operator_type: (typeof OPERATOR_TYPES)[number] | null; primary_weapon: string | null;
  secondary_weapon: string | null; sidearm: string | null; gear_notes: string | null;
};

/** Returns cleaned data or an error code like "validation:nickname". */
export function validatePlayer(input: PlayerInput): { ok: true; data: PlayerProfileData } | { ok: false; error: string } {
  const age = input.age_group;
  if (age === "under_16") return { ok: false, error: "validation:under_16" };
  if (age !== "16_17" && age !== "18_plus") return { ok: false, error: "validation:age_group" };

  const nickname = cleanText(input.nickname, 24);
  if (nickname.length < 2 || !NICK_RE.test(nickname)) return { ok: false, error: "validation:nickname" };
  const first = cleanText(input.first_name, 40);
  if (first.length < 1 || !NAME_RE.test(first)) return { ok: false, error: "validation:first_name" };

  const adult = age === "18_plus";
  let last: string | null = null;
  let phone: string | null = null;
  if (adult) {
    const l = cleanText(input.last_name, 40);
    if (l) { if (!NAME_RE.test(l)) return { ok: false, error: "validation:last_name" }; last = l; }
    const rawPhone = typeof input.phone === "string" ? input.phone.trim() : "";
    if (rawPhone) {
      const n = normalizePhone(rawPhone);
      if (!n.ok) return { ok: false, error: "validation:phone" };
      phone = n.value;
    }
  }

  const exp = EXPERIENCE_VALUES.includes(input.experience_level as never) ? (input.experience_level as PlayerProfileData["experience_level"]) : "dobro";
  const op = input.operator_type == null || input.operator_type === "" ? null : input.operator_type;
  if (op !== null && !OPERATOR_TYPES.includes(op as never)) return { ok: false, error: "validation:operator_type" };
  const opt = (v: unknown, max: number) => cleanText(v, max) || null;

  return {
    ok: true,
    data: {
      nickname, first_name: first, last_name: last,
      show_full_last_name: adult && last !== null && input.show_full_last_name === true,
      age_group: age, phone, club: opt(input.club, 60), experience_level: exp,
      operator_type: op as PlayerProfileData["operator_type"],
      primary_weapon: opt(input.primary_weapon, 60), secondary_weapon: opt(input.secondary_weapon, 60),
      sidearm: opt(input.sidearm, 60), gear_notes: opt(input.gear_notes, 140),
    },
  };
}

/** Only same-site paths: one leading slash, never "//" or "/\". */
export function safeNext(next: unknown): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
