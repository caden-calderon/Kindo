import { defaultControllerCapabilities, type ControllerCapabilities, type DeviceInfo } from "@kindo/protocol";

export const detectControllerCapabilities = (targetWindow: Window = window): ControllerCapabilities => ({
  motion: "DeviceMotionEvent" in targetWindow,
  orientation: "DeviceOrientationEvent" in targetWindow,
  vibration: "vibrate" in targetWindow.navigator,
  wakeLock: "wakeLock" in targetWindow.navigator,
  genericSensor: "Accelerometer" in targetWindow || "Gyroscope" in targetWindow,
  camera: Boolean(targetWindow.navigator.mediaDevices?.getUserMedia),
  webxr: "xr" in targetWindow.navigator,
  vio: "xr" in targetWindow.navigator,
});

export const getDeviceInfo = (navigatorRef: Navigator = navigator): DeviceInfo => ({
  userAgent: navigatorRef.userAgent,
  platform: navigatorRef.platform,
  vendor: navigatorRef.vendor,
  maxTouchPoints: navigatorRef.maxTouchPoints,
});

export const unavailableCapabilities = (): ControllerCapabilities => defaultControllerCapabilities();
