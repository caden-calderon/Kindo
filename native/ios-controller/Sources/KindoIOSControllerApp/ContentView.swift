import KindoIOSControllerCore
import SwiftUI

struct ContentView: View {
  @StateObject private var model = ControllerViewModel()

  var body: some View {
    ZStack {
      LinearGradient(
        colors: [Color(red: 0.03, green: 0.08, blue: 0.06), Color(red: 0.06, green: 0.06, blue: 0.03)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      .ignoresSafeArea()

      ScrollView {
        VStack(alignment: .leading, spacing: 18) {
          header
          connectionPanel
          if model.isConnected {
            trackingPanel
            holdSurface
          }
        }
        .padding(20)
      }
    }
    .preferredColorScheme(.dark)
  }

  private var header: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text("KINDO NATIVE")
        .font(.caption.bold())
        .foregroundStyle(Color(red: 0.92, green: 0.82, blue: 0.38))
      Text(model.roomId.isEmpty ? "Controller" : model.roomId)
        .font(.system(size: 52, weight: .heavy, design: .rounded))
        .minimumScaleFactor(0.5)
        .lineLimit(1)
      statusPill
    }
  }

  private var statusPill: some View {
    HStack(spacing: 8) {
      Circle()
        .fill(model.isConnected ? Color(red: 0.45, green: 0.95, blue: 0.75) : Color.gray)
        .frame(width: 9, height: 9)
      Text(model.statusText)
        .font(.callout.weight(.semibold))
        .lineLimit(2)
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 8)
    .background(Color.white.opacity(0.08), in: Capsule())
  }

  private var connectionPanel: some View {
    VStack(spacing: 12) {
      TextField("Room", text: $model.roomId)
        .textInputAutocapitalization(.characters)
        .autocorrectionDisabled()
        .kindoField()

      TextField("Name", text: $model.playerName)
        .textInputAutocapitalization(.words)
        .autocorrectionDisabled()
        .kindoField()

      TextField("WebSocket", text: $model.serverURLString)
        .keyboardType(.URL)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .kindoField()

      Button(action: model.connect) {
        Label(model.isConnected ? "Connected" : "Join Room", systemImage: "dot.radiowaves.left.and.right")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(KindoPrimaryButtonStyle())
      .disabled(model.roomId.isEmpty)
    }
    .padding(14)
    .background(Color.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .stroke(Color.white.opacity(0.11), lineWidth: 1)
    )
  }

  private var trackingPanel: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack {
        Button(action: {
          if model.isStreaming {
            model.stopTracking()
          } else {
            model.startTracking()
          }
        }) {
          Label(model.isStreaming ? "Stop ARKit" : "Start ARKit", systemImage: model.isStreaming ? "pause.fill" : "play.fill")
        }
        .buttonStyle(KindoPrimaryButtonStyle())

        Button(action: model.resetOrigin) {
          Image(systemName: "arrow.counterclockwise")
            .frame(width: 44, height: 44)
        }
        .buttonStyle(KindoIconButtonStyle())
        .disabled(!model.isStreaming)
      }

      Picker("Hand", selection: $model.handedness) {
        Text("Right").tag(Handedness.right)
        Text("Left").tag(Handedness.left)
      }
      .pickerStyle(.segmented)

      LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
        Metric(label: "Player", value: model.playerId.isEmpty ? "--" : model.playerId)
        Metric(label: "Packets", value: "\(model.seq)")
        Metric(label: "Rate", value: model.packetRate)
        Metric(label: "6DOF", value: model.lastTrackingState.rawValue)
        Metric(label: "Position", value: model.lastPosition)
        Metric(label: "Reset", value: model.neutralRequestId > 0 ? "set" : "open")
      }
    }
    .padding(14)
    .background(Color.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .stroke(Color.white.opacity(0.11), lineWidth: 1)
    )
  }

  private var holdSurface: some View {
    RoundedRectangle(cornerRadius: 8, style: .continuous)
      .fill(model.isPressing ? Color(red: 0.1, green: 0.58, blue: 0.5) : Color(red: 0.89, green: 0.88, blue: 0.72))
      .overlay {
        Text(model.isPressing ? "ACTIVE" : "HOLD")
          .font(.system(size: 40, weight: .black, design: .rounded))
          .foregroundStyle(model.isPressing ? Color.white : Color(red: 0.06, green: 0.12, blue: 0.09))
      }
      .frame(height: 220)
      .gesture(
        DragGesture(minimumDistance: 0)
          .onChanged { _ in model.setPressed(true) }
          .onEnded { _ in model.setPressed(false) }
      )
  }
}

private struct Metric: View {
  var label: String
  var value: String

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(label)
        .font(.caption)
        .foregroundStyle(.secondary)
      Text(value)
        .font(.system(.callout, design: .monospaced).weight(.semibold))
        .lineLimit(1)
        .minimumScaleFactor(0.55)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(10)
    .background(Color.black.opacity(0.17), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
  }
}

private struct KindoPrimaryButtonStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.headline)
      .foregroundStyle(Color(red: 0.03, green: 0.08, blue: 0.06))
      .padding(.horizontal, 16)
      .frame(minHeight: 46)
      .background(
        configuration.isPressed
          ? Color(red: 0.58, green: 0.86, blue: 0.77)
          : Color(red: 0.52, green: 0.95, blue: 0.83),
        in: RoundedRectangle(cornerRadius: 8, style: .continuous)
      )
  }
}

private struct KindoIconButtonStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .foregroundStyle(Color(red: 0.86, green: 0.95, blue: 0.9))
      .background(
        configuration.isPressed
          ? Color.white.opacity(0.16)
          : Color.white.opacity(0.08),
        in: RoundedRectangle(cornerRadius: 8, style: .continuous)
      )
  }
}

private extension View {
  func kindoField() -> some View {
    self
      .font(.system(.body, design: .rounded).weight(.semibold))
      .padding(12)
      .background(Color.black.opacity(0.2), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
      .overlay(
        RoundedRectangle(cornerRadius: 8, style: .continuous)
          .stroke(Color.white.opacity(0.12), lineWidth: 1)
      )
  }
}
