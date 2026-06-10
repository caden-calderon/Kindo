import Foundation

public enum Handedness: String, Codable, Equatable {
  case left
  case right
}

public enum GripMode: String, Codable, Equatable {
  case portrait
  case landscape
}

public enum SafetyMode: String, Codable, Equatable {
  case normal
  case shortSwing = "short-swing"
}

public enum ControllerState: String, Codable, Equatable {
  case idle
  case joining
  case calibrating
  case ready
  case active
}

public enum KindoClientKind: String, Codable, Equatable {
  case desktop
  case controller
  case spectator
}

public enum SpatialTrackingState: String, Codable, Equatable {
  case unavailable
  case initializing
  case normal
  case limited
  case lost
}

public enum SpatialPoseSource: String, Codable, Equatable {
  case webxr
  case arkit
  case arcore
  case marker
  case native
  case simulated
}

public enum ReferenceSpace: String, Codable, Equatable {
  case local
  case localFloor = "local-floor"
  case viewer
  case kindoRoom = "kindo-room"
}

public struct Vector3: Codable, Equatable {
  public let x: Double
  public let y: Double
  public let z: Double

  public init(_ x: Double, _ y: Double, _ z: Double) {
    self.x = x
    self.y = y
    self.z = z
  }

  public init(from decoder: Decoder) throws {
    var container = try decoder.unkeyedContainer()
    x = try container.decode(Double.self)
    y = try container.decode(Double.self)
    z = try container.decode(Double.self)
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.unkeyedContainer()
    try container.encode(x)
    try container.encode(y)
    try container.encode(z)
  }
}

public struct QuaternionTuple: Codable, Equatable {
  public let x: Double
  public let y: Double
  public let z: Double
  public let w: Double

  public init(_ x: Double, _ y: Double, _ z: Double, _ w: Double) {
    self.x = x
    self.y = y
    self.z = z
    self.w = w
  }

  public init(from decoder: Decoder) throws {
    var container = try decoder.unkeyedContainer()
    x = try container.decode(Double.self)
    y = try container.decode(Double.self)
    z = try container.decode(Double.self)
    w = try container.decode(Double.self)
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.unkeyedContainer()
    try container.encode(x)
    try container.encode(y)
    try container.encode(z)
    try container.encode(w)
  }
}

public struct ControllerCapabilities: Codable, Equatable {
  public var motion: Bool
  public var orientation: Bool
  public var vibration: Bool
  public var wakeLock: Bool
  public var genericSensor: Bool
  public var camera: Bool
  public var webxr: Bool
  public var vio: Bool

  public init(
    motion: Bool,
    orientation: Bool,
    vibration: Bool,
    wakeLock: Bool,
    genericSensor: Bool,
    camera: Bool,
    webxr: Bool,
    vio: Bool
  ) {
    self.motion = motion
    self.orientation = orientation
    self.vibration = vibration
    self.wakeLock = wakeLock
    self.genericSensor = genericSensor
    self.camera = camera
    self.webxr = webxr
    self.vio = vio
  }

  public static let nativeARKit = ControllerCapabilities(
    motion: true,
    orientation: true,
    vibration: true,
    wakeLock: false,
    genericSensor: false,
    camera: true,
    webxr: false,
    vio: true
  )
}

public struct SpatialPose: Codable, Equatable {
  public var positionM: Vector3
  public var quaternion: QuaternionTuple
  public var linearVelocityMps: Vector3?
  public var angularVelocityDps: Vector3?
  public var source: SpatialPoseSource
  public var trackingState: SpatialTrackingState
  public var confidence: Double?
  public var referenceSpace: ReferenceSpace?
  public var frameId: Int?

  public init(
    positionM: Vector3,
    quaternion: QuaternionTuple,
    linearVelocityMps: Vector3? = nil,
    angularVelocityDps: Vector3? = nil,
    source: SpatialPoseSource,
    trackingState: SpatialTrackingState,
    confidence: Double? = nil,
    referenceSpace: ReferenceSpace? = nil,
    frameId: Int? = nil
  ) {
    self.positionM = positionM
    self.quaternion = quaternion
    self.linearVelocityMps = linearVelocityMps
    self.angularVelocityDps = angularVelocityDps
    self.source = source
    self.trackingState = trackingState
    self.confidence = confidence
    self.referenceSpace = referenceSpace
    self.frameId = frameId
  }
}

public struct OrientationPose: Codable, Equatable {
  public var alpha: Double?
  public var beta: Double?
  public var gamma: Double?
  public var absolute: Bool?
}

public struct MotionSample: Codable, Equatable {
  public var acc: Vector3?
  public var accG: Vector3?
  public var gyroDeg: Vector3?
  public var intervalMs: Double?
}

public struct TouchState: Codable, Equatable {
  public var primary: Bool
  public var secondary: Bool
  public var x: Double?
  public var y: Double?

  public init(primary: Bool, secondary: Bool, x: Double? = nil, y: Double? = nil) {
    self.primary = primary
    self.secondary = secondary
    self.x = x
    self.y = y
  }
}

public struct ControllerCalibration: Codable, Equatable {
  public var neutralPoseRequestId: Int?
  public var spatialOriginRequestId: Int?

  public init(neutralPoseRequestId: Int? = nil, spatialOriginRequestId: Int? = nil) {
    self.neutralPoseRequestId = neutralPoseRequestId
    self.spatialOriginRequestId = spatialOriginRequestId
  }
}

public struct ControllerControl: Codable, Equatable {
  public var handedness: Handedness
  public var grip: GripMode
  public var safetyMode: SafetyMode
  public var state: ControllerState
  public var calibration: ControllerCalibration?

  public init(
    handedness: Handedness,
    grip: GripMode,
    safetyMode: SafetyMode,
    state: ControllerState,
    calibration: ControllerCalibration? = nil
  ) {
    self.handedness = handedness
    self.grip = grip
    self.safetyMode = safetyMode
    self.state = state
    self.calibration = calibration
  }
}

public struct ControllerPacket: Codable, Equatable {
  public var roomId: String
  public var playerId: String
  public var seq: Int
  public var sentAtMs: Double
  public var unixAtMs: Double?
  public var dtMs: Double?
  public var caps: ControllerCapabilities
  public var pose: OrientationPose?
  public var pose6d: SpatialPose?
  public var motion: MotionSample?
  public var touch: TouchState
  public var control: ControllerControl

  public init(
    roomId: String,
    playerId: String,
    seq: Int,
    sentAtMs: Double,
    unixAtMs: Double? = nil,
    dtMs: Double? = nil,
    caps: ControllerCapabilities,
    pose: OrientationPose? = nil,
    pose6d: SpatialPose? = nil,
    motion: MotionSample? = nil,
    touch: TouchState,
    control: ControllerControl
  ) {
    self.roomId = roomId
    self.playerId = playerId
    self.seq = seq
    self.sentAtMs = sentAtMs
    self.unixAtMs = unixAtMs
    self.dtMs = dtMs
    self.caps = caps
    self.pose = pose
    self.pose6d = pose6d
    self.motion = motion
    self.touch = touch
    self.control = control
  }
}

public struct JoinRoomMessage: Encodable, Equatable {
  public let type = "join_room"
  public var roomId: String
  public var clientKind: KindoClientKind
  public var clientName: String?
  public var sessionToken: String?

  public init(roomId: String, clientKind: KindoClientKind, clientName: String? = nil, sessionToken: String? = nil) {
    self.roomId = roomId
    self.clientKind = clientKind
    self.clientName = clientName
    self.sessionToken = sessionToken
  }
}

public struct ControllerPacketMessage: Encodable, Equatable {
  public let type = "controller_packet"
  public var roomId: String
  public var playerId: String
  public var packet: ControllerPacket

  public init(roomId: String, playerId: String, packet: ControllerPacket) {
    self.roomId = roomId
    self.playerId = playerId
    self.packet = packet
  }
}

public struct RoomJoinedMessage: Decodable, Equatable {
  public var type: String
  public var roomId: String
  public var clientId: String
  public var clientKind: KindoClientKind
  public var playerId: String?
  public var sessionToken: String?
}

public struct ErrorMessage: Decodable, Equatable {
  public var type: String
  public var code: String
  public var message: String
}

public enum VibrationPattern: Decodable, Equatable {
  case single(Int)
  case sequence([Int])

  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if let single = try? container.decode(Int.self) {
      self = .single(single)
      return
    }
    self = .sequence(try container.decode([Int].self))
  }
}

public enum ControllerCommand: Decodable, Equatable {
  case vibrate(pattern: VibrationPattern)
  case setMode(String)
  case showMessage(String)
  case requestCalibration(String)
  case unsupported(String)

  private enum CodingKeys: String, CodingKey {
    case type
    case pattern
    case mode
    case text
    case calibration
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let type = try container.decode(String.self, forKey: .type)

    switch type {
    case "vibrate":
      self = .vibrate(pattern: try container.decode(VibrationPattern.self, forKey: .pattern))
    case "set_mode":
      self = .setMode(try container.decode(String.self, forKey: .mode))
    case "show_message":
      self = .showMessage(try container.decode(String.self, forKey: .text))
    case "request_calibration":
      self = .requestCalibration(try container.decode(String.self, forKey: .calibration))
    default:
      self = .unsupported(type)
    }
  }
}

public struct ControllerCommandMessage: Decodable, Equatable {
  public var type: String
  public var roomId: String
  public var targetPlayerId: String?
  public var command: ControllerCommand
}

public enum IncomingKindoMessage: Equatable {
  case roomJoined(RoomJoinedMessage)
  case controllerCommand(ControllerCommandMessage)
  case error(ErrorMessage)
  case ignored(String)

  private struct Envelope: Decodable {
    var type: String
  }

  public static func decode(from data: Data, decoder: JSONDecoder = JSONDecoder()) throws -> IncomingKindoMessage {
    let envelope = try decoder.decode(Envelope.self, from: data)
    switch envelope.type {
    case "room_joined":
      return .roomJoined(try decoder.decode(RoomJoinedMessage.self, from: data))
    case "controller_command":
      return .controllerCommand(try decoder.decode(ControllerCommandMessage.self, from: data))
    case "error":
      return .error(try decoder.decode(ErrorMessage.self, from: data))
    default:
      return .ignored(envelope.type)
    }
  }
}
