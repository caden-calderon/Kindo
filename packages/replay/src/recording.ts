import type { PlayerCalibration } from "@kindo/calibration";
import type { ControllerPacket, DeviceInfo, MotionIntent } from "@kindo/protocol";

export type MotionRecording = {
  version: 1;
  recordingId: string;
  playerId: string;
  deviceInfo?: DeviceInfo;
  startedAtUnixMs: number;
  endedAtUnixMs?: number;
  calibration?: PlayerCalibration;
  packets: ControllerPacket[];
  intents?: MotionIntent[];
};

export type RecordingOptions = {
  recordingId?: string;
  playerId: string;
  deviceInfo?: DeviceInfo;
  calibration?: PlayerCalibration;
  startedAtUnixMs?: number;
};

export const createMotionRecording = (options: RecordingOptions): MotionRecording => {
  const recording: MotionRecording = {
    version: 1,
    recordingId: options.recordingId ?? createRecordingId(),
    playerId: options.playerId,
    startedAtUnixMs: options.startedAtUnixMs ?? Date.now(),
    packets: [],
  };

  if (options.deviceInfo) {
    recording.deviceInfo = options.deviceInfo;
  }
  if (options.calibration) {
    recording.calibration = options.calibration;
  }

  return recording;
};

export const addPacketToRecording = (recording: MotionRecording, packet: ControllerPacket): MotionRecording => ({
  ...recording,
  packets: [...recording.packets, packet],
});

export const addIntentToRecording = (recording: MotionRecording, intent: MotionIntent): MotionRecording => ({
  ...recording,
  intents: [...(recording.intents ?? []), intent],
});

export const finishRecording = (recording: MotionRecording, endedAtUnixMs = Date.now()): MotionRecording => ({
  ...recording,
  endedAtUnixMs,
});

const createRecordingId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};
