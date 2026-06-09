import {
  serializeKindoMessage,
  type ControllerCommandMessage,
  type ControllerPacketMessage,
  type ErrorMessage,
  type KindoMessage,
  type PlayerListMessage,
  type RoomJoinedMessage,
} from "@kindo/protocol";
import { WebSocket } from "ws";

export const sendMessage = (socket: WebSocket | null, message: KindoMessage): boolean => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  socket.send(serializeKindoMessage(message));
  return true;
};

export const sendError = (socket: WebSocket | null, code: string, message: string): boolean => {
  const errorMessage: ErrorMessage = {
    type: "error",
    code,
    message,
  };
  return sendMessage(socket, errorMessage);
};

export const roomJoined = (message: Omit<RoomJoinedMessage, "type">): RoomJoinedMessage => ({
  type: "room_joined",
  ...message,
});

export const playerList = (message: Omit<PlayerListMessage, "type">): PlayerListMessage => ({
  type: "player_list",
  ...message,
});

export const controllerPacketRelay = (message: Omit<ControllerPacketMessage, "type">): ControllerPacketMessage => ({
  type: "controller_packet",
  ...message,
});

export const controllerCommandRelay = (message: Omit<ControllerCommandMessage, "type">): ControllerCommandMessage => ({
  type: "controller_command",
  ...message,
});
