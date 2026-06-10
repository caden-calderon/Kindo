import AudioToolbox
import Foundation
import KindoIOSControllerCore
import SwiftUI
import UIKit

@MainActor
final class ControllerViewModel: ObservableObject {
  @Published var serverURLString = "wss://kindo-room-worker.caden-calderon03.workers.dev"
  @Published var roomId = ""
  @Published var playerName = "Caden"
  @Published private(set) var statusText = "Idle"
  @Published private(set) var playerId = ""
  @Published private(set) var seq = 0
  @Published private(set) var neutralRequestId = 0
  @Published private(set) var packetRate = "0 Hz"
  @Published private(set) var lastPosition = "--"
  @Published private(set) var lastTrackingState: SpatialTrackingState = .unavailable
  @Published private(set) var isConnected = false
  @Published private(set) var isStreaming = false
  @Published var isPressing = false
  @Published var handedness: Handedness = .right

  let poseTracker = ARPoseTracker()

  private let roomClient = KindoRoomClient()
  private var joinedRoomId = ""
  private var sessionToken: String?
  private var sentInCurrentWindow = 0
  private var rateWindowStartMs = monotonicNowMs()
  private var lastSentAtMs: Double?
  private let targetIntervalMs = 1_000.0 / 60.0

  init() {
    UIApplication.shared.applicationSupportsShakeToEdit = false

    roomClient.onEvent = { [weak self] event in
      Task { @MainActor in
        self?.handleRoomEvent(event)
      }
    }

    poseTracker.onPose = { [weak self] pose in
      Task { @MainActor in
        self?.handlePose(pose)
      }
    }
  }

  func connect() {
    guard let url = normalizedWebSocketURL(serverURLString) else {
      statusText = "Invalid WebSocket URL"
      return
    }

    let normalizedRoom = roomId.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    guard normalizedRoom.range(of: #"^[A-Z0-9]{4,8}$"#, options: .regularExpression) != nil else {
      statusText = "Room code must be 4-8 letters/numbers"
      return
    }

    roomId = normalizedRoom
    statusText = "Connecting"
    roomClient.connect(to: url)
  }

  func startTracking() {
    guard isConnected else {
      statusText = "Join a room first"
      return
    }

    isStreaming = true
    poseTracker.start()
    statusText = "Starting ARKit"
  }

  func stopTracking() {
    isStreaming = false
    poseTracker.stop()
    statusText = "Stopped"
  }

  func resetOrigin() {
    neutralRequestId += 1
    if poseTracker.resetOrigin() {
      statusText = "Origin reset"
    } else {
      statusText = "No ARKit pose yet"
    }
  }

  func setPressed(_ pressing: Bool) {
    isPressing = pressing
  }

  private func handleRoomEvent(_ event: KindoRoomEvent) {
    switch event {
    case .opened:
      statusText = "Joining"
      roomClient.join(roomId: roomId, name: playerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Player" : playerName, sessionToken: sessionToken)
    case .closed:
      isConnected = false
      isStreaming = false
      statusText = "Closed"
    case .joined(let joined):
      joinedRoomId = joined.roomId
      playerId = joined.playerId ?? ""
      sessionToken = joined.sessionToken
      isConnected = joined.clientKind == .controller && !playerId.isEmpty
      statusText = isConnected ? "Joined \(joined.roomId)" : "Joined as \(joined.clientKind.rawValue)"
    case .command(let message):
      applyCommand(message.command)
    case .serverError(let error):
      statusText = error.message
    case .ignored:
      break
    case .failure(let error):
      statusText = error.localizedDescription
    }
  }

  private func handlePose(_ pose: SpatialPose) {
    lastTrackingState = pose.trackingState
    lastPosition = String(format: "%.2f, %.2f, %.2f", pose.positionM.x, pose.positionM.y, pose.positionM.z)

    guard isConnected, isStreaming, !joinedRoomId.isEmpty, !playerId.isEmpty else {
      return
    }

    let nowMs = monotonicNowMs()
    if let lastSentAtMs, nowMs - lastSentAtMs < targetIntervalMs {
      return
    }

    let dtMs = lastSentAtMs.map { nowMs - $0 }
    lastSentAtMs = nowMs
    seq += 1
    updateRate(nowMs: nowMs)

    let calibration: ControllerCalibration?
    if neutralRequestId > 0 {
      calibration = ControllerCalibration(neutralPoseRequestId: neutralRequestId, spatialOriginRequestId: neutralRequestId)
    } else {
      calibration = nil
    }

    let packet = ControllerPacket(
      roomId: joinedRoomId,
      playerId: playerId,
      seq: seq,
      sentAtMs: nowMs,
      unixAtMs: Date().timeIntervalSince1970 * 1_000,
      dtMs: dtMs,
      caps: .nativeARKit,
      pose6d: pose,
      touch: TouchState(primary: isPressing, secondary: false),
      control: ControllerControl(
        handedness: handedness,
        grip: .landscape,
        safetyMode: .normal,
        state: isPressing ? .active : .ready,
        calibration: calibration
      )
    )

    roomClient.sendPacket(packet)
  }

  private func applyCommand(_ command: ControllerCommand) {
    switch command {
    case .vibrate:
      AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
    case .showMessage(let message):
      statusText = message
    case .requestCalibration:
      resetOrigin()
    case .setMode, .unsupported:
      break
    }
  }

  private func updateRate(nowMs: Double) {
    sentInCurrentWindow += 1
    let elapsed = nowMs - rateWindowStartMs
    if elapsed >= 1_000 {
      packetRate = "\(Int((Double(sentInCurrentWindow) / elapsed) * 1_000)) Hz"
      sentInCurrentWindow = 0
      rateWindowStartMs = nowMs
    }
  }
}

private func normalizedWebSocketURL(_ input: String) -> URL? {
  let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
  if trimmed.hasPrefix("ws://") || trimmed.hasPrefix("wss://") {
    return URL(string: trimmed)
  }
  if trimmed.hasPrefix("https://") {
    return URL(string: "wss://" + String(trimmed.dropFirst("https://".count)))
  }
  if trimmed.hasPrefix("http://") {
    return URL(string: "ws://" + String(trimmed.dropFirst("http://".count)))
  }
  return URL(string: "wss://\(trimmed)")
}

private func monotonicNowMs() -> Double {
  ProcessInfo.processInfo.systemUptime * 1_000
}
