import type { TennisSwingIntent } from "@kindo/protocol";
import type { MotionFrame } from "@kindo/motion-core";
import type { MotionRecognizer, RecognizerContext, RecognizerDebugState } from "./recognizerTypes.js";

export class TennisSwingRecognizer implements MotionRecognizer<TennisSwingIntent> {
  readonly id = "tennis_swing";

  reset(): void {
    // Stage 1 placeholder. Tennis comes after bowling once the shared pipeline is exercised.
  }

  update(_frame: MotionFrame, _context: RecognizerContext): TennisSwingIntent | null {
    return null;
  }

  getDebugState(): RecognizerDebugState {
    return {
      id: this.id,
      phase: "idle",
      confidence: 0,
      values: {
        placeholder: true,
      },
    };
  }
}
