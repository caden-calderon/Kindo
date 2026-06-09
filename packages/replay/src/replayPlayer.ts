import type { ControllerPacket } from "@kindo/protocol";
import type { MotionRecording } from "./recording.js";

export type ReplayFrame = {
  packet: ControllerPacket;
  offsetMs: number;
};

export class ReplayPlayer {
  private cursor = 0;
  private readonly frames: ReplayFrame[];

  constructor(recording: MotionRecording) {
    const firstPacketMs = recording.packets[0]?.sentAtMs ?? 0;
    this.frames = recording.packets.map((packet) => ({
      packet,
      offsetMs: Math.max(0, packet.sentAtMs - firstPacketMs),
    }));
  }

  reset(): void {
    this.cursor = 0;
  }

  next(): ReplayFrame | null {
    const frame = this.frames[this.cursor];
    if (!frame) {
      return null;
    }
    this.cursor += 1;
    return frame;
  }

  all(): readonly ReplayFrame[] {
    return this.frames;
  }
}
