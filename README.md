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
5. Desktop shows the connected controller, raw sensor values, packet rate, recognizer phase, and Babylon phone orientation.
6. Desktop can send a vibration command. Unsupported devices flash visually instead.
7. Desktop can record five seconds of packets, replay them through the same ingestion path, and download JSON.

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

The test suite covers protocol validation, replay serialization, fixed timestep behavior, bowling recognizer emission, and WebSocket room creation/join/packet relay.
