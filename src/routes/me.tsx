import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { playerGetMine } from "@/lib/player.functions";
import { safeNext } from "@/lib/player-validation";
import { PlayerAuth } from "@/components/PlayerAuth";
import { PlayerProfileForm, ProfilePreview, type PlayerProfile } from "@/components/PlayerProfileForm";

export const Route = createFileRoute("/me")({
  validateSearch: (s: Record<string, unknown>) => ({ next: typeof s.next === "string" ? s.next : undefined }),
  head: () => ({
    meta: [
      { title: "Player profile — SpartanOps" },
      { name: "description", content: "Your SpartanOps player profile: callsign, loadout and privacy tools for airsoft events." },
      { property: "og:title", content: "Player profile — SpartanOps" },
      { property: "og:description", content: "Your SpartanOps player profile: callsign, loadout and privacy tools for airsoft events." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MePage,
});

const BG = "#0b0d09";
const PANEL = "#13160f";
const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const OK = "#9eff3d";

type Mine = { profile: PlayerProfile | null; needsReconsent: boolean; isMarshal: boolean };

function MePage() {
  const { lang } = useLang();
  const en = lang === "en";
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const getMine = useServerFn(playerGetMine);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [mine, setMine] = useState<Mine | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setSignedIn(false); setMine(null); return; }
    setSignedIn(true);
    try {
      const r = await getMine({ data: { accessToken: data.session.access_token } });
      setMine({ profile: r.profile as PlayerProfile | null, needsReconsent: r.needsReconsent, isMarshal: r.isMarshal });
    } catch { setSignedIn(false); }
  }, [getMine]);

  useEffect(() => {
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void load();
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const title = en ? "Player profile" : "Igralski profil";

  return (
    <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "110px 16px 48px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Michroma', monospace", fontSize: 16, letterSpacing: "0.18em", textAlign: "center", textTransform: "uppercase", marginBottom: 20 }}>{title}</h1>
        {notice && <p role="status" style={{ color: OK, fontFamily: "monospace", fontSize: 13, textAlign: "center", marginBottom: 16 }}>{notice}</p>}
        {signedIn === null || (signedIn && !mine) ? (
          <p style={{ textAlign: "center", fontFamily: "monospace", opacity: 0.7 }}>…</p>
        ) : !signedIn ? (
          <div style={{ background: PANEL, border: `1px solid ${ACCENT}44`, padding: "24px 20px" }}>
            <p style={{ fontFamily: "monospace", fontSize: 13.5, lineHeight: 1.7, marginBottom: 20, textAlign: "center" }}>
              {en ? "Join events, see who is going, share a ride. You do not need an account to play a game." : "Prijavi se na dogodke, poglej, kdo pride, in deli prevoz. Za igranje igre računa ne potrebuješ."}
            </p>
            <PlayerAuth next={next} onDone={() => { const n = safeNext(next); if (n) navigate({ to: n as never }); }} />
            <p style={{ textAlign: "center", marginTop: 18, fontFamily: "monospace", fontSize: 12 }}>
              <Link to="/privacy" style={{ color: ACCENT }}>{en ? "Privacy" : "Zasebnost"}</Link>{"  ·  "}
              <Link to="/terms" style={{ color: ACCENT }}>{en ? "Terms" : "Pogoji"}</Link>
            </p>
          </div>
        ) : mine && (
          <>
            {mine.isMarshal && (
              <p style={{ fontFamily: "monospace", fontSize: 12.5, textAlign: "center", marginBottom: 14 }}>
                {en ? "You also run a field: " : "Vodiš tudi poligon: "}
                <Link to="/marshal-account" style={{ color: ACCENT }}>{en ? "Field settings →" : "Nastavitve poligona →"}</Link>
              </p>
            )}
            {mine.profile && !mine.needsReconsent && <ProfilePreview p={mine.profile} en={en} />}
            {mine.needsReconsent && (
              <p style={{ fontFamily: "monospace", fontSize: 12.5, color: ACCENT, textAlign: "center", marginBottom: 14 }}>
                {en ? "Our Privacy notice changed. Please confirm it below to keep your profile." : "Obvestilo o zasebnosti se je spremenilo. Za ohranitev profila ga spodaj potrdi."}
              </p>
            )}
            <PlayerProfileForm
              key={mine.profile ? "edit" : "new"}
              en={en}
              initial={mine.profile}
              needsConsent={!mine.profile || mine.needsReconsent}
              onSaved={(p) => setMine({ ...mine, profile: p, needsReconsent: false })}
              onDeleted={(kept) => {
                setNotice(kept
                  ? (en ? "Your profile was deleted. Your field login was kept." : "Tvoj profil je izbrisan. Prijava za poligon je ohranjena.")
                  : (en ? "Your profile and login were deleted." : "Tvoj profil in prijava sta izbrisana."));
                void load();
              }}
            />
          </>
        )}
      </div>
    </main>
  );
}
