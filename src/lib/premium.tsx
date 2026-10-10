import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useT, useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useMasterAdmin } from "@/lib/master-admin";
import {
  foundingApplicationMailto, formatFoundingDate, limitsFor, resolveEffectivePlan,
  type PlanId, type PlanRow,
} from "@/lib/plans";

/**
 * Plan-aware access. The signed-in marshal's own plan row is read under RLS;
 * limits are enforced on the server, this only drives the UI.
 */
type PlanState = { plan: PlanId; planUntil: string | null; loading: boolean; accountId: string | null; fieldName: string | null };

type PremiumContextValue = {
  isPremium: boolean;
  openPremiumModal: () => void;
  closePremiumModal: () => void;
  planState: PlanState;
};

const FREE_STATE: PlanState = { plan: "free", planUntil: null, loading: false, accountId: null, fieldName: null };

const PremiumContext = createContext<PremiumContextValue>({
  isPremium: false,
  openPremiumModal: () => {},
  closePremiumModal: () => {},
  planState: FREE_STATE,
});

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [planState, setPlanState] = useState<PlanState>({ ...FREE_STATE, loading: true });
  const master = useMasterAdmin();

  useEffect(() => {
    let cancelled = false;
    const load = async (userId: string | null) => {
      if (!userId) { if (!cancelled) setPlanState(FREE_STATE); return; }
      const [{ data: row }, { data: acct }] = await Promise.all([
        supabase.from("spartanops_field_plans").select("plan, plan_until").eq("account_id", userId).maybeSingle(),
        supabase.from("spartanops_accounts").select("business_name, is_platform_showcase").eq("id", userId).maybeSingle(),
      ]);
      if (cancelled) return;
      const plan: PlanId = acct?.is_platform_showcase ? "pro" : resolveEffectivePlan((row as PlanRow) ?? null);
      setPlanState({
        plan,
        planUntil: row?.plan_until ?? null,
        loading: false,
        accountId: acct ? userId : null,
        fieldName: acct?.business_name ?? null,
      });
    };
    supabase.auth.getSession().then(({ data }) => load(data.session?.user?.id ?? null)).catch(() => load(null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void load(session?.user?.id ?? null);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const isPremium = master || planState.plan === "founding" || planState.plan === "pro";
  const openPremiumModal = useCallback(() => setModalOpen(true), []);
  const closePremiumModal = useCallback(() => setModalOpen(false), []);

  return (
    <PremiumContext.Provider value={{ isPremium, openPremiumModal, closePremiumModal, planState }}>
      {children}
      {modalOpen && <PremiumUpgradeModal onClose={closePremiumModal} planState={planState} />}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  const { isPremium, openPremiumModal, closePremiumModal } = useContext(PremiumContext);
  return { isPremium, openPremiumModal, closePremiumModal };
}

export function usePlan() {
  const { planState } = useContext(PremiumContext);
  return { plan: planState.plan, limits: limitsFor(planState.plan), planUntil: planState.planUntil, loading: planState.loading };
}

function PremiumUpgradeModal({ onClose, planState }: { onClose: () => void; planState: PlanState }) {
  const t = useT();
  const { lang } = useLang();
  const mailto = foundingApplicationMailto(lang, {
    fieldName: planState.fieldName ?? undefined,
    accountId: planState.accountId ?? undefined,
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 460, width: "100%",
          background: "linear-gradient(180deg, #14180f 0%, #0b0d09 100%)",
          border: "1px solid #E0B04E",
          boxShadow: "0 0 40px rgba(224,176,78,0.35), inset 0 0 0 1px rgba(224,176,78,0.08)",
          padding: "28px 24px 22px",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute", top: 8, right: 10,
            background: "transparent", border: "none",
            color: "#ece3c4", fontSize: 22, cursor: "pointer", lineHeight: 1,
          }}
        >
          ×
        </button>
        <div
          style={{
            fontFamily: "'Michroma', monospace",
            fontSize: 13,
            letterSpacing: "0.18em",
            color: "#E0B04E",
            textTransform: "uppercase",
            textShadow: "0 0 12px rgba(224,176,78,0.55)",
            marginBottom: 14,
          }}
        >
          {t("premium.modalTitle")}
        </div>
        <p
          style={{
            color: "#ece3c4", fontFamily: "monospace",
            fontSize: 13, lineHeight: 1.6, letterSpacing: "0.02em",
            marginBottom: 22,
          }}
        >
          {t("premium.modalDesc").replace("{date}", formatFoundingDate(lang))}
        </p>
        <a
          href={mailto}
          onClick={() => setTimeout(onClose, 100)}
          style={{
            display: "block", textAlign: "center",
            padding: "12px 14px",
            background: "#E0B04E", color: "#0b0d09",
            fontFamily: "'Michroma', monospace",
            fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
            fontWeight: 700, textDecoration: "none",
            boxShadow: "0 0 22px rgba(224,176,78,0.45)",
          }}
        >
          {t("premium.modalBtn")}
        </a>
      </div>
    </div>
  );
}

export function PremiumStatusBadge({ compact = false }: { compact?: boolean }) {
  const { isPremium } = usePremium();
  const t = useT();
  const label = isPremium ? t("premium.statusPremium") : t("premium.statusFree");
  const color = isPremium ? "#E0B04E" : "rgba(180,190,205,0.75)";
  const glow = isPremium ? "0 0 10px rgba(224,176,78,0.55)" : "none";
  return (
    <span
      title={label}
      style={{
        display: "inline-flex", alignItems: "center",
        fontFamily: "'Michroma', monospace",
        fontSize: compact ? 8.5 : 9.5,
        letterSpacing: "0.14em",
        color,
        textShadow: glow,
        border: `1px solid ${isPremium ? "rgba(224,176,78,0.55)" : "rgba(180,190,205,0.28)"}`,
        padding: compact ? "3px 6px" : "4px 8px",
        whiteSpace: "nowrap",
        background: isPremium ? "rgba(224,176,78,0.08)" : "transparent",
      }}
    >
      {label}
    </span>
  );
}
