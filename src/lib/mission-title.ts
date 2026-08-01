/** Single source of truth for how a mission is titled across every surface.
 *  Priority: explicit mission name (settings) → event name → field name. */
export function missionTitle(
  lobby:
    | {
        fieldName?: string | null;
        eventName?: string | null;
        settings?: { missionName?: string | null } | null;
      }
    | null
    | undefined,
  fallback = "",
): string {
  if (!lobby) return fallback;
  const fromSettings = (lobby.settings as any)?.missionName;
  const mission =
    (typeof fromSettings === "string" && fromSettings.trim()) ||
    (typeof lobby.eventName === "string" && lobby.eventName.trim()) ||
    (typeof lobby.fieldName === "string" && lobby.fieldName.trim()) ||
    "";
  return mission || fallback;
}
