# Kindo VIO / 6DOF Plan

## Goal

Promote true spatial pose to a first-class Kindo input path so golf, tennis, bowling, and future games can consume physical hand/phone movement instead of only 3DOF orientation gestures.

## Constraints

- iPhone testing is the immediate target.
- iOS Safari does not reliably expose ARKit VIO through WebXR today, so the web controller must report capability truthfully and prepare for a native ARKit bridge.
- The existing browser IMU stream remains the fallback path.
- Shake-to-undo cannot be globally disabled by web content; native UIKit can disable it, and the web app can avoid focused text inputs during play.

## Decisions

- Add optional `pose6d` packet data without breaking IMU-only packets.
- Track `source`, `trackingState`, `referenceSpace`, and `confidence` with every spatial pose.
- Add WebXR/VIO capability flags separately from generic motion/orientation.
- Attempt WebXR `immersive-ar` spatial tracking only from the explicit `Enable Motion` user gesture.
- Rebase spatial origin on controller reset when a spatial pose exists.
- Mitigate iOS shake-to-undo by blurring active edit controls after join, enable, touch start, and reset.

## Native Bridge Next

The eventual iPhone-quality path should be a thin ARKit controller app or wrapper that streams the same `pose6d` shape over the existing room protocol.
