"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import {
  BoxGeometry,
  CylinderGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
} from "three";
import {
  SOCIETY_BUILDINGS,
  SOCIETY_PARKING,
  SOCIETY_POOL,
  SOCIETY_ROADS,
  SOCIETY_SPORTS_COURT,
  SOCIETY_TREES,
  SOCIETY_WALLS,
  type SocietyBuilding,
  type SocietyRoad,
} from "@/game/world/societyLayout";

type InstanceTransform = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rotationY?: number;
};

function populateInstances(mesh: InstancedMesh | null, transforms: readonly InstanceTransform[]) {
  if (!mesh) return;
  const object = new Object3D();
  transforms.forEach(({ x, y, z, sx, sy, sz, rotationY = 0 }, index) => {
    object.position.set(x, y, z);
    object.rotation.set(0, rotationY, 0);
    object.scale.set(sx, sy, sz);
    object.updateMatrix();
    mesh.setMatrixAt(index, object.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

function createWindowTransforms() {
  const transforms: InstanceTransform[] = [];
  SOCIETY_BUILDINGS.forEach((building) => {
    const columns = Math.max(2, Math.floor((building.width - 5) / 5));
    const floors = Math.min(building.floors, 16);
    const floorHeight = building.height / building.floors;
    for (let floor = 0; floor < floors; floor += 1) {
      for (let column = 0; column < columns; column += 1) {
        const u = (column + 1) / (columns + 1);
        const x = building.x + (u - 0.5) * (building.width - 3);
        const z = building.z + (u - 0.5) * (building.depth - 3);
        const y = Math.min(building.height - 1.2, floor * floorHeight + floorHeight * 0.54);
        const windowWidth = Math.min(2.5, (building.width - 4) / columns * 0.58);
        const windowHeight = Math.min(1.55, floorHeight * 0.43);
        const windowDepth = building.kind === "tower" ? 0.1 : 0.08;
        transforms.push(
          { x, y, z: building.z - building.depth / 2 - windowDepth / 2, sx: windowWidth, sy: windowHeight, sz: windowDepth },
          { x, y, z: building.z + building.depth / 2 + windowDepth / 2, sx: windowWidth, sy: windowHeight, sz: windowDepth },
          { x: building.x - building.width / 2 - windowDepth / 2, y, z, sx: windowDepth, sy: windowHeight, sz: Math.min(2.1, building.depth / 4) },
          { x: building.x + building.width / 2 + windowDepth / 2, y, z, sx: windowDepth, sy: windowHeight, sz: Math.min(2.1, building.depth / 4) },
        );
      }
    }
  });
  return transforms;
}

function createRoadMarkTransforms(roads: readonly SocietyRoad[]) {
  const transforms: InstanceTransform[] = [];
  roads.forEach((road) => {
    if (road.width < 12) return;
    const count = Math.floor((road.length - 12) / 15);
    for (let index = 0; index < count; index += 1) {
      const offset = -road.length / 2 + 10 + index * 15;
      transforms.push({
        x: road.axis === "x" ? road.x + offset : road.x,
        y: 0.055,
        z: road.axis === "z" ? road.z + offset : road.z,
        sx: road.axis === "x" ? 5 : 0.16,
        sy: 0.025,
        sz: road.axis === "z" ? 5 : 0.16,
      });
    }
  });
  return transforms;
}

function Road({ road }: { road: SocietyRoad }) {
  const alongX = road.axis === "x";
  const length = road.length;
  const width = road.width;
  const sidewalkWidth = 2.6;
  const roadSize: [number, number, number] = alongX ? [length, 0.08, width] : [width, 0.08, length];
  const sidewalkSize: [number, number, number] = alongX
    ? [length, 0.12, sidewalkWidth]
    : [sidewalkWidth, 0.12, length];
  const curbSize: [number, number, number] = alongX
    ? [length, 0.22, 0.24]
    : [0.24, 0.22, length];
  const sideX = alongX ? 0 : width / 2 + sidewalkWidth / 2;
  const sideZ = alongX ? width / 2 + sidewalkWidth / 2 : 0;
  const curbX = alongX ? 0 : width / 2 + 0.06;
  const curbZ = alongX ? width / 2 + 0.06 : 0;

  return (
    <group position={[road.x, 0, road.z]}>
      <mesh position={[0, 0.025, 0]} receiveShadow>
        <boxGeometry args={roadSize} />
        <meshStandardMaterial color="#343b3d" roughness={0.94} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * sideX, 0.04, side * sideZ]} receiveShadow>
            <boxGeometry args={sidewalkSize} />
            <meshStandardMaterial color="#a6a99e" roughness={0.9} />
          </mesh>
          <mesh position={[side * curbX, 0.11, side * curbZ]} castShadow>
            <boxGeometry args={curbSize} />
            <meshStandardMaterial color="#d2d0c5" roughness={0.78} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Building({ building }: { building: SocietyBuilding }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[building.x, 0, building.z]}>
      <CuboidCollider args={[building.width / 2, building.height / 2, building.depth / 2]} position={[0, building.height / 2, 0]} />
      <mesh position={[0, building.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[building.width, building.height, building.depth]} />
        <meshStandardMaterial color={building.color} roughness={0.75} />
      </mesh>
      <mesh position={[0, building.height + 0.22, 0]} castShadow>
        <boxGeometry args={[building.width + 0.8, 0.45, building.depth + 0.8]} />
        <meshStandardMaterial color={building.kind === "tower" ? "#5e6b69" : "#847e6d"} roughness={0.68} />
      </mesh>
      {building.kind !== "tower" && (
        <mesh position={[0, 2.15, -building.depth / 2 - 0.1]}>
          <boxGeometry args={[Math.min(12, building.width * 0.56), 1.1, 0.15]} />
          <meshStandardMaterial color={building.kind === "shop" ? "#c7734e" : "#536862"} roughness={0.55} />
        </mesh>
      )}
    </RigidBody>
  );
}

function BuildingWindows() {
  const mesh = useRef<InstancedMesh>(null);
  const transforms = useMemo(() => createWindowTransforms(), []);
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const material = useMemo(() => new MeshStandardMaterial({ color: "#536b70", roughness: 0.25, metalness: 0.32, emissive: "#273b3d", emissiveIntensity: 0.22 }), []);

  useLayoutEffect(() => populateInstances(mesh.current, transforms), [transforms]);

  return <instancedMesh ref={mesh} args={[geometry, material, transforms.length]} castShadow={false} />;
}

function RoadMarkings() {
  const mesh = useRef<InstancedMesh>(null);
  const transforms = useMemo(() => createRoadMarkTransforms(SOCIETY_ROADS), []);
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const material = useMemo(() => new MeshStandardMaterial({ color: "#dbd9ca", roughness: 0.82 }), []);

  useLayoutEffect(() => populateInstances(mesh.current, transforms), [transforms]);

  return <instancedMesh ref={mesh} args={[geometry, material, transforms.length]} />;
}

function Trees() {
  const trunks = useRef<InstancedMesh>(null);
  const crowns = useRef<InstancedMesh>(null);
  const trunkGeometry = useMemo(() => new CylinderGeometry(0.34, 0.52, 4, 7), []);
  const crownGeometry = useMemo(() => new SphereGeometry(1, 7, 6), []);
  const trunkMaterial = useMemo(() => new MeshStandardMaterial({ color: "#6c5945", roughness: 1 }), []);
  const crownMaterial = useMemo(() => new MeshStandardMaterial({ color: "#49694c", roughness: 1 }), []);
  const trunkTransforms = useMemo(() => SOCIETY_TREES.map(({ x, z, scale }) => ({ x, y: 2, z, sx: scale, sy: scale, sz: scale })), []);
  const crownTransforms = useMemo(() => SOCIETY_TREES.map(({ x, z, scale }) => ({ x, y: 5.1 * scale, z, sx: 2.7 * scale, sy: 2.5 * scale, sz: 2.7 * scale })), []);

  useLayoutEffect(() => {
    populateInstances(trunks.current, trunkTransforms);
    populateInstances(crowns.current, crownTransforms);
  }, [trunkTransforms, crownTransforms]);

  return (
    <>
      <instancedMesh ref={trunks} args={[trunkGeometry, trunkMaterial, trunkTransforms.length]} castShadow />
      <instancedMesh ref={crowns} args={[crownGeometry, crownMaterial, crownTransforms.length]} castShadow receiveShadow />
    </>
  );
}

function Streetlights() {
  const poles = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  const poleTransforms = useMemo(() => {
    const transforms: InstanceTransform[] = [];
    SOCIETY_ROADS.filter((road) => road.width >= 13 && road.length > 100).forEach((road) => {
      const count = Math.floor((road.length - 20) / 38);
      for (let index = 0; index < count; index += 1) {
        const offset = -road.length / 2 + 18 + index * 38;
        for (const side of [-1, 1]) {
          transforms.push({
            x: road.axis === "x" ? road.x + offset : road.x + side * (road.width / 2 + 3),
            y: 5,
            z: road.axis === "z" ? road.z + offset : road.z + side * (road.width / 2 + 3),
            sx: 0.16,
            sy: 5,
            sz: 0.16,
          });
        }
      }
    });
    return transforms;
  }, []);
  const headTransforms = useMemo(() => poleTransforms.map(({ x, z }) => ({ x: x + 0.6, y: 9.7, z, sx: 1.3, sy: 0.12, sz: 0.32 })), [poleTransforms]);
  const poleGeometry = useMemo(() => new CylinderGeometry(0.09, 0.14, 1, 7), []);
  const headGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const poleMaterial = useMemo(() => new MeshStandardMaterial({ color: "#384240", metalness: 0.55, roughness: 0.45 }), []);
  const headMaterial = useMemo(() => new MeshStandardMaterial({ color: "#d5e3b5", emissive: "#c8e29b", emissiveIntensity: 1.5 }), []);

  useLayoutEffect(() => {
    populateInstances(poles.current, poleTransforms);
    populateInstances(heads.current, headTransforms);
  }, [poleTransforms, headTransforms]);

  return (
    <>
      <instancedMesh ref={poles} args={[poleGeometry, poleMaterial, poleTransforms.length]} castShadow />
      <instancedMesh ref={heads} args={[headGeometry, headMaterial, headTransforms.length]} />
    </>
  );
}

function ParkingAreas() {
  return (
    <group>
      {SOCIETY_PARKING.map((area, index) => (
        <group key={index}>
          <mesh position={[area.x, 0.035, area.z]} receiveShadow>
            <boxGeometry args={[area.width, 0.06, area.depth]} />
            <meshStandardMaterial color="#414849" roughness={0.92} />
          </mesh>
          {Array.from({ length: Math.floor(area.width / 3.2) }, (_, stall) => (
            <mesh key={stall} position={[area.x - area.width / 2 + 1.6 + stall * 3.2, 0.075, area.z]}>
              <boxGeometry args={[0.07, 0.018, area.depth - 1.2]} />
              <meshBasicMaterial color="#d6d2c2" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Park() {
  return (
    <group>
      <mesh position={[33, 0.005, -28]} receiveShadow>
        <boxGeometry args={[43, 0.03, 47]} />
        <meshStandardMaterial color="#617c57" roughness={1} />
      </mesh>
      <mesh position={[33, 0.028, -28]}>
        <boxGeometry args={[4, 0.035, 43]} />
        <meshStandardMaterial color="#b5ad94" roughness={0.95} />
      </mesh>
      <mesh position={[33, 0.031, -28]}>
        <boxGeometry args={[39, 0.035, 4]} />
        <meshStandardMaterial color="#b5ad94" roughness={0.95} />
      </mesh>
      {[-1, 1].flatMap((side) => [-1, 1].map((end) => (
        <group key={`${side}-${end}`} position={[33 + side * 12, 0, -28 + end * 19]} rotation={[0, Math.PI / 2, 0]}>
          <mesh position={[0, 0.66, 0]} castShadow>
            <boxGeometry args={[3.6, 0.18, 0.72]} />
            <meshStandardMaterial color="#806a50" roughness={0.78} />
          </mesh>
          <mesh position={[0, 0.95, -0.28]}>
            <boxGeometry args={[3.6, 0.65, 0.12]} />
            <meshStandardMaterial color="#9b835f" roughness={0.8} />
          </mesh>
        </group>
      )))}
    </group>
  );
}

function SportsAndPool() {
  return (
    <group>
      <group position={[SOCIETY_SPORTS_COURT.x, 0, SOCIETY_SPORTS_COURT.z]}>
        <mesh position={[0, 0.045, 0]} receiveShadow>
          <boxGeometry args={[SOCIETY_SPORTS_COURT.width, 0.08, SOCIETY_SPORTS_COURT.depth]} />
          <meshStandardMaterial color="#537c76" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[0.15, 0.025, SOCIETY_SPORTS_COURT.depth - 2]} />
          <meshBasicMaterial color="#e8e5d8" />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[SOCIETY_SPORTS_COURT.width - 2, 0.025, 0.15]} />
          <meshBasicMaterial color="#e8e5d8" />
        </mesh>
      </group>
      <group position={[SOCIETY_POOL.x, 0, SOCIETY_POOL.z]}>
        <mesh position={[0, 0.05, 0]} receiveShadow>
          <boxGeometry args={[SOCIETY_POOL.width + 5, 0.1, SOCIETY_POOL.depth + 5]} />
          <meshStandardMaterial color="#c9c7b9" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.115, 0]}>
          <boxGeometry args={[SOCIETY_POOL.width, 0.04, SOCIETY_POOL.depth]} />
          <meshStandardMaterial color="#337f91" metalness={0.14} roughness={0.19} />
        </mesh>
        <mesh position={[SOCIETY_POOL.width / 2 + 3, 0.32, 0]} castShadow>
          <boxGeometry args={[0.2, 0.5, SOCIETY_POOL.depth + 4]} />
          <meshStandardMaterial color="#d8d5c6" roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

function Roundabout() {
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[4.4, 4.4, 0.16, 24]} />
        <meshStandardMaterial color="#687e59" roughness={1} />
      </mesh>
      <mesh position={[0, 0.16, 0]} castShadow>
        <sphereGeometry args={[1.9, 10, 7]} />
        <meshStandardMaterial color="#607753" roughness={1} />
      </mesh>
    </group>
  );
}

function EntranceAndGate() {
  return (
    <group>
      <mesh position={[-11, 3.8, 127]} castShadow>
        <boxGeometry args={[0.8, 7.6, 1.1]} />
        <meshStandardMaterial color="#908b78" roughness={0.78} />
      </mesh>
      <mesh position={[11, 3.8, 127]} castShadow>
        <boxGeometry args={[0.8, 7.6, 1.1]} />
        <meshStandardMaterial color="#908b78" roughness={0.78} />
      </mesh>
      <mesh position={[0, 7.1, 127]} castShadow>
        <boxGeometry args={[24, 0.7, 1.6]} />
        <meshStandardMaterial color="#777c70" metalness={0.18} roughness={0.54} />
      </mesh>
      <mesh position={[0, 6.8, 127.86]}>
        <boxGeometry args={[17, 0.18, 0.06]} />
        <meshStandardMaterial color="#d5f05d" emissive="#97ad44" emissiveIntensity={0.65} />
      </mesh>
      {[-7, 7].map((x) => (
        <mesh key={x} position={[x, 2.6, 130]} rotation={[0, 0, x < 0 ? -0.48 : 0.48]} castShadow>
          <boxGeometry args={[0.45, 5.2, 0.28]} />
          <meshStandardMaterial color="#eee7d3" roughness={0.58} />
        </mesh>
      ))}
    </group>
  );
}

function SocietyBoundary() {
  return (
    <group>
      {SOCIETY_WALLS.map((wall) => (
        <RigidBody key={wall.id} type="fixed" colliders={false} position={[wall.x, wall.height / 2, wall.z]}>
          <CuboidCollider args={[wall.width / 2, wall.height / 2, wall.depth / 2]} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={[wall.width, wall.height, wall.depth]} />
            <meshStandardMaterial color="#999886" roughness={0.9} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}

function SocietyGround() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[520, 520]} />
        <meshStandardMaterial color="#59724f" roughness={1} />
      </mesh>
      {SOCIETY_ROADS.map((road) => <Road key={road.id} road={road} />)}
      <RoadMarkings />
      <Park />
      <ParkingAreas />
      <SportsAndPool />
      <Roundabout />
      <EntranceAndGate />
      <SocietyBoundary />
      <Trees />
      <Streetlights />
      {SOCIETY_BUILDINGS.map((building) => <Building key={building.id} building={building} />)}
      <BuildingWindows />
    </>
  );
}

export default function SocietyWorld() {
  return <SocietyGround />;
}