import type { ControllerCommand } from "@kindo/protocol";

export const vibrate = (pattern: number | number[], navigatorRef: Navigator = navigator): boolean => {
  if (!("vibrate" in navigatorRef)) {
    return false;
  }
  return navigatorRef.vibrate(pattern);
};

export const applyControllerCommand = (command: ControllerCommand, navigatorRef: Navigator = navigator): boolean => {
  if (command.type === "vibrate") {
    return vibrate(command.pattern, navigatorRef);
  }
  return false;
};
