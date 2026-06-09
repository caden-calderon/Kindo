import {
  applyControllerCommand,
  detectControllerCapabilities,
  getDeviceInfo,
  requestMotionPermissions,
  requestScreenWakeLock,
  type MotionPermissionResult,
  type WakeLockHandle,
} from "@kindo/controller-core";
import type { ControllerCapabilities, ControllerPacket, GripMode, Handedness, KindoMessage } from "@kindo/protocol";
import { KindoSocketClient, type TransportStatus } from "@kindo/transport";
import { Activity, Hand, Power, Radio, RotateCcw, Smartphone, Vibrate } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserSensorSampler } from "../sensors/browserSensors.js";
import { getRoomIdFromLocation, getRoomServerUrl } from "./config.js";

type JoinedState = {
  roomId: string;
  clientId: string;
  playerId: string;
  sessionToken: string;
};

type TouchState = {
  primary: boolean;
  secondary: boolean;
  x?: number;
  y?: number;
};

export function PhoneControllerApp() {
  const initialRoomId = useMemo(() => getRoomIdFromLocation(), []);
  const [roomId, setRoomId] = useState(initialRoomId);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("kindo:name") ?? "Player");
  const [status, setStatus] = useState<TransportStatus>("idle");
  const [joined, setJoined] = useState<JoinedState | null>(null);
  const [caps, setCaps] = useState<ControllerCapabilities>(() => detectControllerCapabilities());
  const [permission, setPermission] = useState<MotionPermissionResult | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [handedness, setHandedness] = useState<Handedness>("right");
  const [grip, setGrip] = useState<GripMode>("portrait");
  const [seq, setSeq] = useState(0);
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState(false);
  const [neutralSet, setNeutralSet] = useState(false);

  const clientRef = useRef<KindoSocketClient | null>(null);
  const samplerRef = useRef(new BrowserSensorSampler());
  const wakeLockRef = useRef<WakeLockHandle | null>(null);
  const touchRef = useRef<TouchState>({ primary: false, secondary: false });
  const lastSentAtRef = useRef<number | null>(null);
  const seqRef = useRef(0);

  const canStream = Boolean(joined && enabled);

  const connect = useCallback(() => {
    if (!roomId) {
      setMessage("Enter a room code");
      return;
    }

    localStorage.setItem("kindo:name", playerName);
    const client = new KindoSocketClient({ url: getRoomServerUrl() });
    clientRef.current?.disconnect();
    clientRef.current = client;

    const storedSession = localStorage.getItem(sessionStorageKey(roomId));
    client.onStatus((nextStatus) => {
      setStatus(nextStatus);
      if (nextStatus === "open") {
        client.send({
          type: "join_room",
          roomId,
          clientKind: "controller",
          clientName: playerName.trim() || "Player",
          sessionToken: storedSession ?? undefined,
        });
      }
    });
    client.onMessage((incoming) => handleIncomingMessage(incoming, roomId, setJoined, setMessage, setFeedback));
    client.connect();
  }, [playerName, roomId]);

  useEffect(() => {
    return () => {
      samplerRef.current.stop();
      clientRef.current?.disconnect();
      void wakeLockRef.current?.release();
    };
  }, []);

  useEffect(() => {
    if (!joined) {
      return;
    }
    localStorage.setItem(sessionStorageKey(joined.roomId), joined.sessionToken);
  }, [joined]);

  useEffect(() => {
    if (!canStream || !joined) {
      return;
    }

    const interval = window.setInterval(() => {
      const client = clientRef.current;
      if (!client || client.status !== "open") {
        return;
      }

      const sentAtMs = performance.now();
      const lastSentAt = lastSentAtRef.current;
      const nextSeq = seqRef.current + 1;
      seqRef.current = nextSeq;
      lastSentAtRef.current = sentAtMs;
      setSeq(nextSeq);

      const packetInput: Parameters<typeof createPacket>[0] = {
        roomId: joined.roomId,
        playerId: joined.playerId,
        seq: nextSeq,
        sentAtMs,
        caps,
        touch: touchRef.current,
        handedness,
        grip,
        active: touchRef.current.primary,
        neutralSet,
        snapshot: samplerRef.current.getSnapshot(),
      };
      if (lastSentAt !== null) {
        packetInput.dtMs = sentAtMs - lastSentAt;
      }

      const packet = createPacket(packetInput);

      client.send({
        type: "controller_packet",
        roomId: joined.roomId,
        playerId: joined.playerId,
        packet,
      });
    }, 1000 / 60);

    return () => window.clearInterval(interval);
  }, [canStream, caps, grip, handedness, joined, neutralSet]);

  const enableMotion = useCallback(async () => {
    const permissionResult = await requestMotionPermissions();
    setPermission(permissionResult);
    samplerRef.current.start();
    setCaps(detectControllerCapabilities());
    wakeLockRef.current = await requestScreenWakeLock();
    setEnabled(true);
    setMessage(permissionResult.errors[0] ?? "Motion enabled");
  }, []);

  const updateTouch = useCallback((event: React.PointerEvent<HTMLDivElement>, primary: boolean) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    touchRef.current = {
      primary,
      secondary: event.buttons === 2,
      x,
      y,
    };
    if (primary) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }, []);

  return (
    <main className={feedback ? "phone-shell feedback" : "phone-shell"}>
      <section className="phone-top">
        <div>
          <p className="eyebrow">Kindo Controller</p>
          <h1>{joined?.roomId ?? (roomId || "Room")}</h1>
        </div>
        <div className="status-pill">
          <Radio size={17} />
          <span>{status}</span>
        </div>
      </section>

      {!joined ? (
        <section className="join-card">
          <label>
            <span>Room</span>
            <input value={roomId} inputMode="text" autoCapitalize="characters" onChange={(event) => setRoomId(event.target.value.toUpperCase())} />
          </label>
          <label>
            <span>Name</span>
            <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
          </label>
          <button type="button" className="primary-action" onClick={connect}>
            <Power size={22} />
            <span>Join</span>
          </button>
        </section>
      ) : (
        <>
          <section className="capability-strip">
            <Capability icon={<Activity size={17} />} label="Motion" enabled={caps.motion} />
            <Capability icon={<Smartphone size={17} />} label="Orient" enabled={caps.orientation} />
            <Capability icon={<Vibrate size={17} />} label="Haptics" enabled={caps.vibration} />
            <Capability icon={<Power size={17} />} label="Wake" enabled={caps.wakeLock} />
          </section>

          <section className="controls">
            <div className="segmented">
              <button type="button" className={handedness === "left" ? "selected" : ""} onClick={() => setHandedness("left")}>
                <Hand size={18} />
                <span>Left</span>
              </button>
              <button type="button" className={handedness === "right" ? "selected" : ""} onClick={() => setHandedness("right")}>
                <Hand size={18} />
                <span>Right</span>
              </button>
            </div>
            <div className="segmented">
              <button type="button" className={grip === "portrait" ? "selected" : ""} onClick={() => setGrip("portrait")}>
                <Smartphone size={18} />
                <span>Portrait</span>
              </button>
              <button type="button" className={grip === "landscape" ? "selected" : ""} onClick={() => setGrip("landscape")}>
                <RotateCcw size={18} />
                <span>Wide</span>
              </button>
            </div>
          </section>

          {!enabled ? (
            <button type="button" className="primary-action enable" onClick={enableMotion}>
              <Activity size={24} />
              <span>Enable Motion</span>
            </button>
          ) : (
            <div
              className={touchRef.current.primary ? "touch-zone active" : "touch-zone"}
              onPointerDown={(event) => updateTouch(event, true)}
              onPointerMove={(event) => {
                if (touchRef.current.primary) {
                  updateTouch(event, true);
                }
              }}
              onPointerUp={(event) => updateTouch(event, false)}
              onPointerCancel={(event) => updateTouch(event, false)}
              role="button"
              tabIndex={0}
            >
              <span>Hold</span>
            </div>
          )}

          <section className="bottom-bar">
            <button type="button" title="Set neutral pose" disabled={!enabled} onClick={() => setNeutralSet(true)}>
              <RotateCcw size={18} />
            </button>
            <dl>
              <div>
                <dt>Player</dt>
                <dd>{joined.playerId}</dd>
              </div>
              <div>
                <dt>Seq</dt>
                <dd>{seq}</dd>
              </div>
              <div>
                <dt>Motion</dt>
                <dd>{permission?.motion ?? "prompt"}</dd>
              </div>
              <div>
                <dt>Neutral</dt>
                <dd>{neutralSet ? "set" : "open"}</dd>
              </div>
            </dl>
          </section>
        </>
      )}

      {message ? <p className="message-line">{message}</p> : null}
    </main>
  );
}

function Capability({ enabled, icon, label }: { enabled: boolean; icon: React.ReactNode; label: string }) {
  return (
    <div className={enabled ? "capability ok" : "capability"}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

const handleIncomingMessage = (
  incoming: KindoMessage,
  expectedRoomId: string,
  setJoined: (joined: JoinedState) => void,
  setMessage: (message: string) => void,
  setFeedback: (feedback: boolean) => void,
): void => {
  switch (incoming.type) {
    case "room_joined":
      if (incoming.clientKind === "controller" && incoming.playerId && incoming.sessionToken) {
        setJoined({
          roomId: incoming.roomId,
          clientId: incoming.clientId,
          playerId: incoming.playerId,
          sessionToken: incoming.sessionToken,
        });
        setMessage(`Joined ${expectedRoomId}`);
      }
      return;
    case "controller_command":
      if (incoming.command.type === "vibrate") {
        const vibrated = applyControllerCommand(incoming.command);
        if (!vibrated) {
          flashFeedback(setFeedback);
        }
      }
      if (incoming.command.type === "show_message") {
        setMessage(incoming.command.text);
      }
      return;
    case "error":
      setMessage(incoming.message);
      return;
    case "create_room":
    case "join_room":
    case "controller_packet":
    case "controller_intent":
    case "player_list":
    case "ping":
    case "pong":
      return;
  }
};

const createPacket = (input: {
  roomId: string;
  playerId: string;
  seq: number;
  sentAtMs: number;
  dtMs?: number;
  caps: ControllerCapabilities;
  touch: TouchState;
  handedness: Handedness;
  grip: GripMode;
  active: boolean;
  neutralSet: boolean;
  snapshot: ReturnType<BrowserSensorSampler["getSnapshot"]>;
}): ControllerPacket => {
  const packet: ControllerPacket = {
    roomId: input.roomId,
    playerId: input.playerId,
    seq: input.seq,
    sentAtMs: input.sentAtMs,
    unixAtMs: Date.now(),
    caps: input.caps,
    touch: {
      primary: input.touch.primary,
      secondary: input.touch.secondary,
      x: input.touch.x,
      y: input.touch.y,
    },
    control: {
      handedness: input.handedness,
      grip: input.grip,
      safetyMode: "normal",
      state: input.active ? "active" : input.neutralSet ? "ready" : "calibrating",
    },
  };

  if (input.dtMs !== undefined) {
    packet.dtMs = input.dtMs;
  }
  if (input.snapshot.orientation) {
    packet.pose = input.snapshot.orientation;
  }
  if (input.snapshot.motion) {
    packet.motion = input.snapshot.motion;
  }

  return packet;
};

const sessionStorageKey = (roomId: string): string => `kindo:${roomId}:session`;

const flashFeedback = (setFeedback: (feedback: boolean) => void): void => {
  setFeedback(true);
  window.setTimeout(() => setFeedback(false), 180);
};
