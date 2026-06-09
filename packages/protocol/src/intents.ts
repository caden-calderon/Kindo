import { z } from "zod";

const finiteNumber = z.number().finite();
const normalized = finiteNumber.min(0).max(1);

export const MotionPhaseSchema = z.enum([
  "idle",
  "ready",
  "backswing",
  "transition",
  "forward",
  "impact_or_release",
  "follow_through",
  "recovery",
]);
export type MotionPhase = z.infer<typeof MotionPhaseSchema>;

export const BowlingThrowIntentSchema = z.object({
  type: z.literal("bowling_throw"),
  playerId: z.string().min(1),
  releaseSpeed: normalized,
  releaseAngle: finiteNumber,
  laneAim: finiteNumber.min(-1).max(1),
  loft: normalized,
  wristTwist: finiteNumber,
  spinAxis: finiteNumber,
  spinAmount: normalized,
  smoothness: normalized,
  timing: normalized,
  confidence: normalized,
  debug: z.record(z.string(), z.unknown()).optional(),
});
export type BowlingThrowIntent = z.infer<typeof BowlingThrowIntentSchema>;

export const TennisSwingIntentSchema = z.object({
  type: z.literal("tennis_swing"),
  playerId: z.string().min(1),
  hand: z.enum(["forehand", "backhand", "serve_like"]),
  swingSpeed: normalized,
  swingPlane: finiteNumber,
  faceAngle: finiteNumber,
  timing: normalized,
  topspin: normalized,
  slice: normalized,
  directionBias: finiteNumber.min(-1).max(1),
  power: normalized,
  confidence: normalized,
  debug: z.record(z.string(), z.unknown()).optional(),
});
export type TennisSwingIntent = z.infer<typeof TennisSwingIntentSchema>;

export const AimIntentSchema = z.object({
  type: z.literal("aim"),
  playerId: z.string().min(1),
  x: finiteNumber.min(-1).max(1),
  y: finiteNumber.min(-1).max(1),
  confidence: normalized,
});
export type AimIntent = z.infer<typeof AimIntentSchema>;

export const MotionIntentSchema = z.discriminatedUnion("type", [
  BowlingThrowIntentSchema,
  TennisSwingIntentSchema,
  AimIntentSchema,
]);
export type MotionIntent = z.infer<typeof MotionIntentSchema>;
