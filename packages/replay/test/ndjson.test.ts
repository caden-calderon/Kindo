import { describe, expect, it } from "vitest";
import { createMotionRecording, packetsFromNdjson, packetsToNdjson, serializeRecordingJson, parseRecordingJson } from "../src/index.js";
import { defaultControllerCapabilities, type ControllerPacket } from "@kindo/protocol";

const packet: ControllerPacket = {
  roomId: "ABCD",
  playerId: "p_1",
  seq: 0,
  sentAtMs: 1,
  caps: defaultControllerCapabilities(),
  touch: { primary: false, secondary: false },
  control: {
    handedness: "right",
    grip: "portrait",
    safetyMode: "normal",
    state: "active",
  },
};

describe("replay serialization", () => {
  it("round-trips NDJSON packets", () => {
    expect(packetsFromNdjson(packetsToNdjson([packet]))).toEqual([packet]);
  });

  it("validates JSON recordings", () => {
    const recording = createMotionRecording({ playerId: "p_1", recordingId: "rec_test", startedAtUnixMs: 1 });
    recording.packets.push(packet);

    expect(parseRecordingJson(serializeRecordingJson(recording)).packets).toHaveLength(1);
  });
});
