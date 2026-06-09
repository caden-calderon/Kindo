import { parseKindoMessageJson, type KindoMessage } from "@kindo/protocol";
import { WebSocket } from "ws";
import type { RoomManager } from "./rooms.js";
import { sendError, sendMessage } from "./protocol.js";

export const handleRawMessage = (roomManager: RoomManager, socket: WebSocket, raw: WebSocket.RawData): void => {
  let message: KindoMessage;
  try {
    message = parseKindoMessageJson(raw.toString("utf8"));
  } catch (error) {
    sendError(socket, "invalid_message", error instanceof Error ? error.message : "Invalid JSON message");
    return;
  }

  switch (message.type) {
    case "create_room":
      roomManager.createRoom(socket, message);
      return;
    case "join_room":
      roomManager.joinRoom(socket, message);
      return;
    case "controller_packet":
      roomManager.handleControllerPacket(socket, message);
      return;
    case "controller_command":
      roomManager.handleControllerCommand(socket, message);
      return;
    case "ping":
      sendMessage(socket, {
        type: "pong",
        id: message.id,
        sentAtMs: message.sentAtMs,
        serverAtUnixMs: Date.now(),
      });
      return;
    case "room_joined":
    case "controller_intent":
    case "player_list":
    case "error":
    case "pong":
      sendError(socket, "unexpected_message", `${message.type} is not accepted from clients`);
      return;
  }
};
