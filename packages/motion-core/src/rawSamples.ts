import type { ControllerPacket } from "@kindo/protocol";

export type Vec3 = [number, number, number];

export type RawMotionSample = {
  seq: number;
  tMs: number;
  dtMs?: number;
  orientation?: {
    alpha?: number;
    beta?: number;
    gamma?: number;
    absolute?: boolean;
  };
  acceleration?: Vec3;
  accelerationIncludingGravity?: Vec3;
  rotationRateDeg?: Vec3;
  intervalMs?: number;
};

export type MotionQuality = {
  hasMotion: boolean;
  hasOrientation: boolean;
  sampleRateHz?: number;
  jitterMs?: number;
  droppedPacketEstimate?: number;
  confidence: number;
  warnings: string[];
};

export type MotionFrame = {
  tMs: number;
  dtMs: number;
  orientationEuler?: Vec3;
  angularVelocityDeg?: Vec3;
  acceleration?: Vec3;
  accelerationIncludingGravity?: Vec3;
  quality: MotionQuality;
};

export const rawSampleFromPacket = (packet: ControllerPacket): RawMotionSample => {
  const sample: RawMotionSample = {
    seq: packet.seq,
    tMs: packet.sentAtMs,
  };

  if (packet.dtMs !== undefined) {
    sample.dtMs = packet.dtMs;
  }

  if (packet.pose) {
    const orientation: NonNullable<RawMotionSample["orientation"]> = {};
    if (packet.pose.alpha !== undefined) {
      orientation.alpha = packet.pose.alpha;
    }
    if (packet.pose.beta !== undefined) {
      orientation.beta = packet.pose.beta;
    }
    if (packet.pose.gamma !== undefined) {
      orientation.gamma = packet.pose.gamma;
    }
    if (packet.pose.absolute !== undefined) {
      orientation.absolute = packet.pose.absolute;
    }
    sample.orientation = orientation;
  }

  if (packet.motion) {
    if (packet.motion.acc !== undefined) {
      sample.acceleration = packet.motion.acc;
    }
    if (packet.motion.accG !== undefined) {
      sample.accelerationIncludingGravity = packet.motion.accG;
    }
    if (packet.motion.gyroDeg !== undefined) {
      sample.rotationRateDeg = packet.motion.gyroDeg;
    }
    if (packet.motion.intervalMs !== undefined) {
      sample.intervalMs = packet.motion.intervalMs;
    }
  }

  return sample;
};

export const motionFrameFromRawSample = (sample: RawMotionSample, quality: MotionQuality): MotionFrame => {
  const dtMs = sample.dtMs ?? sample.intervalMs ?? 16.6667;
  const frame: MotionFrame = {
    tMs: sample.tMs,
    dtMs,
    quality,
  };

  if (sample.orientation) {
    frame.orientationEuler = [
      sample.orientation.alpha ?? 0,
      sample.orientation.beta ?? 0,
      sample.orientation.gamma ?? 0,
    ];
  }

  if (sample.rotationRateDeg) {
    frame.angularVelocityDeg = sample.rotationRateDeg;
  }

  if (sample.acceleration) {
    frame.acceleration = sample.acceleration;
  }

  if (sample.accelerationIncludingGravity) {
    frame.accelerationIncludingGravity = sample.accelerationIncludingGravity;
  }

  return frame;
};
