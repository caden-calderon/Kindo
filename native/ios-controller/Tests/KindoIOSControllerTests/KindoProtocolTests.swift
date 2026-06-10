import XCTest
@testable import KindoIOSControllerCore

final class KindoProtocolTests: XCTestCase {
  func testControllerPacketMessageEncodesProtocolShape() throws {
    let pose = SpatialPose(
      positionM: Vector3(0.12, 0.8, -0.31),
      quaternion: QuaternionTuple(0, 0, 0, 1),
      source: .arkit,
      trackingState: .normal,
      confidence: 1,
      referenceSpace: .kindoRoom,
      frameId: 99
    )

    let packet = ControllerPacket(
      roomId: "9DRRR9",
      playerId: "p_1",
      seq: 1,
      sentAtMs: 123,
      unixAtMs: 1_760_000_000_000,
      caps: .nativeARKit,
      pose6d: pose,
      touch: TouchState(primary: false, secondary: false),
      control: ControllerControl(
        handedness: .right,
        grip: .landscape,
        safetyMode: .normal,
        state: .ready,
        calibration: ControllerCalibration(neutralPoseRequestId: 1, spatialOriginRequestId: 1)
      )
    )

    let data = try JSONEncoder().encode(ControllerPacketMessage(roomId: "9DRRR9", playerId: "p_1", packet: packet))
    let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    let encodedPacket = try XCTUnwrap(object["packet"] as? [String: Any])
    let pose6d = try XCTUnwrap(encodedPacket["pose6d"] as? [String: Any])
    let caps = try XCTUnwrap(encodedPacket["caps"] as? [String: Any])

    XCTAssertEqual(object["type"] as? String, "controller_packet")
    XCTAssertEqual(pose6d["source"] as? String, "arkit")
    XCTAssertEqual(pose6d["referenceSpace"] as? String, "kindo-room")
    XCTAssertEqual(caps["vio"] as? Bool, true)
    XCTAssertEqual(encodedPacket["roomId"] as? String, "9DRRR9")
  }

  func testRoomJoinedMessageDecodes() throws {
    let json = """
      {
        "type": "room_joined",
        "roomId": "9DRRR9",
        "clientId": "c_1",
        "clientKind": "controller",
        "playerId": "p_1",
        "sessionToken": "s_12345678"
      }
      """

    let message = try IncomingKindoMessage.decode(from: Data(json.utf8))
    XCTAssertEqual(
      message,
      .roomJoined(
        RoomJoinedMessage(
          type: "room_joined",
          roomId: "9DRRR9",
          clientId: "c_1",
          clientKind: .controller,
          playerId: "p_1",
          sessionToken: "s_12345678"
        )
      )
    )
  }
}
