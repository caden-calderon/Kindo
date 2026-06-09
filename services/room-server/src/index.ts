import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";
import { WebSocketServer } from "ws";
import { handleRawMessage } from "./relay.js";
import { RoomManager } from "./rooms.js";

export type RoomServerHandle = {
  server: Server;
  wss: WebSocketServer;
  roomManager: RoomManager;
  close(): Promise<void>;
};

export type RoomServerOptions = {
  port?: number;
  host?: string;
};

export const createRoomServer = (options: RoomServerOptions = {}): RoomServerHandle => {
  const roomManager = new RoomManager();
  const server = createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });

  const wss = new WebSocketServer({ server });
  wss.on("connection", (socket) => {
    console.info(JSON.stringify({ event: "client_connected" }));
    socket.on("message", (raw) => handleRawMessage(roomManager, socket, raw));
    socket.on("close", () => {
      roomManager.disconnect(socket);
      console.info(JSON.stringify({ event: "client_disconnected" }));
    });
  });

  const port = options.port ?? Number(process.env.PORT ?? 8787);
  const host = options.host ?? process.env.HOST ?? "0.0.0.0";
  server.listen(port, host, () => {
    const address = server.address();
    console.info(JSON.stringify({ event: "room_server_listening", address }));
  });

  return {
    server,
    wss,
    roomManager,
    close: () =>
      new Promise<void>((resolve, reject) => {
        wss.close((wssError) => {
          if (wssError) {
            reject(wssError);
            return;
          }
          server.close((serverError) => {
            if (serverError) {
              reject(serverError);
              return;
            }
            resolve();
          });
        });
      }),
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createRoomServer();
}
