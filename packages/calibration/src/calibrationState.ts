import type { CalibrationKind, GripMode, Handedness } from "@kindo/protocol";
import type { RawMotionSample } from "@kindo/motion-core";

export type PlayerCalibration = {
  playerId: string;
  handedness: Handedness;
  grip: GripMode;
  neutralPose?: RawMotionSample;
  readyPoseByGame?: Record<string, RawMotionSample>;
  safeSwingRange?: {
    maxAngularVelocityDeg: number;
    maxBackswingAngleDeg: number;
  };
  createdAtMs: number;
  updatedAtMs: number;
};

export const createPlayerCalibration = (
  playerId: string,
  options: {
    handedness?: Handedness;
    grip?: GripMode;
    nowMs?: number;
  } = {},
): PlayerCalibration => {
  const nowMs = options.nowMs ?? Date.now();
  return {
    playerId,
    handedness: options.handedness ?? "right",
    grip: options.grip ?? "portrait",
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  };
};

export const applyCalibrationSample = (
  calibration: PlayerCalibration,
  kind: CalibrationKind,
  sample: RawMotionSample,
  options: { gameId?: string; nowMs?: number } = {},
): PlayerCalibration => {
  const updatedAtMs = options.nowMs ?? Date.now();

  switch (kind) {
    case "neutral_pose":
    case "recenter_yaw":
      return { ...calibration, neutralPose: sample, updatedAtMs };
    case "ready_pose": {
      const gameId = options.gameId ?? "default";
      return {
        ...calibration,
        readyPoseByGame: {
          ...calibration.readyPoseByGame,
          [gameId]: sample,
        },
        updatedAtMs,
      };
    }
    case "safe_swing_range":
      return {
        ...calibration,
        safeSwingRange: {
          maxAngularVelocityDeg: sample.rotationRateDeg ? Math.hypot(...sample.rotationRateDeg) : 720,
          maxBackswingAngleDeg: 95,
        },
        updatedAtMs,
      };
    case "handedness":
    case "grip":
      return { ...calibration, updatedAtMs };
  }
};
