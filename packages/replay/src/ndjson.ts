import { ControllerPacketSchema, type ControllerPacket } from "@kindo/protocol";
import type { MotionRecording } from "./recording.js";

export const serializeRecordingJson = (recording: MotionRecording): string => JSON.stringify(recording, null, 2);

export const parseRecordingJson = (json: string): MotionRecording => {
  const parsed = JSON.parse(json) as MotionRecording;
  if (parsed.version !== 1 || !Array.isArray(parsed.packets)) {
    throw new Error("Unsupported motion recording");
  }
  for (const packet of parsed.packets) {
    ControllerPacketSchema.parse(packet);
  }
  return parsed;
};

export const packetsToNdjson = (packets: readonly ControllerPacket[]): string =>
  packets.map((packet) => JSON.stringify(packet)).join("\n");

export const packetsFromNdjson = (ndjson: string): ControllerPacket[] =>
  ndjson
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ControllerPacketSchema.parse(JSON.parse(line)));
