# Native iOS ARKit Controller Plan

## Goal

Add the first native iPhone controller path for true 6DOF tracking. The app should use ARKit world tracking for position and rotation, then stream the existing Kindo `pose6d` packet shape to the same room WebSocket used by the browser controller.

## Constraints

- This Linux workspace cannot compile or sign iOS code; verification here must focus on protocol compatibility and TypeScript integration.
- The first native controller should stay thin: connect, join, start ARKit, reset origin, stream packets.
- The TypeScript protocol remains the source of truth for room messages. Swift mirrors only the subset needed by the native controller.
- The web controller remains the fallback and development controller.

## Decisions

- Put native code under `native/ios-controller` so it does not pollute the web monorepo packages.
- Use SwiftUI for the minimal controller UI and UIKit app delegate support to disable Shake to Undo.
- Use `ARWorldTrackingConfiguration` and `ARSessionDelegate` to read camera pose updates.
- Rebase ARKit transforms on reset so packets use `referenceSpace: "kindo-room"`.
- Send `pose6d.source: "arkit"`, `caps.vio: true`, and omit velocity until we have a measured derivative path.
- Include an XcodeGen `project.yml` so Caden can generate a real Xcode project on macOS without us committing brittle hand-authored `.xcodeproj` files.
- Add a GitHub Actions hosted macOS unsigned build workflow so we can catch native compile errors even without a local Mac.

## Non-Goals

- No native game UI.
- No App Store packaging.
- No signed IPA/TestFlight pipeline until Apple signing credentials exist.
- No marker tracking, shared AR maps, or multiplayer spatial alignment yet.
