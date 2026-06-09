import type {
  ControllerCommandMessage,
  ControllerPacketMessage,
  CreateRoomMessage,
  JoinRoomMessage,
  PlayerSummary,
} from "@kindo/protocol";
import { defaultControllerCapabilities } from "@kindo/protocol";
import { randomBytes, randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { controllerCommandRelay, controllerPacketRelay, playerList, roomJoined, sendError, sendMessage } from "./protocol.js";

export type ControllerClient = {
  clientId: string;
  playerId: string;
  name: string;
  sessionToken: string;
  socket: WebSocket | null;
  connected: boolean;
  caps?: PlayerSummary["caps"];
  packetSeq?: number;
  lastPacketAtUnixMs?: number;
};

export type RoomState = {
  roomId: string;
  desktopClientId: string | null;
  desktopSocket: WebSocket | null;
  controllers: Map<string, ControllerClient>;
  createdAt: number;
  lastActiveAt: number;
};

type ServerClient = {
  clientId: string;
  roomId: string | null;
  kind: "desktop" | "controller" | "spectator" | null;
  playerId: string | null;
  socket: WebSocket;
};

export class RoomManager {
  private readonly rooms = new Map<string, RoomState>();
  private readonly clients = new Map<WebSocket, ServerClient>();

  createRoom(socket: WebSocket, message: CreateRoomMessage): RoomState {
    const roomId = message.requestedRoomId ?? this.generateRoomId();
    const now = Date.now();
    const room: RoomState = {
      roomId,
      desktopClientId: this.getOrCreateClient(socket).clientId,
      desktopSocket: socket,
      controllers: new Map(),
      createdAt: now,
      lastActiveAt: now,
    };
    this.rooms.set(roomId, room);

    const client = this.getOrCreateClient(socket);
    client.kind = "desktop";
    client.roomId = roomId;
    client.playerId = null;

    sendMessage(
      socket,
      roomJoined({
        roomId,
        clientId: client.clientId,
        clientKind: "desktop",
      }),
    );
    this.broadcastPlayerList(room);
    return room;
  }

  joinRoom(socket: WebSocket, message: JoinRoomMessage): RoomState | null {
    const room = this.rooms.get(message.roomId);
    if (!room) {
      sendError(socket, "room_not_found", `Room ${message.roomId} does not exist`);
      return null;
    }

    const client = this.getOrCreateClient(socket);
    client.kind = message.clientKind;
    client.roomId = room.roomId;

    if (message.clientKind === "desktop") {
      room.desktopClientId = client.clientId;
      room.desktopSocket = socket;
      client.playerId = null;
      sendMessage(
        socket,
        roomJoined({
          roomId: room.roomId,
          clientId: client.clientId,
          clientKind: "desktop",
        }),
      );
      this.broadcastPlayerList(room);
      return room;
    }

    if (message.clientKind === "controller") {
      const existing = this.findControllerBySession(room, message.sessionToken);
      const controller = existing ?? this.createController(room, client.clientId, message.clientName);
      controller.socket = socket;
      controller.connected = true;
      controller.name = message.clientName ?? controller.name;
      client.playerId = controller.playerId;

      sendMessage(
        socket,
        roomJoined({
          roomId: room.roomId,
          clientId: client.clientId,
          clientKind: "controller",
          playerId: controller.playerId,
          sessionToken: controller.sessionToken,
        }),
      );
      this.touch(room);
      this.broadcastPlayerList(room);
      return room;
    }

    sendMessage(
      socket,
      roomJoined({
        roomId: room.roomId,
        clientId: client.clientId,
        clientKind: "spectator",
      }),
    );
    return room;
  }

  handleControllerPacket(socket: WebSocket, message: ControllerPacketMessage): void {
    const client = this.clients.get(socket);
    const room = client?.roomId ? this.rooms.get(client.roomId) : undefined;
    if (!client || !room || client.kind !== "controller" || client.playerId !== message.playerId) {
      sendError(socket, "unauthorized_packet", "Controller packet did not match the joined room/player");
      return;
    }

    const controller = room.controllers.get(message.playerId);
    if (!controller) {
      sendError(socket, "player_not_found", "Controller player is no longer in this room");
      return;
    }

    controller.caps = message.packet.caps;
    controller.packetSeq = message.packet.seq;
    controller.lastPacketAtUnixMs = Date.now();
    this.touch(room);

    sendMessage(
      room.desktopSocket,
      controllerPacketRelay({
        roomId: room.roomId,
        playerId: message.playerId,
        packet: message.packet,
      }),
    );
  }

  handleControllerCommand(socket: WebSocket, message: ControllerCommandMessage): void {
    const client = this.clients.get(socket);
    const room = client?.roomId ? this.rooms.get(client.roomId) : undefined;
    if (!client || !room || client.kind !== "desktop") {
      sendError(socket, "unauthorized_command", "Only the desktop client can send controller commands");
      return;
    }

    const targets = message.targetPlayerId
      ? [room.controllers.get(message.targetPlayerId)].filter((candidate): candidate is ControllerClient => Boolean(candidate))
      : [...room.controllers.values()];

    for (const controller of targets) {
      sendMessage(
        controller.socket,
        controllerCommandRelay({
          roomId: room.roomId,
          targetPlayerId: controller.playerId,
          command: message.command,
        }),
      );
    }
  }

  disconnect(socket: WebSocket): void {
    const client = this.clients.get(socket);
    if (!client) {
      return;
    }

    const room = client.roomId ? this.rooms.get(client.roomId) : undefined;
    if (room && client.kind === "desktop" && room.desktopClientId === client.clientId) {
      room.desktopClientId = null;
      room.desktopSocket = null;
    }

    if (room && client.kind === "controller" && client.playerId) {
      const controller = room.controllers.get(client.playerId);
      if (controller) {
        controller.connected = false;
        controller.socket = null;
      }
      this.broadcastPlayerList(room);
    }

    this.clients.delete(socket);
  }

  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  listPlayers(room: RoomState): PlayerSummary[] {
    return [...room.controllers.values()].map((controller) => {
      const summary: PlayerSummary = {
        playerId: controller.playerId,
        clientId: controller.clientId,
        name: controller.name,
        connected: controller.connected,
      };

      if (controller.caps) {
        summary.caps = controller.caps;
      }
      if (controller.packetSeq !== undefined) {
        summary.packetSeq = controller.packetSeq;
      }
      if (controller.lastPacketAtUnixMs !== undefined) {
        summary.lastPacketAtUnixMs = controller.lastPacketAtUnixMs;
      }

      return summary;
    });
  }

  private broadcastPlayerList(room: RoomState): void {
    sendMessage(
      room.desktopSocket,
      playerList({
        roomId: room.roomId,
        players: this.listPlayers(room),
      }),
    );
  }

  private getOrCreateClient(socket: WebSocket): ServerClient {
    const existing = this.clients.get(socket);
    if (existing) {
      return existing;
    }

    const client: ServerClient = {
      clientId: `c_${randomUUID()}`,
      roomId: null,
      kind: null,
      playerId: null,
      socket,
    };
    this.clients.set(socket, client);
    return client;
  }

  private createController(room: RoomState, clientId: string, name?: string): ControllerClient {
    const playerId = `p_${room.controllers.size + 1}`;
    const controller: ControllerClient = {
      clientId,
      playerId,
      name: name ?? `Player ${room.controllers.size + 1}`,
      sessionToken: `s_${randomUUID()}`,
      socket: null,
      connected: true,
      caps: defaultControllerCapabilities(),
    };
    room.controllers.set(playerId, controller);
    return controller;
  }

  private findControllerBySession(room: RoomState, sessionToken: string | undefined): ControllerClient | undefined {
    if (!sessionToken) {
      return undefined;
    }
    return [...room.controllers.values()].find((controller) => controller.sessionToken === sessionToken);
  }

  private touch(room: RoomState): void {
    room.lastActiveAt = Date.now();
  }

  private generateRoomId(): string {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const roomId = randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
      if (!this.rooms.has(roomId)) {
        return roomId;
      }
    }
    return randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  }
}
