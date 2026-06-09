import { KindoMessageSchema, parseKindoMessageJson, serializeKindoMessage, type KindoMessage } from "@kindo/protocol";

export type TransportStatus = "idle" | "connecting" | "open" | "closed" | "error";

export type KindoSocketClientOptions = {
  url: string;
  webSocketFactory?: (url: string) => WebSocket;
};

export type MessageListener = (message: KindoMessage) => void;
export type StatusListener = (status: TransportStatus) => void;

export class KindoSocketClient {
  private socket: WebSocket | undefined;
  private statusValue: TransportStatus = "idle";
  private readonly messageListeners = new Set<MessageListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private readonly webSocketFactory: (url: string) => WebSocket;

  constructor(private readonly options: KindoSocketClientOptions) {
    this.webSocketFactory = options.webSocketFactory ?? ((url) => new WebSocket(url));
  }

  get status(): TransportStatus {
    return this.statusValue;
  }

  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
      return;
    }

    this.setStatus("connecting");
    const socket = this.webSocketFactory(this.options.url);
    this.socket = socket;

    socket.addEventListener("open", () => this.setStatus("open"));
    socket.addEventListener("close", () => this.setStatus("closed"));
    socket.addEventListener("error", () => this.setStatus("error"));
    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") {
        return;
      }
      try {
        this.emitMessage(parseKindoMessageJson(event.data));
      } catch (error) {
        this.emitMessage({
          type: "error",
          code: "invalid_message",
          message: error instanceof Error ? error.message : "Received invalid message",
        });
      }
    });
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = undefined;
    this.setStatus("closed");
  }

  send(message: KindoMessage): boolean {
    KindoMessageSchema.parse(message);
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.socket.send(serializeKindoMessage(message));
    return true;
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.statusValue);
    return () => this.statusListeners.delete(listener);
  }

  private emitMessage(message: KindoMessage): void {
    for (const listener of this.messageListeners) {
      listener(message);
    }
  }

  private setStatus(status: TransportStatus): void {
    this.statusValue = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}
