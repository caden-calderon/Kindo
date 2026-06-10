# Kindo VIO / 6DOF Context

## User Direction

- Kindo needs Wii-like physical motion for golf/tennis/bowling.
- 3DOF is insufficient for the product vision.
- Testing device is iPhone, not Android.
- Shake-to-undo appears during controller use and should be disabled or mitigated.

## Research Notes

- ARKit and ARCore use visual-inertial odometry: camera feature tracking plus IMU fusion.
- Browser IMU alone cannot provide stable 3D position.
- WebXR can expose spatial pose where available, but iOS Safari support is not a dependable route for iPhone ARKit testing.
- Native iOS has `applicationSupportsShakeToEdit`; web apps do not.
