export type RoomServerUrlOptions = {
  protocol?: string;
  hostname?: string;
  port?: string | number;
};

export const getDefaultRoomServerUrl = (locationRef: Location = window.location): string => {
  const protocol = locationRef.protocol === "https:" ? "wss:" : "ws:";
  const hostname = locationRef.hostname || "localhost";
  return `${protocol}//${hostname}:8787`;
};

export const getDefaultPhoneControllerUrl = (roomId: string, locationRef: Location = window.location): string => {
  const protocol = locationRef.protocol;
  const hostname = locationRef.hostname || "localhost";
  return `${protocol}//${hostname}:5174/join/${roomId}`;
};

export const createRoomServerUrl = (options: RoomServerUrlOptions): string => {
  const protocol = options.protocol ?? "ws:";
  const hostname = options.hostname ?? "localhost";
  const port = options.port === undefined ? "" : `:${options.port}`;
  return `${protocol}//${hostname}${port}`;
};
