import { describe, expect, it } from "vitest";
import arkitPacketFixture from "../../../native/ios-controller/Fixtures/controller-packet-arkit.json";
import { parseKindoMessage } from "../src/index.js";

describe("native iOS controller fixture", () => {
  it("matches the shared Kindo protocol", () => {
    const parsed = parseKindoMessage(arkitPacketFixture);

    expect(parsed.type).toBe("controller_packet");
    if (parsed.type !== "controller_packet") {
      throw new Error("Expected controller_packet");
    }

    expect(parsed.packet.pose6d?.source).toBe("arkit");
    expect(parsed.packet.pose6d?.referenceSpace).toBe("kindo-room");
    expect(parsed.packet.caps.vio).toBe(true);
    expect(parsed.packet.control.grip).toBe("landscape");
  });
});
