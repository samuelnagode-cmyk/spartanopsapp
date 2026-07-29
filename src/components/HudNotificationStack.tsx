import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Non-intrusive tactical notification feed for the player HUD.
 * Max 3 cards, newest on top, slide in from the left, manual dismiss only.
 */

export type HudNotice = {
  id: string;
  kind: "capture" | "respawn";
  text: string;
  title: string;
  color: string;
  at: number;
};

const MAX_STACK = 3;

function fmtTime(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function fillTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? "");
}

export function useHudNotices() {
  const [notices, setNotices] = useState<HudNotice[]>([]);
  const push = useCallback((n: HudNotice) => {
    setNotices((prev) => [n, ...prev.filter((p) => p.id !== n.id)].slice(0, MAX_STACK));
  }, []);
  const dismiss = useCallback((id: string) => {
    setNotices((prev) => prev.filter((p) => p.id !== id));
  }, []);
  return { notices, push, dismiss };
}

export function HudNotificationStack({
  notices,
  onDismiss,
}: {
  notices: HudNotice[];
  onDismiss: (id: string) => void;
}) {
  const t = useT();
  if (notices.length === 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 96,
        zIndex: 55,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
        alignItems: "flex-start",
      }}
    >
      {notices.map((n) => (
        <NoticeCard key={n.id} notice={n} onDismiss={onDismiss} dismissLabel={t("hudNotif.dismiss")} />
      ))}
      <style>{`@keyframes sop-notice-in{from{opacity:0;transform:translateX(-110%)}to{opacity:1;transform:translateX(0)}}`}</style>
    </div>
  );
}

function NoticeCard({
  notice,
  onDismiss,
  dismissLabel,
}: {
  notice: HudNotice;
  onDismiss: (id: string) => void;
  dismissLabel: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.animation = "sop-notice-in 320ms cubic-bezier(0.16,1,0.3,1)";
  }, []);
  const c = notice.color;
  return (
    <div
      ref={ref}
      role="status"
      style={{
        pointerEvents: "auto",
        position: "relative",
        maxWidth: 320,
        width: "100%",
        background: "rgba(10,12,10,0.94)",
        border: `1px solid ${c}`,
        borderLeft: `3px solid ${c}`,
        boxShadow: `0 0 18px -6px ${c}, inset 0 0 24px -14px ${c}`,
        backdropFilter: "blur(6px)",
        padding: "9px 30px 9px 11px",
        transition: "transform 220ms ease, opacity 220ms ease",
      }}
    >
      <button
        type="button"
        aria-label={dismissLabel}
        onClick={() => onDismiss(notice.id)}
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          width: 22,
          height: 22,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: `1px solid ${c}66`,
          color: c,
          cursor: "pointer",
          lineHeight: 0,
        }}
      >
        <X size={12} strokeWidth={2.5} />
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span
          style={{
            fontFamily: "'Michroma', monospace",
            fontSize: 8,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: c,
            fontWeight: 700,
          }}
        >
          {notice.title}
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(236,227,196,0.5)", letterSpacing: "0.1em" }}>
          {fmtTime(notice.at)}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontFamily: "monospace",
          fontSize: 11,
          lineHeight: 1.5,
          color: "#ece3c4",
        }}
      >
        {notice.text}
      </p>
    </div>
  );
}
