import type { BowlingThrowIntent, MotionPhase } from "@kindo/protocol";
import { extractMotionFeatures, normalize01, type MotionFrame } from "@kindo/motion-core";
import { PhaseMachine } from "./phaseMachine.js";
import type { MotionRecognizer, RecognizerContext, RecognizerDebugState } from "./recognizerTypes.js";

export type BowlingThrowRecognizerOptions = {
  backswingVelocityThresholdDeg?: number;
  forwardVelocityThresholdDeg?: number;
  releaseVelocityThresholdDeg?: number;
};

export class BowlingThrowRecognizer implements MotionRecognizer<BowlingThrowIntent> {
  readonly id = "bowling_throw";

  private readonly phaseMachine = new PhaseMachine();
  private readonly backswingVelocityThresholdDeg: number;
  private readonly forwardVelocityThresholdDeg: number;
  private readonly releaseVelocityThresholdDeg: number;
  private maxForwardVelocity = 0;
  private maxAngularSpeed = 0;
  private lastReleaseAtMs = -Infinity;
  private lastPrimary = false;
  private latestConfidence = 0;
  private latestVelocity = 0;

  constructor(options: BowlingThrowRecognizerOptions = {}) {
    this.backswingVelocityThresholdDeg = options.backswingVelocityThresholdDeg ?? -80;
    this.forwardVelocityThresholdDeg = options.forwardVelocityThresholdDeg ?? 110;
    this.releaseVelocityThresholdDeg = options.releaseVelocityThresholdDeg ?? 160;
  }

  reset(): void {
    this.phaseMachine.reset();
    this.maxForwardVelocity = 0;
    this.maxAngularSpeed = 0;
    this.lastReleaseAtMs = -Infinity;
    this.lastPrimary = false;
    this.latestConfidence = 0;
    this.latestVelocity = 0;
  }

  update(frame: MotionFrame, context: RecognizerContext): BowlingThrowIntent | null {
    const features = extractMotionFeatures(frame);
    const swingVelocity = features.primarySwingVelocityDeg;
    const angularSpeed = features.angularSpeedDeg;
    this.latestVelocity = swingVelocity;
    this.maxAngularSpeed = Math.max(this.maxAngularSpeed, angularSpeed);

    const phase = this.phaseMachine.phase;
    const touchReleased = this.lastPrimary && !context.touchPrimary;
    this.lastPrimary = context.touchPrimary;

    if (!context.touchPrimary && phase === "idle") {
      this.latestConfidence = frame.quality.confidence * 0.4;
      return null;
    }

    if (context.touchPrimary && phase === "idle") {
      this.phaseMachine.transition("ready", frame.tMs, "primary_touch");
    }

    if (this.phaseMachine.phase === "ready" && swingVelocity < this.backswingVelocityThresholdDeg) {
      this.phaseMachine.transition("backswing", frame.tMs, "negative_velocity");
    }

    if (this.phaseMachine.phase === "backswing" && Math.abs(swingVelocity) < 25) {
      this.phaseMachine.transition("transition", frame.tMs, "velocity_near_zero");
    }

    if (
      (this.phaseMachine.phase === "backswing" || this.phaseMachine.phase === "transition") &&
      swingVelocity > this.forwardVelocityThresholdDeg
    ) {
      this.phaseMachine.transition("forward", frame.tMs, "forward_velocity");
    }

    if (this.phaseMachine.phase === "forward") {
      this.maxForwardVelocity = Math.max(this.maxForwardVelocity, swingVelocity);
      const validReleaseVelocity = this.maxForwardVelocity > this.releaseVelocityThresholdDeg;
      if (touchReleased || (validReleaseVelocity && swingVelocity < this.maxForwardVelocity * 0.55)) {
        this.phaseMachine.transition("impact_or_release", frame.tMs, touchReleased ? "touch_release" : "velocity_peak_drop");
        this.lastReleaseAtMs = frame.tMs;
        const intent = this.createIntent(context, frame);
        this.phaseMachine.transition("follow_through", frame.tMs, "intent_emitted");
        return intent;
      }
    }

    if (this.phaseMachine.phase === "follow_through" && frame.tMs - this.lastReleaseAtMs > 450) {
      this.phaseMachine.transition("recovery", frame.tMs, "follow_through_timeout");
    }

    if (this.phaseMachine.phase === "recovery" && !context.touchPrimary) {
      this.phaseMachine.transition("idle", frame.tMs, "touch_idle");
      this.maxForwardVelocity = 0;
      this.maxAngularSpeed = 0;
    }

    this.latestConfidence = this.estimateConfidence(frame.quality.confidence, this.phaseMachine.phase);
    return null;
  }

  getDebugState(): RecognizerDebugState {
    const debug: RecognizerDebugState = {
      id: this.id,
      phase: this.phaseMachine.phase,
      confidence: this.latestConfidence,
      values: {
        latestVelocity: Math.round(this.latestVelocity),
        maxForwardVelocity: Math.round(this.maxForwardVelocity),
        maxAngularSpeed: Math.round(this.maxAngularSpeed),
      },
    };

    if (Number.isFinite(this.lastReleaseAtMs)) {
      debug.lastEventAtMs = this.lastReleaseAtMs;
    }

    return debug;
  }

  private createIntent(context: RecognizerContext, frame: MotionFrame): BowlingThrowIntent {
    const speed = normalize01(this.maxForwardVelocity, this.releaseVelocityThresholdDeg, 900);
    const twist = frame.angularVelocityDeg?.[2] ?? 0;
    const smoothness = frame.quality.jitterMs === undefined ? 0.7 : 1 - normalize01(frame.quality.jitterMs, 4, 40);
    const timing = this.phaseMachine.history.some((entry) => entry.to === "backswing") ? 0.8 : 0.45;
    const confidence = this.estimateConfidence(frame.quality.confidence, "impact_or_release");

    this.latestConfidence = confidence;

    return {
      type: "bowling_throw",
      playerId: context.playerId,
      releaseSpeed: speed,
      releaseAngle: context.laneAim ?? 0,
      laneAim: context.laneAim ?? 0,
      loft: normalize01(frame.accelerationIncludingGravity?.[2] ?? 0, 0, 15),
      wristTwist: twist,
      spinAxis: Math.sign(twist),
      spinAmount: normalize01(Math.abs(twist), 60, 420),
      smoothness,
      timing,
      confidence,
      debug: {
        maxForwardVelocity: this.maxForwardVelocity,
        maxAngularSpeed: this.maxAngularSpeed,
        phaseCount: this.phaseMachine.history.length,
      },
    };
  }

  private estimateConfidence(qualityConfidence: number, phase: MotionPhase): number {
    const phaseScore = phase === "impact_or_release" || phase === "follow_through" ? 0.4 : 0.15;
    const velocityScore = normalize01(this.maxForwardVelocity, this.forwardVelocityThresholdDeg, 650) * 0.3;
    return Math.min(1, qualityConfidence * 0.3 + phaseScore + velocityScore);
  }
}
