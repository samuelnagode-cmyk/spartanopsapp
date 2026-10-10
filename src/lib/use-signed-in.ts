import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    supabase.auth.getSession().then(({ data }) => check(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void check(session?.user?.id ?? null);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);
  return isMarshal;
}
