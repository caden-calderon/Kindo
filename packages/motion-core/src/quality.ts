import type { MotionQuality, RawMotionSample } from "./rawSamples.js";

export type MotionQualityTrackerOptions = {
  expectedSampleMs?: number;
  staleAfterMs?: number;
};

export class MotionQualityTracker {
  private readonly expectedSampleMs: number;
  private readonly staleAfterMs: number;
  private lastSample: RawMotionSample | undefined;
  private readonly intervals: number[] = [];
  private droppedPackets = 0;

  constructor(options: MotionQualityTrackerOptions = {}) {
    this.expectedSampleMs = options.expectedSampleMs ?? 16.6667;
    this.staleAfterMs = options.staleAfterMs ?? 250;
  }

  update(sample: RawMotionSample, nowMs = sample.tMs): MotionQuality {
    const lastSample = this.lastSample;
    if (lastSample) {
      const dt = sample.tMs - lastSample.tMs;
      if (Number.isFinite(dt) && dt > 0) {
        this.intervals.push(dt);
        if (this.intervals.length > 60) {
          this.intervals.shift();
        }
      }

      const seqGap = sample.seq - lastSample.seq - 1;
      if (seqGap > 0) {
        this.droppedPackets += seqGap;
      }
    }

    this.lastSample = sample;
    return this.getQuality(nowMs);
  }

  getQuality(nowMs: number): MotionQuality {
    const sample = this.lastSample;
    const warnings: string[] = [];
    if (!sample) {
      return {
        hasMotion: false,
        hasOrientation: false,
        confidence: 0,
        warnings: ["no_samples"],
      };
    }

    const hasMotion = Boolean(sample.acceleration || sample.accelerationIncludingGravity || sample.rotationRateDeg || sample.spatialPose);
    const hasOrientation = Boolean(sample.orientation);
    const hasSpatialPose = Boolean(sample.spatialPose);
    if (!hasMotion) {
      warnings.push("motion_unavailable");
    }
    if (!hasOrientation) {
      warnings.push("orientation_unavailable");
    }

    const sampleAge = nowMs - sample.tMs;
    if (sampleAge > this.staleAfterMs) {
      warnings.push("stale_samples");
    }

    const averageInterval = average(this.intervals);
    const jitterMs = averageInterval === undefined ? undefined : average(this.intervals.map((v) => Math.abs(v - averageInterval)));
    if (jitterMs !== undefined && jitterMs > this.expectedSampleMs) {
      warnings.push("high_jitter");
    }

    const sampleRateHz = averageInterval === undefined ? undefined : 1000 / averageInterval;
    const availabilityScore = (hasMotion ? 0.35 : 0) + (hasOrientation ? 0.3 : 0) + (hasSpatialPose ? 0.25 : 0);
    const freshnessScore = sampleAge <= this.staleAfterMs ? 0.1 : 0;
    const jitterScore = jitterMs === undefined || jitterMs <= this.expectedSampleMs ? 0.1 : 0;

    const quality: MotionQuality = {
      hasMotion,
      hasOrientation,
      hasSpatialPose,
      confidence: clamp01(availabilityScore + freshnessScore + jitterScore),
      warnings,
    };

    if (sampleRateHz !== undefined) {
      quality.sampleRateHz = sampleRateHz;
    }
    if (jitterMs !== undefined) {
      quality.jitterMs = jitterMs;
    }
    if (this.droppedPackets > 0) {
      quality.droppedPacketEstimate = this.droppedPackets;
    }

    return quality;
  }

  reset(): void {
    this.lastSample = undefined;
    this.intervals.length = 0;
    this.droppedPackets = 0;
  }
}

const average = (values: number[]): number | undefined => {
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
