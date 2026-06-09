import type { Handedness } from "@kindo/protocol";
import type { PlayerCalibration } from "./calibrationState.js";

export const setHandedness = (calibration: PlayerCalibration, handedness: Handedness, nowMs = Date.now()): PlayerCalibration => ({
  ...calibration,
  handedness,
  updatedAtMs: nowMs,
});
