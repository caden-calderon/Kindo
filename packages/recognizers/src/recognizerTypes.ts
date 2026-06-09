import type { MotionIntent, MotionPhase } from "@kindo/protocol";
import type { MotionFrame } from "@kindo/motion-core";

export type RecognizerContext = {
  playerId: string;
  touchPrimary: boolean;
  laneAim?: number;
  nowMs?: number;
};

export type RecognizerDebugState = {
  id: string;
  phase: MotionPhase;
  confidence: number;
  lastEventAtMs?: number;
  values: Record<string, number | string | boolean | undefined>;
};

export interface MotionRecognizer<TIntent extends MotionIntent = MotionIntent> {
  readonly id: string;
  reset(): void;
  update(frame: MotionFrame, context: RecognizerContext): TIntent | null;
  getDebugState(): RecognizerDebugState;
}
