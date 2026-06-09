import { describe, expect, it } from "vitest";
import { KindoMessageSchema, defaultControllerCapabilities } from "../src/index.js";

describe("KindoMessageSchema", () => {
  it("accepts valid controller packets", () => {
    const parsed = KindoMessageSchema.parse({
      type: "controller_packet",
      roomId: "ABCD",
      playerId: "p_1",
      packet: {
        roomId: "ABCD",
        playerId: "p_1",
        seq: 1,
        sentAtMs: 10,
        caps: defaultControllerCapabilities(),
        pose: { alpha: 1, beta: 2, gamma: 3, absolute: false },
        motion: { acc: [0, 1, 2], gyroDeg: [3, 4, 5], intervalMs: 16.7 },
        touch: { primary: false, secondary: false },
        control: {
          handedness: "right",
          grip: "portrait",
          safetyMode: "normal",
          state: "active",
        },
      },
    });

    expect(parsed.type).toBe("controller_packet");
  });

  it("rejects malformed room ids", () => {
    expect(() =>
      KindoMessageSchema.parse({
        type: "join_room",
        roomId: "abc",
        clientKind: "controller",
      }),
    ).toThrow();
  });
});
