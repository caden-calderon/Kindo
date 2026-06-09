import type { Vec3 } from "./rawSamples.js";

export type QuaternionTuple = [number, number, number, number];

export const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const radiansToDegrees = (radians: number): number => (radians * 180) / Math.PI;

export const identityQuaternion = (): QuaternionTuple => [0, 0, 0, 1];

export const normalizeQuaternion = (quat: QuaternionTuple): QuaternionTuple => {
  const [x, y, z, w] = quat;
  const length = Math.hypot(x, y, z, w);
  if (length === 0) {
    return identityQuaternion();
  }
  return [x / length, y / length, z / length, w / length];
};

export const eulerDegreesToQuaternion = (euler: Vec3): QuaternionTuple => {
  const [yawDeg, pitchDeg, rollDeg] = euler;
  const yaw = degreesToRadians(yawDeg);
  const pitch = degreesToRadians(pitchDeg);
  const roll = degreesToRadians(rollDeg);

  const cy = Math.cos(yaw * 0.5);
  const sy = Math.sin(yaw * 0.5);
  const cp = Math.cos(pitch * 0.5);
  const sp = Math.sin(pitch * 0.5);
  const cr = Math.cos(roll * 0.5);
  const sr = Math.sin(roll * 0.5);

  return normalizeQuaternion([
    sr * cp * cy - cr * sp * sy,
    cr * sp * cy + sr * cp * sy,
    cr * cp * sy - sr * sp * cy,
    cr * cp * cy + sr * sp * sy,
  ]);
};

export const deviceOrientationToQuaternion = (alpha = 0, beta = 0, gamma = 0): QuaternionTuple => {
  // Browser DeviceOrientation gives alpha/beta/gamma in a Z-X'-Y'' convention.
  // Stage 0 keeps this as an approximate renderer-neutral preview mapping; calibration will own
  // true grip/frame correction once real device traces exist.
  return eulerDegreesToQuaternion([alpha, beta, -gamma]);
};

export const magnitude3 = (value: Vec3 | undefined): number => {
  if (!value) {
    return 0;
  }
  return Math.hypot(value[0], value[1], value[2]);
};
