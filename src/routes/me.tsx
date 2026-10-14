import { AccountSwitch } from "@/components/AccountSwitch";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { eventRsvpSet } from "@/lib/event-rsvps.functions";
import { playerClaimDevice, playerGetMine } from "@/lib/player.functions";
import { claimDeviceOnce } from "@/components/ProfileOfferCard";
import { safeNext } from "@/lib/player-validation";
import { PlayerAuth } from "@/components/PlayerAuth";
import { FieldCreateCard } from "@/components/FieldCreateCard";
import type { User } from "@supabase/supabase-js";
import { PlayerProfileForm, ProfilePreview, type PlayerProfile, type ProfilePrefill } from "@/components/PlayerProfileForm";

export const Route = createFileRoute("/me")({
  validateSearch: (s: Record<string, unknown>): { next?: string; from?: string; rsvp?: "going" | "maybe" } => ({
    ...(typeof s.next === "string" ? { next: s.next } : {}),
    ...(s.rsvp === "going" || s.rsvp === "maybe" ? { rsvp: s.rsvp } : {}),
    ...(s.from === "game" ? { from: "game" } : {}),
  }),
  head: () => ({
    meta: [
      { title: "My account — SpartanOps" },
      { name: "description", content: "Your SpartanOps account and profile: callsign, loadout and privacy tools for airsoft events." },
      { property: "og:title", content: "My account — SpartanOps" },
      { property: "og:description", content: "Your SpartanOps account and profile: callsign, loadout and privacy tools for airsoft events." },
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
  const { next, from, rsvp } = Route.useSearch();
  const setRsvp = useServerFn(eventRsvpSet);
  // Only an exact event path may receive a deferred answer from the URL.
  const rsvpEventId = rsvp && typeof next === "string" ? (/^\/events\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(next)?.[1] ?? null) : null;
  const claim = useServerFn(playerClaimDevice);
  const [prefill, setPrefill] = useState<ProfilePrefill | null>(null);
  const backToMission = safeNext(next)?.startsWith("/misija") ? safeNext(next) : null;
  useEffect(() => {
    try {
      const raw = localStorage.getItem("spartanops:player-profile");
      if (!raw) return;
      const g = JSON.parse(raw) as Record<string, string>;
      setPrefill({ nickname: g.callsign || undefined, first_name: g.firstName || undefined, last_initial: g.lastInitial || undefined,
        club: g.club || undefined, phone: g.phone || undefined, experience_level: g.experience || undefined, operator_type: g.operatorType || undefined });
    } catch { /* ignore */ }
  }, []);
  const navigate = useNavigate();
  const getMine = useServerFn(playerGetMine);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [mine, setMine] = useState<Mine | null>(null);
  const [notice, setNotice] = useState<ReactNode>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setSignedIn(false); setMine(null); return; }
    setSignedIn(true);
    try {
      const r = await getMine({ data: { accessToken: data.session.access_token } });
      setMine({ profile: r.profile as PlayerProfile | null, needsReconsent: r.needsReconsent, isMarshal: r.isMarshal });
      const prof = r.profile as PlayerProfile | null;
      if (prof?.link_games && !r.needsReconsent) void claimDeviceOnce(claim, data.session.user.id, data.session.access_token);
    } catch { setSignedIn(false); }
  }, [getMine, claim]);

  useEffect(() => {
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void load();
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const title = en ? "My account" : "Moj račun";
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null)); }, [signedIn]);

  return (
    <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "110px 16px 48px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Michroma', monospace", fontSize: 16, letterSpacing: "0.18em", textAlign: "center", textTransform: "uppercase", marginBottom: 20 }}>{title}</h1>
        {signedIn && <AccountSwitch current="account" />}
        {notice && <p role="status" style={{ color: OK, fontFamily: "monospace", fontSize: 13, textAlign: "center", marginBottom: 16 }}>{notice}</p>}
        {signedIn === null || (signedIn && !mine) ? (
          <p style={{ textAlign: "center", fontFamily: "monospace", opacity: 0.7 }}>…</p>
        ) : !signedIn ? (
          <div style={{ background: PANEL, border: `1px solid ${ACCENT}44`, padding: "24px 20px" }}>
            <p style={{ fontFamily: "monospace", fontSize: 13.5, lineHeight: 1.7, marginBottom: 20, textAlign: "center" }}>
              {en ? "Join events, see who is going, share a ride. You do not need an account to play a game." : "Prijavi se na dogodke, poglej, kdo pride, in deli prevoz. Za igranje igre računa ne potrebuješ."}
            </p>
            {from === "game" && (
              <p style={{ fontFamily: "monospace", fontSize: 12.5, color: ACCENT, textAlign: "center", marginBottom: 14 }}>
                {en ? "We filled in what you already told us. Check it and add your email." : "Izpolnili smo, kar si že vpisal. Preveri in dodaj e-pošto."}
              </p>
            )}
            <PlayerAuth initialTab={from === "game" ? "signup" : "signin"} next={next} rsvp={rsvpEventId ? rsvp : undefined} onDone={async () => {
              if (from === "game") {
                try {
                  const { data: s1 } = await supabase.auth.getSession();
                  if (s1.session) await claimDeviceOnce(claim, s1.session.user.id, s1.session.access_token, true);
                } catch { /* profile may not exist yet; claim runs after save */ }
              }
              const n = safeNext(next); if (n) navigate({ to: n as never });
            }} />
            <p style={{ textAlign: "center", marginTop: 18, fontFamily: "monospace", fontSize: 12 }}>
              <Link to="/privacy" style={{ color: ACCENT }}>{en ? "Privacy" : "Zasebnost"}</Link>{"  ·  "}
              <Link to="/terms" style={{ color: ACCENT }}>{en ? "Terms" : "Pogoji"}</Link>
            </p>
            <p style={{ textAlign: "center", marginTop: 12, fontFamily: "monospace", fontSize: 12, opacity: 0.85 }}>
              <Link to="/marshal-account" style={{ color: ACCENT }}>{en ? "Do you run an airsoft field? Register your field here →" : "Vodiš airsoft poligon? Registriraj poligon tukaj →"}</Link>
            </p>
          </div>
        ) : mine && (
          <>
            {!mine.isMarshal && user && (
              <FieldCreateCard collapsible user={user} en={en} onCreated={() => setMine({ ...mine, isMarshal: true })} />
            )}
            {mine.profile && !mine.needsReconsent && <ProfilePreview p={mine.profile} en={en} />}
            {mine.needsReconsent && (
              <p style={{ fontFamily: "monospace", fontSize: 12.5, color: ACCENT, textAlign: "center", marginBottom: 14 }}>
                {en ? "Our Privacy notice changed. Please confirm it below to keep your profile." : "Obvestilo o zasebnosti se je spremenilo. Za ohranitev profila ga spodaj potrdi."}
              </p>
            )}
            {rsvpEventId && rsvp && (!mine.profile || mine.needsReconsent) && (
              <p role="status" style={{ fontFamily: "monospace", fontSize: 13, color: ACCENT, textAlign: "center", marginBottom: 14, border: `1px solid ${ACCENT}55`, padding: "10px 12px" }}>
                {en ? `After you save, you'll be marked as: ${rsvp === "going" ? "Going" : "Maybe"} for this event.` : `Po shranjevanju boš označen kot: ${rsvp === "going" ? "Pridem" : "Morda"} za ta dogodek.`}
              </p>
            )}
            <PlayerProfileForm
              key={mine.profile ? "edit" : "new"}
              en={en}
              initial={mine.profile}
              prefill={mine.profile ? null : prefill}
              needsConsent={!mine.profile || mine.needsReconsent}
              onSaved={async (p) => {
                const wasNew = !mine.profile;
                setMine({ ...mine, profile: p, needsReconsent: false });
                if (wasNew) {
                  try { localStorage.removeItem("spartanops:profile-offer-dismissed"); } catch { /* ignore */ }
                  const { data: s2 } = await supabase.auth.getSession();
                  if (p.link_games !== false && s2.session) {
                    const n = await claimDeviceOnce(claim, s2.session.user.id, s2.session.access_token, true);
                    setNotice(<>{en ? `Saved.${n ? ` ${n} earlier games on this phone were added to My games.` : ""}` : `Shranjeno.${n ? ` ${n} prejšnjih iger na tem telefonu je dodanih v Moje igre.` : ""}`}{n ? <>{" "}<Link to="/me/games" style={{ color: ACCENT }}>{en ? "Open My games" : "Odpri Moje igre"}</Link></> : null}</>);
                  }
                }
                if (rsvpEventId && rsvp) {
                  let code: string | null = null;
                  try {
                    const { data: s3 } = await supabase.auth.getSession();
                    await setRsvp({ data: { accessToken: s3.session?.access_token ?? "", eventId: rsvpEventId, status: rsvp, phoneShare: "none", rideRole: "none" } });
                  } catch (e) {
                    const m = e instanceof Error ? e.message : "";
                    code = ["full", "event_closed", "event_over", "not_found"].includes(m) ? m : m.startsWith("minor") ? "minor" : "failed";
                  }
                  navigate({ to: next as never, search: (code ? { rsvpError: code } : {}) as never });
                  return;
                }
                const n = safeNext(next);
                if (n && !backToMission) navigate({ to: n as never });
              }}
              onDeleted={(kept) => {
                setNotice(kept
                  ? (en ? "Your profile was deleted. Your field login was kept." : "Tvoj profil je izbrisan. Prijava za poligon je ohranjena.")
                  : (en ? "Your profile and login were deleted." : "Tvoj profil in prijava sta izbrisana."));
                void load();
              }}
            />
            {backToMission && mine.profile && !mine.needsReconsent && (
              <a href={backToMission} style={{ display: "block", textAlign: "center", background: ACCENT, color: BG, padding: 14, minHeight: 44, fontFamily: "'Michroma', monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, textDecoration: "none", marginTop: 14 }}>
                {en ? "Back to mission" : "Nazaj na misijo"}
              </a>
            )}
          </>
        )}
      </div>
    </main>
  );
}

