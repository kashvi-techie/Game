"use client";

import { Component, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { Sky } from "@react-three/drei";
import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  MathUtils,
  Quaternion,
  TorusGeometry,
  Vector3,
} from "three";
import { arcadeAudio } from "@/game/audio/ArcadeAudio";
import SocietyWorld from "@/components/game/SocietyWorld";
import { createOpenWorldSimulation, isOpenWorldCameraClear, recoverOpenWorldSimulation, stepOpenWorldSimulation } from "@/game/physics/openWorldPhysics";
import { useGameStore } from "@/lib/state/gameStore";
import { useInput } from "@/game/input/useInput";
import { SOCIETY_START, SOCIETY_ROADS } from "@/game/world/societyLayout";
import {
  createRacingSimulation,
  recoverRacingSimulation,
  stepRacingSimulation,
  TRACK_HALF_WIDTH,
  TRACK_RADIUS_X,
  TRACK_RADIUS_Z,
  type RacingSimulation,
} from "@/game/physics/racingPhysics";
import type { WorldMode } from "@/lib/state/gameStore";

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

type LoftSection = {
  z: number;
  ring: readonly (readonly [number, number])[];
};

function createLoftGeometry(sections: readonly LoftSection[]) {
  const geometry = new BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];
  const ringSize = sections[0].ring.length;

  sections.forEach(({ z, ring }) => {
    ring.forEach(([x, y]) => vertices.push(x, y, z));
  });

  for (let section = 0; section < sections.length - 1; section += 1) {
    const ringStart = section * ringSize;
    const nextRingStart = (section + 1) * ringSize;
    for (let point = 0; point < ringSize; point += 1) {
      const nextPoint = (point + 1) % ringSize;
      const a = ringStart + point;
      const b = ringStart + nextPoint;
      const c = nextRingStart + point;
      const d = nextRingStart + nextPoint;
      indices.push(a, c, b, b, c, d);
    }
  }

  const capEnds = [0, sections.length - 1];
  capEnds.forEach((section, capIndex) => {
    const centerIndex = vertices.length / 3;
    const ringStart = section * ringSize;
    const center = sections[section].ring.reduce(
      (sum, [x, y]) => [sum[0] + x / ringSize, sum[1] + y / ringSize],
      [0, 0],
    );
    vertices.push(center[0], center[1], sections[section].z);
    for (let point = 0; point < ringSize; point += 1) {
      const nextPoint = (point + 1) % ringSize;
      if (capIndex === 0) indices.push(centerIndex, ringStart + point, ringStart + nextPoint);
      else indices.push(centerIndex, ringStart + nextPoint, ringStart + point);
    }
  });

  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createGlassGeometry() {
  const geometry = new BufferGeometry();
  const polygons: readonly (readonly (readonly [number, number, number])[])[] = [
    [[-0.57, 0.7, -1.04], [0.57, 0.7, -1.04], [0.4, 1.15, -0.57], [-0.4, 1.15, -0.57]],
    [[-0.62, 0.75, -0.93], [-0.6, 0.75, 0.88], [-0.44, 1.13, 0.4], [-0.44, 1.13, -0.49]],
    [[0.62, 0.75, -0.93], [0.44, 1.13, -0.49], [0.44, 1.13, 0.4], [0.6, 0.75, 0.88]],
    [[-0.57, 0.68, 0.95], [-0.42, 1.12, 0.42], [0.42, 1.12, 0.42], [0.57, 0.68, 0.95]],
  ];
  const vertices: number[] = [];
  const indices: number[] = [];

  polygons.forEach((polygon) => {
    const start = vertices.length / 3;
    polygon.forEach((point) => vertices.push(...point));
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  });

  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

type CarGeometrySet = {
  body: BufferGeometry;
  cabin: BufferGeometry;
  glass: BufferGeometry;
  tire: CylinderGeometry;
  rim: CylinderGeometry;
  hub: CylinderGeometry;
  arch: TorusGeometry;
};

let sharedCarGeometry: CarGeometrySet | undefined;

function getCarGeometry() {
  if (!sharedCarGeometry) {
    sharedCarGeometry = {
      body: createLoftGeometry([
        { z: -1.68, ring: [[-0.36, 0.42], [-0.5, 0.47], [-0.5, 0.54], [-0.39, 0.57], [0.39, 0.57], [0.5, 0.54], [0.5, 0.47], [0.36, 0.42]] },
        { z: -1.48, ring: [[-0.53, 0.28], [-0.72, 0.34], [-0.74, 0.55], [-0.57, 0.66], [0.57, 0.66], [0.74, 0.55], [0.72, 0.34], [0.53, 0.28]] },
        { z: -0.92, ring: [[-0.62, 0.25], [-0.83, 0.31], [-0.84, 0.6], [-0.68, 0.7], [0.68, 0.7], [0.84, 0.6], [0.83, 0.31], [0.62, 0.25]] },
        { z: 0.48, ring: [[-0.66, 0.25], [-0.9, 0.31], [-0.9, 0.57], [-0.72, 0.68], [0.72, 0.68], [0.9, 0.57], [0.9, 0.31], [0.66, 0.25]] },
        { z: 1.28, ring: [[-0.58, 0.29], [-0.78, 0.35], [-0.78, 0.55], [-0.62, 0.63], [0.62, 0.63], [0.78, 0.55], [0.78, 0.35], [0.58, 0.29]] },
        { z: 1.66, ring: [[-0.43, 0.39], [-0.6, 0.43], [-0.6, 0.52], [-0.48, 0.59], [0.48, 0.59], [0.6, 0.52], [0.6, 0.43], [0.43, 0.39]] },
      ]),
      cabin: createLoftGeometry([
        { z: -1.1, ring: [[-0.6, 0.67], [-0.35, 0.94], [0.35, 0.94], [0.6, 0.67]] },
        { z: -0.56, ring: [[-0.66, 0.68], [-0.45, 1.22], [0.45, 1.22], [0.66, 0.68]] },
        { z: 0.38, ring: [[-0.65, 0.66], [-0.43, 1.22], [0.43, 1.22], [0.65, 0.66]] },
        { z: 1.1, ring: [[-0.58, 0.64], [-0.34, 0.91], [0.34, 0.91], [0.58, 0.64]] },
      ]),
      glass: createGlassGeometry(),
      tire: new CylinderGeometry(0.36, 0.36, 0.27, 20),
      rim: new CylinderGeometry(0.235, 0.235, 0.055, 12),
      hub: new CylinderGeometry(0.105, 0.105, 0.07, 10),
      arch: new TorusGeometry(0.42, 0.045, 6, 20, Math.PI),
    };
  }
  return sharedCarGeometry;
}

function CarModel({ paint = "#e84d32" }: { paint?: string }) {
  const geometry = useMemo(() => getCarGeometry(), []);

  return (
    <group>
      <mesh geometry={geometry.body} castShadow receiveShadow>
        <meshPhysicalMaterial color={paint} metalness={0.34} roughness={0.28} clearcoat={0.78} clearcoatRoughness={0.2} />
      </mesh>
      <mesh geometry={geometry.cabin} castShadow receiveShadow>
        <meshPhysicalMaterial color={paint} metalness={0.28} roughness={0.25} clearcoat={0.88} clearcoatRoughness={0.16} />
      </mesh>
      <mesh geometry={geometry.glass}>
        <meshPhysicalMaterial color="#47616a" metalness={0.32} roughness={0.16} clearcoat={1} transparent opacity={0.88} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 1.22, -0.08]} castShadow>
        <boxGeometry args={[0.91, 0.1, 0.92]} />
        <meshPhysicalMaterial color={paint} metalness={0.3} roughness={0.24} clearcoat={0.9} />
      </mesh>
      <mesh position={[0, 0.37, -1.59]} castShadow>
        <boxGeometry args={[1.55, 0.2, 0.2]} />
        <meshStandardMaterial color="#202729" metalness={0.42} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.38, 1.59]} castShadow>
        <boxGeometry args={[1.5, 0.2, 0.2]} />
        <meshStandardMaterial color="#202729" metalness={0.42} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.47, -1.695]}>
        <boxGeometry args={[0.58, 0.13, 0.025]} />
        <meshStandardMaterial color="#111719" roughness={0.7} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.56, 0.57, -1.53]}>
            <boxGeometry args={[0.36, 0.12, 0.08]} />
            <meshStandardMaterial color="#edf2e6" emissive="#d3e7d8" emissiveIntensity={1.4} roughness={0.22} />
          </mesh>
          <mesh position={[side * 0.54, 0.52, 1.48]}>
            <boxGeometry args={[0.34, 0.13, 0.07]} />
            <meshStandardMaterial color="#bd4435" emissive="#9b251e" emissiveIntensity={0.85} roughness={0.3} />
          </mesh>
          <mesh position={[side * 0.79, 0.87, -0.51]}>
            <boxGeometry args={[0.2, 0.1, 0.22]} />
            <meshStandardMaterial color={paint} metalness={0.3} roughness={0.28} />
          </mesh>
          <mesh geometry={geometry.arch} position={[side * 0.82, 0.275, -1.1]} rotation={[0, Math.PI / 2, 0]}>
            <meshStandardMaterial color="#343b3c" metalness={0.22} roughness={0.34} />
          </mesh>
          <mesh geometry={geometry.arch} position={[side * 0.82, 0.275, 1.1]} rotation={[0, Math.PI / 2, 0]}>
            <meshStandardMaterial color="#343b3c" metalness={0.22} roughness={0.34} />
          </mesh>
          {[-1.1, 1.1].map((longitudinal) => (
            <group key={longitudinal} position={[side * 0.88, 0.275, longitudinal]}>
              <mesh geometry={geometry.tire} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                <meshStandardMaterial color="#171a1b" roughness={0.86} />
              </mesh>
              <mesh geometry={geometry.rim} position={[side * 0.14, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <meshStandardMaterial color="#aab2ae" metalness={0.78} roughness={0.24} />
              </mesh>
              <mesh geometry={geometry.hub} position={[side * 0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <meshStandardMaterial color="#d4d7d0" metalness={0.72} roughness={0.25} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {[-0.48, 0.48].map((side) => (
        <mesh key={side} position={[side, 0.79, 1.36]} castShadow>
          <boxGeometry args={[0.07, 0.22, 0.07]} />
          <meshStandardMaterial color="#252b2c" metalness={0.35} roughness={0.32} />
        </mesh>
      ))}
      <mesh position={[0, 0.91, 1.43]} castShadow>
        <boxGeometry args={[1.22, 0.09, 0.23]} />
        <meshPhysicalMaterial color={paint} metalness={0.32} roughness={0.26} clearcoat={0.8} />
      </mesh>
    </group>
  );
}

function OpenWorldCar({ input, active, resetToken, simulationRef, visible }: {
  input: ReturnType<typeof useInput>;
  active: boolean;
  resetToken: number;
  simulationRef: MutableRefObject<RacingSimulation>;
  visible: boolean;
}) {
  const body = useRef<RapierRigidBody>(null);
  const accumulator = useRef(0);
  const hudAccumulator = useRef(0);
  const resetPressed = useRef(false);
  const collisionFeedback = useRef(0);
  const updateTelemetry = useGameStore((state) => state.updateTelemetry);

  useEffect(() => {
    Object.assign(simulationRef.current, createOpenWorldSimulation());
    accumulator.current = 0;
    resetPressed.current = false;
    collisionFeedback.current = 0;
    const simulation = simulationRef.current;
    body.current?.setTranslation({ x: simulation.x, y: 0.12, z: simulation.z }, true);
    body.current?.setRotation(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), simulation.yaw), true);
  }, [resetToken, simulationRef]);

  useFrame((_, delta) => {
    const simulation = simulationRef.current;
    const controls = input.read();
    collisionFeedback.current = Math.max(0, collisionFeedback.current - delta);
    if (active && controls.reset && !resetPressed.current) {
      recoverOpenWorldSimulation(simulation, SOCIETY_ROADS);
      accumulator.current = 0;
      collisionFeedback.current = 0.36;
      body.current?.setTranslation({ x: simulation.x, y: 0.12, z: simulation.z }, true);
      body.current?.setRotation(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), simulation.yaw), true);
      arcadeAudio.playCue("impact");
    }
    resetPressed.current = Boolean(controls.reset);
    arcadeAudio.updateVehicle({ ...controls, speed: simulation.speed, nitro: simulation.nitro, enabled: active });

    if (active) {
      accumulator.current += Math.min(delta, 0.1);
      while (accumulator.current >= 1 / 60) {
        const result = stepOpenWorldSimulation(simulation, controls, 1 / 60);
        if (simulation.collided) {
          collisionFeedback.current = 0.36;
          arcadeAudio.playCue("impact");
        }
        if (result.finished) arcadeAudio.playCue("finish");
        accumulator.current -= 1 / 60;
      }
      body.current?.setNextKinematicTranslation({ x: simulation.x, y: 0.12, z: simulation.z });
      body.current?.setNextKinematicRotation(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), simulation.yaw));
      hudAccumulator.current += delta;
      if (hudAccumulator.current >= 0.08) {
        updateTelemetry(simulation.speed * 3.6, 1, simulation.elapsed, simulation.nitro, simulation.currentLapTime, 0, collisionFeedback.current > 0, false);
        hudAccumulator.current = 0;
      }
    }
  });

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[SOCIETY_START.x, 0.12, SOCIETY_START.z]}>
      <CuboidCollider args={[0.83, 0.48, 1.72]} />
      <group visible={visible} rotation={[0, Math.PI, 0]}>
        <CarModel />
      </group>
    </RigidBody>
  );
}

function RacingCar({ input, active, resetToken, simulationRef, visible }: {
  input: ReturnType<typeof useInput>;
  active: boolean;
  resetToken: number;
  simulationRef: MutableRefObject<RacingSimulation>;
  visible: boolean;
}) {
  const body = useRef<RapierRigidBody>(null);
  const simulationAccumulator = useRef(0);
  const hudAccumulator = useRef(0);
  const resetPressed = useRef(false);
  const collisionFeedback = useRef(0);
  const updateTelemetry = useGameStore((state) => state.updateTelemetry);
  const finishRace = useGameStore((state) => state.finishRace);
  const recordLap = useGameStore((state) => state.recordLap);

  useEffect(() => {
    Object.assign(simulationRef.current, createRacingSimulation());
    simulationAccumulator.current = 0;
    collisionFeedback.current = 0;
    resetPressed.current = false;
    const initial = simulationRef.current;
    body.current?.setTranslation({ x: initial.x, y: 0.12, z: initial.z }, true);
    body.current?.setRotation(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), initial.yaw), true);
  }, [resetToken, simulationRef]);

  useFrame((_, delta) => {
    const current = simulationRef.current;
    const controls = input.read();
    collisionFeedback.current = Math.max(0, collisionFeedback.current - delta);
    if (active && controls.reset && !resetPressed.current) {
      recoverRacingSimulation(current);
      simulationAccumulator.current = 0;
      collisionFeedback.current = 0.36;
      body.current?.setTranslation({ x: current.x, y: 0.12, z: current.z }, true);
      body.current?.setRotation(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), current.yaw), true);
      arcadeAudio.playCue("impact");
    }
    resetPressed.current = Boolean(controls.reset);
    arcadeAudio.updateVehicle({ ...controls, speed: current.speed, nitro: current.nitro, enabled: active });
    if (active) {
      const fixedStep = 1 / 60;
      simulationAccumulator.current += Math.min(delta, 0.1);
      while (simulationAccumulator.current >= fixedStep) {
        const result = stepRacingSimulation(current, controls, fixedStep);
        if (current.collided) {
          collisionFeedback.current = 0.36;
          arcadeAudio.playCue("impact");
        }
        if (result.lapCompleted) {
          recordLap(result.lapTime);
          arcadeAudio.playCue("lap");
        }
        if (result.finished) {
          arcadeAudio.playCue("finish");
          finishRace();
          break;
        }
        simulationAccumulator.current -= fixedStep;
      }
      body.current?.setNextKinematicTranslation({ x: current.x, y: 0.12, z: current.z });
      body.current?.setNextKinematicRotation(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), current.yaw));
      hudAccumulator.current += delta;
      if (hudAccumulator.current >= 0.08) {
        updateTelemetry(current.speed * 3.6, current.lap, current.elapsed, current.nitro, current.currentLapTime, current.lapProgress, collisionFeedback.current > 0, current.wrongWay);
        hudAccumulator.current = 0;
      }
    }

  });

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[0, 0.12, -TRACK_RADIUS_Z]}>
      <CuboidCollider args={[0.83, 0.48, 1.72]} />
      <group visible={visible} rotation={[0, Math.PI, 0]}>
        <CarModel />
      </group>
    </RigidBody>
  );
}

const TAU = Math.PI * 2;
const INTRO_DURATION = 8.2;
const DEMO_CAR_PAINTS = ["#d5f05d", "#e84d32", "#78949a"] as const;

function CinematicDirector({ phase, worldMode, simulationRef, introActive, introRunId, motionEnabled, onIntroComplete }: {
  phase: string;
  worldMode: WorldMode;
  simulationRef: MutableRefObject<RacingSimulation>;
  introActive: boolean;
  introRunId: number;
  motionEnabled: boolean;
  onIntroComplete: () => void;
}) {
  const { camera } = useThree();
  const demoCars = useRef<(Group | null)[]>([null, null, null]);
  const demoTime = useRef(0);
  const introTime = useRef(0);
  const lastRunId = useRef(introRunId);
  const completionSent = useRef(false);
  const middle = useMemo(() => new Vector3(), []);
  const cameraTarget = useMemo(() => new Vector3(18, 0, -50), []);
  const cameraGoal = useMemo(() => new Vector3(), []);
  const targetGoal = useMemo(() => new Vector3(), []);
  const behind = useMemo(() => new Vector3(), []);
  const alongside = useMemo(() => new Vector3(), []);
  const frontThreeQuarter = useMemo(() => new Vector3(), []);
  const menuPosition = useMemo(() => new Vector3(-8, 7, -63), []);
  const menuTarget = useMemo(() => new Vector3(2.5, 0.55, -50), []);
  const cameraCandidate = useMemo(() => new Vector3(), []);

  useFrame((_, delta) => {
    arcadeAudio.setIntroAmbience(introActive && phase === "menu");
    if (lastRunId.current !== introRunId) {
      lastRunId.current = introRunId;
      introTime.current = 0;
      completionSent.current = false;
    }
    if (motionEnabled && introActive) demoTime.current += delta;
    if (introActive) introTime.current += delta;

    const middleAngle = (demoTime.current * 0.42) % TAU;
    let middleX = 0;
    let middleZ = -TRACK_RADIUS_Z;
    let middleYaw = Math.PI / 2;

    for (let index = 0; index < demoCars.current.length; index += 1) {
      const car = demoCars.current[index];
      if (!car) continue;
      const lane = index - 1;
      const angle = (middleAngle + lane * 0.15 + TAU) % TAU;
      const [x, z] = trackPoint(angle, lane * 1.35);
      const yaw = Math.atan2(TRACK_RADIUS_X * Math.cos(angle), TRACK_RADIUS_Z * Math.sin(angle));
      const bumpProgress = MathUtils.clamp((introTime.current - 4.05) / 0.7, 0, 1);
      const bump = index === 1 && introActive ? Math.sin(bumpProgress * Math.PI) * 0.48 : 0;
      car.position.set(x, 0.12 + bump, z);
      car.rotation.y = yaw;
      if (index === 1) {
        middleX = x;
        middleZ = z;
        middleYaw = yaw;
      }
    }

    const forwardX = Math.sin(middleYaw);
    const forwardZ = Math.cos(middleYaw);
    const sideX = Math.cos(middleYaw);
    const sideZ = -Math.sin(middleYaw);
    middle.set(middleX, 0.45, middleZ);
    behind.set(middleX - forwardX * 9, 2.35, middleZ - forwardZ * 9);
    alongside.set(middleX + sideX * 7, 2.35, middleZ + sideZ * 7);
    frontThreeQuarter.set(
      middleX + forwardX * 8 + sideX * 3.5,
      3.1,
      middleZ + forwardZ * 8 + sideZ * 3.5,
    );

    if (introActive) {
      const elapsed = introTime.current;
      if (elapsed < 2.3) {
        cameraGoal.copy(behind).lerp(alongside, MathUtils.smoothstep(elapsed, 0, 2.3));
        targetGoal.copy(middle);
      } else if (elapsed < 4.8) {
        cameraGoal.copy(alongside).lerp(frontThreeQuarter, MathUtils.smoothstep(elapsed, 2.3, 4.8));
        targetGoal.copy(middle);
      } else {
        const transition = MathUtils.smoothstep(elapsed, 4.8, 7.4);
        cameraGoal.copy(frontThreeQuarter).lerp(menuPosition, transition);
        targetGoal.copy(middle).lerp(menuTarget, transition);
      }
      if (elapsed >= INTRO_DURATION && !completionSent.current) {
        completionSent.current = true;
        onIntroComplete();
      }
    } else if (phase === "racing" || phase === "paused" || phase === "finished") {
      const player = simulationRef.current;
      cameraGoal.set(
        player.x - Math.sin(player.yaw) * 14,
        6.5,
        player.z - Math.cos(player.yaw) * 14,
      );
      targetGoal.set(player.x, 0.6, player.z);
    } else if (phase === "exploring") {
      const player = simulationRef.current;
      targetGoal.set(player.x, 0.8, player.z);
      cameraGoal.set(
        player.x - Math.sin(player.yaw) * 12,
        7.5,
        player.z - Math.cos(player.yaw) * 12,
      );
      cameraCandidate.copy(cameraGoal).sub(targetGoal);
      const distance = cameraCandidate.length();
      cameraCandidate.normalize();
      let clearDistance = distance;
      for (let sample = 1; sample <= Math.floor(distance); sample += 1) {
        const x = targetGoal.x + cameraCandidate.x * sample;
        const z = targetGoal.z + cameraCandidate.z * sample;
        if (!isOpenWorldCameraClear(x, z)) {
          clearDistance = Math.max(4, sample - 1.2);
          break;
        }
      }
      cameraGoal.copy(targetGoal).addScaledVector(cameraCandidate, clearDistance);
    } else {
      if (worldMode === "society") {
        cameraGoal.set(-12, 10, SOCIETY_START.z + 21);
        targetGoal.set(0, 0.6, SOCIETY_START.z - 6);
      } else {
        cameraGoal.copy(menuPosition);
        targetGoal.copy(menuTarget);
      }
    }

    camera.position.lerp(cameraGoal, 1 - Math.exp(-delta * 3.2));
    cameraTarget.lerp(targetGoal, 1 - Math.exp(-delta * 4));
    camera.lookAt(cameraTarget);
  });

  return (
    <group>
      {[0, 1, 2].map((index) => (
        <group
          key={index}
          ref={(group) => { demoCars.current[index] = group; }}
          visible={motionEnabled && introActive}
        >
          <group rotation={[0, Math.PI, 0]}>
            <CarModel paint={DEMO_CAR_PAINTS[index]} />
          </group>
        </group>
      ))}
    </group>
  );
}

function WebGLFallback({ onUnavailable }: { onUnavailable: () => void }) {
  useEffect(() => onUnavailable(), [onUnavailable]);

  return (
    <div className="viewport-loading" role="status">
      WebGL unavailable. This browser cannot display the 3D circuit.
    </div>
  );
}

class RendererErrorBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? <WebGLFallback onUnavailable={this.props.onFailure} /> : this.props.children;
  }
}

function World({ phase, worldMode, resetToken, introActive, introRunId, motionEnabled, onIntroComplete }: {
  phase: string;
  worldMode: WorldMode;
  resetToken: number;
  introActive: boolean;
  introRunId: number;
  motionEnabled: boolean;
  onIntroComplete: () => void;
}) {
  const input = useInput(phase === "racing" || phase === "exploring");
  const raceSimulationRef = useRef(createRacingSimulation());
  const societySimulationRef = useRef(createOpenWorldSimulation());
  const activeSimulationRef = worldMode === "society" ? societySimulationRef : raceSimulationRef;

  return (
    <>
      <CinematicDirector
        phase={phase}
        worldMode={worldMode}
        simulationRef={activeSimulationRef}
        introActive={introActive}
        introRunId={introRunId}
        motionEnabled={motionEnabled}
        onIntroComplete={onIntroComplete}
      />
      <color attach="background" args={["#a8c2c5"]} />
      <fog attach="fog" args={["#a8c2c5", 100, 240]} />
      <Sky sunPosition={[70, 35, -80]} turbidity={5} rayleigh={1.4} />
      <ambientLight intensity={0.7} />
      <hemisphereLight color="#d9e6e7" groundColor="#4c594a" intensity={1.15} />
      <directionalLight position={[-45, 75, -10]} intensity={2.6} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <Physics gravity={[0, -9.81, 0]} timeStep="vary">
        {worldMode === "society" ? <SocietyWorld /> : <TrackSurface />}
        {worldMode === "society" ? (
          <OpenWorldCar
            input={input}
            active={phase === "exploring"}
            resetToken={resetToken}
            simulationRef={societySimulationRef}
            visible={!introActive}
          />
        ) : (
          <RacingCar
            input={input}
            active={phase === "racing"}
            resetToken={resetToken}
            simulationRef={raceSimulationRef}
            visible={!introActive}
          />
        )}
      </Physics>
    </>
  );
}

export default function RaceScene({ introActive, introRunId, motionEnabled, onIntroComplete }: {
  introActive: boolean;
  introRunId: number;
  motionEnabled: boolean;
  onIntroComplete: () => void;
}) {
  const phase = useGameStore((state) => state.phase);
  const worldMode = useGameStore((state) => state.worldMode);
  const resetToken = useGameStore((state) => state.resetToken);

  return (
    <RendererErrorBoundary onFailure={onIntroComplete}>
      <Canvas
        fallback={<WebGLFallback onUnavailable={onIntroComplete} />}
        shadows
        camera={{ position: [0, 8, -64], fov: 48, near: 0.1, far: 400 }}
        dpr={[1, 1.5]}
      >
        <World
          phase={phase}
          worldMode={worldMode}
          resetToken={resetToken}
          introActive={introActive}
          introRunId={introRunId}
          motionEnabled={motionEnabled}
          onIntroComplete={onIntroComplete}
        />
      </Canvas>
    </RendererErrorBoundary>
  );
}