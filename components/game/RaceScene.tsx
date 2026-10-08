"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { Sky } from "@react-three/drei";
import { BufferGeometry, Float32BufferAttribute, Quaternion, Vector3 } from "three";
import { useGameStore } from "@/lib/state/gameStore";
import { useInput } from "@/game/input/useInput";
import {
  createRacingSimulation,
  stepRacingSimulation,
  TRACK_HALF_WIDTH,
  TRACK_RADIUS_X,
  TRACK_RADIUS_Z,
  type RacingSimulation,
} from "@/game/physics/racingPhysics";

function trackPoint(angle: number, offset: number) {
  const centerX = TRACK_RADIUS_X * Math.sin(angle);
  const centerZ = -TRACK_RADIUS_Z * Math.cos(angle);
  const tangentX = TRACK_RADIUS_X * Math.cos(angle);
  const tangentZ = TRACK_RADIUS_Z * Math.sin(angle);
  const tangentLength = Math.hypot(tangentX, tangentZ);
  return [
    centerX + (tangentZ / tangentLength) * offset,
    centerZ - (tangentX / tangentLength) * offset,
  ] as const;
}

function TrackSurface() {
  const roadGeometry = useMemo(() => {
    const segments = 256;
    const vertices: number[] = [];
    const indices: number[] = [];

    for (let index = 0; index <= segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      const [outerX, outerZ] = trackPoint(angle, TRACK_HALF_WIDTH);
      const [innerX, innerZ] = trackPoint(angle, -TRACK_HALF_WIDTH);
      vertices.push(outerX, 0.015, outerZ, innerX, 0.015, innerZ);
      if (index < segments) {
        const start = index * 2;
        indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  const centerMarks = useMemo(() => {
    return Array.from({ length: 108 }, (_, index) => {
      const angle = (index / 108) * Math.PI * 2;
      const [x, z] = trackPoint(angle, 0);
      const tangentYaw = Math.atan2(TRACK_RADIUS_X * Math.cos(angle), TRACK_RADIUS_Z * Math.sin(angle));
      return { x, z, tangentYaw, visible: index % 2 === 0 };
    }).filter((mark) => mark.visible);
  }, []);

  const barriers = useMemo(() => {
    const segments = 192;
    return [TRACK_HALF_WIDTH, -TRACK_HALF_WIDTH].flatMap((offset, side) =>
      Array.from({ length: segments }, (_, index) => {
        const angleA = (index / segments) * Math.PI * 2;
        const angleB = ((index + 1) / segments) * Math.PI * 2;
        const [xA, zA] = trackPoint(angleA, offset);
        const [xB, zB] = trackPoint(angleB, offset);
        return {
          key: `${side}-${index}`,
          x: (xA + xB) / 2,
          z: (zA + zB) / 2,
          length: Math.hypot(xB - xA, zB - zA),
          yaw: Math.atan2(-(zB - zA), xB - xA),
        };
      }),
    );
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[420, 420]} />
        <meshStandardMaterial color="#31483a" roughness={1} />
      </mesh>
      <mesh geometry={roadGeometry} receiveShadow>
        <meshStandardMaterial color="#34393b" roughness={0.94} side={2} />
      </mesh>
      {centerMarks.map((mark, index) => (
        <mesh key={index} position={[mark.x, 0.035, mark.z]} rotation={[-Math.PI / 2, 0, mark.tangentYaw]}>
          <planeGeometry args={[0.22, 2.2]} />
          <meshBasicMaterial color="#d5d0ba" transparent opacity={0.68} />
        </mesh>
      ))}
      {barriers.map((barrier) => (
        <RigidBody key={barrier.key} type="fixed" colliders={false} position={[barrier.x, 0.46, barrier.z]} rotation={[0, barrier.yaw, 0]}>
          <CuboidCollider args={[barrier.length / 2 + 0.08, 0.46, 0.2]} />
          <mesh castShadow receiveShadow position={[0, 0.02, 0]}>
            <boxGeometry args={[barrier.length, 0.82, 0.34]} />
            <meshStandardMaterial color="#c1c2b7" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <boxGeometry args={[barrier.length + 0.02, 0.08, 0.355]} />
            <meshStandardMaterial color="#ef5939" roughness={0.7} />
          </mesh>
        </RigidBody>
      ))}
      <StartLine />
      <TrackDetails />
    </group>
  );
}

function StartLine() {
  const tiles = Array.from({ length: 10 }, (_, index) => (
    <mesh key={index} position={[-4.5 + index, 0.04, -TRACK_RADIUS_Z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1, 1.1]} />
      <meshBasicMaterial color={index % 2 === 0 ? "#edece4" : "#252a2c"} />
    </mesh>
  ));
  return <group>{tiles}</group>;
}

function TrackDetails() {
  return (
    <group>
      <mesh position={[-4, 1.5, -TRACK_RADIUS_Z - 10]} castShadow>
        <boxGeometry args={[0.18, 3, 0.18]} />
        <meshStandardMaterial color="#c8cec3" metalness={0.55} roughness={0.42} />
      </mesh>
      <mesh position={[4, 1.5, -TRACK_RADIUS_Z - 10]} castShadow>
        <boxGeometry args={[0.18, 3, 0.18]} />
        <meshStandardMaterial color="#c8cec3" metalness={0.55} roughness={0.42} />
      </mesh>
      <mesh position={[0, 2.8, -TRACK_RADIUS_Z - 10]} castShadow>
        <boxGeometry args={[8, 0.18, 0.18]} />
        <meshStandardMaterial color="#e54d32" metalness={0.28} roughness={0.48} />
      </mesh>
      <mesh position={[0, 2.52, -TRACK_RADIUS_Z - 10.1]}>
        <planeGeometry args={[6, 0.1]} />
        <meshBasicMaterial color="#e54d32" />
      </mesh>
    </group>
  );
}

function CarModel() {
  return (
    <group>
      <mesh castShadow position={[0, 0.52, 0]}>
        <boxGeometry args={[1.82, 0.56, 3.7]} />
        <meshStandardMaterial color="#e84d32" metalness={0.25} roughness={0.34} />
      </mesh>
      <mesh castShadow position={[0, 0.96, -0.28]}>
        <boxGeometry args={[1.38, 0.55, 1.65]} />
        <meshStandardMaterial color="#252c31" metalness={0.3} roughness={0.22} />
      </mesh>
      <mesh castShadow position={[0, 1.23, 1.4]}>
        <boxGeometry args={[1.52, 0.12, 0.18]} />
        <meshStandardMaterial color="#25282a" roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 0.9, 1.62]}>
        <boxGeometry args={[1.76, 0.1, 0.28]} />
        <meshStandardMaterial color="#202527" roughness={0.6} />
      </mesh>
      {[-1, 1].flatMap((side) =>
        [-1.12, 1.12].map((longitudinal) => (
          <group key={`${side}-${longitudinal}`} position={[side * 0.91, 0.43, longitudinal]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.37, 0.37, 0.24, 12]} />
              <meshStandardMaterial color="#17191a" roughness={0.82} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.19, 0.19, 0.255, 8]} />
              <meshStandardMaterial color="#a8ada9" metalness={0.68} roughness={0.3} />
            </mesh>
          </group>
        )),
      )}
      {[-0.58, 0.58].map((x) => (
        <mesh key={x} position={[x, 0.55, -1.88]}>
          <boxGeometry args={[0.36, 0.14, 0.04]} />
          <meshBasicMaterial color="#f5e6bf" />
        </mesh>
      ))}
    </group>
  );
}

function RacingCar({ input, active, resetToken }: { input: ReturnType<typeof useInput>; active: boolean; resetToken: number }) {
  const body = useRef<RapierRigidBody>(null);
  const simulation = useRef<RacingSimulation>(createRacingSimulation());
  const simulationAccumulator = useRef(0);
  const hudAccumulator = useRef(0);
  const cameraTarget = useMemo(() => new Vector3(), []);
  const cameraPosition = useMemo(() => new Vector3(), []);
  const updateTelemetry = useGameStore((state) => state.updateTelemetry);
  const finishRace = useGameStore((state) => state.finishRace);
  const recordLap = useGameStore((state) => state.recordLap);
  const { camera } = useThree();

  useEffect(() => {
    simulation.current = createRacingSimulation();
    simulationAccumulator.current = 0;
    const initial = simulation.current;
    body.current?.setTranslation({ x: initial.x, y: 0.12, z: initial.z }, true);
    body.current?.setRotation(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), initial.yaw), true);
  }, [resetToken]);

  useFrame((_, delta) => {
    const current = simulation.current;
    if (active) {
      const fixedStep = 1 / 60;
      simulationAccumulator.current += Math.min(delta, 0.1);
      while (simulationAccumulator.current >= fixedStep) {
        const result = stepRacingSimulation(current, input.read(), fixedStep);
        if (result.lapCompleted) {
          recordLap(result.lapTime);
        }
        if (result.finished) {
          finishRace();
          break;
        }
        simulationAccumulator.current -= fixedStep;
      }
      body.current?.setNextKinematicTranslation({ x: current.x, y: 0.12, z: current.z });
      body.current?.setNextKinematicRotation(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), current.yaw));
      hudAccumulator.current += delta;
      if (hudAccumulator.current >= 0.08) {
        updateTelemetry(current.speed * 3.6, current.lap, current.elapsed, current.nitro, current.currentLapTime, current.lapProgress);
        hudAccumulator.current = 0;
      }
    }

    const followDistance = active ? 14 : 14;
    if (active) {
      cameraTarget.set(current.x, 0.6, current.z);
      cameraPosition.set(
        current.x - Math.sin(current.yaw) * followDistance,
        6.5,
        current.z - Math.cos(current.yaw) * followDistance,
      );
    } else {
      cameraTarget.set(18, 0, -50);
      cameraPosition.set(-4, 42, -10);
    }
    camera.position.lerp(cameraPosition, 1 - Math.exp(-delta * 4));
    camera.lookAt(cameraTarget);
  });

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[0, 0.12, -TRACK_RADIUS_Z]}>
      <CuboidCollider args={[0.83, 0.48, 1.72]} />
      <group rotation={[0, Math.PI, 0]}>
        <CarModel />
      </group>
    </RigidBody>
  );
}

function World({ phase, resetToken }: { phase: string; resetToken: number }) {
  const input = useInput(phase === "racing");

  return (
    <>
      <color attach="background" args={["#a8c2c5"]} />
      <fog attach="fog" args={["#a8c2c5", 100, 240]} />
      <Sky sunPosition={[70, 35, -80]} turbidity={5} rayleigh={1.4} />
      <ambientLight intensity={0.7} />
      <hemisphereLight args={["#d9e6e7", "#4c594a", 1.15]} />
      <directionalLight position={[-45, 75, -10]} intensity={2.6} castShadow shadow-mapSize={[2048, 2048]} />
      <Physics gravity={[0, -9.81, 0]} timeStep="vary">
        <TrackSurface />
        <RacingCar input={input} active={phase === "racing"} resetToken={resetToken} />
      </Physics>
    </>
  );
}

export default function RaceScene() {
  const phase = useGameStore((state) => state.phase);
  const resetToken = useGameStore((state) => state.resetToken);

  return (
    <Canvas shadows camera={{ position: [0, 8, -64], fov: 48, near: 0.1, far: 400 }} dpr={[1, 1.5]}>
      <World phase={phase} resetToken={resetToken} />
    </Canvas>
  );
}