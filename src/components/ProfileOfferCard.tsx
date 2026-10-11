import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { playerCheckinDefaults, playerClaimDevice, playerGetMine } from "@/lib/player.functions";

const ACCENT = "#E0B04E";
const INK = "#ece3c4";
const PANEL = "#13160f";
const BG = "#0b0d09";
const MUTED = "rgba(236,227,196,0.65)";
const DISMISS_KEY = "spartanops:profile-offer-dismissed";
const SHARE_KEY = "spartanops:share-phone-marshal";
const DAY = 86_400_000;

export const currentUrl = () => (typeof window === "undefined" ? "/" : window.location.pathname + window.location.search);

export type GateDefaults = {
  callsign: string; firstName: string; lastInitial: string | null; club: string | null;
  adult: boolean; hasPhone: boolean; linkGames: boolean;
};
export type GateAuth =
  | { status: "loading" | "anon" }
  | { status: "error"; email: string | null }
  | { status: "noprofile"; email: string | null }
  | { status: "profile"; email: string | null; token: string; userId: string; d: GateDefaults; needsReconsent: boolean };

/** Silent one-time claim of this phone's earlier games, per user. */
export async function claimDeviceOnce(claim: (a: { data: { accessToken: string; sessionId: string } }) => Promise<{ claimed: number }>, userId: string, token: string, force = false): Promise<number | null> {
  const key = `spartanops:device-claimed:${userId}`;
  try { if (!force && localStorage.getItem(key)) return null; } catch { return null; }
  let sid = "";
  try { sid = localStorage.getItem("spartanops:session_id") ?? ""; } catch { /* ignore */ }
  if (sid.length < 8) return null;
  try {
    const r = await claim({ data: { accessToken: token, sessionId: sid } });
    try { localStorage.setItem(key, String(Date.now())); } catch { /* ignore */ }
    return r.claimed;
  } catch { return null; }
}

/** Reads the session and the player's gate defaults. Never blocks: failures fall back to the anonymous form. */
export function useGateAuth(): [GateAuth, () => void] {
  const getDefaults = useServerFn(playerCheckinDefaults);
  const getMine = useServerFn(playerGetMine);
  const claim = useServerFn(playerClaimDevice);
  const [auth, setAuth] = useState<GateAuth>({ status: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const s = data.session;
      if (!s) { if (alive) setAuth({ status: "anon" }); return; }
      const email = s.user.email ?? null;
      try {
        const [d, mine] = await Promise.all([
          getDefaults({ data: { accessToken: s.access_token } }),
          getMine({ data: { accessToken: s.access_token } }),
        ]);
        if (!alive) return;
        if (d.profile === false) { setAuth({ status: "noprofile", email }); return; }
        setAuth({ status: "profile", email, token: s.access_token, userId: s.user.id, needsReconsent: mine.needsReconsent, d: d as unknown as GateDefaults });
        if (d.linkGames && !mine.needsReconsent) void claimDeviceOnce(claim, s.user.id, s.access_token);
      } catch { if (alive) setAuth({ status: "error", email }); }
    };
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") void load(); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [getDefaults, getMine, claim, tick]);
  return [auth, () => setTick((t) => t + 1)];
}

export function readSharePhone(): boolean {
  try { return localStorage.getItem(SHARE_KEY) === "1"; } catch { return false; }
}
export function writeSharePhone(v: boolean) {
  try { localStorage.setItem(SHARE_KEY, v ? "1" : "0"); } catch { /* ignore */ }
}

const btn = { minHeight: 44, padding: "10px 14px", fontFamily: "'Michroma', monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" as const, cursor: "pointer", fontWeight: 700 };

/** After an anonymous check-in: one quiet offer to save the details as a player profile. */
export function ProfileOfferCard({ en }: { en: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      const t = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      if (t && Date.now() - t < 30 * DAY) return;
    } catch { return; }
    void supabase.auth.getSession().then(({ data }) => { if (alive && !data.session) setShow(true); });
    return () => { alive = false; };
  }, []);
  if (!show) return null;
  return (
    <div style={{ background: PANEL, border: `1px solid ${ACCENT}44`, padding: "12px 14px", margin: "0 auto 18px", maxWidth: 520, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <p style={{ flex: "1 1 220px", fontFamily: "monospace", fontSize: 12, lineHeight: 1.5, color: INK, margin: 0 }}>
        {en ? "Join your next game or event in one tap. Save these details as your player profile." : "Pri naslednji igri ali dogodku se pridruži z enim dotikom. Shrani te podatke kot svoj igralski profil."}
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <a href={`/me?from=game&next=${encodeURIComponent(currentUrl())}`} style={{ ...btn, background: ACCENT, color: BG, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          {en ? "Save profile" : "Shrani profil"}
        </a>
        <button type="button" onClick={() => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ } setShow(false); }}
          style={{ ...btn, background: "transparent", color: MUTED, border: `1px solid ${ACCENT}33` }}>
          {en ? "Not now" : "Ne zdaj"}
        </button>
      </div>
    </div>
  );
}
