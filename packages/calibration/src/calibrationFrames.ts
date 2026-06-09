import type { RawMotionSample } from "@kindo/motion-core";
import type { PlayerCalibration } from "./calibrationState.js";

export type CalibrationFrameStatus = {
  hasNeutralPose: boolean;
  hasSafeSwingRange: boolean;
  neutralAgeMs?: number;
};

export const getCalibrationFrameStatus = (calibration: PlayerCalibration, nowMs = Date.now()): CalibrationFrameStatus => {
  const status: CalibrationFrameStatus = {
    hasNeutralPose: Boolean(calibration.neutralPose),
    hasSafeSwingRange: Boolean(calibration.safeSwingRange),
  };

  if (calibration.neutralPose) {
    status.neutralAgeMs = Math.max(0, nowMs - calibration.updatedAtMs);
  }

  return status;
};

export const cloneCalibrationSample = (sample: RawMotionSample): RawMotionSample => {
  const clone: RawMotionSample = {
    seq: sample.seq,
    tMs: sample.tMs,
  };

  if (sample.dtMs !== undefined) {
    clone.dtMs = sample.dtMs;
  }
  if (sample.orientation) {
    clone.orientation = { ...sample.orientation };
  }
  if (sample.acceleration) {
    clone.acceleration = [...sample.acceleration];
  }
  if (sample.accelerationIncludingGravity) {
    clone.accelerationIncludingGravity = [...sample.accelerationIncludingGravity];
  }
  if (sample.rotationRateDeg) {
    clone.rotationRateDeg = [...sample.rotationRateDeg];
  }
  if (sample.intervalMs !== undefined) {
    clone.intervalMs = sample.intervalMs;
  }

  return clone;
};
