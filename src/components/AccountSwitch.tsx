import { Link } from "@tanstack/react-router";
import { useIsMarshal } from "@/lib/use-signed-in";
import { useLang } from "@/lib/i18n";

const ACCENT = "#E0B04E";
const INK = "#ece3c4";

/**
 * Two-segment switch between the two halves of one login: My account (/me) and Field (/marshal-account).
 * Renders nothing unless the login owns a field; appears only once that is known (no reserved gap while loading).
 */
export function AccountSwitch({ current }: { current: "account" | "field" }) {
  const isMarshal = useIsMarshal();
  const { lang } = useLang();
  const en = lang === "en";
  if (!isMarshal) return null;
  const seg = (active: boolean) => ({
    flex: 1, minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase" as const,
    textDecoration: "none", padding: "0 8px", textAlign: "center" as const,
    border: `1px solid ${active ? ACCENT : `${ACCENT}44`}`,
    background: active ? `${ACCENT}22` : "transparent",
    color: active ? ACCENT : INK,
  });
  const ring = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E0B04E]";
  return (
    <nav aria-label={en ? "Account sections" : "Razdelki računa"} style={{ display: "flex", gap: 6, maxWidth: 520, width: "100%", margin: "0 auto 18px" }}>
      <Link to="/me" className={ring} aria-current={current === "account" ? "page" : undefined} style={seg(current === "account")}>
        {en ? "My account" : "Moj račun"}
      </Link>
      <Link to="/marshal-account" className={ring} aria-current={current === "field" ? "page" : undefined} style={seg(current === "field")}>
        {en ? "Field" : "Poligon"}
      </Link>
    </nav>
  );
}
