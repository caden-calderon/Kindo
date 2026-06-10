# Kindo

Kindo is a browser-first party game foundation where a desktop browser is the console and each phone joins as a motion controller through a room code or QR link.

This repo is the Stage 0 / Stage 1 technical spike only: room joining, WebSocket relay, phone motion streaming, Babylon.js orientation preview, debug panels, haptics, and packet recording/replay scaffolding. Full bowling, tennis, golf, accounts, WebRTC, and polished game UI are intentionally deferred.

## Workspace

```txt
apps/
  desktop-console/      Vite + React desktop console with Babylon.js preview
  phone-controller/     Vite + React phone controller
services/
  room-server/          Node ws room server
native/
  ios-controller/       SwiftUI + ARKit native iPhone 6DOF controller scaffold
packages/
  protocol/             Zod-validated JSON protocol and intent types
  transport/            Browser WebSocket client helpers
  controller-core/      Motion permissions, capabilities, wake lock, haptics
  motion-core/          Raw samples, quality, filters, orientation helpers
  calibration/          Player calibration snapshots and placeholders
  recognizers/          Rule-based recognizer interfaces and bowling skeleton
  replay/               JSON/NDJSON recording and replay utilities
  game-runtime/         Fixed timestep and session/event primitives
```

Babylon.js is used only in `apps/desktop-console/src/babylon`. The Kindo core packages are renderer-agnostic.

## Setup

Requirements:

- Node.js 20+
- pnpm 10+
- macOS + Xcode 16+ for the native iOS controller

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## Run Locally

Start the server and both apps:

```bash
pnpm dev
```

Default local URLs:

- Desktop console: `http://localhost:5173`
- Phone controller: `http://localhost:5174/join/<ROOM>`
- Room server health: `http://localhost:8787/health`
- Room server WebSocket: `ws://localhost:8787`

The desktop creates a room automatically and shows a QR code. The QR points to the phone controller app on port `5174`.

## Real Phone Testing

Do not scan a QR code that points to desktop `localhost`; a phone resolves that to itself. Use your computer's LAN IP or a tunnel.

LAN example:

```bash
hostname -I
VITE_ROOM_SERVER_URL=ws://<LAN_IP>:8787 VITE_PHONE_CONTROLLER_URL=http://<LAN_IP>:5174 pnpm dev
```

Open the desktop at:

```txt
http://<LAN_IP>:5173
```

Then scan the QR from the phone.

## HTTPS Notes

Real browser motion permissions are inconsistent on plain LAN HTTP. iOS Safari and many modern APIs require a secure context for motion/orientation permission prompts, wake lock, and future sensor work.

Recommended options:

- Use `ngrok` or `cloudflared` for quick tests. Tunnel both the phone app and room server, then set `VITE_ROOM_SERVER_URL=wss://...` and `VITE_PHONE_CONTROLLER_URL=https://...`.
- Use `mkcert` plus a local reverse proxy such as Caddy to terminate HTTPS/WSS for the Vite apps and `services/room-server`.
- Android Chrome may allow more during local HTTP development, but do not treat that as the product baseline.

If the phone app is loaded over HTTPS, the WebSocket URL must be `wss://`, not `ws://`, or the browser will block it as mixed content.

## 6DOF / VIO Tracking

Kindo now treats spatial tracking as a first-class packet path. Controllers can send an optional `pose6d` alongside the existing IMU packet data:

```txt
positionM      x/y/z position in meters relative to the tracking origin
quaternion     phone orientation
source         webxr, arkit, arcore, marker, native, or simulated
trackingState  unavailable, initializing, normal, limited, or lost
referenceSpace local, local-floor, viewer, or kindo-room
```

The current web controller attempts WebXR `immersive-ar` tracking from the `Enable Motion` tap when the browser exposes it. If unavailable, it reports that honestly and keeps streaming IMU fallback packets.

For iPhone, the production-quality 6DOF route is likely a thin native ARKit controller app or wrapper that streams the same `pose6d` shape over the room WebSocket. iOS Safari does not currently give us dependable browser access to ARKit VIO.

The reset button now also rebases the spatial origin when a 6DOF pose is active. Gameplay calibration should still happen in the real play grip, not flat on a table.

## Native iOS ARKit Controller

The native iPhone scaffold lives in `native/ios-controller`. It is intentionally thin: room join, ARKit world tracking, origin reset, hold/active touch state, and WebSocket packet streaming. It sends the same `controller_packet` shape as the web controller, with:

```txt
pose6d.source          arkit
pose6d.referenceSpace  kindo-room
caps.camera            true
caps.vio               true
control.grip           landscape
```

Generate and run the Xcode project on macOS:

```bash
cd native/ios-controller
brew install xcodegen
xcodegen generate
open KindoIOSController.xcodeproj
```

In Xcode:

1. Select the `KindoIOSController` app target.
2. Set your signing team and bundle identifier if Xcode asks.
3. Run on a real iPhone. The simulator is not useful for ARKit world tracking.
4. Open the desktop console, copy the room code into the native app, and join.
5. Tap `Start ARKit`, hold the phone in the sideways paddle grip, then tap reset to make that pose the 6DOF origin.

The native app defaults to the deployed edge Worker:

```txt
wss://kindo-room-worker.caden-calderon03.workers.dev
```

You can change the WebSocket field in-app to `wss://ws.playkindo.dev` after that hostname is behaving cleanly, or to a local/tunnel URL during development.

Shake to Undo is disabled inside the native app through UIKit's `applicationSupportsShakeToEdit` hook. The browser controller can only mitigate Shake to Undo; the native app can actually opt out.

## iOS Shake To Undo

Web content cannot globally disable iOS Shake to Undo. Native UIKit apps can disable it with `applicationSupportsShakeToEdit`, and users can disable it in iOS Accessibility settings.

The web controller mitigates it by blurring active text inputs after joining, enabling motion, touching the play zone, and resetting calibration. This keeps normal play out of text-editing mode, which is where the undo prompt usually appears.

## Cloudflare Plan

`playkindo.dev` is the project domain. The clean development tunnel layout is:

```txt
https://kindo.playkindo.dev          desktop console
https://controller.playkindo.dev     phone controller
wss://ws.playkindo.dev               WebSocket room server
```

For a local tunnel, run Kindo with:

```bash
PORT=8797 pnpm --filter @kindo/room-server dev

VITE_ROOM_SERVER_URL=wss://ws.playkindo.dev \
VITE_PHONE_CONTROLLER_URL=https://controller.playkindo.dev \
pnpm --filter @kindo/desktop-console dev

VITE_ROOM_SERVER_URL=wss://ws.playkindo.dev \
pnpm --filter @kindo/phone-controller dev
```

For production, the target architecture is:

```txt
desktop + controller static assets -> Cloudflare Pages or Workers assets
room coordination/WebSockets       -> Cloudflare Worker + Durable Object per room
```

The static apps and room server are intentionally separate. The repo includes two room servers:

- `services/room-server`: local Node `ws` server for fast debugging.
- `services/edge-room-worker`: Cloudflare Worker + Durable Object server for `wss://ws.playkindo.dev`.

### Deploy `ws.playkindo.dev`

Log in once:

```bash
pnpm --filter @kindo/edge-room-worker exec wrangler login
```

Deploy:

```bash
pnpm deploy:edge
```

In Cloudflare, attach the Worker to a custom domain:

```txt
Workers & Pages
-> kindo-room-worker
-> Settings
-> Domains & Routes
-> Add
-> Custom domain
-> ws.playkindo.dev
```

After that, verify:

```bash
curl https://ws.playkindo.dev/health
```

It should return:

```json
{"ok":true,"edge":true}
```

Then make sure both Pages projects use:

```txt
VITE_ROOM_SERVER_URL=wss://ws.playkindo.dev
```

## Controller Flow

1. Desktop opens and creates a room.
2. Phone joins from QR or `/join/<ROOM>`.
3. Phone user taps `Enable Motion`.
4. Phone requests motion/orientation permission, attempts wake lock, and starts streaming packets.
5. Phone defaults to the `Paddle` grip, meaning landscape/sideways hold with the screen acting as the racket or paddle face.
6. The phone attempts 6DOF/VIO tracking where browser support exists and otherwise reports IMU fallback.
7. Native iPhone testing should use the ARKit controller for true 6DOF. Tap reset while holding the comfortable sideways paddle pose to recenter both orientation and spatial origin.
8. Tap the web phone reset button, or the desktop reset button, while holding the comfortable neutral pose to recenter the browser IMU preview.
9. Desktop shows the connected controller, raw sensor values, packet rate, recognizer phase, tracking state, and calibrated Babylon phone orientation/spatial preview.
10. Desktop can send a vibration command. Unsupported devices flash visually instead.
11. Desktop can record five seconds of packets, replay them through the same ingestion path, and download JSON.

## Environment Variables

Desktop:

```txt
VITE_ROOM_SERVER_URL=ws://localhost:8787
VITE_PHONE_CONTROLLER_URL=http://localhost:5174
```

Phone:

```txt
VITE_ROOM_SERVER_URL=ws://localhost:8787
```

## Validation

Current checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

The test suite covers protocol validation, 6DOF packet relay, replay serialization, fixed timestep behavior, orientation calibration, bowling recognizer emission, and WebSocket room creation/join/packet relay.
