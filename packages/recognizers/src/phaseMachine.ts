import type { MotionPhase } from "@kindo/protocol";

export type PhaseTransition = {
  from: MotionPhase;
  to: MotionPhase;
  atMs: number;
  reason: string;
};

export class PhaseMachine {
  private phaseValue: MotionPhase = "idle";
  private readonly historyValue: PhaseTransition[] = [];

  get phase(): MotionPhase {
    return this.phaseValue;
  }

  get history(): readonly PhaseTransition[] {
    return this.historyValue;
  }

  transition(to: MotionPhase, atMs: number, reason: string): void {
    if (this.phaseValue === to) {
      return;
    }

    this.historyValue.push({
      from: this.phaseValue,
      to,
      atMs,
      reason,
    });
    if (this.historyValue.length > 24) {
      this.historyValue.shift();
    }
    this.phaseValue = to;
  }

  reset(): void {
    this.phaseValue = "idle";
    this.historyValue.length = 0;
  }
}
