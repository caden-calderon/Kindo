# Kindo iOS Controller

This is the native iPhone controller path for true ARKit 6DOF tracking. It joins the same Kindo room server as the browser controller and streams the shared `controller_packet` protocol with `pose6d.source: "arkit"`.

## No-Mac Workflow

You do not need a personal Mac to check whether this native code compiles. The repo includes `.github/workflows/ios-controller.yml`, which runs on GitHub's hosted macOS runner, generates the Xcode project with XcodeGen, runs the Swift package tests, and builds the iOS app with signing disabled.

Run it from GitHub:

```txt
Actions -> iOS Controller -> Run workflow
```

That proves the app builds, but it does not produce an installable iPhone build.

## Real iPhone Install Options

Apple still requires signing before a native iOS app can run on an iPhone. Without a Mac, the most practical route is:

1. Enroll in the Apple Developer Program.
2. Use a cloud iOS build service such as Codemagic, Xcode Cloud, or a signed GitHub Actions workflow.
3. Distribute the build through TestFlight.

For Kindo, Codemagic is likely the lowest-friction no-Mac option because it can connect to the GitHub repo and manage iOS certificates/profiles through App Store Connect.

The GitHub workflow in this repo is intentionally unsigned for now. Once signing credentials exist, we can add a separate signed archive/TestFlight workflow without putting secrets in the repository.

## Local Mac Workflow

If you later get access to a Mac:

```bash
cd native/ios-controller
brew install xcodegen
xcodegen generate
open KindoIOSController.xcodeproj
```

Run on a real iPhone, not the simulator. The simulator is not useful for ARKit world tracking.

## Test Flow

1. Open the deployed desktop console and create a room.
2. Open the native app on iPhone.
3. Enter the room code.
4. Keep the WebSocket URL as `wss://kindo-room-worker.caden-calderon03.workers.dev` unless we have confirmed `wss://ws.playkindo.dev` is healthy from your network.
5. Join, tap `Start ARKit`, hold the phone in the sideways paddle grip, then tap reset.
6. The desktop should show `6DOF normal`, `Pose Src arkit`, and nonzero position updates.
