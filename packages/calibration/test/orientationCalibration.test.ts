import { describe, expect, it } from "vitest";
import { createPlayerCalibration, applyCalibrationSample, calibrateOrientation } from "../src/index.js";
import type { RawMotionSample } from "@kindo/motion-core";

describe("orientation calibration", () => {
  it("returns the landscape grip mount at the neutral pose", () => {
    const neutral = sampleWithPose(1, 20, 45, -12);
    const calibration = applyCalibrationSample(createPlayerCalibration("p_1", { grip: "landscape" }), "neutral_pose", neutral);
    const calibrated = calibrateOrientation(neutral, calibration);

    expect(calibrated.neutralApplied).toBe(true);
    expect(calibrated.grip).toBe("landscape");
    expect(calibrated.quaternion[2]).toBeCloseTo(-Math.SQRT1_2, 5);
    expect(calibrated.quaternion[3]).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it("falls back to the grip mount when orientation is unavailable", () => {
    const calibration = createPlayerCalibration("p_1", { grip: "portrait" });
    const calibrated = calibrateOrientation(undefined, calibration);

    expect(calibrated.neutralApplied).toBe(false);
    expect(calibrated.quaternion).toEqual([0, 0, 0, 1]);
  });
});

const sampleWithPose = (seq: number, alpha: number, beta: number, gamma: number): RawMotionSample => ({
  seq,
  tMs: seq * 16,
  orientation: { alpha, beta, gamma },
});
