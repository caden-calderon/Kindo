import { getDefaultPhoneControllerUrl, getDefaultRoomServerUrl } from "@kindo/transport";

export const getRoomServerUrl = (): string => import.meta.env.VITE_ROOM_SERVER_URL ?? getDefaultRoomServerUrl();

export const getPhoneJoinUrl = (roomId: string): string => {
  const configured = import.meta.env.VITE_PHONE_CONTROLLER_URL as string | undefined;
  if (configured) {
    return `${configured.replace(/\/$/, "")}/join/${roomId}`;
  }
  return getDefaultPhoneControllerUrl(roomId);
};
