export type SensorPermissionState = "granted" | "denied" | "prompt" | "unsupported";

export type MotionPermissionResult = {
  motion: SensorPermissionState;
  orientation: SensorPermissionState;
  errors: string[];
};

type PermissionRequestingConstructor = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

export const requestMotionPermissions = async (targetWindow: Window = window): Promise<MotionPermissionResult> => {
  const errors: string[] = [];
  const motion = await requestPermissionFor((targetWindow as unknown as { DeviceMotionEvent?: PermissionRequestingConstructor }).DeviceMotionEvent, errors);
  const orientation = await requestPermissionFor(
    (targetWindow as unknown as { DeviceOrientationEvent?: PermissionRequestingConstructor }).DeviceOrientationEvent,
    errors,
  );

  return {
    motion,
    orientation,
    errors,
  };
};

const requestPermissionFor = async (
  constructorRef: PermissionRequestingConstructor | undefined,
  errors: string[],
): Promise<SensorPermissionState> => {
  if (!constructorRef) {
    return "unsupported";
  }

  if (!constructorRef.requestPermission) {
    return "granted";
  }

  try {
    return await constructorRef.requestPermission();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "permission_request_failed");
    return "denied";
  }
};
