# Kindo Orientation Calibration Plan

## Goal

Make the Stage 1 phone preview feel physically aligned for the first real grip: phone held sideways as a paddle/racket face, with the power-button edge toward the player.

## Decisions

- Keep incoming `ControllerPacket` sensor values raw for logging, replay, and future recognizers.
- Interpret raw packets through per-player calibration state on the desktop/runtime side.
- Use `landscape` as the first paddle grip profile instead of adding a new protocol enum before we have more real device traces.
- Treat phone neutral resets as packet metadata so the controller can trigger calibration while it is in the user's hand.
- Keep Babylon-specific mesh presentation in the desktop app; quaternion math and grip transforms stay in engine-agnostic packages.

## Scope

- Add quaternion composition/inversion helpers to `@kindo/motion-core`.
- Add calibrated orientation helpers to `@kindo/calibration`.
- Add a real neutral reset signal to controller packets.
- Default the phone controller to landscape/paddle grip.
- Add desktop reset controls and pass calibration into the Babylon preview.
- Add focused tests around neutral calibration behavior.
