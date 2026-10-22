import { useEffect, useState } from "react";

/** A safety notice only; never cancels the work being watched. */
export function useSlowAfter(active: boolean, ms: number): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    setSlow(false);
    if (!active) return;
    const timer = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(timer);
  }, [active, ms]);

  return active && slow;
}