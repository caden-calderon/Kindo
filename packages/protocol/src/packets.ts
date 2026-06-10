import { z } from "zod";

export const HandednessSchema = z.enum(["left", "right"]);
export type Handedness = z.infer<typeof HandednessSchema>;

export const GripModeSchema = z.enum(["portrait", "landscape"]);
export type GripMode = z.infer<typeof GripModeSchema>;

export const SafetyModeSchema = z.enum(["normal", "short-swing"]);
export type SafetyMode = z.infer<typeof SafetyModeSchema>;

export const ControllerStateSchema = z.enum(["idle", "joining", "calibrating", "ready", "active"]);
export type ControllerState = z.infer<typeof ControllerStateSchema>;

export const ControllerCapabilitiesSchema = z.object({
  motion: z.boolean(),
  orientation: z.boolean(),
  vibration: z.boolean(),
  wakeLock: z.boolean(),
  genericSensor: z.boolean(),
});
export type ControllerCapabilities = z.infer<typeof ControllerCapabilitiesSchema>;

const finiteNumber = z.number().finite();
const vector3Schema = z.tuple([finiteNumber, finiteNumber, finiteNumber]);

export const ControllerPacketSchema = z.object({
  roomId: z.string().min(3),
  playerId: z.string().min(1),
  seq: z.number().int().nonnegative(),
  sentAtMs: finiteNumber,
  unixAtMs: finiteNumber.optional(),
  dtMs: finiteNumber.nonnegative().optional(),
  caps: ControllerCapabilitiesSchema,
  pose: z
    .object({
      alpha: finiteNumber.optional(),
      beta: finiteNumber.optional(),
      gamma: finiteNumber.optional(),
      absolute: z.boolean().optional(),
    })
    .optional(),
  motion: z
    .object({
      acc: vector3Schema.optional(),
      accG: vector3Schema.optional(),
      gyroDeg: vector3Schema.optional(),
      intervalMs: finiteNumber.nonnegative().optional(),
    })
    .optional(),
  touch: z.object({
    primary: z.boolean(),
    secondary: z.boolean(),
    x: finiteNumber.optional(),
    y: finiteNumber.optional(),
  }),
  control: z.object({
    handedness: HandednessSchema,
    grip: GripModeSchema,
    safetyMode: SafetyModeSchema,
    state: ControllerStateSchema,
    calibration: z
      .object({
        neutralPoseRequestId: z.number().int().nonnegative().optional(),
      })
      .optional(),
  }),
});
export type ControllerPacket = z.infer<typeof ControllerPacketSchema>;

export const DeviceInfoSchema = z.object({
  userAgent: z.string().optional(),
  platform: z.string().optional(),
  vendor: z.string().optional(),
  maxTouchPoints: z.number().int().nonnegative().optional(),
});
export type DeviceInfo = z.infer<typeof DeviceInfoSchema>;

export const defaultControllerCapabilities = (): ControllerCapabilities => ({
  motion: false,
  orientation: false,
  vibration: false,
  wakeLock: false,
  genericSensor: false,
});
