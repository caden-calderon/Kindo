# Native iOS ARKit Controller Context

## User Direction

- The product needs Wii-like 6DOF motion for golf, tennis, and bowling.
- iPhone is the immediate test device.
- The user wants the comfortable sideways/paddle grip to remain the baseline.
- Shake to Undo should not appear during controller play.
- The user does not have a Mac, so native iOS builds need a cloud macOS/signing path.

## Current System

- The web protocol already accepts optional `pose6d` data on controller packets.
- The room server and edge Worker relay `pose6d` unchanged.
- The phone web controller attempts WebXR but iOS Safari is expected to fall back to IMU only.
- Desktop currently reports 6DOF state in debug panels.
- GitHub Actions can run an unsigned compile check on hosted macOS; real iPhone installation still requires Apple signing.

## Research Notes

- Apple documents ARKit world tracking as 6DOF tracking for device movement.
- ARSession delegate callbacks provide updated ARFrame camera information.
- UIKit exposes `applicationSupportsShakeToEdit` for disabling Shake to Undo inside a native app.
- TestFlight/cloud signing is the practical no-Mac distribution path for native iPhone testing.
