export function audioPhaseSignals(i: {
  status: string | null | undefined;
  hasTeam: boolean;
  marshalView: boolean;
}): { lobby: boolean; matchStart: boolean } {
  const participant = i.hasTeam || i.marshalView;
  return {
    lobby: i.status === "lobby" || i.status === "closed" || (!participant && i.status !== "ended"),
    matchStart: participant && (i.status === "active" || i.status === "paused"),
  };
}