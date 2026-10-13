/** Premade player avatars: pure data (no JSX) so the server and tests can import it. */

export const AVATAR_ICONS = [
  { id: "helmet", en: "Tactical helmet", sl: "Taktična čelada" },
  { id: "spartan", en: "Spartan helmet", sl: "Spartanska čelada" },
  { id: "nvg", en: "Night-vision goggles", sl: "Naprava za nočno gledanje" },
  { id: "respirator", en: "Respirator", sl: "Maska" },
  { id: "balaclava", en: "Balaclava", sl: "Kukla" },
  { id: "dogtags", en: "Dog tags", sl: "Vojaški ploščici" },
  { id: "crosshair", en: "Crosshair", sl: "Merek" },
  { id: "binoculars", en: "Binoculars", sl: "Daljnogled" },
  { id: "compass", en: "Compass", sl: "Kompas" },
  { id: "radio", en: "Radio", sl: "Radijska postaja" },
  { id: "chevron", en: "Rank chevron", sl: "Čin" },
  { id: "chevrons", en: "Double chevron", sl: "Dvojni čin" },
  { id: "shield", en: "Shield", sl: "Ščit" },
  { id: "wolf", en: "Wolf", sl: "Volk" },
  { id: "eagle", en: "Eagle", sl: "Orel" },
  { id: "bear", en: "Bear", sl: "Medved" },
  { id: "fox", en: "Fox", sl: "Lisica" },
  { id: "boot", en: "Combat boot", sl: "Škorenj" },
  { id: "backpack", en: "Backpack", sl: "Nahrbtnik" },
  { id: "smoke", en: "Smoke signal", sl: "Dimni signal" },
] as const;

/** Muted tones for the dark UI; each passes 4.5:1 on its own 0.18 tint over #0b0d09. */
export const AVATAR_COLORS = [
  { id: "olive", hex: "#9DAA5C", en: "Olive", sl: "Olivna" },
  { id: "gold", hex: "#E0B04E", en: "Gold", sl: "Zlata" },
  { id: "steel", hex: "#7FA3C7", en: "Steel blue", sl: "Jeklено modra" },
  { id: "sand", hex: "#D2BF94", en: "Sand", sl: "Peščena" },
  { id: "rust", hex: "#D4825A", en: "Rust", sl: "Rja" },
  { id: "slate", hex: "#9AA3AE", en: "Slate", sl: "Skrilasta" },
  { id: "teal", hex: "#5FB3A6", en: "Teal", sl: "Turkizna" },
  { id: "plum", hex: "#B98BB5", en: "Plum", sl: "Slivova" },
] as const;

export type AvatarIconId = (typeof AVATAR_ICONS)[number]["id"];
export type AvatarColorId = (typeof AVATAR_COLORS)[number]["id"];

export function isAvatarIcon(x: unknown): x is AvatarIconId {
  return typeof x === "string" && AVATAR_ICONS.some((i) => i.id === x);
}
export function isAvatarColor(x: unknown): x is AvatarColorId {
  return typeof x === "string" && AVATAR_COLORS.some((c) => c.id === x);
}
export function avatarHex(id: unknown): string | null {
  return AVATAR_COLORS.find((c) => c.id === id)?.hex ?? null;
}
