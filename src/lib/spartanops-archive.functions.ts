import { createServerFn } from "@tanstack/react-start";

export type SpartanOpsArchiveRow = {
  id: string;
  lobbyId: string;
  fieldName: string;
  eventName: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  gamemode: string | null;
  finalScores: Record<string, number>;
  winnerTeam: string | null;
  missionState: string | null;
  playerCount: number;
  captureCount: number;
  startedAt: string | null;
  decommissionedAt: string;
};

export const listArchivedMissions = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("spartanops_archived_missions" as any)
    .select("id,lobby_id,field_name,event_name,location,city,country,gamemode,final_scores,winner_team,mission_state,player_count,capture_count,started_at,decommissioned_at")
    .order("decommissioned_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r): SpartanOpsArchiveRow => ({
    id: r.id,
    lobbyId: r.lobby_id,
    fieldName: r.field_name,
    eventName: r.event_name ?? null,
    location: r.location ?? null,
    city: r.city ?? null,
    country: r.country ?? null,
    gamemode: r.gamemode ?? null,
    finalScores: (r.final_scores as Record<string, number>) ?? {},
    winnerTeam: r.winner_team ?? null,
    missionState: r.mission_state ?? null,
    playerCount: Number(r.player_count ?? 0),
    captureCount: Number(r.capture_count ?? 0),
    startedAt: r.started_at ?? null,
    decommissionedAt: r.decommissioned_at,
  }));
});