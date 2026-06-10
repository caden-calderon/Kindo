import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public enum KindoRoomEvent {
  case opened
  case closed
  case joined(RoomJoinedMessage)
  case command(ControllerCommandMessage)
  case serverError(ErrorMessage)
  case ignored(String)
  case failure(Error)
}

public final class KindoRoomClient: NSObject, URLSessionWebSocketDelegate {
  public var onEvent: ((KindoRoomEvent) -> Void)?

  private let encoder = JSONEncoder()
  private let decoder = JSONDecoder()
  private lazy var session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
  private var socket: URLSessionWebSocketTask?

  public override init() {
    super.init()
  }

  public func connect(to url: URL) {
    disconnect()
    let task = session.webSocketTask(with: url)
    socket = task
    task.resume()
    receiveNext(from: task)
  }

  public func disconnect() {
    socket?.cancel(with: .normalClosure, reason: nil)
    socket = nil
  }

  public func join(roomId: String, name: String, sessionToken: String? = nil) {
    send(
      JoinRoomMessage(
        roomId: roomId,
        clientKind: .controller,
        clientName: name,
        sessionToken: sessionToken
      )
    )
  }

  public func sendPacket(_ packet: ControllerPacket) {
    send(ControllerPacketMessage(roomId: packet.roomId, playerId: packet.playerId, packet: packet))
  }

  public func send<Message: Encodable>(_ message: Message) {
    do {
      let data = try encoder.encode(message)
      guard let text = String(data: data, encoding: .utf8) else {
        return
      }
      socket?.send(.string(text)) { [weak self] error in
        if let error {
          self?.emit(.failure(error))
        }
      }
    } catch {
      emit(.failure(error))
    }
  }

  public func urlSession(
    _ session: URLSession,
    webSocketTask: URLSessionWebSocketTask,
    didOpenWithProtocol _: String?
  ) {
    emit(.opened)
  }

  public func urlSession(
    _ session: URLSession,
    webSocketTask: URLSessionWebSocketTask,
    didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
    reason: Data?
  ) {
    if socket === webSocketTask {
      socket = nil
    }
    emit(.closed)
  }

  private func receiveNext(from task: URLSessionWebSocketTask) {
    task.receive { [weak self, weak task] result in
      guard let self, let task else {
        return
      }

      switch result {
      case .success(let message):
        self.handle(message)
        if self.socket === task {
          self.receiveNext(from: task)
        }
      case .failure(let error):
        self.emit(.failure(error))
      }
    }
  }

  private func handle(_ message: URLSessionWebSocketTask.Message) {
    let data: Data?
    switch message {
    case .data(let messageData):
      data = messageData
    case .string(let text):
      data = text.data(using: .utf8)
    @unknown default:
      data = nil
    }

    guard let data else {
      return
    }

    do {
      switch try IncomingKindoMessage.decode(from: data, decoder: decoder) {
      case .roomJoined(let joined):
        emit(.joined(joined))
      case .controllerCommand(let command):
        emit(.command(command))
      case .error(let error):
        emit(.serverError(error))
      case .ignored(let type):
        emit(.ignored(type))
      }
    } catch {
      emit(.failure(error))
    }
  }

  private func emit(_ event: KindoRoomEvent) {
    DispatchQueue.main.async { [weak self] in
      self?.onEvent?(event)
    }
  }
}
