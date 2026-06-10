import ARKit
import Foundation
import KindoIOSControllerCore
import simd

final class ARPoseTracker: NSObject, ObservableObject, ARSessionDelegate {
  @Published private(set) var trackingState: SpatialTrackingState = .unavailable
  @Published private(set) var statusText = "ARKit idle"

  var onPose: ((SpatialPose) -> Void)?

  private let session = ARSession()
  private let lock = NSLock()
  private var latestTransform: simd_float4x4?
  private var originTransform: simd_float4x4?
  private var frameCounter = 0

  func start() {
    guard ARWorldTrackingConfiguration.isSupported else {
      trackingState = .unavailable
      statusText = "ARKit world tracking unavailable"
      return
    }

    let configuration = ARWorldTrackingConfiguration()
    configuration.worldAlignment = .gravity
    configuration.isAutoFocusEnabled = true

    session.delegate = self
    session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
    trackingState = .initializing
    statusText = "ARKit initializing"
  }

  func stop() {
    session.pause()
    trackingState = .unavailable
    statusText = "ARKit paused"

    lock.lock()
    latestTransform = nil
    originTransform = nil
    lock.unlock()
  }

  @discardableResult
  func resetOrigin() -> Bool {
    lock.lock()
    defer { lock.unlock() }

    guard let latestTransform else {
      return false
    }

    originTransform = latestTransform
    return true
  }

  func session(_ session: ARSession, didUpdate frame: ARFrame) {
    let cameraTransform = frame.camera.transform
    let tracking = Self.mapTrackingState(frame.camera.trackingState)

    lock.lock()
    latestTransform = cameraTransform
    let origin = originTransform
    frameCounter += 1
    let frameId = frameCounter
    lock.unlock()

    let poseTransform = origin.map { simd_inverse($0) * cameraTransform } ?? cameraTransform
    let translation = poseTransform.columns.3
    let rotationMatrix = simd_float3x3(
      SIMD3<Float>(poseTransform.columns.0.x, poseTransform.columns.0.y, poseTransform.columns.0.z),
      SIMD3<Float>(poseTransform.columns.1.x, poseTransform.columns.1.y, poseTransform.columns.1.z),
      SIMD3<Float>(poseTransform.columns.2.x, poseTransform.columns.2.y, poseTransform.columns.2.z)
    )
    let rotation = simd_quatf(rotationMatrix)

    let pose = SpatialPose(
      positionM: Vector3(Double(translation.x), Double(translation.y), Double(translation.z)),
      quaternion: QuaternionTuple(
        Double(rotation.imag.x),
        Double(rotation.imag.y),
        Double(rotation.imag.z),
        Double(rotation.real)
      ),
      source: .arkit,
      trackingState: tracking.state,
      confidence: tracking.confidence,
      referenceSpace: .kindoRoom,
      frameId: frameId
    )

    DispatchQueue.main.async { [weak self] in
      self?.trackingState = tracking.state
      self?.statusText = tracking.message
      self?.onPose?(pose)
    }
  }

  func session(_ session: ARSession, didFailWithError error: Error) {
    DispatchQueue.main.async { [weak self] in
      self?.trackingState = .lost
      self?.statusText = error.localizedDescription
    }
  }

  func sessionWasInterrupted(_ session: ARSession) {
    DispatchQueue.main.async { [weak self] in
      self?.trackingState = .lost
      self?.statusText = "ARKit interrupted"
    }
  }

  func sessionInterruptionEnded(_ session: ARSession) {
    DispatchQueue.main.async { [weak self] in
      self?.start()
    }
  }

  private static func mapTrackingState(_ trackingState: ARCamera.TrackingState) -> (state: SpatialTrackingState, confidence: Double, message: String) {
    switch trackingState {
    case .normal:
      return (.normal, 1.0, "ARKit normal")
    case .notAvailable:
      return (.lost, 0.0, "ARKit tracking unavailable")
    case .limited(let reason):
      return (.limited, 0.4, "ARKit limited: \(limitedReasonText(reason))")
    }
  }

  private static func limitedReasonText(_ reason: ARCamera.TrackingState.Reason) -> String {
    switch reason {
    case .initializing:
      return "initializing"
    case .excessiveMotion:
      return "excessive motion"
    case .insufficientFeatures:
      return "low detail"
    case .relocalizing:
      return "relocalizing"
    @unknown default:
      return "unknown"
    }
  }
}
