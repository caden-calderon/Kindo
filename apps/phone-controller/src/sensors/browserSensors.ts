import {
  invertQuaternion,
  multiplyQuaternions,
  normalizeQuaternion,
  rotateVec3ByQuaternion,
  type QuaternionTuple,
  type Vec3,
} from "@kindo/motion-core";
import type { ControllerPacket, SpatialPoseSource, SpatialTrackingState } from "@kindo/protocol";

type Pose6D = NonNullable<ControllerPacket["pose6d"]>;

export type SpatialTrackingStatus = {
  source: SpatialPoseSource;
  state: SpatialTrackingState;
  supported: boolean;
  active: boolean;
  message: string;
};

export type BrowserSensorSnapshot = {
  orientation?: NonNullable<ControllerPacket["pose"]>;
  motion?: NonNullable<ControllerPacket["motion"]>;
  pose6d?: Pose6D;
  spatialTracking: SpatialTrackingStatus;
};

type NavigatorWithXR = Navigator & {
  xr?: {
    isSessionSupported?(mode: "immersive-ar"): Promise<boolean>;
    requestSession?(mode: "immersive-ar", options?: XRSessionInitLike): Promise<XRSessionLike>;
  };
};

type WindowWithXR = Window & {
  XRWebGLLayer?: new (session: XRSessionLike, context: WebGLRenderingContext) => unknown;
};

type XRSessionInitLike = {
  requiredFeatures?: string[];
  optionalFeatures?: string[];
};

type XRSessionLike = EventTarget & {
  requestReferenceSpace(type: "local" | "local-floor" | "viewer"): Promise<XRReferenceSpaceLike>;
  requestAnimationFrame(callback: (time: number, frame: XRFrameLike) => void): number;
  cancelAnimationFrame(handle: number): void;
  updateRenderState?(state: { baseLayer?: unknown }): void;
  end(): Promise<void>;
};

type XRReferenceSpaceLike = object;

type XRFrameLike = {
  getViewerPose(referenceSpace: XRReferenceSpaceLike): XRViewerPoseLike | null;
};

type XRViewerPoseLike = {
  transform: {
    position: { x?: number; y?: number; z?: number };
    orientation: { x?: number; y?: number; z?: number; w?: number };
  };
};

type SpatialOrigin = {
  positionM: Vec3;
  quaternion: QuaternionTuple;
};

export class BrowserSensorSampler {
  private orientation?: NonNullable<ControllerPacket["pose"]>;
  private motion?: NonNullable<ControllerPacket["motion"]>;
  private pose6d?: Pose6D;
  private rawPose6d?: Pose6D;
  private running = false;
  private spatialStatus: SpatialTrackingStatus = unavailableSpatialStatus("VIO not started");
  private xrSession: XRSessionLike | undefined;
  private xrReferenceSpace: XRReferenceSpaceLike | undefined;
  private xrFrameHandle: number | undefined;
  private xrCanvas: HTMLCanvasElement | undefined;
  private spatialOrigin?: SpatialOrigin;
  private spatialFrameId = 0;

  start(): void {
    if (this.running) {
      return;
    }
    window.addEventListener("deviceorientation", this.handleOrientation);
    window.addEventListener("devicemotion", this.handleMotion);
    this.running = true;
  }

  stop(): void {
    if (!this.running) {
      return;
    }
    window.removeEventListener("deviceorientation", this.handleOrientation);
    window.removeEventListener("devicemotion", this.handleMotion);
    this.running = false;
    void this.stopSpatialTracking();
  }

  async startSpatialTracking(targetWindow: Window = window): Promise<SpatialTrackingStatus> {
    if (this.xrSession) {
      return this.spatialStatus;
    }

    const navigatorWithXr = targetWindow.navigator as NavigatorWithXR;
    if (!navigatorWithXr.xr?.requestSession) {
      this.setSpatialStatus(unavailableSpatialStatus("VIO unavailable in this browser"));
      return this.spatialStatus;
    }

    const supported = navigatorWithXr.xr.isSessionSupported ? await navigatorWithXr.xr.isSessionSupported("immersive-ar") : true;
    if (!supported) {
      this.setSpatialStatus(unavailableSpatialStatus("WebXR AR session unsupported"));
      return this.spatialStatus;
    }

    this.setSpatialStatus({
      source: "webxr",
      state: "initializing",
      supported: true,
      active: false,
      message: "Starting VIO tracking",
    });

    try {
      const session = await navigatorWithXr.xr.requestSession("immersive-ar", {
        requiredFeatures: ["local"],
        optionalFeatures: ["local-floor"],
      });
      const gl = await this.createXrCompatibleContext(targetWindow);
      const layerCtor = (targetWindow as WindowWithXR).XRWebGLLayer;
      if (layerCtor && session.updateRenderState) {
        session.updateRenderState({ baseLayer: new layerCtor(session, gl) });
      }

      const referenceSpace = await session.requestReferenceSpace("local");
      this.xrSession = session;
      this.xrReferenceSpace = referenceSpace;
      this.setSpatialStatus({
        source: "webxr",
        state: "initializing",
        supported: true,
        active: true,
        message: "VIO initializing",
      });

      session.addEventListener("end", this.handleXrEnded);
      this.xrFrameHandle = session.requestAnimationFrame(this.handleXrFrame);
      return this.spatialStatus;
    } catch (error) {
      this.cleanupSpatialTracking();
      this.setSpatialStatus({
        source: "webxr",
        state: "unavailable",
        supported: true,
        active: false,
        message: error instanceof Error ? error.message : "VIO start failed",
      });
      return this.spatialStatus;
    }
  }

  async stopSpatialTracking(): Promise<void> {
    const session = this.xrSession;
    if (!session) {
      return;
    }
    this.cleanupSpatialTracking();
    await session.end().catch(() => undefined);
  }

  resetSpatialOrigin(): boolean {
    if (!this.rawPose6d) {
      return false;
    }

    this.spatialOrigin = {
      positionM: this.rawPose6d.positionM,
      quaternion: this.rawPose6d.quaternion,
    };
    this.pose6d = rebaseSpatialPose(this.rawPose6d, this.spatialOrigin);
    return true;
  }

  getSpatialTrackingStatus(): SpatialTrackingStatus {
    return this.spatialStatus;
  }

  getSnapshot(): BrowserSensorSnapshot {
    const snapshot: BrowserSensorSnapshot = {
      spatialTracking: this.spatialStatus,
    };
    if (this.orientation) {
      snapshot.orientation = this.orientation;
    }
    if (this.motion) {
      snapshot.motion = this.motion;
    }
    if (this.pose6d) {
      snapshot.pose6d = this.pose6d;
    }
    return snapshot;
  }

  private async createXrCompatibleContext(targetWindow: Window): Promise<WebGLRenderingContext> {
    const canvas = targetWindow.document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    canvas.style.cssText = "position:fixed;left:-10px;top:-10px;width:1px;height:1px;opacity:0;pointer-events:none;";
    targetWindow.document.body.appendChild(canvas);
    this.xrCanvas = canvas;

    const gl = canvas.getContext("webgl", { xrCompatible: true }) as (WebGLRenderingContext & { makeXRCompatible?: () => Promise<void> }) | null;
    if (!gl) {
      throw new Error("WebGL unavailable for VIO session");
    }
    await gl.makeXRCompatible?.();
    return gl;
  }

  private readonly handleXrFrame = (_time: number, frame: XRFrameLike): void => {
    const session = this.xrSession;
    const referenceSpace = this.xrReferenceSpace;
    if (!session || !referenceSpace) {
      return;
    }

    const viewerPose = frame.getViewerPose(referenceSpace);
    if (viewerPose) {
      const rawPose = spatialPoseFromViewerPose(viewerPose, ++this.spatialFrameId);
      this.rawPose6d = rawPose;
      this.pose6d = this.spatialOrigin ? rebaseSpatialPose(rawPose, this.spatialOrigin) : rawPose;
      this.setSpatialStatus({
        source: "webxr",
        state: "normal",
        supported: true,
        active: true,
        message: "VIO tracking",
      });
    } else {
      this.setSpatialStatus({
        source: "webxr",
        state: "limited",
        supported: true,
        active: true,
        message: "VIO pose limited",
      });
    }

    this.xrFrameHandle = session.requestAnimationFrame(this.handleXrFrame);
  };

  private readonly handleXrEnded = (): void => {
    this.cleanupSpatialTracking();
    this.setSpatialStatus({
      source: "webxr",
      state: "lost",
      supported: true,
      active: false,
      message: "VIO session ended",
    });
  };

  private cleanupSpatialTracking(): void {
    const session = this.xrSession;
    if (session && this.xrFrameHandle !== undefined) {
      session.cancelAnimationFrame(this.xrFrameHandle);
    }
    session?.removeEventListener("end", this.handleXrEnded);
    this.xrSession = undefined;
    this.xrReferenceSpace = undefined;
    this.xrFrameHandle = undefined;
    this.xrCanvas?.remove();
    this.xrCanvas = undefined;
  }

  private setSpatialStatus(status: SpatialTrackingStatus): void {
    this.spatialStatus = status;
  }

  private readonly handleOrientation = (event: DeviceOrientationEvent): void => {
    const orientation: NonNullable<ControllerPacket["pose"]> = {};
    if (event.alpha !== null) {
      orientation.alpha = event.alpha;
    }
    if (event.beta !== null) {
      orientation.beta = event.beta;
    }
    if (event.gamma !== null) {
      orientation.gamma = event.gamma;
    }
    if (event.absolute !== undefined) {
      orientation.absolute = event.absolute;
    }
    this.orientation = orientation;
  };

  private readonly handleMotion = (event: DeviceMotionEvent): void => {
    const motion: NonNullable<ControllerPacket["motion"]> = {};
    const acc = vectorFromAcceleration(event.acceleration);
    const accG = vectorFromAcceleration(event.accelerationIncludingGravity);
    const gyroDeg = vectorFromRotationRate(event.rotationRate);

    if (acc) {
      motion.acc = acc;
    }
    if (accG) {
      motion.accG = accG;
    }
    if (gyroDeg) {
      motion.gyroDeg = gyroDeg;
    }
    if (event.interval !== undefined) {
      motion.intervalMs = event.interval;
    }
    this.motion = motion;
  };
}

const unavailableSpatialStatus = (message: string): SpatialTrackingStatus => ({
  source: "webxr",
  state: "unavailable",
  supported: false,
  active: false,
  message,
});

const spatialPoseFromViewerPose = (viewerPose: XRViewerPoseLike, frameId: number): Pose6D => ({
  positionM: [
    viewerPose.transform.position.x ?? 0,
    viewerPose.transform.position.y ?? 0,
    viewerPose.transform.position.z ?? 0,
  ],
  quaternion: normalizeQuaternion([
    viewerPose.transform.orientation.x ?? 0,
    viewerPose.transform.orientation.y ?? 0,
    viewerPose.transform.orientation.z ?? 0,
    viewerPose.transform.orientation.w ?? 1,
  ]),
  source: "webxr",
  trackingState: "normal",
  confidence: 1,
  referenceSpace: "local",
  frameId,
});

const rebaseSpatialPose = (pose: Pose6D, origin: SpatialOrigin): Pose6D => {
  const inverseOrigin = invertQuaternion(origin.quaternion);
  const delta: Vec3 = [
    pose.positionM[0] - origin.positionM[0],
    pose.positionM[1] - origin.positionM[1],
    pose.positionM[2] - origin.positionM[2],
  ];
  return {
    ...pose,
    positionM: rotateVec3ByQuaternion(delta, inverseOrigin),
    quaternion: multiplyQuaternions(inverseOrigin, pose.quaternion),
    linearVelocityMps: pose.linearVelocityMps ? rotateVec3ByQuaternion(pose.linearVelocityMps, inverseOrigin) : undefined,
    referenceSpace: "kindo-room",
  };
};

const vectorFromAcceleration = (value: DeviceMotionEventAcceleration | null): [number, number, number] | undefined => {
  if (!value || value.x === null || value.y === null || value.z === null) {
    return undefined;
  }
  return [value.x, value.y, value.z];
};

const vectorFromRotationRate = (value: DeviceMotionEventRotationRate | null): [number, number, number] | undefined => {
  if (!value || value.alpha === null || value.beta === null || value.gamma === null) {
    return undefined;
  }
  return [value.alpha, value.beta, value.gamma];
};
