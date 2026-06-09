import { z } from "zod";
import { MotionIntentSchema } from "./intents.js";
import { ControllerCapabilitiesSchema, ControllerPacketSchema } from "./packets.js";

export const KindoClientKindSchema = z.enum(["desktop", "controller", "spectator"]);
export type KindoClientKind = z.infer<typeof KindoClientKindSchema>;

export const CalibrationKindSchema = z.enum([
  "neutral_pose",
  "ready_pose",
  "handedness",
  "grip",
  "safe_swing_range",
  "recenter_yaw",
]);
export type CalibrationKind = z.infer<typeof CalibrationKindSchema>;

export const ControllerCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("vibrate"),
    pattern: z.union([z.number().int().nonnegative(), z.array(z.number().int().nonnegative())]),
  }),
  z.object({
    type: z.literal("set_mode"),
    mode: z.enum(["lobby", "calibrate", "bowling", "tennis"]),
  }),
  z.object({
    type: z.literal("show_message"),
    text: z.string().min(1).max(240),
  }),
  z.object({
    type: z.literal("request_calibration"),
    calibration: CalibrationKindSchema,
  }),
]);
export type ControllerCommand = z.infer<typeof ControllerCommandSchema>;

export const PlayerSummarySchema = z.object({
  playerId: z.string().min(1),
  clientId: z.string().min(1),
  name: z.string().min(1).max(40),
  connected: z.boolean(),
  caps: ControllerCapabilitiesSchema.optional(),
  packetSeq: z.number().int().nonnegative().optional(),
  lastPacketAtUnixMs: z.number().finite().optional(),
});
export type PlayerSummary = z.infer<typeof PlayerSummarySchema>;

const clientIdSchema = z.string().min(1);
const roomIdSchema = z.string().regex(/^[A-Z0-9]{4,8}$/);

export const CreateRoomMessageSchema = z.object({
  type: z.literal("create_room"),
  clientKind: z.literal("desktop"),
  requestedRoomId: roomIdSchema.optional(),
});
export type CreateRoomMessage = z.infer<typeof CreateRoomMessageSchema>;

export const JoinRoomMessageSchema = z.object({
  type: z.literal("join_room"),
  roomId: roomIdSchema,
  clientKind: KindoClientKindSchema,
  clientName: z.string().min(1).max(40).optional(),
  sessionToken: z.string().min(8).optional(),
});
export type JoinRoomMessage = z.infer<typeof JoinRoomMessageSchema>;

export const RoomJoinedMessageSchema = z.object({
  type: z.literal("room_joined"),
  roomId: roomIdSchema,
  clientId: clientIdSchema,
  clientKind: KindoClientKindSchema,
  playerId: z.string().min(1).optional(),
  sessionToken: z.string().min(8).optional(),
});
export type RoomJoinedMessage = z.infer<typeof RoomJoinedMessageSchema>;

export const ControllerPacketMessageSchema = z.object({
  type: z.literal("controller_packet"),
  roomId: roomIdSchema,
  playerId: z.string().min(1),
  packet: ControllerPacketSchema,
});
export type ControllerPacketMessage = z.infer<typeof ControllerPacketMessageSchema>;

export const ControllerCommandMessageSchema = z.object({
  type: z.literal("controller_command"),
  roomId: roomIdSchema,
  targetPlayerId: z.string().min(1).optional(),
  command: ControllerCommandSchema,
});
export type ControllerCommandMessage = z.infer<typeof ControllerCommandMessageSchema>;

export const ControllerIntentMessageSchema = z.object({
  type: z.literal("controller_intent"),
  roomId: roomIdSchema,
  playerId: z.string().min(1),
  intent: MotionIntentSchema,
});
export type ControllerIntentMessage = z.infer<typeof ControllerIntentMessageSchema>;

export const PlayerListMessageSchema = z.object({
  type: z.literal("player_list"),
  roomId: roomIdSchema,
  players: z.array(PlayerSummarySchema),
});
export type PlayerListMessage = z.infer<typeof PlayerListMessageSchema>;

export const ErrorMessageSchema = z.object({
  type: z.literal("error"),
  code: z.string().min(1),
  message: z.string().min(1),
});
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

export const PingMessageSchema = z.object({
  type: z.literal("ping"),
  id: z.string().min(1),
  sentAtMs: z.number().finite(),
});
export type PingMessage = z.infer<typeof PingMessageSchema>;

export const PongMessageSchema = z.object({
  type: z.literal("pong"),
  id: z.string().min(1),
  sentAtMs: z.number().finite(),
  serverAtUnixMs: z.number().finite().optional(),
});
export type PongMessage = z.infer<typeof PongMessageSchema>;

export const KindoMessageSchema = z.discriminatedUnion("type", [
  CreateRoomMessageSchema,
  JoinRoomMessageSchema,
  RoomJoinedMessageSchema,
  ControllerPacketMessageSchema,
  ControllerCommandMessageSchema,
  ControllerIntentMessageSchema,
  PlayerListMessageSchema,
  ErrorMessageSchema,
  PingMessageSchema,
  PongMessageSchema,
]);
export type KindoMessage = z.infer<typeof KindoMessageSchema>;

export const parseKindoMessage = (input: unknown): KindoMessage => KindoMessageSchema.parse(input);

export const serializeKindoMessage = (message: KindoMessage): string => JSON.stringify(message);

export const parseKindoMessageJson = (json: string): KindoMessage => parseKindoMessage(JSON.parse(json));
