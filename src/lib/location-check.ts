import { useSyncExternalStore } from "react";

let on = false;
const subs = new Set<() => void>();

/** Whether the mission the player is on checks location. Set by /misija and /capture. */
export function setLocationCheckOn(next: boolean) {
  if (on === next) return;
  on = next;
  subs.forEach((f) => f());
}

export function useLocationCheckOn(): boolean {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => on,
    () => false,
  );
}
