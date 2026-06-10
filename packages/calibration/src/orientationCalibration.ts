import {
  axisAngleToQuaternion,
  deviceOrientationToQuaternion,
  identityQuaternion,
  invertQuaternion,
  multiplyQuaternions,
  type QuaternionTuple,
  type RawMotionSample,
} from "@kindo/motion-core";
import type { GripMode } from "@kindo/protocol";
import type { PlayerCalibration } from "./calibrationState.js";

export type CalibratedOrientation = {
  quaternion: QuaternionTuple;
  neutralApplied: boolean;
  grip: GripMode;
};

export const rawSampleOrientationToQuaternion = (sample: RawMotionSample | undefined): QuaternionTuple | undefined => {
  if (!sample?.orientation) {
    return undefined;
  }

  return deviceOrientationToQuaternion(sample.orientation.alpha, sample.orientation.beta, sample.orientation.gamma);
};

export const getGripMountQuaternion = (grip: GripMode): QuaternionTuple => {
  if (grip === "landscape") {
    return axisAngleToQuaternion([0, 0, 1], -Math.PI / 2);
  }

  return identityQuaternion();
};

export const calibrateOrientation = (
  sample: RawMotionSample | undefined,
  calibration: PlayerCalibration | undefined,
): CalibratedOrientation => {
  const grip = calibration?.grip ?? "portrait";
  const current = rawSampleOrientationToQuaternion(sample);
  const mount = getGripMountQuaternion(grip);

  if (!current) {
    return {
      quaternion: mount,
      neutralApplied: false,
      grip,
    };
  }

  const neutral = rawSampleOrientationToQuaternion(calibration?.neutralPose);
  const relative = neutral ? multiplyQuaternions(invertQuaternion(neutral), current) : current;

  return {
    quaternion: multiplyQuaternions(relative, mount),
    neutralApplied: Boolean(neutral),
    grip,
  };
};
