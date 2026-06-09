import type { MotionIntent } from "@kindo/protocol";
import { TypedEventBus } from "./events.js";
import type { RuntimePlayer } from "./players.js";

export type GameSessionEvents = {
  intent: MotionIntent;
  player_joined: RuntimePlayer;
  player_left: { playerId: string };
};

export class GameSession {
  readonly events = new TypedEventBus<GameSessionEvents>();
  private readonly players = new Map<string, RuntimePlayer>();

  addPlayer(player: RuntimePlayer): void {
    this.players.set(player.playerId, player);
    this.events.emit("player_joined", player);
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.events.emit("player_left", { playerId });
  }

  dispatchIntent(intent: MotionIntent): void {
    this.events.emit("intent", intent);
  }

  getPlayers(): RuntimePlayer[] {
    return [...this.players.values()];
  }
}
