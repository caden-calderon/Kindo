import {
  defaultControllerCapabilities,
  parseKindoMessageJson,
  serializeKindoMessage,
  type ControllerCommandMessage,
  type ControllerPacketMessage,
  type CreateRoomMessage,
  type JoinRoomMessage,
  type KindoMessage,
  type PlayerSummary,
} from "@kindo/protocol";

export interface Env {
  ROOM_HUB: DurableObjectNamespace;
}

type ClientKind = "desktop" | "controller" | "spectator";

type HubClient = {
  clientId: string;
  roomId: string | null;
  kind: ClientKind | null;
  playerId: string | null;
  socket: WebSocket;
};

type ControllerClient = {
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

type RoomState = {
  roomId: string;
  desktopClientId: string | null;
  desktopSocket: WebSocket | null;
  controllers: Map<string, ControllerClient>;
  createdAt: number;
  lastActiveAt: number;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, edge: true });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Kindo room WebSocket endpoint", {
        status: 200,
        headers: { "content-type": "text/plain;charset=UTF-8" },
      });
    }

    const id = env.ROOM_HUB.idFromName("global-v1");
    return env.ROOM_HUB.get(id).fetch(request);
  },
};

export class RoomHub implements DurableObject {
  private readonly rooms = new Map<string, RoomState>();
  private readonly clients = new Map<WebSocket, HubClient>();

  constructor(private readonly state: DurableObjectState, private readonly env: Env) {
    void this.state;
    void this.env;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const clientSocket = pair[0];
    const serverSocket = pair[1];
    serverSocket.accept();

    const client = this.createClient(serverSocket);
    this.clients.set(serverSocket, client);

    serverSocket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") {
        this.sendError(serverSocket, "invalid_message", "Kindo messages must be JSON strings");
        return;
      }
      this.handleMessage(serverSocket, event.data);
    });

    serverSocket.addEventListener("close", () => this.disconnect(serverSocket));
    serverSocket.addEventListener("error", () => this.disconnect(serverSocket));

    return new Response(null, {
      status: 101,
      webSocket: clientSocket,
    });
  }

  private handleMessage(socket: WebSocket, json: string): void {
    let message: KindoMessage;
    try {
      message = parseKindoMessageJson(json);
    } catch (error) {
      this.sendError(socket, "invalid_message", error instanceof Error ? error.message : "Invalid JSON message");
      return;
    }

    switch (message.type) {
      case "create_room":
        this.createRoom(socket, message);
        return;
      case "join_room":
        this.joinRoom(socket, message);
        return;
      case "controller_packet":
        this.handleControllerPacket(socket, message);
        return;
      case "controller_command":
        this.handleControllerCommand(socket, message);
        return;
      case "ping":
        this.sendMessage(socket, {
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
        this.sendError(socket, "unexpected_message", `${message.type} is not accepted from clients`);
        return;
    }
  }

  private createRoom(socket: WebSocket, message: CreateRoomMessage): void {
    const client = this.getClient(socket);
    const roomId = message.requestedRoomId ?? this.generateRoomId();
    const now = Date.now();
    const room: RoomState = {
      roomId,
      desktopClientId: client.clientId,
      desktopSocket: socket,
      controllers: new Map(),
      createdAt: now,
      lastActiveAt: now,
    };
    this.rooms.set(roomId, room);

    client.kind = "desktop";
    client.roomId = roomId;
    client.playerId = null;

    this.sendMessage(socket, {
      type: "room_joined",
      roomId,
      clientId: client.clientId,
      clientKind: "desktop",
    });
    this.broadcastPlayerList(room);
  }

  private joinRoom(socket: WebSocket, message: JoinRoomMessage): void {
    const room = this.rooms.get(message.roomId);
    if (!room) {
      this.sendError(socket, "room_not_found", `Room ${message.roomId} does not exist`);
      return;
    }

    const client = this.getClient(socket);
    client.kind = message.clientKind;
    client.roomId = room.roomId;

    if (message.clientKind === "desktop") {
      room.desktopClientId = client.clientId;
      room.desktopSocket = socket;
      client.playerId = null;
      this.sendMessage(socket, {
        type: "room_joined",
        roomId: room.roomId,
        clientId: client.clientId,
        clientKind: "desktop",
      });
      this.broadcastPlayerList(room);
      return;
    }

    if (message.clientKind === "controller") {
      const controller = this.findControllerBySession(room, message.sessionToken) ?? this.createController(room, client.clientId, message.clientName);
      controller.socket = socket;
      controller.connected = true;
      controller.name = message.clientName ?? controller.name;
      client.playerId = controller.playerId;

      this.sendMessage(socket, {
        type: "room_joined",
        roomId: room.roomId,
        clientId: client.clientId,
        clientKind: "controller",
        playerId: controller.playerId,
        sessionToken: controller.sessionToken,
      });
      this.touch(room);
      this.broadcastPlayerList(room);
      return;
    }

    this.sendMessage(socket, {
      type: "room_joined",
      roomId: room.roomId,
      clientId: client.clientId,
      clientKind: "spectator",
    });
  }

  private handleControllerPacket(socket: WebSocket, message: ControllerPacketMessage): void {
    const client = this.clients.get(socket);
    const room = client?.roomId ? this.rooms.get(client.roomId) : undefined;
    if (!client || !room || client.kind !== "controller" || client.playerId !== message.playerId) {
      this.sendError(socket, "unauthorized_packet", "Controller packet did not match the joined room/player");
      return;
    }

    const controller = room.controllers.get(message.playerId);
    if (!controller) {
      this.sendError(socket, "player_not_found", "Controller player is no longer in this room");
      return;
    }

    controller.caps = message.packet.caps;
    controller.packetSeq = message.packet.seq;
    controller.lastPacketAtUnixMs = Date.now();
    this.touch(room);

    this.sendMessage(room.desktopSocket, {
      type: "controller_packet",
      roomId: room.roomId,
      playerId: message.playerId,
      packet: message.packet,
    });
  }

  private handleControllerCommand(socket: WebSocket, message: ControllerCommandMessage): void {
    const client = this.clients.get(socket);
    const room = client?.roomId ? this.rooms.get(client.roomId) : undefined;
    if (!client || !room || client.kind !== "desktop") {
      this.sendError(socket, "unauthorized_command", "Only the desktop client can send controller commands");
      return;
    }

    const targets = message.targetPlayerId
      ? [room.controllers.get(message.targetPlayerId)].filter((candidate): candidate is ControllerClient => Boolean(candidate))
      : [...room.controllers.values()];

    for (const controller of targets) {
      this.sendMessage(controller.socket, {
        type: "controller_command",
        roomId: room.roomId,
        targetPlayerId: controller.playerId,
        command: message.command,
      });
    }
  }

  private disconnect(socket: WebSocket): void {
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

  private createClient(socket: WebSocket): HubClient {
    return {
      clientId: `c_${crypto.randomUUID()}`,
      roomId: null,
      kind: null,
      playerId: null,
      socket,
    };
  }

  private getClient(socket: WebSocket): HubClient {
    const client = this.clients.get(socket);
    if (!client) {
      throw new Error("Missing WebSocket client state");
    }
    return client;
  }

  private createController(room: RoomState, clientId: string, name?: string): ControllerClient {
    const playerId = `p_${room.controllers.size + 1}`;
    const controller: ControllerClient = {
      clientId,
      playerId,
      name: name ?? `Player ${room.controllers.size + 1}`,
      sessionToken: `s_${crypto.randomUUID()}`,
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

  private listPlayers(room: RoomState): PlayerSummary[] {
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
    this.sendMessage(room.desktopSocket, {
      type: "player_list",
      roomId: room.roomId,
      players: this.listPlayers(room),
    });
  }

  private sendMessage(socket: WebSocket | null, message: KindoMessage): boolean {
    if (!socket) {
      return false;
    }
    try {
      socket.send(serializeKindoMessage(message));
      return true;
    } catch {
      return false;
    }
  }

  private sendError(socket: WebSocket | null, code: string, message: string): boolean {
    return this.sendMessage(socket, {
      type: "error",
      code,
      message,
    });
  }

  private touch(room: RoomState): void {
    room.lastActiveAt = Date.now();
  }

  private generateRoomId(): string {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const roomId = randomRoomId();
      if (!this.rooms.has(roomId)) {
        return roomId;
      }
    }
    return crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  }
}

const randomRoomId = (): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
};
