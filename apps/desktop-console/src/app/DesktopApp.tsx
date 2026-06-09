import { Activity, Download, Play, Radio, RefreshCw, Smartphone, Square, Vibrate } from "lucide-react";
import QRCode from "qrcode";
import type { ControllerPacket } from "@kindo/protocol";
import { useEffect, useMemo, useState } from "react";
import { PhoneOrientationPreview } from "../babylon/PhoneOrientationPreview.js";
import { getPhoneJoinUrl } from "./config.js";
import { useKindoRoom } from "./useKindoRoom.js";

export function DesktopApp() {
  const room = useKindoRoom();
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const joinUrl = useMemo(() => (room.roomId ? getPhoneJoinUrl(room.roomId) : ""), [room.roomId]);
  const primaryController = room.controllers[0];

  useEffect(() => {
    if (!joinUrl) {
      setQrDataUrl("");
      return;
    }
    void QRCode.toDataURL(joinUrl, {
      margin: 1,
      width: 280,
      color: {
        dark: "#10201d",
        light: "#f7f1df",
      },
    }).then(setQrDataUrl);
  }, [joinUrl]);

  return (
    <main className="console-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Kindo Console</p>
          <h1>{room.roomId ?? "Creating room..."}</h1>
        </div>
        <div className="status-pill">
          <Radio size={18} />
          <span>{room.status}</span>
        </div>
      </section>

      <section className="console-grid">
        <div className="join-panel">
          <div className="qr-frame">{qrDataUrl ? <img src={qrDataUrl} alt={`Join room ${room.roomId}`} /> : <div className="qr-placeholder" />}</div>
          <div className="join-copy">
            <span>Room</span>
            <strong>{room.roomId ?? "----"}</strong>
            <a href={joinUrl}>{joinUrl || "Waiting for server"}</a>
          </div>
        </div>

        <div className="preview-panel">
          <PhoneOrientationPreview packet={room.activePacket} />
          <div className="preview-overlay">
            <Smartphone size={18} />
            <span>{primaryController?.summary.name ?? "No controller"}</span>
          </div>
        </div>

        <div className="debug-panel">
          <div className="panel-title">
            <Activity size={18} />
            <h2>Controllers</h2>
          </div>
          <div className="controller-list">
            {room.controllers.length === 0 ? <p className="muted">Waiting for a phone...</p> : null}
            {room.controllers.map((controller) => (
              <article className="controller-row" key={controller.summary.playerId}>
                <div>
                  <strong>{controller.summary.name}</strong>
                  <span>{controller.summary.playerId}</span>
                </div>
                <div className="cap-row">
                  <CapabilityDot label="motion" enabled={controller.summary.caps?.motion ?? false} />
                  <CapabilityDot label="orientation" enabled={controller.summary.caps?.orientation ?? false} />
                  <CapabilityDot label="haptics" enabled={controller.summary.caps?.vibration ?? false} />
                </div>
                <dl className="stats-grid">
                  <Stat label="Packets" value={controller.packetCount.toString()} />
                  <Stat label="Rate" value={`${controller.packetRateHz.toFixed(1)} Hz`} />
                  <Stat label="Seq" value={`${controller.lastPacket?.seq ?? "--"}`} />
                  <Stat label="Phase" value={controller.debug?.phase ?? "idle"} />
                </dl>
                <div className="row-actions">
                  <button type="button" title="Send vibration" onClick={() => room.sendVibrate(controller.summary.playerId)}>
                    <Vibrate size={18} />
                  </button>
                  <button type="button" title="Record five seconds" onClick={() => room.startRecording(controller.summary.playerId)}>
                    <Square size={18} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="packet-panel">
          <div className="panel-title">
            <RefreshCw size={18} />
            <h2>Motion Packet</h2>
          </div>
          <PacketReadout packet={room.activePacket} />
          <div className="recording-strip">
            <span>{room.recording.active ? `Recording ${room.recording.packetCount} packets` : `${room.recording.lastRecording?.packets.length ?? 0} packets saved`}</span>
            <button type="button" title="Stop recording" disabled={!room.recording.active} onClick={room.stopRecording}>
              <Square size={16} />
            </button>
            <button type="button" title="Replay last recording" disabled={!room.recording.lastRecording} onClick={room.replayLastRecording}>
              <Play size={16} />
            </button>
            <button type="button" title="Download recording" disabled={!room.recording.lastRecording} onClick={room.downloadLastRecording}>
              <Download size={16} />
            </button>
          </div>
        </div>

        <div className="intent-panel">
          <div className="panel-title">
            <Play size={18} />
            <h2>Recognizer</h2>
          </div>
          {room.intents.length === 0 ? <p className="muted">No intents emitted yet.</p> : null}
          {room.intents.map((intent, index) => (
            <pre key={`${intent.type}-${index}`}>{JSON.stringify(intent, null, 2)}</pre>
          ))}
        </div>
      </section>
    </main>
  );
}

function CapabilityDot({ enabled, label }: { enabled: boolean; label: string }) {
  return <span className={enabled ? "cap-dot on" : "cap-dot"} title={label} aria-label={`${label}: ${enabled ? "yes" : "no"}`} />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function PacketReadout({ packet }: { packet: ControllerPacket | undefined }) {
  const pose = packet?.pose;
  const motion = packet?.motion;
  return (
    <dl className="packet-grid">
      <Stat label="Alpha" value={formatNumber(pose?.alpha)} />
      <Stat label="Beta" value={formatNumber(pose?.beta)} />
      <Stat label="Gamma" value={formatNumber(pose?.gamma)} />
      <Stat label="Gyro" value={formatVec(motion?.gyroDeg)} />
      <Stat label="Accel" value={formatVec(motion?.acc)} />
      <Stat label="Accel+G" value={formatVec(motion?.accG)} />
      <Stat label="Touch" value={packet?.touch.primary ? "held" : "open"} />
      <Stat label="State" value={packet?.control.state ?? "--"} />
    </dl>
  );
}

const formatNumber = (value: number | undefined): string => (value === undefined ? "--" : value.toFixed(1));

const formatVec = (value: [number, number, number] | undefined): string =>
  value ? value.map((part) => part.toFixed(1)).join(", ") : "--";
