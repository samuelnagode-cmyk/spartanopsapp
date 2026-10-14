import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useHasProfile } from "@/lib/use-signed-in";
import { AccountSwitch } from "@/components/AccountSwitch";
import { PlayerAuth } from "@/components/PlayerAuth";
import { MyEvents } from "@/components/events/MyEvents";
import { MyGames } from "@/components/MyGames";

export const Route = createFileRoute("/me_/games")({
  head: () => ({
    meta: [
      { title: "My games — SpartanOps" },
      { name: "description", content: "Events you are going to and missions you have played on SpartanOps." },
      { property: "og:title", content: "My games — SpartanOps" },
      { property: "og:description", content: "Events you are going to and missions you have played on SpartanOps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyGamesPage,
});

const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";

function MyGamesPage() {
  const { lang } = useLang();
  const en = lang === "en";
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const hasProfile = useHasProfile();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "110px 16px 48px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Michroma', monospace", fontSize: 16, letterSpacing: "0.18em", textAlign: "center", textTransform: "uppercase", marginBottom: 20 }}>{en ? "My games" : "Moje igre"}</h1>
        {signedIn && <AccountSwitch current="games" />}
        {signedIn === null || (signedIn && hasProfile === null) ? (
          <p style={{ textAlign: "center", fontFamily: "monospace", opacity: 0.7 }}>…</p>
        ) : !signedIn ? (
          <div style={{ background: PANEL, border: `1px solid ${ACCENT}44`, padding: "24px 20px" }}>
            <p style={{ fontFamily: "monospace", fontSize: 13.5, lineHeight: 1.7, marginBottom: 20, textAlign: "center" }}>
              {en ? "Join events, see who is going, share a ride. You do not need an account to play a game." : "Prijavi se na dogodke, poglej, kdo pride, in deli prevoz. Za igranje igre računa ne potrebuješ."}
            </p>
            <PlayerAuth initialTab="signin" next="/me/games" onDone={() => navigate({ to: "/me/games" })} />
          </div>
        ) : !hasProfile ? (
          <div style={{ background: PANEL, border: `1px solid ${ACCENT}44`, padding: "20px 18px", textAlign: "center" }}>
            <p style={{ fontFamily: "monospace", fontSize: 13, marginBottom: 14 }}>{en ? "Create your profile to join events and games" : "Ustvari profil, da se lahko prijaviš na dogodke in igre"}</p>
            <Link to="/me" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "0 18px", background: ACCENT, color: BG, fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", textDecoration: "none" }}>{en ? "My account" : "Moj račun"}</Link>
          </div>
        ) : (
          <>
            <MyEvents lang={en ? "en" : "sl"} />
            <MyGames en={en} />
          </>
        )}
      </div>
    </main>
  );
}
