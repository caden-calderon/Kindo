import {
  applyCalibrationSample,
  createPlayerCalibration,
  setGrip,
  setHandedness,
  type PlayerCalibration,
} from "@kindo/calibration";
import { createMotionRecording, finishRecording, ReplayPlayer, serializeRecordingJson, type MotionRecording } from "@kindo/replay";
import { BowlingThrowRecognizer, type RecognizerDebugState } from "@kindo/recognizers";
import { motionFrameFromRawSample, MotionQualityTracker, rawSampleFromPacket, type RawMotionSample } from "@kindo/motion-core";
import type { ControllerCommand, ControllerPacket, KindoMessage, MotionIntent, PlayerSummary } from "@kindo/protocol";
import { KindoSocketClient, type TransportStatus } from "@kindo/transport";
import { useCallback, useEffect, useRef, useState } from "react";
import { getRoomServerUrl } from "./config.js";

export type ControllerRuntimeState = {
  summary: PlayerSummary;
  lastPacket: ControllerPacket | undefined;
  packetCount: number;
  packetRateHz: number;
  lastPacketReceivedAtMs: number | undefined;
  debug: RecognizerDebugState | undefined;
  calibration: PlayerCalibration | undefined;
};

export type RecordingState = {
  active: boolean;
  targetPlayerId: string | undefined;
  packetCount: number;
  lastRecording: MotionRecording | undefined;
};

export type UseKindoRoomResult = {
  status: TransportStatus;
  roomId: string | undefined;
  clientId: string | undefined;
  controllers: ControllerRuntimeState[];
  activePacket: ControllerPacket | undefined;
  activeCalibration: PlayerCalibration | undefined;
  intents: MotionIntent[];
  recording: RecordingState;
  sendVibrate(playerId?: string): void;
  resetOrientation(playerId?: string): void;
  startRecording(playerId: string): void;
  stopRecording(): void;
  downloadLastRecording(): void;
  replayLastRecording(): void;
};

export const useKindoRoom = (): UseKindoRoomResult => {
  const [status, setStatus] = useState<TransportStatus>("idle");
  const [roomId, setRoomId] = useState<string>();
  const [clientId, setClientId] = useState<string>();
  const [controllers, setControllers] = useState<Map<string, ControllerRuntimeState>>(new Map());
  const [intents, setIntents] = useState<MotionIntent[]>([]);
  const [recording, setRecording] = useState<RecordingState>({
    active: false,
    targetPlayerId: undefined,
    packetCount: 0,
    lastRecording: undefined,
  });

  const clientRef = useRef<KindoSocketClient | null>(null);
  const statsRef = useRef(new Map<string, { firstAt: number; lastAt: number; count: number }>());
  const qualityRef = useRef(new Map<string, MotionQualityTracker>());
  const recognizersRef = useRef(new Map<string, BowlingThrowRecognizer>());
  const calibrationsRef = useRef(new Map<string, PlayerCalibration>());
  const neutralRequestIdsRef = useRef(new Map<string, number>());
  const recordingRef = useRef<MotionRecording | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  const ingestPacket = useCallback((packet: ControllerPacket) => {
    const receivedAt = performance.now();
    const stats = statsRef.current.get(packet.playerId) ?? { firstAt: receivedAt, lastAt: receivedAt, count: 0 };
    stats.count += 1;
    stats.lastAt = receivedAt;
    statsRef.current.set(packet.playerId, stats);

    const qualityTracker = qualityRef.current.get(packet.playerId) ?? new MotionQualityTracker();
    qualityRef.current.set(packet.playerId, qualityTracker);
    const sample = rawSampleFromPacket(packet);
    const calibration = updateCalibrationFromPacket(calibrationsRef.current, neutralRequestIdsRef.current, packet, sample);
    const quality = qualityTracker.update(sample);
    const frame = motionFrameFromRawSample(sample, quality);

    const recognizer = recognizersRef.current.get(packet.playerId) ?? new BowlingThrowRecognizer();
    recognizersRef.current.set(packet.playerId, recognizer);
    const intent = recognizer.update(frame, {
      playerId: packet.playerId,
      touchPrimary: packet.touch.primary,
      laneAim: packet.touch.x === undefined ? 0 : Math.max(-1, Math.min(1, packet.touch.x * 2 - 1)),
    });

    if (intent) {
      setIntents((current) => [intent, ...current].slice(0, 12));
    }

    const activeRecording = recordingRef.current;
    if (activeRecording && activeRecording.playerId === packet.playerId) {
      activeRecording.packets.push(packet);
      setRecording((current) => ({ ...current, packetCount: activeRecording.packets.length }));
    }

    setControllers((current) => {
      const next = new Map(current);
      const existing = next.get(packet.playerId);
      const elapsedSeconds = Math.max(0.001, (stats.lastAt - stats.firstAt) / 1000);
      next.set(packet.playerId, {
        summary:
          existing?.summary ??
          ({
            playerId: packet.playerId,
            clientId: packet.playerId,
            name: packet.playerId,
            connected: true,
            caps: packet.caps,
            packetSeq: packet.seq,
          } satisfies PlayerSummary),
        lastPacket: packet,
        packetCount: stats.count,
        packetRateHz: stats.count / elapsedSeconds,
        lastPacketReceivedAtMs: receivedAt,
        debug: recognizer.getDebugState(),
        calibration,
      });
      return next;
    });
  }, []);

  useEffect(() => {
    const client = new KindoSocketClient({ url: getRoomServerUrl() });
    clientRef.current = client;

    const unsubscribeStatus = client.onStatus((nextStatus) => {
      setStatus(nextStatus);
      if (nextStatus === "open") {
        client.send({ type: "create_room", clientKind: "desktop" });
      }
    });

    const unsubscribeMessage = client.onMessage((message) => {
      handleMessage(message, {
        setRoomId,
        setClientId,
        setControllers,
        ingestPacket,
      });
    });

    client.connect();

    return () => {
      unsubscribeStatus();
      unsubscribeMessage();
      client.disconnect();
      clientRef.current = null;
      if (recordingTimerRef.current !== null) {
        window.clearTimeout(recordingTimerRef.current);
      }
    };
  }, [ingestPacket]);

  const sendVibrate = useCallback((playerId?: string) => {
    if (!roomId) {
      return;
    }
    sendControllerCommand(clientRef.current, roomId, { type: "vibrate", pattern: [45, 35, 70] }, playerId);
  }, [roomId]);

  const resetOrientation = useCallback((playerId?: string) => {
    setControllers((current) => {
      const targetPlayerId = playerId ?? current.values().next().value?.summary.playerId;
      if (!targetPlayerId) {
        return current;
      }

      const controller = current.get(targetPlayerId);
      if (!controller?.lastPacket) {
        return current;
      }

      const sample = rawSampleFromPacket(controller.lastPacket);
      if (!sample.orientation) {
        return current;
      }

      const calibration = applyNeutralSample(calibrationsRef.current, controller.lastPacket, sample);
      const next = new Map(current);
      next.set(targetPlayerId, {
        ...controller,
        calibration,
      });
      return next;
    });
  }, []);

  const stopRecording = useCallback(() => {
    const activeRecording = recordingRef.current;
    if (!activeRecording) {
      return;
    }
    const finished = finishRecording(activeRecording);
    recordingRef.current = null;
    if (recordingTimerRef.current !== null) {
      window.clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecording({
      active: false,
      targetPlayerId: undefined,
      packetCount: finished.packets.length,
      lastRecording: finished,
    });
  }, []);

  const startRecording = useCallback(
    (playerId: string) => {
      if (recordingTimerRef.current !== null) {
        window.clearTimeout(recordingTimerRef.current);
      }
      const nextRecording = createMotionRecording({ playerId });
      recordingRef.current = nextRecording;
      setRecording({ active: true, targetPlayerId: playerId, packetCount: 0, lastRecording: undefined });
      recordingTimerRef.current = window.setTimeout(stopRecording, 5000);
    },
    [stopRecording],
  );

  const downloadLastRecording = useCallback(() => {
    if (!recording.lastRecording) {
      return;
    }
    const blob = new Blob([serializeRecordingJson(recording.lastRecording)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kindo-${recording.lastRecording.playerId}-${recording.lastRecording.recordingId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [recording.lastRecording]);

  const replayLastRecording = useCallback(() => {
    if (!recording.lastRecording) {
      return;
    }
    const replay = new ReplayPlayer(recording.lastRecording);
    for (const frame of replay.all()) {
      ingestPacket(frame.packet);
    }
  }, [ingestPacket, recording.lastRecording]);

  return {
    status,
    roomId,
    clientId,
    controllers: [...controllers.values()],
    activePacket: [...controllers.values()].find((controller) => controller.lastPacket)?.lastPacket,
    activeCalibration: [...controllers.values()].find((controller) => controller.lastPacket)?.calibration,
    intents,
    recording,
    sendVibrate,
    resetOrientation,
    startRecording,
    stopRecording,
    downloadLastRecording,
    replayLastRecording,
  };
};

type MessageHandlers = {
  setRoomId(roomId: string): void;
  setClientId(clientId: string): void;
  setControllers(updater: (current: Map<string, ControllerRuntimeState>) => Map<string, ControllerRuntimeState>): void;
  ingestPacket(packet: ControllerPacket): void;
};

const handleMessage = (message: KindoMessage, handlers: MessageHandlers): void => {
  switch (message.type) {
    case "room_joined":
      handlers.setRoomId(message.roomId);
      handlers.setClientId(message.clientId);
      return;
    case "player_list":
      handlers.setControllers((current) => {
        const next = new Map(current);
        for (const player of message.players) {
          const existing = next.get(player.playerId);
          next.set(player.playerId, {
            summary: player,
            lastPacket: existing?.lastPacket,
            packetCount: existing?.packetCount ?? 0,
            packetRateHz: existing?.packetRateHz ?? 0,
            lastPacketReceivedAtMs: existing?.lastPacketReceivedAtMs,
            debug: existing?.debug,
            calibration: existing?.calibration,
          });
        }
        return next;
      });
      return;
    case "controller_packet":
      handlers.ingestPacket(message.packet);
      return;
    case "error":
      console.warn("Kindo server error", message.code, message.message);
      return;
    case "create_room":
    case "join_room":
    case "controller_command":
    case "controller_intent":
    case "ping":
    case "pong":
      return;
  }
};

const updateCalibrationFromPacket = (
  calibrations: Map<string, PlayerCalibration>,
  neutralRequestIds: Map<string, number>,
  packet: ControllerPacket,
  sample: RawMotionSample,
): PlayerCalibration => {
  let calibration =
    calibrations.get(packet.playerId) ??
    createPlayerCalibration(packet.playerId, {
      handedness: packet.control.handedness,
      grip: packet.control.grip,
    });

  if (calibration.handedness !== packet.control.handedness) {
    calibration = setHandedness(calibration, packet.control.handedness);
  }
  if (calibration.grip !== packet.control.grip) {
    calibration = setGrip(calibration, packet.control.grip);
  }

  const neutralPoseRequestId = packet.control.calibration?.neutralPoseRequestId;
  if (neutralPoseRequestId !== undefined && neutralPoseRequestId !== neutralRequestIds.get(packet.playerId) && sample.orientation) {
    calibration = applyCalibrationSample(calibration, "neutral_pose", sample);
    neutralRequestIds.set(packet.playerId, neutralPoseRequestId);
  }

  calibrations.set(packet.playerId, calibration);
  return calibration;
};

const applyNeutralSample = (
  calibrations: Map<string, PlayerCalibration>,
  packet: ControllerPacket,
  sample: RawMotionSample,
): PlayerCalibration => {
  const current =
    calibrations.get(packet.playerId) ??
    createPlayerCalibration(packet.playerId, {
      handedness: packet.control.handedness,
      grip: packet.control.grip,
    });
  const updated = applyCalibrationSample(current, "neutral_pose", sample);
  calibrations.set(packet.playerId, updated);
  return updated;
};

const sendControllerCommand = (
  client: KindoSocketClient | null,
  roomId: string,
  command: ControllerCommand,
  targetPlayerId?: string,
): void => {
  const message: KindoMessage = {
    type: "controller_command",
    roomId,
    command,
  };
  if (targetPlayerId !== undefined) {
    message.targetPlayerId = targetPlayerId;
  }
  client?.send(message);
};
