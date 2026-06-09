import { magnitude3 } from "./orientation.js";
import type { MotionFrame } from "./rawSamples.js";

export type MotionFeatures = {
  angularSpeedDeg: number;
  accelerationMagnitude: number;
  gravityMagnitude: number;
  primarySwingVelocityDeg: number;
};

export const extractMotionFeatures = (frame: MotionFrame): MotionFeatures => ({
  angularSpeedDeg: magnitude3(frame.angularVelocityDeg),
  accelerationMagnitude: magnitude3(frame.acceleration),
  gravityMagnitude: magnitude3(frame.accelerationIncludingGravity),
  primarySwingVelocityDeg: frame.angularVelocityDeg?.[1] ?? 0,
});
