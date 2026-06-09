export type FixedTimestepStep = {
  dtMs: number;
  alpha: number;
};

export class FixedTimestepAccumulator {
  private accumulatorMs = 0;
  private lastTimeMs: number | undefined;

  constructor(private readonly stepMs = 1000 / 60, private readonly maxAccumulatedMs = 250) {}

  beginFrame(nowMs: number): FixedTimestepStep[] {
    if (this.lastTimeMs === undefined) {
      this.lastTimeMs = nowMs;
      return [];
    }

    const elapsedMs = Math.min(this.maxAccumulatedMs, Math.max(0, nowMs - this.lastTimeMs));
    this.lastTimeMs = nowMs;
    this.accumulatorMs += elapsedMs;

    const steps: FixedTimestepStep[] = [];
    while (this.accumulatorMs >= this.stepMs) {
      this.accumulatorMs -= this.stepMs;
      steps.push({
        dtMs: this.stepMs,
        alpha: this.accumulatorMs / this.stepMs,
      });
    }

    return steps;
  }

  reset(nowMs?: number): void {
    this.accumulatorMs = 0;
    this.lastTimeMs = nowMs;
  }
}
