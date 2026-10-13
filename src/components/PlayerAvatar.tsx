import type { ReactNode } from "react";
import { Backpack, Binoculars, Compass, Crosshair, Radio, Shield } from "lucide-react";
import { AVATAR_ICONS, avatarHex, type AvatarIconId } from "@/lib/avatars";

/** Same hue as the existing initial avatars (attendee list), so screens without an avatar do not change. */
export function initialColour(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 38%)`;
}

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const svg = (children: ReactNode) => (size: number) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...S} aria-hidden="true">{children}</svg>
);

/** Custom icons drawn in the Lucide style (24 grid, 2px round stroke). */
const CUSTOM: Partial<Record<AvatarIconId, (size: number) => ReactNode>> = {
  helmet: svg(<><path d="M3 15a9 9 0 0 1 18 0" /><path d="M2 15h20" /><path d="M7 15v3h10v-3" /><path d="M12 6v4" /></>),
  spartan: svg(<><path d="M7 5c3-3 7-3 10 0" /><path d="M5 21V11a7 7 0 0 1 14 0v10h-4v-6h-2v-4h-2v4H9v6z" /></>),
  nvg: svg(<><path d="M4 9h16v4H4z" /><circle cx="8" cy="17" r="3" /><circle cx="16" cy="17" r="3" /><path d="M12 9V4" /></>),
  balaclava: svg(<><path d="M5 22v-11a7 7 0 0 1 14 0v11" /><path d="M7 11h10v3H7z" /><path d="M10 18h4" /></>),
  dogtags: svg(<><path d="M8 3l2 5" /><path d="M16 3l-2 5" /><rect x="5" y="8" width="7" height="12" rx="2.5" /><rect x="12" y="10" width="7" height="12" rx="2.5" /></>),
  chevron: svg(<path d="M4 16l8-6 8 6" />),
  chevrons: svg(<><path d="M4 13l8-6 8 6" /><path d="M4 19l8-6 8 6" /></>),
  wolf: svg(<><path d="M5 3l3 6h8l3-6v9l-7 9-7-9z" /><circle cx="9.5" cy="12" r="0.6" fill="currentColor" /><circle cx="14.5" cy="12" r="0.6" fill="currentColor" /></>),
  bear: svg(<><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="13" r="7.5" /><path d="M10.5 15.5h3l-1.5 1.5z" /></>),
  fox: svg(<><path d="M3 3l5 6h8l5-6-1 8-8 10-8-10z" /><path d="M8 13l4 3 4-3" /></>),
  boot: svg(<><path d="M7 3h6v10l6 3c1.5.7 2 2 2 3v1H3V3z" /><path d="M3 17h18" /><path d="M7 7h3" /><path d="M7 10h3" /></>),
  smoke: svg(<><rect x="9" y="15" width="6" height="7" rx="1" /><path d="M7 12a3 3 0 0 1 1-6 4 4 0 0 1 7.5 0A3 3 0 0 1 17 12z" /></>),
};
const LUCIDE: Partial<Record<AvatarIconId, typeof Crosshair>> = {
  crosshair: Crosshair, binoculars: Binoculars, compass: Compass, radio: Radio, shield: Shield, backpack: Backpack,
};

export function AvatarGlyph({ icon, size }: { icon: AvatarIconId; size: number }) {
  const L = LUCIDE[icon];
  if (L) return <L size={size} strokeWidth={2} aria-hidden="true" />;
  return <>{CUSTOM[icon]?.(size)}</>;
}

/**
 * Round player avatar. With an icon + colour: ring and 0.18 tint in the colour, icon at 55%.
 * Without: the initial letter exactly like the existing attendee avatar.
 */
export function PlayerAvatar({ icon, color, name, size, labelled = false, lang = "sl", ink = "#ece3c4" }: {
  icon: string | null | undefined; color: string | null | undefined; name: string; size: number;
  labelled?: boolean; lang?: "en" | "sl"; ink?: string;
}) {
  const hex = avatarHex(color);
  const meta = AVATAR_ICONS.find((i) => i.id === icon);
  const a11y = labelled ? { role: "img", "aria-label": meta ? `${name}: ${lang === "en" ? meta.en : meta.sl}` : name } : { "aria-hidden": true };
  const base = { width: size, height: size, minWidth: size, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxSizing: "border-box" as const };
  if (meta && hex) {
    return (
      <span {...a11y} style={{ ...base, border: `1px solid ${hex}`, background: `${hex}2E`, color: hex }}>
        <AvatarGlyph icon={meta.id} size={Math.round(size * 0.55)} />
      </span>
    );
  }
  return (
    <span {...a11y} style={{ ...base, background: initialColour(name), color: ink, fontFamily: "'Michroma', monospace", fontSize: Math.round(size * 0.36) }}>
      {Array.from(name.trim())[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
