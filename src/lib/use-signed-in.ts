import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { playerGetMine } from "@/lib/player.functions";

/** Fired on window after a field row is created, so marshal-aware UI updates without a reload. */
export const FIELD_CREATED_EVENT = "spartanops:field-created";

/** True when any login session exists (player or marshal). Updates on sign-in/sign-out. */
export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);
  return signedIn;
}

/** True only when signed in AND this login owns a field (a spartanops_accounts row). */
export function useIsMarshal(): boolean {
  const [isMarshal, setIsMarshal] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const check = async (userId: string | null) => {
      if (!userId) { if (!cancelled) setIsMarshal(false); return; }
      const { data } = await supabase.from("spartanops_accounts").select("id").eq("id", userId).maybeSingle();
      if (!cancelled) setIsMarshal(!!data);
    };
    const recheck = () => { supabase.auth.getSession().then(({ data }) => check(data.session?.user?.id ?? null)); };
    recheck();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void check(session?.user?.id ?? null);
    });
    window.addEventListener(FIELD_CREATED_EVENT, recheck);
    return () => { cancelled = true; sub.subscription.unsubscribe(); window.removeEventListener(FIELD_CREATED_EVENT, recheck); };
  }, []);
  return isMarshal;
}

/** Short label for the signed-in login: profile callsign, else the email part before "@". Null when signed out. */
export function useAccountLabel(): string | null {
  const getMine = useServerFn(playerGetMine);
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const s = data.session;
      if (!s) { if (!cancelled) setLabel(null); return; }
      const fallback = (s.user.email ?? "").split("@")[0] || null;
      if (!cancelled) setLabel(fallback);
      try {
        const r = await getMine({ data: { accessToken: s.access_token } });
        const nick = (r.profile as { nickname?: string } | null)?.nickname;
        if (!cancelled && nick) setLabel(nick);
      } catch { /* keep fallback */ }
    };
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void load();
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [getMine]);
  return label;
}
