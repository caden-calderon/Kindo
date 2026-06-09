# Kindo Stage 0 / Stage 1 Context

## Source Inputs Read

- `/home/caden/Downloads/kindo_codex_handoff.md`
- `/home/caden/Downloads/deep-research-report(4).md`

## Core Constraints

- Kindo is a browser-first phone-as-motion-controller party engine.
- The first milestone proves the control loop, not a full sport.
- Phone IMU data becomes calibrated/recognized game intents. Games must not consume raw sensor values directly.
- Real phone sensor permission must be triggered by user gesture and often requires HTTPS.
- Desktop uses Babylon.js for rendering/debug visualization only.
- Debug tooling and replay are core infrastructure.

## Local Testing Notes

- Desktop Vite app defaults to port `5173`.
- Phone Vite app defaults to port `5174`.
- Room server defaults to WebSocket port `8787`.
- For real phones, use the computer's LAN IP or a tunnel, not desktop `localhost`.
- iOS motion permission and most sensor APIs require secure contexts.
