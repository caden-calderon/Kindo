export type RuntimePlayer = {
  playerId: string;
  name: string;
  color: string;
  connected: boolean;
};

export const upsertPlayer = (players: readonly RuntimePlayer[], player: RuntimePlayer): RuntimePlayer[] => {
  const index = players.findIndex((candidate) => candidate.playerId === player.playerId);
  if (index === -1) {
    return [...players, player];
  }
  return players.map((candidate, candidateIndex) => (candidateIndex === index ? player : candidate));
};
