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

export const multiplyQuaternions = (left: QuaternionTuple, right: QuaternionTuple): QuaternionTuple => {
  const [ax, ay, az, aw] = left;
  const [bx, by, bz, bw] = right;
  return normalizeQuaternion([
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]);
};

export const conjugateQuaternion = (quat: QuaternionTuple): QuaternionTuple => {
  const [x, y, z, w] = normalizeQuaternion(quat);
  return [-x, -y, -z, w];
};

export const invertQuaternion = (quat: QuaternionTuple): QuaternionTuple => conjugateQuaternion(quat);

export const axisAngleToQuaternion = (axis: Vec3, angleRadians: number): QuaternionTuple => {
  const [x, y, z] = axis;
  const length = Math.hypot(x, y, z);
  if (length === 0) {
    return identityQuaternion();
  }

  const halfAngle = angleRadians * 0.5;
  const scale = Math.sin(halfAngle) / length;
  return normalizeQuaternion([x * scale, y * scale, z * scale, Math.cos(halfAngle)]);
};

export const rotateVec3ByQuaternion = (value: Vec3, quat: QuaternionTuple): Vec3 => {
  const [x, y, z, w] = normalizeQuaternion(quat);
  const [vx, vy, vz] = value;
  const uvx = y * vz - z * vy;
  const uvy = z * vx - x * vz;
  const uvz = x * vy - y * vx;
  const uuvx = y * uvz - z * uvy;
  const uuvy = z * uvx - x * uvz;
  const uuvz = x * uvy - y * uvx;
  return [
    vx + 2 * (w * uvx + uuvx),
    vy + 2 * (w * uvy + uuvy),
    vz + 2 * (w * uvz + uuvz),
  ];
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

export const deviceOrientationEulerToQuaternion = (alpha = 0, beta = 0, gamma = 0): QuaternionTuple => {
  const x = degreesToRadians(beta);
  const y = degreesToRadians(alpha);
  const z = degreesToRadians(-gamma);

  const c1 = Math.cos(x * 0.5);
  const c2 = Math.cos(y * 0.5);
  const c3 = Math.cos(z * 0.5);
  const s1 = Math.sin(x * 0.5);
  const s2 = Math.sin(y * 0.5);
  const s3 = Math.sin(z * 0.5);

  return normalizeQuaternion([
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 - s1 * s2 * c3,
    c1 * c2 * c3 + s1 * s2 * s3,
  ]);
};

export const deviceOrientationToQuaternion = (alpha = 0, beta = 0, gamma = 0): QuaternionTuple => {
  // Browser DeviceOrientation gives alpha/beta/gamma in a Z-X'-Y'' convention.
  // This matches the common Y-X-Z browser control mapping while keeping renderer-specific
  // mesh alignment in calibration/Babylon layers.
  return deviceOrientationEulerToQuaternion(alpha, beta, gamma);
};

export const magnitude3 = (value: Vec3 | undefined): number => {
  if (!value) {
    return 0;
  }
  return Math.hypot(value[0], value[1], value[2]);
};
