import { describe, expect, it } from "vitest";
import { BowlingThrowRecognizer } from "../src/index.js";
import type { MotionFrame } from "@kindo/motion-core";

const frame = (tMs: number, primaryVelocity: number): MotionFrame => ({
  tMs,
  dtMs: 16,
  angularVelocityDeg: [0, primaryVelocity, 0],
  accelerationIncludingGravity: [0, 0, 9.8],
  quality: {
    hasMotion: true,
    hasOrientation: true,
    confidence: 1,
    warnings: [],
  },
});

describe("BowlingThrowRecognizer", () => {
  it("emits a throw intent after a held backswing and forward release", () => {
    const recognizer = new BowlingThrowRecognizer();
    const context = { playerId: "p_1", touchPrimary: true };

    expect(recognizer.update(frame(0, 0), context)).toBeNull();
    expect(recognizer.update(frame(16, -130), context)).toBeNull();
    expect(recognizer.update(frame(32, 0), context)).toBeNull();
    expect(recognizer.update(frame(48, 320), context)).toBeNull();

    const intent = recognizer.update(frame(64, 160), { ...context, touchPrimary: false });

    expect(intent?.type).toBe("bowling_throw");
    expect(intent?.releaseSpeed).toBeGreaterThan(0);
    expect(recognizer.getDebugState().phase).toBe("follow_through");
  });
});
