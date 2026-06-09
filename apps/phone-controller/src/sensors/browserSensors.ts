import type { ControllerPacket } from "@kindo/protocol";

export type BrowserSensorSnapshot = {
  orientation?: NonNullable<ControllerPacket["pose"]>;
  motion?: NonNullable<ControllerPacket["motion"]>;
};

export class BrowserSensorSampler {
  private orientation?: NonNullable<ControllerPacket["pose"]>;
  private motion?: NonNullable<ControllerPacket["motion"]>;
  private running = false;

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
  }

  getSnapshot(): BrowserSensorSnapshot {
    const snapshot: BrowserSensorSnapshot = {};
    if (this.orientation) {
      snapshot.orientation = this.orientation;
    }
    if (this.motion) {
      snapshot.motion = this.motion;
    }
    return snapshot;
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
