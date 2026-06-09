export type WakeLockHandle = {
  supported: boolean;
  released: boolean;
  release(): Promise<void>;
};

type WakeLockSentinelLike = {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request(type: "screen"): Promise<WakeLockSentinelLike>;
  };
};

export const requestScreenWakeLock = async (navigatorRef: Navigator = navigator): Promise<WakeLockHandle> => {
  const wakeLockNavigator = navigatorRef as WakeLockNavigator;
  if (!wakeLockNavigator.wakeLock) {
    return unsupportedWakeLock();
  }

  try {
    const sentinel = await wakeLockNavigator.wakeLock.request("screen");
    return {
      supported: true,
      get released() {
        return sentinel.released;
      },
      release: () => sentinel.release(),
    };
  } catch {
    return unsupportedWakeLock();
  }
};

const unsupportedWakeLock = (): WakeLockHandle => ({
  supported: false,
  released: true,
  release: async () => undefined,
});
