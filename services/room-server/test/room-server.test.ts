import { defaultControllerCapabilities, parseKindoMessageJson, serializeKindoMessage, type ControllerPacket } from "@kindo/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { createRoomServer, type RoomServerHandle } from "../src/index.js";

let handle: RoomServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

describe("room server", () => {
  it("creates a room, joins a controller, and relays packets", async () => {
    handle = createRoomServer({ port: 0, host: "127.0.0.1" });
    await waitForListening(handle);
    const port = getPort(handle);

    const desktop = await openSocket(`ws://127.0.0.1:${port}`);
    desktop.send(serializeKindoMessage({ type: "create_room", clientKind: "desktop" }));
    const joined = await nextMessage(desktop);
    expect(joined.type).toBe("room_joined");
    if (joined.type !== "room_joined") {
      throw new Error("Expected room_joined");
    }

    const controller = await openSocket(`ws://127.0.0.1:${port}`);
    controller.send(
      serializeKindoMessage({
        type: "join_room",
        roomId: joined.roomId,
        clientKind: "controller",
        clientName: "Test Player",
      }),
    );
    const controllerJoined = await nextMessage(controller);
    expect(controllerJoined.type).toBe("room_joined");
    if (controllerJoined.type !== "room_joined" || !controllerJoined.playerId) {
      throw new Error("Expected controller room_joined");
    }

    await nextMessage(desktop);
    const packet: ControllerPacket = {
      roomId: joined.roomId,
      playerId: controllerJoined.playerId,
      seq: 1,
      sentAtMs: 100,
      caps: defaultControllerCapabilities(),
      pose: { alpha: 1, beta: 2, gamma: 3 },
      pose6d: {
        positionM: [0.2, 0.3, -0.4],
        quaternion: [0, 0, 0, 1],
        source: "webxr",
        trackingState: "normal",
        referenceSpace: "local",
        frameId: 4,
      },
      touch: { primary: false, secondary: false },
      control: {
        handedness: "right",
        grip: "portrait",
        safetyMode: "normal",
        state: "active",
      },
    };
    controller.send(
      serializeKindoMessage({
        type: "controller_packet",
        roomId: joined.roomId,
        playerId: controllerJoined.playerId,
        packet,
      }),
    );

    const relayed = await nextMessage(desktop);
    expect(relayed.type).toBe("controller_packet");
    if (relayed.type === "controller_packet") {
      expect(relayed.packet.seq).toBe(1);
      expect(relayed.packet.pose6d?.trackingState).toBe("normal");
      expect(relayed.packet.pose6d?.positionM).toEqual([0.2, 0.3, -0.4]);
    }

    desktop.close();
    controller.close();
  });
});

const waitForListening = async (serverHandle: RoomServerHandle): Promise<void> => {
  if (serverHandle.server.listening) {
    return;
  }
  await new Promise<void>((resolve) => serverHandle.server.once("listening", resolve));
};

const getPort = (serverHandle: RoomServerHandle): number => {
  const address = serverHandle.server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  return address.port;
};

const openSocket = async (url: string): Promise<WebSocket> => {
  const socket = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  return socket;
};

const nextMessage = async (socket: WebSocket): Promise<ReturnType<typeof parseKindoMessageJson>> =>
  new Promise((resolve, reject) => {
    socket.once("message", (data) => {
      try {
        resolve(parseKindoMessageJson(data.toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    socket.once("error", reject);
  });
