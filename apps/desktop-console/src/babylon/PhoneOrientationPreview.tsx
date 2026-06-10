import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { Scene } from "@babylonjs/core/scene.js";
import { calibrateOrientation, type PlayerCalibration } from "@kindo/calibration";
import { identityQuaternion, rawSampleFromPacket, type QuaternionTuple } from "@kindo/motion-core";
import type { ControllerPacket } from "@kindo/protocol";
import { useEffect, useRef } from "react";

type PhoneOrientationPreviewProps = {
  packet: ControllerPacket | undefined;
  calibration: PlayerCalibration | undefined;
};

export function PhoneOrientationPreview({ calibration, packet }: PhoneOrientationPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phoneRootRef = useRef<TransformNode | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
    });
    const scene = new Scene(engine);
    scene.clearColor.set(0.04, 0.045, 0.04, 1);

    const camera = new ArcRotateCamera("camera", -Math.PI / 2.6, Math.PI / 2.5, 5.4, Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 3;
    camera.upperRadiusLimit = 8;

    const light = new HemisphericLight("light", new Vector3(0.4, 1, 0.3), scene);
    light.intensity = 0.85;

    const phoneRoot = new TransformNode("phone-root", scene);
    phoneRoot.rotationQuaternion = new Quaternion(0, 0, 0, 1);
    phoneRootRef.current = phoneRoot;

    const bodyMaterial = new StandardMaterial("phone-body", scene);
    bodyMaterial.diffuseColor = new Color3(0.09, 0.1, 0.095);
    bodyMaterial.specularColor = new Color3(0.8, 0.8, 0.72);

    const screenMaterial = new StandardMaterial("phone-screen", scene);
    screenMaterial.diffuseColor = new Color3(0.08, 0.55, 0.48);
    screenMaterial.emissiveColor = new Color3(0.02, 0.12, 0.1);

    const phone = MeshBuilder.CreateBox("phone", { width: 1.05, height: 2.05, depth: 0.16 }, scene);
    phone.parent = phoneRoot;
    phone.material = bodyMaterial;

    const screen = MeshBuilder.CreateBox("screen", { width: 0.9, height: 1.72, depth: 0.018 }, scene);
    screen.position.z = -0.091;
    screen.parent = phoneRoot;
    screen.material = screenMaterial;

    createAxisLine("axis-x", new Vector3(0, 0, 0), new Vector3(1.45, 0, 0), new Color3(1, 0.25, 0.22), phoneRoot, scene);
    createAxisLine("axis-y", new Vector3(0, 0, 0), new Vector3(0, 1.45, 0), new Color3(0.3, 0.85, 0.36), phoneRoot, scene);
    createAxisLine("axis-z", new Vector3(0, 0, 0), new Vector3(0, 0, 1.45), new Color3(0.35, 0.58, 1), phoneRoot, scene);

    engine.runRenderLoop(() => scene.render());

    const resize = () => engine.resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      phoneRootRef.current = null;
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    const phoneRoot = phoneRootRef.current;
    if (!phoneRoot) {
      return;
    }

    const quat = getPacketQuaternion(packet, calibration);
    phoneRoot.rotationQuaternion = new Quaternion(quat[0], quat[1], quat[2], quat[3]);
  }, [calibration, packet]);

  return <canvas ref={canvasRef} className="orientation-canvas" aria-label="Live phone orientation preview" />;
}

const createAxisLine = (
  name: string,
  start: Vector3,
  end: Vector3,
  color: Color3,
  parent: TransformNode,
  scene: Scene,
): void => {
  const line = MeshBuilder.CreateLines(name, { points: [start, end] }, scene);
  line.color = color;
  line.parent = parent;
};

const getPacketQuaternion = (packet: ControllerPacket | undefined, calibration: PlayerCalibration | undefined): QuaternionTuple => {
  if (!packet?.pose) {
    return calibration ? calibrateOrientation(undefined, calibration).quaternion : identityQuaternion();
  }
  return calibrateOrientation(rawSampleFromPacket(packet), calibration).quaternion;
};
