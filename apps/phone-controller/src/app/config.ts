import { getDefaultRoomServerUrl, normalizeConfiguredUrl } from "@kindo/transport";

export const getRoomServerUrl = (): string => normalizeConfiguredUrl(import.meta.env.VITE_ROOM_SERVER_URL) ?? getDefaultRoomServerUrl();

export const getRoomIdFromLocation = (locationRef: Location = window.location): string => {
  const match = locationRef.pathname.match(/\/(?:join|controller)\/([A-Z0-9]{4,8})/i);
  return match?.[1]?.toUpperCase() ?? new URLSearchParams(locationRef.search).get("room")?.toUpperCase() ?? "";
};
