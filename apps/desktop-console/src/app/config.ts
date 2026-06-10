import { getDefaultPhoneControllerUrl, getDefaultRoomServerUrl, normalizeConfiguredUrl } from "@kindo/transport";

export const getRoomServerUrl = (): string => normalizeConfiguredUrl(import.meta.env.VITE_ROOM_SERVER_URL) ?? getDefaultRoomServerUrl();

export const getPhoneJoinUrl = (roomId: string): string => {
  const configured = normalizeConfiguredUrl(import.meta.env.VITE_PHONE_CONTROLLER_URL);
  if (configured) {
    return `${configured.replace(/\/$/, "")}/join/${roomId}`;
  }
  return getDefaultPhoneControllerUrl(roomId);
};
