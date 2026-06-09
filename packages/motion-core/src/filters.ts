import type { Vec3 } from "./rawSamples.js";

export const lowPass = (previous: number, next: number, alpha: number): number => previous + alpha * (next - previous);

export const lowPassVec3 = (previous: Vec3 | undefined, next: Vec3, alpha: number): Vec3 => {
  if (!previous) {
    return next;
  }
  return [
    lowPass(previous[0], next[0], alpha),
    lowPass(previous[1], next[1], alpha),
    lowPass(previous[2], next[2], alpha),
  ];
};

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const normalize01 = (value: number, min: number, max: number): number => {
  if (max <= min) {
    return 0;
  }
  return clamp((value - min) / (max - min), 0, 1);
};
