/** Single source of truth for how a mission is titled across every surface.
 *  Always the explicit mission name (settings); the field name is only a
 *  last-resort fallback. The event name is never used as a mission title. */
export function missionTitle(
  lobby:
    | {
        fieldName?: string | null;
        eventName?: string | null;
        settings?: Record<string, any> | null;
      }
    | null
    | undefined,

  fallback = "",
): string {
  if (!lobby) return fallback;
  const fromSettings = (lobby.settings as any)?.missionName;
  const mission =
    (typeof fromSettings === "string" && fromSettings.trim()) ||
    (typeof lobby.fieldName === "string" && lobby.fieldName.trim()) ||
    "";
  return mission || fallback;
}

