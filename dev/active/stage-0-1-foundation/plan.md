# Kindo Stage 0 / Stage 1 Foundation Plan

## Goal

Build the first Kindo technical spike: phone joins a desktop room, streams browser motion packets over WebSocket, desktop visualizes a live phone orientation in Babylon.js, and core motion/debug/replay packages exist without taking a dependency on Babylon or React.

## Architecture Decisions

- Use a pnpm TypeScript monorepo with Vite apps and a Node `ws` room server.
- Keep `@kindo/protocol` as the shared schema boundary and validate untrusted WebSocket JSON with Zod.
- Use readable JSON packets for Stage 0. Binary/WebRTC are later optimizations after schema and latency data settle.
- Put Babylon only in `apps/desktop-console/src/babylon`. All motion, calibration, recognizer, replay, and runtime packages are engine-agnostic.
- Use legacy `DeviceMotionEvent` and `DeviceOrientationEvent` first. Generic Sensor API is detected as a capability but not required.
- Treat calibration and replay as first-class state now, even while math and recognizers are intentionally simple.

## Stage 0 Surfaces

- Desktop console creates a room, shows room code and QR join URL, receives controller packets, sends haptics, and records packet traces.
- Phone controller joins by URL/code, requests motion permission from a tap, attempts wake lock, streams sequence-numbered packets, and handles haptic commands with fallback.
- Room server owns room membership and relay only.

## Stage 1 Package Skeleton

- `protocol`: message and packet types plus runtime validation.
- `transport`: browser WebSocket client helpers.
- `controller-core`: capabilities, permission, wake lock, haptics.
- `motion-core`: raw sample conversion, quality tracking, filtering, orientation helpers.
- `calibration`: first-class player calibration snapshots.
- `recognizers`: finite-state recognizer interfaces and bowling/tennis placeholders.
- `replay`: packet recording, JSON/NDJSON serialization, replay iteration.
- `game-runtime`: fixed timestep and event/session primitives.

## Deferred

- Full bowling gameplay, tennis, golf, WebRTC, accounts, polished art, ECS/editor, and production deployment.
