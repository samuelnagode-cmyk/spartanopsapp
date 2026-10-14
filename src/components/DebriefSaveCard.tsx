import { useGateAuth } from "@/components/ProfileOfferCard";

const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const PANEL = "#13160f";
const BG = "#0b0d09";
const MUTED = "rgba(236,227,196,0.65)";
const SAVE_URL = "/me?from=game&next=%2Fme%2Fgames";

export type DebriefMe = { callsign: string; teamName: string; teamColor: string; captures: number; deaths: number | null };

/** Debrief offer: save this game to an account, or confirm it was saved. */
export function DebriefSaveCard({ en, me }: { en: boolean; me?: DebriefMe }) {
  const [auth] = useGateAuth();
  if (auth.status === "loading" || auth.status === "error") return null;
  if (auth.status === "profile" && !auth.d.linkGames) return null;

  const headline = auth.status === "profile" ? (en ? "SAVED TO YOUR GAMES" : "SHRANJENO V MOJE IGRE") : (en ? "SAVE THIS GAME" : "SHRANI TO IGRO");
  const h = { fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.16em", color: ACCENT, margin: "0 0 8px", fontWeight: 700 };
  const body = { fontFamily: "monospace", fontSize: 12, lineHeight: 1.55, color: INK, margin: "0 0 12px" };
  const small = { fontFamily: "monospace", fontSize: 11.5, color: MUTED, lineHeight: 1.5 };

  return (
    <section aria-label={headline} style={{ background: PANEL, border: `1px solid ${ACCENT}44`, padding: "14px 16px", margin: "0 auto 18px", maxWidth: 520, width: "100%", boxSizing: "border-box" }}>
      {me && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px", borderLeft: `4px solid ${me.teamColor}`, paddingLeft: 10, marginBottom: 12, fontFamily: "monospace", fontSize: 12, color: INK }}>
          <strong style={{ fontWeight: 700 }}>{me.callsign}</strong>
          <span style={{ color: me.teamColor }}>{me.teamName}</span>
          <span>{me.captures} {en ? "captures" : "zavzetij"}</span>
          {me.deaths !== null && <span>{me.deaths} {en ? "deaths" : "smrti"}</span>}
        </div>
      )}

      {auth.status === "profile" ? (
        <div role="status" style={{ marginBottom: 12 }}>
          <p style={h}>{headline}</p>
          <a href="/me/games" style={{ ...small, color: ACCENT }}>{en ? "Open My games" : "Odpri Moje igre"}</a>
        </div>
      ) : (
        <>
          <p style={h}>{headline}</p>
          <p style={body}>
            {auth.status === "anon"
              ? (en ? "Create a free account and this game goes into your history: captures, deaths, wins. Next time you join with one tap." : "Ustvari brezplačen račun in ta igra gre v tvojo zgodovino: zavzetja, smrti, zmage. Naslednjič vstopiš z enim dotikom.")
              : (en ? "Create your player profile and this game goes into your history." : "Ustvari igralski profil in ta igra gre v tvojo zgodovino.")}
          </p>
          <a href={SAVE_URL} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "10px 14px", background: ACCENT, color: BG, textDecoration: "none", fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.16em", fontWeight: 700, textAlign: "center" }}>
            {auth.status === "anon" ? (en ? "CREATE ACCOUNT AND SAVE" : "USTVARI RAČUN IN SHRANI") : (en ? "CREATE PROFILE AND SAVE" : "USTVARI PROFIL IN SHRANI")}
          </a>
          {auth.status === "anon" && (
            <>
              <p style={{ ...small, textAlign: "center", margin: "10px 0 4px" }}>
                <a href={SAVE_URL} style={{ color: MUTED, display: "inline-block", padding: "6px 0" }}>{en ? "Already have an account? Sign in" : "Že imaš račun? Prijava"}</a>
              </p>
              <p style={{ ...small, textAlign: "center", margin: "0 0 12px" }}>
                {en ? "You will get a confirmation email. Open it on this phone." : "Dobil boš potrditveno e-pošto. Odpri jo na tem telefonu."}
              </p>
            </>
          )}
          {auth.status === "noprofile" && <div style={{ height: 12 }} />}
        </>
      )}

      <p style={{ ...small, margin: 0, display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'Michroma', monospace", fontSize: 9, letterSpacing: "0.16em", color: ACCENT, border: `1px solid ${ACCENT}66`, padding: "2px 6px" }}>{en ? "SOON" : "KMALU"}</span>
        <span>{en ? "Player ranking is coming. Saved games will be ready for it." : "Lestvica igralcev prihaja. Shranjene igre bodo pripravljene nanjo."}</span>
      </p>
    </section>
  );
}
