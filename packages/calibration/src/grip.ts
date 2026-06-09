import type { GripMode } from "@kindo/protocol";
import type { PlayerCalibration } from "./calibrationState.js";

export const setGrip = (calibration: PlayerCalibration, grip: GripMode, nowMs = Date.now()): PlayerCalibration => ({
  ...calibration,
  grip,
  updatedAtMs: nowMs,
});
