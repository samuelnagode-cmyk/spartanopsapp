import { Link } from "@tanstack/react-router";
import { useHasProfile, useIsMarshalKnown } from "@/lib/use-signed-in";
import { useLang } from "@/lib/i18n";

const ACCENT = "#E0B04E";
const INK = "#ece3c4";

/**
 * Up to three segments: My account (/me), My games (/me/games, needs a profile), Field (/marshal-account, needs a field).
 * Renders only once both states are known, and nothing when only one segment would show.
 */
export function AccountSwitch({ current }: { current: "account" | "games" | "field" }) {
  const isMarshal = useIsMarshalKnown();
  const hasProfile = useHasProfile();
  const { lang } = useLang();
  const en = lang === "en";
  if (isMarshal === null || hasProfile === null) return null;
  const segs: { key: typeof current; to: "/me" | "/me/games" | "/marshal-account"; label: string }[] = [
    { key: "account", to: "/me", label: en ? "My account" : "Račun" },
    ...(hasProfile ? [{ key: "games" as const, to: "/me/games" as const, label: en ? "My games" : "Moje igre" }] : []),
    ...(isMarshal ? [{ key: "field" as const, to: "/marshal-account" as const, label: en ? "Field" : "Poligon" }] : []),
  ];
  if (segs.length < 2) return null;
  const seg = (active: boolean) => ({
    flex: "1 1 0", minWidth: 0, minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Michroma', monospace", fontSize: segs.length === 3 ? 9 : 10, letterSpacing: segs.length === 3 ? "0.08em" : "0.18em",
    textTransform: "uppercase" as const, whiteSpace: "nowrap" as const,
    textDecoration: "none", padding: "0 4px", textAlign: "center" as const,
    border: `1px solid ${active ? ACCENT : `${ACCENT}44`}`,
    background: active ? `${ACCENT}22` : "transparent",
    color: active ? ACCENT : INK,
  });
  const ring = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E0B04E]";
  return (
    <nav aria-label={en ? "Account sections" : "Razdelki računa"} style={{ display: "flex", gap: 6, maxWidth: 520, width: "100%", margin: "0 auto 18px" }}>
      {segs.map((s) => (
        <Link key={s.key} to={s.to} className={ring} aria-current={current === s.key ? "page" : undefined} style={seg(current === s.key)}>{s.label}</Link>
      ))}
    </nav>
  );
}
