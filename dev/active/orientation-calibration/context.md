# Kindo Orientation Calibration Context

## User Feedback

- Connection now works in production.
- Current axes feel mapped wrong when turning the phone.
- Most comfortable grip is sideways with the power button facing the user.
- The screen should feel like the face of a paddle or tennis racket.

## Current Code State

- Phone streams raw `DeviceOrientationEvent` alpha/beta/gamma and motion data.
- Desktop Babylon preview maps raw orientation with a rough Stage 0 helper and no neutral frame.
- Phone has a neutral button, but it only changes local state and does not calibrate the desktop/runtime.
