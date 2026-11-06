"use client";

import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  SRGBColorSpace,
} from "three";
import { arcadeAudio } from "@/game/audio/ArcadeAudio";
import {
  CURB_WIDTH,
  MAIN_AVENUE_WIDTH,
  PEDESTRIAN_NPCS,
  PEDESTRIAN_ROUTES,
  POLICE_PATROL_ROUTE,
  SECONDARY_ROAD_WIDTH,
  SIDEWALK_WIDTH,
  SOCIETY_BUILDINGS,
  SOCIETY_INTERSECTIONS,
  SOCIETY_PARK,
  SOCIETY_PARKED_CARS,
  SOCIETY_PARKING,
  SOCIETY_ROADS,
  SOCIETY_ROUNDABOUT,
  SOCIETY_TENNIS_COURT,
  SOCIETY_TREES,
  SOCIETY_WALLS,
  STATIC_LIVING_NPCS,
  type PedestrianNPC,
  type PedestrianRoute,
  type SocietyBuilding,
  type StaticNPC,
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
  if (!mesh || transforms.length === 0) return;
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

// -------------------------------------------------------------
// TEXTURES & SIGNS
// -------------------------------------------------------------
function createSignTexture(title: string, subtitle: string, accentColor = "#d5f05d") {
  if (typeof document === "undefined") {
    return new CanvasTexture(null as unknown as HTMLCanvasElement);
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 144;
  const context = canvas.getContext("2d");
  if (!context) return new CanvasTexture(canvas);

  context.fillStyle = "#1b2123";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = accentColor;
  context.fillRect(0, 0, 14, canvas.height);
  context.fillStyle = "#f0ede1";
  context.font = "800 44px Arial, sans-serif";
  context.fillText(title, 32, 64, 455);
  context.fillStyle = "#9fa69b";
  context.font = "600 22px Arial, sans-serif";
  context.fillText(subtitle, 34, 108, 455);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function SocietySign({
  title,
  subtitle,
  width,
  position,
  rotationY = Math.PI,
  accentColor = "#d5f05d",
}: {
  title: string;
  subtitle: string;
  width: number;
  position: [number, number, number];
  rotationY?: number;
  accentColor?: string;
}) {
  const texture = useMemo(() => createSignTexture(title, subtitle, accentColor), [title, subtitle, accentColor]);
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[width, width * 0.28]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

// -------------------------------------------------------------
// NPC SPEECH BUBBLE BILLBOARD SYSTEM
// -------------------------------------------------------------
const BUBBLE_TEXTURE_CACHE = new Map<string, CanvasTexture>();

function getBubbleTexture(text: string, isAlert = false) {
  const key = `${text}_${isAlert}`;
  let tex = BUBBLE_TEXTURE_CACHE.get(key);
  if (!tex) {
    if (typeof document === "undefined") {
      return new CanvasTexture(null as unknown as HTMLCanvasElement);
    }
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = isAlert ? "rgba(225, 29, 72, 0.94)" : "rgba(15, 23, 42, 0.92)";
      ctx.strokeStyle = isAlert ? "#fecdd3" : "#d5f05d";
      ctx.lineWidth = 4;
      const r = 18;
      const w = 504;
      const h = 126;
      const x = 4;
      const y = 4;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(w / 2 + 14, y + h);
      ctx.lineTo(w / 2, y + h + 18);
      ctx.lineTo(w / 2 - 14, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 25px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let line = "";
      words.forEach((word) => {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > w - 40) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      });
      if (line) lines.push(line);
      const lineHeight = 30;
      const firstY = y + h / 2 - ((Math.min(lines.length, 2) - 1) * lineHeight) / 2;
      lines.slice(0, 2).forEach((content, index) => ctx.fillText(content, w / 2, firstY + index * lineHeight));
    }
    tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    BUBBLE_TEXTURE_CACHE.set(key, tex);
  }
  return tex;
}

type BubbleState = { text: string; isAlert: boolean; visible: boolean };

function SpeechBubble({ bubbleRef }: { bubbleRef: MutableRefObject<BubbleState> }) {
  const meshRef = useRef<Group>(null);
  const matRef = useRef<MeshBasicMaterial>(null);
  const lastKey = useRef("");

  useFrame(({ camera }) => {
    if (!meshRef.current) return;
    const state = bubbleRef.current;
    const shouldBeVisible = Boolean(state.visible && state.text);
    meshRef.current.visible = shouldBeVisible;
    if (!shouldBeVisible) return;

    meshRef.current.quaternion.copy(camera.quaternion);
    const key = `${state.text}_${state.isAlert}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      const tex = getBubbleTexture(state.text, state.isAlert);
      if (matRef.current) {
        matRef.current.map = tex;
        matRef.current.needsUpdate = true;
      }
    }
  });

  return (
    <group ref={meshRef} position={[0, 2.45, 0]} visible={false}>
      <mesh>
        <planeGeometry args={[3.05, 0.95]} />
        <meshBasicMaterial ref={matRef} transparent side={DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------
// ROAD NETWORK, SIDEWALKS & INTERSECTIONS
// -------------------------------------------------------------
type SidewalkBlock = {
  x: number;
  z: number;
  width: number;
  length: number;
  axis: "x" | "z";
  side: -1 | 1;
};

function generateSidewalkBlocks(): SidewalkBlock[] {
  const blocks: SidewalkBlock[] = [];
  const xGrid = [-118, -62, 0, 62, 118];
  const zGrid = [-118, -58, 0, 58, 118];

  // N-S segments between consecutive Z intersections
  xGrid.forEach((x) => {
    const isMain = x === 0;
    const roadWidth = isMain ? MAIN_AVENUE_WIDTH : SECONDARY_ROAD_WIDTH;

    for (let i = 0; i < zGrid.length - 1; i += 1) {
      const zA = zGrid[i];
      const zB = zGrid[i + 1];

      const widthA = SECONDARY_ROAD_WIDTH;
      const widthB = SECONDARY_ROAD_WIDTH;

      const zStart = zA + widthA / 2 + 0.3;
      const zEnd = zB - widthB / 2 - 0.3;
      const length = zEnd - zStart;
      if (length <= 2) continue;

      const zCenter = (zStart + zEnd) / 2;
      const sideDist = roadWidth / 2 + SIDEWALK_WIDTH / 2;

      // West and East sidewalks
      blocks.push({ x: x - sideDist, z: zCenter, width: SIDEWALK_WIDTH, length, axis: "z", side: -1 });
      blocks.push({ x: x + sideDist, z: zCenter, width: SIDEWALK_WIDTH, length, axis: "z", side: 1 });
    }
  });

  // E-W segments between consecutive X intersections
  zGrid.forEach((z) => {
    const roadWidth = SECONDARY_ROAD_WIDTH;

    for (let i = 0; i < xGrid.length - 1; i += 1) {
      const xA = xGrid[i];
      const xB = xGrid[i + 1];

      const widthA = xA === 0 ? MAIN_AVENUE_WIDTH : SECONDARY_ROAD_WIDTH;
      const widthB = xB === 0 ? MAIN_AVENUE_WIDTH : SECONDARY_ROAD_WIDTH;

      const xStart = xA + widthA / 2 + 0.3;
      const xEnd = xB - widthB / 2 - 0.3;
      const length = xEnd - xStart;
      if (length <= 2) continue;

      const xCenter = (xStart + xEnd) / 2;
      const sideDist = roadWidth / 2 + SIDEWALK_WIDTH / 2;

      // North and South sidewalks
      blocks.push({ x: xCenter, z: z - sideDist, width: SIDEWALK_WIDTH, length, axis: "x", side: -1 });
      blocks.push({ x: xCenter, z: z + sideDist, width: SIDEWALK_WIDTH, length, axis: "x", side: 1 });
    }
  });

  // North Grand Entrance Sidewalk (from gate at Z = -134 up to North Perimeter at Z = -124)
  const entryStart = -146;
  const entryEnd = -118 - SECONDARY_ROAD_WIDTH / 2 - 0.3;
  const entryLength = entryEnd - entryStart;
  const entryZCenter = (entryStart + entryEnd) / 2;
  const entrySide = MAIN_AVENUE_WIDTH / 2 + SIDEWALK_WIDTH / 2;
  blocks.push({ x: -entrySide, z: entryZCenter, width: SIDEWALK_WIDTH, length: entryLength, axis: "z", side: -1 });
  blocks.push({ x: entrySide, z: entryZCenter, width: SIDEWALK_WIDTH, length: entryLength, axis: "z", side: 1 });

  return blocks;
}

function SidewalksAndCurbs() {
  const blocks = useMemo(() => generateSidewalkBlocks(), []);
  const sidewalkMesh = useRef<InstancedMesh>(null);
  const curbMesh = useRef<InstancedMesh>(null);

  const { sidewalkTransforms, curbTransforms } = useMemo(() => {
    const sw: InstanceTransform[] = [];
    const cb: InstanceTransform[] = [];

    blocks.forEach((b) => {
      const isX = b.axis === "x";
      sw.push({
        x: b.x,
        y: 0.08,
        z: b.z,
        sx: isX ? b.length : b.width,
        sy: 0.1,
        sz: isX ? b.width : b.length,
      });

      // Curb runs along the edge touching the asphalt
      const curbX = isX ? b.x : b.x + (b.side === -1 ? b.width / 2 - CURB_WIDTH / 2 : -b.width / 2 + CURB_WIDTH / 2);
      const curbZ = isX ? b.z + (b.side === -1 ? b.width / 2 - CURB_WIDTH / 2 : -b.width / 2 + CURB_WIDTH / 2) : b.z;

      cb.push({
        x: curbX,
        y: 0.12,
        z: curbZ,
        sx: isX ? b.length : CURB_WIDTH,
        sy: 0.14,
        sz: isX ? CURB_WIDTH : b.length,
      });
    });

    return { sidewalkTransforms: sw, curbTransforms: cb };
  }, [blocks]);

  const swGeo = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const cbGeo = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const swMat = useMemo(() => new MeshStandardMaterial({ color: "#9ca196", roughness: 0.88 }), []);
  const cbMat = useMemo(() => new MeshStandardMaterial({ color: "#cbc8bd", roughness: 0.72 }), []);

  useLayoutEffect(() => {
    populateInstances(sidewalkMesh.current, sidewalkTransforms);
    populateInstances(curbMesh.current, curbTransforms);
  }, [sidewalkTransforms, curbTransforms]);

  return (
    <>
      <instancedMesh ref={sidewalkMesh} args={[swGeo, swMat, sidewalkTransforms.length]} receiveShadow />
      <instancedMesh ref={curbMesh} args={[cbGeo, cbMat, curbTransforms.length]} castShadow receiveShadow />
    </>
  );
}

function RoadSurfaces() {
  return (
    <group>
      {SOCIETY_ROADS.map((road) => {
        const isX = road.axis === "x";
        return (
          <mesh key={road.id} position={[road.x, 0.03, road.z]} receiveShadow>
            <boxGeometry args={[isX ? road.length : road.width, 0.06, isX ? road.width : road.length]} />
            <meshStandardMaterial color="#2d3336" roughness={0.92} />
          </mesh>
        );
      })}
    </group>
  );
}

function RoadMarkingsAndCrosswalks() {
  const lineMesh = useRef<InstancedMesh>(null);
  const crosswalkMesh = useRef<InstancedMesh>(null);

  const { lineTransforms, crossTransforms } = useMemo(() => {
    const lines: InstanceTransform[] = [];
    const crosses: InstanceTransform[] = [];

    // Lane dividing dashed lines along roads
    SOCIETY_ROADS.forEach((road) => {
      if (road.width < 12) return;
      const isX = road.axis === "x";
      const totalLen = road.length;
      const count = Math.floor((totalLen - 24) / 6.5);
      for (let i = 0; i < count; i += 1) {
        const offset = -totalLen / 2 + 16 + i * 6.5;
        const posX = isX ? road.x + offset : road.x;
        const posZ = isX ? road.z : road.z + offset;
        // Skip dashes inside roundabout center
        if (Math.hypot(posX, posZ) < 14) continue;

        lines.push({
          x: posX,
          y: 0.064,
          z: posZ,
          sx: isX ? 3.4 : 0.18,
          sy: 0.012,
          sz: isX ? 0.18 : 3.4,
        });
      }
    });

    // Crosswalks at major junctions
    SOCIETY_INTERSECTIONS.filter((int) => int.crosswalks).forEach((int) => {
      // Pedestrian crosswalk crossing E-W road (West and East approaches)
      [-1, 1].forEach((dir) => {
        const crossX = int.x + dir * (int.widthZ / 2 + 2.4);
        const crossZ = int.z;
        const roadW = int.widthX;
        const stripes = Math.floor((roadW - 2.5) / 1.1);
        for (let s = 0; s < stripes; s += 1) {
          const stripeZ = crossZ - roadW / 2 + 1.4 + s * 1.1;
          crosses.push({
            x: crossX,
            y: 0.065,
            z: stripeZ,
            sx: 2.2,
            sy: 0.012,
            sz: 0.48,
          });
        }
      });

      // Pedestrian crosswalk crossing N-S road (North and South approaches)
      [-1, 1].forEach((dir) => {
        const crossX = int.x;
        const crossZ = int.z + dir * (int.widthX / 2 + 2.4);
        const roadW = int.widthZ;
        const stripes = Math.floor((roadW - 2.5) / 1.1);
        for (let s = 0; s < stripes; s += 1) {
          const stripeX = crossX - roadW / 2 + 1.4 + s * 1.1;
          crosses.push({
            x: stripeX,
            y: 0.065,
            z: crossZ,
            sx: 0.48,
            sy: 0.012,
            sz: 2.2,
          });
        }
      });
    });

    return { lineTransforms: lines, crossTransforms: crosses };
  }, []);

  const lineGeo = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const lineMat = useMemo(() => new MeshStandardMaterial({ color: "#dedbc8", roughness: 0.8 }), []);
  const crossMat = useMemo(() => new MeshStandardMaterial({ color: "#f0ede1", roughness: 0.76 }), []);

  useLayoutEffect(() => {
    populateInstances(lineMesh.current, lineTransforms);
    populateInstances(crosswalkMesh.current, crossTransforms);
  }, [lineTransforms, crossTransforms]);

  return (
    <>
      <instancedMesh ref={lineMesh} args={[lineGeo, lineMat, lineTransforms.length]} />
      <instancedMesh ref={crosswalkMesh} args={[lineGeo, crossMat, crossTransforms.length]} />
    </>
  );
}

// -------------------------------------------------------------
// CENTRAL ROUNDABOUT & MONUMENT
// -------------------------------------------------------------
function Roundabout() {
  const { x, z, radius } = SOCIETY_ROUNDABOUT;
  return (
    <group position={[x, 0, z]}>
      {/* Outer asphalt transition ring */}
      <mesh position={[0, 0.035, 0]} receiveShadow>
        <cylinderGeometry args={[radius + 4.2, radius + 4.2, 0.065, 36]} />
        <meshStandardMaterial color="#2d3336" roughness={0.92} />
      </mesh>
      {/* Raised stone curb ring */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, 0.18, 36]} />
        <meshStandardMaterial color="#cfcbc0" roughness={0.7} />
      </mesh>
      {/* Central green landscaped lawn */}
      <mesh position={[0, 0.18, 0]} receiveShadow>
        <cylinderGeometry args={[radius - 0.4, radius - 0.4, 0.16, 32]} />
        <meshStandardMaterial color="#55754d" roughness={0.96} />
      </mesh>
      {/* Central modern architectural fountain & obelisk */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[2.2, 2.8, 0.8, 8]} />
        <meshStandardMaterial color="#465152" roughness={0.65} />
      </mesh>
      <mesh position={[0, 2.6, 0]} castShadow>
        <boxGeometry args={[0.9, 4.2, 0.9]} />
        <meshStandardMaterial color="#d5f05d" metalness={0.4} roughness={0.3} />
      </mesh>
      <mesh position={[0, 4.9, 0]} castShadow>
        <sphereGeometry args={[0.65, 12, 8]} />
        <meshStandardMaterial color="#f0ede1" emissive="#d5f05d" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------
// PROCEDURAL ARCHITECTURAL BUILDINGS
// -------------------------------------------------------------
function TowerBuilding({ building }: { building: SocietyBuilding }) {
  const { width, depth, height, floors, color, accentColor, roofType } = building;
  const floorHeight = (height - 5.5) / Math.max(4, floors);
  const beaconRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (beaconRef.current) {
      const blink = Math.sin(clock.getElapsedTime() * 5.2) > 0.4 ? 1.8 : 0.15;
      const beaconMesh = beaconRef.current.children[0] as Mesh | undefined;
      const mat = beaconMesh?.material as MeshStandardMaterial | undefined;
      if (mat) mat.emissiveIntensity = blink;
    }
  });

  return (
    <RigidBody type="fixed" colliders={false} position={[building.x, 0, building.z]}>
      <CuboidCollider args={[width / 2, height / 2, depth / 2]} position={[0, height / 2, 0]} />

      {/* Main Core Tower Mass */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.78} />
      </mesh>

      {/* Horizontal Floor Spandrel Slabs dividing floors */}
      {Array.from({ length: floors + 1 }, (_, i) => {
        const y = 4.8 + i * floorHeight;
        if (y > height) return null;
        return (
          <mesh key={`spandrel-${i}`} position={[0, y, 0]} castShadow>
            <boxGeometry args={[width + 0.35, 0.22, depth + 0.35]} />
            <meshStandardMaterial color="#30383a" roughness={0.65} />
          </mesh>
        );
      })}

      {/* Window Bays on Front & Rear Facades */}
      {Array.from({ length: floors }, (_, i) => {
        const y = 4.8 + i * floorHeight + floorHeight / 2;
        if (y >= height - 0.5) return null;
        const isWarmLit = (i * 3 + Math.round(building.x)) % 3 === 0;
        return (
          <group key={`win-${i}`}>
            {/* Front facade windows */}
            <mesh position={[0, y, depth / 2 + 0.08]}>
              <boxGeometry args={[width * 0.76, floorHeight * 0.62, 0.1]} />
              <meshStandardMaterial
                color={isWarmLit ? "#ffe8a3" : "#2d4554"}
                emissive={isWarmLit ? "#ffb300" : "#1a2c38"}
                emissiveIntensity={isWarmLit ? 0.75 : 0.25}
                roughness={0.2}
                metalness={0.5}
              />
            </mesh>
            {/* Rear facade windows */}
            <mesh position={[0, y, -depth / 2 - 0.08]}>
              <boxGeometry args={[width * 0.76, floorHeight * 0.62, 0.1]} />
              <meshStandardMaterial
                color={!isWarmLit ? "#ffe8a3" : "#2d4554"}
                emissive={!isWarmLit ? "#ffb300" : "#1a2c38"}
                emissiveIntensity={!isWarmLit ? 0.75 : 0.25}
                roughness={0.2}
                metalness={0.5}
              />
            </mesh>
          </group>
        );
      })}

      {/* Cantilevered Balconies on Alternating Floors */}
      {Array.from({ length: Math.floor(floors / 2) }, (_, i) => {
        const floorIdx = i * 2 + 1;
        const y = 4.8 + floorIdx * floorHeight;
        if (y >= height - 2) return null;
        return (
          <group key={`balcony-${i}`} position={[0, y, depth / 2 + 0.75]}>
            <mesh castShadow>
              <boxGeometry args={[width * 0.52, 0.22, 1.5]} />
              <meshStandardMaterial color="#404b4c" roughness={0.65} />
            </mesh>
            <mesh position={[0, 0.5, 0.72]}>
              <boxGeometry args={[width * 0.52, 0.82, 0.08]} />
              <meshStandardMaterial color="#22333b" roughness={0.15} metalness={0.6} transparent opacity={0.88} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * (width * 0.26 - 0.04), 0.5, 0]}>
                <boxGeometry args={[0.08, 0.82, 1.44]} />
                <meshStandardMaterial color="#22333b" roughness={0.15} metalness={0.6} transparent opacity={0.88} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Ground Floor Entrance Lobby Podium (Taller, Glass Curtain Wall) */}
      <mesh position={[0, 2.2, 0]} castShadow>
        <boxGeometry args={[width + 0.6, 4.4, depth + 0.6]} />
        <meshStandardMaterial color="#263133" roughness={0.4} metalness={0.3} />
      </mesh>

      {/* Main Entrance Portico / Canopy facing the street */}
      <mesh position={[0, 3.8, depth / 2 + 1.8]} castShadow>
        <boxGeometry args={[width * 0.48, 0.38, 3.8]} />
        <meshStandardMaterial color="#1a2021" roughness={0.6} metalness={0.5} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width * 0.21), 1.9, depth / 2 + 3.4]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 3.8, 8]} />
          <meshStandardMaterial color="#889291" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}

      {/* Glazed Double Revolving Doors & Warm Entrance Interior */}
      <mesh position={[0, 1.8, depth / 2 + 0.35]}>
        <boxGeometry args={[width * 0.42, 3.2, 0.2]} />
        <meshStandardMaterial color="#f0d59e" roughness={0.15} metalness={0.4} emissive="#ffc107" emissiveIntensity={0.5} />
      </mesh>

      {/* Flanking Entrance Planters with Boxwood Shrubs */}
      {[-1, 1].map((s) => (
        <group key={`planter-${s}`} position={[s * (width * 0.29), 0.35, depth / 2 + 1.4]}>
          <mesh castShadow>
            <boxGeometry args={[1.2, 0.7, 1.2]} />
            <meshStandardMaterial color="#495556" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.65, 0]} castShadow>
            <sphereGeometry args={[0.65, 8, 8]} />
            <meshStandardMaterial color="#355e3b" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Vertical Accent Color Fin running up the tower */}
      <mesh position={[width / 2 + 0.16, height / 2 + 1.5, 0]} castShadow>
        <boxGeometry args={[0.3, height - 4, 2.8]} />
        <meshStandardMaterial color={accentColor} roughness={0.45} metalness={0.25} />
      </mesh>
      <mesh position={[-width / 2 - 0.16, height / 2 + 1.5, 0]} castShadow>
        <boxGeometry args={[0.3, height - 4, 2.8]} />
        <meshStandardMaterial color={accentColor} roughness={0.45} metalness={0.25} />
      </mesh>

      {/* Roof Crown / Penthouse Bulkhead & Communications Mast */}
      <group position={[0, height, 0]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[width + 0.5, 0.9, depth + 0.5]} />
          <meshStandardMaterial color="#30393b" roughness={0.7} />
        </mesh>
        <mesh position={[0, 2.2, 0]} castShadow>
          <boxGeometry args={[width * 0.55, 3.6, depth * 0.55]} />
          <meshStandardMaterial color="#2d3536" roughness={0.6} />
        </mesh>
        <mesh position={[-width * 0.18, 4.4, 0]} castShadow>
          <boxGeometry args={[2.4, 1.4, 3.2]} />
          <meshStandardMaterial color="#475152" roughness={0.5} metalness={0.4} />
        </mesh>
        <group position={[width * 0.18, 4.0, 0]}>
          <mesh position={[0, 2.2, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.16, 4.4, 6]} />
            <meshStandardMaterial color="#8b9596" metalness={0.8} roughness={0.25} />
          </mesh>
          <group ref={beaconRef} position={[0, 4.4, 0]}>
            <mesh>
              <sphereGeometry args={[0.22, 8, 8]} />
              <meshStandardMaterial color="#ff2222" emissive="#ff2222" emissiveIntensity={1.8} roughness={0.1} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Tower Sign */}
      <SocietySign
        title={building.name}
        subtitle="RESIDENTIAL TOWER"
        width={Math.min(18, width * 0.6)}
        position={[0, 5.2, depth / 2 + 0.36]}
        rotationY={0}
        accentColor={accentColor}
      />
    </RigidBody>
  );
}

function VillaBuilding({ building }: { building: SocietyBuilding }) {
  const { width, depth, height, color, accentColor } = building;
  return (
    <RigidBody type="fixed" colliders={false} position={[building.x, 0, building.z]}>
      <CuboidCollider args={[width / 2, height / 2, depth / 2]} position={[0, height / 2, 0]} />

      {/* Main Ground & First Floor Box */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>

      {/* Warm Timber Slat Architectural Accent Panels */}
      <mesh position={[0, height / 2, depth / 2 + 0.08]} castShadow>
        <boxGeometry args={[width * 0.48, height * 0.68, 0.12]} />
        <meshStandardMaterial color={accentColor} roughness={0.7} />
      </mesh>

      {/* Ground Floor Entrance Door & Glass Inset */}
      <mesh position={[-width * 0.25, 1.4, depth / 2 + 0.08]}>
        <boxGeometry args={[2.2, 2.6, 0.1]} />
        <meshStandardMaterial color="#1f2829" roughness={0.4} />
      </mesh>
      <mesh position={[-width * 0.25, 0.1, depth / 2 + 0.8]}>
        <boxGeometry args={[2.8, 0.2, 1.4]} />
        <meshStandardMaterial color="#555d5e" roughness={0.8} />
      </mesh>

      {/* Modern Cantilevered Second-Floor Balcony with Smoked Glass */}
      <group position={[width * 0.22, height * 0.52, depth / 2 + 1.2]}>
        <mesh castShadow>
          <boxGeometry args={[width * 0.46, 0.24, 2.4]} />
          <meshStandardMaterial color="#3a3731" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.5, 1.15]}>
          <boxGeometry args={[width * 0.46, 0.8, 0.08]} />
          <meshStandardMaterial color="#242b2d" roughness={0.2} metalness={0.5} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 1.1, -1.15]}>
          <boxGeometry args={[width * 0.42, 2.0, 0.1]} />
          <meshStandardMaterial color="#2d4554" roughness={0.15} metalness={0.4} transparent opacity={0.85} />
        </mesh>
      </group>

      {/* Modern Zinc / Cedar Sloped Roof Cap */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * (width / 4), height + 0.85, 0]}
          rotation={[0, 0, s * -0.28]}
          castShadow
        >
          <boxGeometry args={[width / 2 + 1.4, 0.42, depth + 1.6]} />
          <meshStandardMaterial color="#3e3831" roughness={0.82} />
        </mesh>
      ))}

      {/* Modern Architectural Carport / Pergola Louvers */}
      <group position={[-width * 0.28, 2.9, depth / 2 + 1.8]}>
        <mesh castShadow>
          <boxGeometry args={[width * 0.38, 0.2, 3.4]} />
          <meshStandardMaterial color="#2b3133" roughness={0.7} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (width * 0.17), -1.45, 1.5]} castShadow>
            <boxGeometry args={[0.16, 2.9, 0.16]} />
            <meshStandardMaterial color="#222728" metalness={0.7} />
          </mesh>
        ))}
      </group>

      {/* Front Pathway Pavers Flanked by Green Boxwood Hedges */}
      {[-1, 1].map((s) => (
        <mesh key={`hedge-${s}`} position={[s * (width * 0.44), 0.4, depth / 2 + 1.5]} castShadow>
          <boxGeometry args={[0.9, 0.75, 2.6]} />
          <meshStandardMaterial color="#355e3b" roughness={0.92} />
        </mesh>
      ))}
    </RigidBody>
  );
}

function ShopBuilding({ building }: { building: SocietyBuilding }) {
  const { width, depth, height, color, accentColor } = building;
  const isGrocery = building.id.includes("fresh");
  const isCafe = building.id.includes("cafe");
  const isPharmacy = building.id.includes("pharmacy");

  const signTitle = isGrocery ? "FRESH MARKET" : isCafe ? "CEDAR CAFE" : "CARE PHARMACY";
  const signSubtitle = isGrocery ? "ORGANIC & DAILY ESSENTIALS" : isCafe ? "ARTISAN COFFEE & BAKERY" : "HEALTH & PRESCRIPTIONS";

  return (
    <RigidBody type="fixed" colliders={false} position={[building.x, 0, building.z]}>
      <CuboidCollider args={[width / 2, height / 2, depth / 2]} position={[0, height / 2, 0]} />

      {/* Main Shop Building Body */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>

      {/* Commercial Glass Display Windows facing street North (Z = 35 - 8 = 27) */}
      <mesh position={[0, 2.1, -depth / 2 - 0.08]}>
        <boxGeometry args={[width - 2.4, 3.4, 0.16]} />
        <meshStandardMaterial color="#28393c" roughness={0.2} metalness={0.5} emissive="#1f3236" emissiveIntensity={0.35} />
      </mesh>

      {/* Protruding Colored Fabric Awning over shopfront */}
      <mesh position={[0, 3.8, -depth / 2 - 1.4]} rotation={[0.22, 0, 0]} castShadow>
        <boxGeometry args={[width - 0.8, 0.16, 2.8]} />
        <meshStandardMaterial color={accentColor} roughness={0.85} />
      </mesh>

      {/* Prominent Shop Fascia Signboard */}
      <SocietySign
        title={signTitle}
        subtitle={signSubtitle}
        width={width - 1.2}
        position={[0, 4.9, -depth / 2 - 0.14]}
        rotationY={Math.PI}
        accentColor={accentColor}
      />

      {/* Parapet Roof Border */}
      <mesh position={[0, height + 0.22, 0]} castShadow>
        <boxGeometry args={[width + 0.4, 0.45, depth + 0.4]} />
        <meshStandardMaterial color="#3c4345" roughness={0.7} />
      </mesh>

      {/* --- SPECIFIC PROMENADE STOREFRONT DETAILS --- */}
      {/* 1. Cedar Fresh Market Produce Display Crates */}
      {isGrocery && (
        <group position={[0, 0.4, -depth / 2 - 1.6]}>
          {[-2.8, 0, 2.8].map((ox, idx) => (
            <group key={idx} position={[ox, 0, 0]}>
              <mesh castShadow>
                <boxGeometry args={[1.8, 0.7, 1.1]} />
                <meshStandardMaterial color="#8d6e49" roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.4, 0]}>
                <boxGeometry args={[1.65, 0.2, 0.95]} />
                <meshStandardMaterial
                  color={idx === 0 ? "#e65100" : idx === 1 ? "#2e7d32" : "#c62828"}
                  roughness={0.8}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* 2. Cedar Cafe Outdoor Bistro Terrace (Tables, Chairs, Coffee Mugs) */}
      {isCafe && (
        <group position={[0, 0, -depth / 2 - 2.2]}>
          {[-3.2, 0, 3.2].map((tx, idx) => (
            <group key={idx} position={[tx, 0, 0]}>
              <mesh position={[0, 0.38, 0]} castShadow>
                <cylinderGeometry args={[0.06, 0.06, 0.76, 8]} />
                <meshStandardMaterial color="#1a2021" metalness={0.7} />
              </mesh>
              <mesh position={[0, 0.76, 0]} castShadow>
                <cylinderGeometry args={[0.72, 0.72, 0.05, 16]} />
                <meshStandardMaterial color="#333b3d" roughness={0.4} />
              </mesh>
              <mesh position={[0.18, 0.84, 0.12]}>
                <cylinderGeometry args={[0.07, 0.06, 0.14, 8]} />
                <meshStandardMaterial color="#f0ede1" roughness={0.3} />
              </mesh>
              {[-0.8, 0.8].map((cz, cIdx) => (
                <group key={cIdx} position={[0, 0, cz]}>
                  <mesh position={[0, 0.22, 0]} castShadow>
                    <boxGeometry args={[0.42, 0.44, 0.42]} />
                    <meshStandardMaterial color="#252b2c" roughness={0.6} metalness={0.4} />
                  </mesh>
                  <mesh position={[0, 0.58, cz > 0 ? 0.18 : -0.18]} castShadow>
                    <boxGeometry args={[0.42, 0.4, 0.06]} />
                    <meshStandardMaterial color="#252b2c" roughness={0.6} metalness={0.4} />
                  </mesh>
                </group>
              ))}
            </group>
          ))}
        </group>
      )}

      {/* 3. Care Pharmacy Glowing Green Cross Wall Sign */}
      {isPharmacy && (
        <group position={[width / 2 + 0.12, 3.2, -depth / 4]}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[0.4, 1.2, 0.12]} />
            <meshStandardMaterial color="#2ecc71" emissive="#2ecc71" emissiveIntensity={1.8} />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[1.2, 0.4, 0.12]} />
            <meshStandardMaterial color="#2ecc71" emissive="#2ecc71" emissiveIntensity={1.8} />
          </mesh>
        </group>
      )}
    </RigidBody>
  );
}

function ClubhouseBuilding({ building }: { building: SocietyBuilding }) {
  const { width, depth, height, color } = building;
  return (
    <RigidBody type="fixed" colliders={false} position={[building.x, 0, building.z]}>
      <CuboidCollider args={[width / 2, height / 2, depth / 2]} position={[0, height / 2, 0]} />

      {/* Main Clubhouse Structure */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>

      {/* Grand Double-Height Glass Central Rotunda */}
      <mesh position={[0, height / 2, depth / 2 + 0.2]}>
        <boxGeometry args={[width * 0.6, height - 1.5, 0.4]} />
        <meshStandardMaterial color="#35494d" roughness={0.15} metalness={0.5} emissive="#1a2d30" emissiveIntensity={0.4} />
      </mesh>

      {/* Classical Modern Colonnade Pillars */}
      {[-1, -0.33, 0.33, 1].map((p, idx) => (
        <mesh key={idx} position={[p * (width * 0.38), height / 2, depth / 2 + 2.2]} castShadow>
          <cylinderGeometry args={[0.35, 0.42, height, 10]} />
          <meshStandardMaterial color="#948c77" roughness={0.65} />
        </mesh>
      ))}

      {/* Grand Portico Overhang */}
      <mesh position={[0, height + 0.3, depth / 2 + 1.2]} castShadow>
        <boxGeometry args={[width + 1.2, 0.6, 4.4]} />
        <meshStandardMaterial color="#4a4234" roughness={0.7} />
      </mesh>

      {/* Sign */}
      <SocietySign
        title="COMMUNITY CLUBHOUSE"
        subtitle="FITNESS · LOUNGE · RECREATION"
        width={width * 0.65}
        position={[0, height - 1.2, depth / 2 + 0.45]}
        rotationY={0}
      />
    </RigidBody>
  );
}

function SecurityGatehouse({ building }: { building: SocietyBuilding }) {
  const { width, depth, height, color } = building;
  return (
    <RigidBody type="fixed" colliders={false} position={[building.x, 0, building.z]}>
      <CuboidCollider args={[width / 2, height / 2, depth / 2]} position={[0, height / 2, 0]} />
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {/* 360-degree security glass windows */}
      <mesh position={[0, height * 0.58, 0]}>
        <boxGeometry args={[width + 0.1, 1.4, depth + 0.1]} />
        <meshStandardMaterial color="#2d3d40" roughness={0.2} metalness={0.4} />
      </mesh>
      {/* Roof visor */}
      <mesh position={[0, height + 0.15, 0]} castShadow>
        <boxGeometry args={[width + 0.8, 0.3, depth + 0.8]} />
        <meshStandardMaterial color="#424c47" roughness={0.6} />
      </mesh>
    </RigidBody>
  );
}

// -------------------------------------------------------------
// NORTH GRAND ENTRANCE PORTAL & GATES (Z = -134)
// -------------------------------------------------------------
function EntrancePortal() {
  return (
    <group position={[0, 0, -134]}>
      {/* Massive Gateway Pylons */}
      <mesh position={[-10, 4.4, 0]} castShadow>
        <boxGeometry args={[2.2, 8.8, 2.6]} />
        <meshStandardMaterial color="#4e5957" roughness={0.7} />
      </mesh>
      <mesh position={[10, 4.4, 0]} castShadow>
        <boxGeometry args={[2.2, 8.8, 2.6]} />
        <meshStandardMaterial color="#4e5957" roughness={0.7} />
      </mesh>

      {/* Overhead Gateway Truss Beam */}
      <mesh position={[0, 8.4, 0]} castShadow>
        <boxGeometry args={[22.4, 1.2, 3.2]} />
        <meshStandardMaterial color="#36403e" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* North-facing illuminated Welcome Gantry Sign (visible when entering from North) */}
      <SocietySign
        title="CEDAR GROVE"
        subtitle="RESIDENTIAL SOCIETY · MAIN ENTRANCE"
        width={16}
        position={[0, 8.4, -1.65]}
        rotationY={Math.PI}
        accentColor="#d5f05d"
      />
      {/* South-facing Sign (visible when leaving towards North) */}
      <SocietySign
        title="CEDAR GROVE"
        subtitle="HAVE A SAFE DRIVE"
        width={16}
        position={[0, 8.4, 1.65]}
        rotationY={0}
        accentColor="#d5f05d"
      />

      {/* Security Barrier Arms (Red & White Striped) */}
      <mesh position={[-5, 1.1, -0.4]} rotation={[0, 0, 0.06]} castShadow>
        <boxGeometry args={[7.2, 0.22, 0.12]} />
        <meshStandardMaterial color="#e85d43" roughness={0.5} />
      </mesh>
      <mesh position={[5, 1.1, 0.4]} rotation={[0, 0, -0.06]} castShadow>
        <boxGeometry args={[7.2, 0.22, 0.12]} />
        <meshStandardMaterial color="#e85d43" roughness={0.5} />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------
// CENTRAL PARK (Plot NE3: Center X = 31.5, Z = -29)
// -------------------------------------------------------------
function CentralPark() {
  const { x, z, width, depth } = SOCIETY_PARK;
  return (
    <group position={[x, 0, z]}>
      {/* Lush Green Park Lawn */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[width, 0.06, depth]} />
        <meshStandardMaterial color="#3d6339" roughness={0.96} />
      </mesh>

      {/* Crushed Stone Paved Walking Paths */}
      <mesh position={[0, 0.055, 0]}>
        <boxGeometry args={[width - 6, 0.015, 3.8]} />
        <meshStandardMaterial color="#c2baa6" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.055, 0]}>
        <boxGeometry args={[3.8, 0.015, depth - 6]} />
        <meshStandardMaterial color="#c2baa6" roughness={0.9} />
      </mesh>

      {/* Multi-Tiered Circular Architectural Stone Fountain */}
      <group position={[0, 0, 0]}>
        {/* Tier 1: Outer Stone Basin Ring */}
        <mesh position={[0, 0.28, 0]} castShadow>
          <cylinderGeometry args={[4.6, 5.0, 0.55, 28]} />
          <meshStandardMaterial color="#d8d5c8" roughness={0.7} />
        </mesh>
        {/* Shimmering Aqua Water Basin */}
        <mesh position={[0, 0.48, 0]}>
          <cylinderGeometry args={[4.2, 4.2, 0.15, 28]} />
          <meshStandardMaterial color="#269db8" roughness={0.15} metalness={0.3} />
        </mesh>
        {/* Tier 2: Raised Inner Basin */}
        <mesh position={[0, 0.85, 0]} castShadow>
          <cylinderGeometry args={[2.2, 2.5, 0.65, 20]} />
          <meshStandardMaterial color="#cfcbc0" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.12, 0]}>
          <cylinderGeometry args={[1.9, 1.9, 0.14, 20]} />
          <meshStandardMaterial color="#269db8" roughness={0.15} metalness={0.3} />
        </mesh>
        {/* Central Spire with Foam Plume */}
        <mesh position={[0, 1.55, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.45, 0.85, 12]} />
          <meshStandardMaterial color="#cfcbc0" roughness={0.6} />
        </mesh>
        <mesh position={[0, 2.05, 0]}>
          <sphereGeometry args={[0.38, 12, 8]} />
          <meshStandardMaterial color="#e0f7fa" emissive="#b2ebf2" emissiveIntensity={0.8} roughness={0.1} />
        </mesh>
      </group>

      {/* Colorful Manicured Flowerbeds */}
      {[
        { fx: -10, fz: -10, color: "#f59e0b" },
        { fx: 10, fz: -10, color: "#a855f7" },
        { fx: -10, fz: 10, color: "#ec4899" },
        { fx: 10, fz: 10, color: "#f8fafc" },
      ].map(({ fx, fz, color }, idx) => (
        <group key={idx} position={[fx, 0.08, fz]}>
          <mesh castShadow>
            <cylinderGeometry args={[2.6, 2.8, 0.22, 16]} />
            <meshStandardMaterial color="#cfcbc0" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[2.4, 2.4, 0.1, 16]} />
            <meshStandardMaterial color="#3e2723" roughness={0.95} />
          </mesh>
          {[-1.2, 0, 1.2].flatMap((cx) =>
            [-1.2, 0, 1.2].map((cz) => {
              if (Math.hypot(cx, cz) > 2.0) return null;
              return (
                <mesh key={`${cx}-${cz}`} position={[cx, 0.22, cz]}>
                  <sphereGeometry args={[0.26, 6, 6]} />
                  <meshStandardMaterial color={color} roughness={0.9} />
                </mesh>
              );
            })
          )}
        </group>
      ))}

      {/* Classic Timber Park Benches flanking fountain */}
      {[
        { bx: -8, bz: 0, byaw: Math.PI / 2 },
        { bx: 8, bz: 0, byaw: -Math.PI / 2 },
        { bx: 0, bz: -8, byaw: 0 },
        { bx: 0, bz: 8, byaw: Math.PI },
      ].map(({ bx, bz, byaw }, bIdx) => (
        <group key={`bench-${bIdx}`} position={[bx, 0, bz]} rotation={[0, byaw, 0]}>
          {[-0.9, 0.9].map((lx) => (
            <mesh key={lx} position={[lx, 0.25, 0]} castShadow>
              <boxGeometry args={[0.08, 0.5, 0.44]} />
              <meshStandardMaterial color="#1a2e22" metalness={0.7} />
            </mesh>
          ))}
          <mesh position={[0, 0.46, 0]} castShadow>
            <boxGeometry args={[2.0, 0.08, 0.48]} />
            <meshStandardMaterial color="#8d5b32" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.74, -0.22]} rotation={[-0.15, 0, 0]} castShadow>
            <boxGeometry args={[2.0, 0.42, 0.08]} />
            <meshStandardMaterial color="#8d5b32" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// -------------------------------------------------------------
// DEDICATED RECREATION ZONE: TENNIS COURT (Plot NE4: X = 90, Z = -29)
// -------------------------------------------------------------
function TennisCourt() {
  const court = SOCIETY_TENNIS_COURT;
  const { courtWidth, courtDepth, fenceWidth, fenceDepth, fenceHeight, netLength } = court;

  return (
    <group position={[court.x, 0, court.z]}>
      {/* Court Perimeter Green Buffer Slab */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[fenceWidth, 0.06, fenceDepth]} />
        <meshStandardMaterial color="#2e6b4e" roughness={0.9} />
      </mesh>

      {/* Inner Playing Court Blue Surface */}
      <mesh position={[0, 0.055, 0]} receiveShadow>
        <boxGeometry args={[courtWidth, 0.02, courtDepth]} />
        <meshStandardMaterial color="#255fb2" roughness={0.88} />
      </mesh>

      {/* Regulation White Boundary & Service Lines */}
      {/* Outer Doubles Baseline & Sidelines */}
      <mesh position={[0, 0.068, 0]}>
        <boxGeometry args={[courtWidth - 2, 0.005, courtDepth - 2]} />
        <meshBasicMaterial color="#f0ede1" wireframe />
      </mesh>
      {/* Inner Singles Sidelines */}
      <mesh position={[0, 0.069, -(courtDepth - 2) / 2 + 1.2]}>
        <boxGeometry args={[courtWidth - 2, 0.005, 0.08]} />
        <meshBasicMaterial color="#f0ede1" />
      </mesh>
      <mesh position={[0, 0.069, (courtDepth - 2) / 2 - 1.2]}>
        <boxGeometry args={[courtWidth - 2, 0.005, 0.08]} />
        <meshBasicMaterial color="#f0ede1" />
      </mesh>
      {/* Service Lines (6.4m from net at center X=0) */}
      <mesh position={[-6.4, 0.069, 0]}>
        <boxGeometry args={[0.08, 0.005, courtDepth - 4.4]} />
        <meshBasicMaterial color="#f0ede1" />
      </mesh>
      <mesh position={[6.4, 0.069, 0]}>
        <boxGeometry args={[0.08, 0.005, courtDepth - 4.4]} />
        <meshBasicMaterial color="#f0ede1" />
      </mesh>
      {/* Center Service Line */}
      <mesh position={[0, 0.069, 0]}>
        <boxGeometry args={[12.8, 0.005, 0.08]} />
        <meshBasicMaterial color="#f0ede1" />
      </mesh>

      {/* Regulation Tennis Net & Posts */}
      <group position={[0, 0, 0]}>
        {/* Net Posts */}
        {[-netLength / 2, netLength / 2].map((pz) => (
          <mesh key={pz} position={[0, 0.6, pz]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 1.2, 8]} />
            <meshStandardMaterial color="#1a2021" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
        {/* Net White Headband Tape */}
        <mesh position={[0, 1.05, 0]} castShadow>
          <boxGeometry args={[0.06, 0.08, netLength]} />
          <meshStandardMaterial color="#f8f8f2" roughness={0.4} />
        </mesh>
        {/* Net Mesh Body */}
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[0.02, 0.95, netLength]} />
          <meshStandardMaterial color="#2d3335" transparent opacity={0.65} wireframe />
        </mesh>
      </group>

      {/* Perimeter Security Chain-Link Fence */}
      <group>
        {/* North Fence (Z = -fenceDepth / 2) */}
        <mesh position={[0, fenceHeight / 2, -fenceDepth / 2]} castShadow>
          <boxGeometry args={[fenceWidth, fenceHeight, 0.08]} />
          <meshStandardMaterial color="#4a5553" wireframe transparent opacity={0.4} />
        </mesh>
        {/* South Fence (Z = fenceDepth / 2) */}
        <mesh position={[0, fenceHeight / 2, fenceDepth / 2]} castShadow>
          <boxGeometry args={[fenceWidth, fenceHeight, 0.08]} />
          <meshStandardMaterial color="#4a5553" wireframe transparent opacity={0.4} />
        </mesh>
        {/* East Fence (X = fenceWidth / 2) */}
        <mesh position={[fenceWidth / 2, fenceHeight / 2, 0]} castShadow>
          <boxGeometry args={[0.08, fenceHeight, fenceDepth]} />
          <meshStandardMaterial color="#4a5553" wireframe transparent opacity={0.4} />
        </mesh>
        {/* West Fence with Open Access Gate facing West pedestrian pathway */}
        <mesh position={[-fenceWidth / 2, fenceHeight / 2, -fenceDepth / 4 - 0.7]} castShadow>
          <boxGeometry args={[0.08, fenceHeight, fenceDepth / 2 - 1.4]} />
          <meshStandardMaterial color="#4a5553" wireframe transparent opacity={0.4} />
        </mesh>
        <mesh position={[-fenceWidth / 2, fenceHeight / 2, fenceDepth / 4 + 0.7]} castShadow>
          <boxGeometry args={[0.08, fenceHeight, fenceDepth / 2 - 1.4]} />
          <meshStandardMaterial color="#4a5553" wireframe transparent opacity={0.4} />
        </mesh>
        {/* Gate Overhead Header Bar */}
        <mesh position={[-fenceWidth / 2, fenceHeight - 0.1, 0]}>
          <boxGeometry args={[0.1, 0.14, 2.8]} />
          <meshStandardMaterial color="#22282a" metalness={0.7} />
        </mesh>

        {/* Fence Corner & Intermediate Posts */}
        {[-fenceWidth / 2, 0, fenceWidth / 2].flatMap((px) =>
          [-fenceDepth / 2, fenceDepth / 2].map((pz) => (
            <mesh key={`${px}-${pz}`} position={[px, fenceHeight / 2, pz]} castShadow>
              <cylinderGeometry args={[0.09, 0.09, fenceHeight, 8]} />
              <meshStandardMaterial color="#2d3536" metalness={0.6} />
            </mesh>
          ))
        )}
      </group>

      {/* Sideline Spectator Benches */}
      <mesh position={[0, 0.28, fenceDepth / 2 - 1.2]} castShadow>
        <boxGeometry args={[4.2, 0.45, 0.65]} />
        <meshStandardMaterial color="#35493b" roughness={0.7} />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------
// COMMUNITY POOL COMPLEX (Adjacent to Clubhouse in Block SE1)
// -------------------------------------------------------------
function SwimmingPool() {
  return (
    <group position={[44, 0, 16]}>
      {/* Tiled Pool Deck */}
      <mesh position={[0, 0.045, 0]} receiveShadow>
        <boxGeometry args={[16, 0.08, 12]} />
        <meshStandardMaterial color="#c8c4b7" roughness={0.75} />
      </mesh>
      {/* Pool Water Basin */}
      <mesh position={[0, 0.075, 0]}>
        <boxGeometry args={[13, 0.04, 9]} />
        <meshStandardMaterial color="#1e788e" roughness={0.16} metalness={0.2} />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------
// DEDICATED PARKING LOTS & PARKED VEHICLES
// -------------------------------------------------------------
function ParkingLots() {
  return (
    <group>
      {SOCIETY_PARKING.map((lot) => (
        <group key={lot.id} position={[lot.x, 0.035, lot.z]}>
          <mesh receiveShadow>
            <boxGeometry args={[lot.width, 0.05, lot.depth]} />
            <meshStandardMaterial color="#272d2e" roughness={0.92} />
          </mesh>
          {Array.from({ length: Math.floor(lot.width / 3.4) }, (_, s) => (
            <mesh key={s} position={[-lot.width / 2 + 1.7 + s * 3.4, 0.038, 0]}>
              <boxGeometry args={[0.08, 0.015, lot.depth - 1.2]} />
              <meshBasicMaterial color="#dedbc8" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

const CAR_CHASSIS_GEO = new BoxGeometry(1.72, 0.52, 4.1);
const CAR_CABIN_GEO = new BoxGeometry(1.48, 0.46, 2.3);
const CAR_WHEEL_GEO = new CylinderGeometry(0.3, 0.3, 0.24, 12);
const CAR_CABIN_MAT = new MeshStandardMaterial({ color: "#1c2324", roughness: 0.2, metalness: 0.7 });
const CAR_WHEEL_MAT = new MeshStandardMaterial({ color: "#181c1d", roughness: 0.9 });

function ParkedVehicles() {
  return (
    <group>
      {SOCIETY_PARKED_CARS.map((car) => (
        <group key={car.id} position={[car.x, 0, car.z]} rotation={[0, car.yaw, 0]}>
          {/* Main Car Body Chassis */}
          <mesh position={[0, 0.42, 0]} geometry={CAR_CHASSIS_GEO} castShadow receiveShadow>
            <meshStandardMaterial color={car.color} roughness={0.35} metalness={0.65} />
          </mesh>
          {/* Cabin & Tinted Glass */}
          <mesh position={[0, 0.88, -0.22]} geometry={CAR_CABIN_GEO} material={CAR_CABIN_MAT} castShadow />
          {/* Wheels */}
          {[-0.82, 0.82].flatMap((wx) =>
            [-1.25, 1.25].map((wz) => (
              <mesh key={`${wx}-${wz}`} position={[wx, 0.28, wz]} rotation={[0, 0, Math.PI / 2]} geometry={CAR_WHEEL_GEO} material={CAR_WHEEL_MAT} />
            ))
          )}
          {/* Headlights & Taillights */}
          <mesh position={[0, 0.42, 2.06]}>
            <boxGeometry args={[1.3, 0.14, 0.06]} />
            <meshBasicMaterial color="#fffae0" />
          </mesh>
          <mesh position={[0, 0.42, -2.06]}>
            <boxGeometry args={[1.3, 0.14, 0.06]} />
            <meshBasicMaterial color="#e53e3e" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// -------------------------------------------------------------
// STREETLIGHTS & TREES
// -------------------------------------------------------------
function Streetlights() {
  const poleMesh = useRef<InstancedMesh>(null);
  const headMesh = useRef<InstancedMesh>(null);

  const { poleTransforms, headTransforms } = useMemo(() => {
    const poles: InstanceTransform[] = [];
    const heads: InstanceTransform[] = [];

    // Streetlights along all major streets
    const xGrid = [-118, -62, 0, 62, 118];
    xGrid.forEach((x) => {
      const isMain = x === 0;
      const roadW = isMain ? MAIN_AVENUE_WIDTH : SECONDARY_ROAD_WIDTH;
      const sideDist = roadW / 2 + 1.2;

      for (let z = -105; z <= 105; z += 30) {
        if (Math.abs(z) < 16) continue; // Skip inside roundabout
        [-1, 1].forEach((dir) => {
          poles.push({ x: x + dir * sideDist, y: 3.4, z, sx: 1, sy: 6.8, sz: 1 });
          heads.push({ x: x + dir * (sideDist - 0.7), y: 6.8, z, sx: 1.1, sy: 0.18, sz: 0.38, rotationY: dir === -1 ? 0 : Math.PI });
        });
      }
    });

    return { poleTransforms: poles, headTransforms: heads };
  }, []);

  const poleGeo = useMemo(() => new CylinderGeometry(0.14, 0.22, 1, 10), []);
  const headGeo = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const poleMat = useMemo(() => new MeshStandardMaterial({ color: "#323c3a", metalness: 0.6, roughness: 0.4 }), []);
  const headMat = useMemo(() => new MeshStandardMaterial({ color: "#f5ffd1", emissive: "#d5f05d", emissiveIntensity: 1.8 }), []);

  useLayoutEffect(() => {
    populateInstances(poleMesh.current, poleTransforms);
    populateInstances(headMesh.current, headTransforms);
  }, [poleTransforms, headTransforms]);

  return (
    <>
      <instancedMesh ref={poleMesh} args={[poleGeo, poleMat, poleTransforms.length]} castShadow />
      <instancedMesh ref={headMesh} args={[headGeo, headMat, headTransforms.length]} />
    </>
  );
}

function Trees() {
  const trunks = useRef<InstancedMesh>(null);
  const crowns = useRef<InstancedMesh>(null);

  const trunkGeo = useMemo(() => new CylinderGeometry(0.28, 0.44, 4, 8), []);
  const crownGeo = useMemo(() => new SphereGeometry(1, 8, 7), []);
  const trunkMat = useMemo(() => new MeshStandardMaterial({ color: "#544637", roughness: 0.95 }), []);
  const crownMat = useMemo(() => new MeshStandardMaterial({ color: "#425f3f", roughness: 0.92 }), []);

  const { trunkTransforms, crownTransforms } = useMemo(() => {
    const tList: InstanceTransform[] = [];
    const cList: InstanceTransform[] = [];

    SOCIETY_TREES.forEach(({ x, z, scale, kind }) => {
      const s = scale || 1;
      const isPine = kind === "pine";
      tList.push({ x, y: 2 * s, z, sx: s, sy: s, sz: s });
      cList.push({
        x,
        y: 4.8 * s,
        z,
        sx: (isPine ? 2.1 : 2.7) * s,
        sy: (isPine ? 3.4 : 2.6) * s,
        sz: (isPine ? 2.1 : 2.7) * s,
      });
    });

    return { trunkTransforms: tList, crownTransforms: cList };
  }, []);

  useLayoutEffect(() => {
    populateInstances(trunks.current, trunkTransforms);
    populateInstances(crowns.current, crownTransforms);
  }, [trunkTransforms, crownTransforms]);

  return (
    <>
      <instancedMesh ref={trunks} args={[trunkGeo, trunkMat, trunkTransforms.length]} castShadow />
      <instancedMesh ref={crowns} args={[crownGeo, crownMat, crownTransforms.length]} castShadow receiveShadow />
    </>
  );
}

// -------------------------------------------------------------
// BOUNDARY WALLS
// -------------------------------------------------------------
function SocietyBoundaries() {
  return (
    <group>
      {SOCIETY_WALLS.map((wall) => (
        <RigidBody key={wall.id} type="fixed" colliders={false} position={[wall.x, wall.height / 2, wall.z]}>
          <CuboidCollider args={[wall.width / 2, wall.height / 2, wall.depth / 2]} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={[wall.width, wall.height, wall.depth]} />
            <meshStandardMaterial color="#888776" roughness={0.88} />
          </mesh>
          {/* Wall decorative capstone */}
          <mesh position={[0, wall.height / 2 + 0.12, 0]}>
            <boxGeometry args={[wall.width + 0.3, 0.24, wall.depth + 0.3]} />
            <meshStandardMaterial color="#a9a897" roughness={0.7} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}

// -------------------------------------------------------------
// ANIMATED NPC PEDESTRIANS
// -------------------------------------------------------------
const NPC_TORSO_GEO = new BoxGeometry(0.42, 0.54, 0.24);
const NPC_HEAD_GEO = new BoxGeometry(0.26, 0.28, 0.26);
const NPC_HAIR_GEO = new BoxGeometry(0.28, 0.14, 0.28);
const NPC_LEG_GEO = new BoxGeometry(0.16, 0.72, 0.18);
const NPC_ARM_GEO = new BoxGeometry(0.11, 0.5, 0.12);
const NPC_SKIN_MAT = new MeshStandardMaterial({ color: "#d4a373", roughness: 0.65 });

// -------------------------------------------------------------
// POLICE PATROL CRUISER (Foundational Law Enforcement Presence)
// -------------------------------------------------------------
function PolicePatrolVehicle({
  playerSimulationRef,
  input,
}: {
  playerSimulationRef?: MutableRefObject<{ x: number; z: number; speed: number; yaw: number; y?: number }>;
  input?: { read: () => { horn?: boolean } };
}) {
  const groupRef = useRef<Group>(null);
  const blueStrobeRef = useRef<MeshStandardMaterial>(null);
  const redStrobeRef = useRef<MeshStandardMaterial>(null);
  const sirenCooldown = useRef(0);

  const route = POLICE_PATROL_ROUTE;
  const { totalLength, segmentLengths } = useMemo(() => {
    const segs: number[] = [];
    let sum = 0;
    for (let i = 0; i < route.length; i += 1) {
      const nextIdx = (i + 1) % route.length;
      const dx = route[nextIdx].x - route[i].x;
      const dz = route[nextIdx].z - route[i].z;
      const dist = Math.hypot(dx, dz);
      segs.push(dist);
      sum += dist;
    }
    return { totalLength: Math.max(1, sum), segmentLengths: segs };
  }, [route]);

  const progressRef = useRef(0);
  const speed = 7.6; // ~27 km/h patrol cruising speed

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.1);
    progressRef.current = (progressRef.current + speed * dt) % totalLength;

    let accum = 0;
    let segIdx = 0;
    let segOffset = progressRef.current;
    for (let i = 0; i < segmentLengths.length; i += 1) {
      if (accum + segmentLengths[i] >= progressRef.current) {
        segIdx = i;
        segOffset = progressRef.current - accum;
        break;
      }
      accum += segmentLengths[i];
    }

    const pA = route[segIdx];
    const pB = route[(segIdx + 1) % route.length];
    const segLen = segmentLengths[segIdx] || 1;
    const t = Math.min(1, Math.max(0, segOffset / segLen));

    const curX = pA.x + (pB.x - pA.x) * t;
    const curZ = pA.z + (pB.z - pA.z) * t;
    const headingYaw = Math.atan2(pB.x - pA.x, pB.z - pA.z);

    groupRef.current.position.set(curX, 0, curZ);
    groupRef.current.rotation.y = headingYaw;

    // Check interaction with player vehicle (Excessive speeding or honking nearby)
    const player = playerSimulationRef?.current;
    let isAlert = false;
    if (player) {
      const dist = Math.hypot(curX - player.x, curZ - player.z);
      const playerSpeed = Math.abs(player.speed);
      const isHonking = Boolean(input?.read().horn);
      if (dist < 26 && (playerSpeed > 26 || isHonking)) {
        isAlert = true;
        sirenCooldown.current -= dt;
        if (sirenCooldown.current <= 0) {
          arcadeAudio.playCue("siren");
          sirenCooldown.current = 2.8;
        }
      }
    }

    const strobeFreq = isAlert ? 14.0 : 4.0;
    const flash = Math.sin(progressRef.current * strobeFreq) > 0;
    if (blueStrobeRef.current) {
      blueStrobeRef.current.emissiveIntensity = flash ? 3.5 : 0.2;
    }
    if (redStrobeRef.current) {
      redStrobeRef.current.emissiveIntensity = !flash ? 3.5 : 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Chassis: White Police Interceptor Body */}
      <mesh position={[0, 0.42, 0]} geometry={CAR_CHASSIS_GEO} castShadow receiveShadow>
        <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.4} />
      </mesh>
      {/* Navy Blue Side Quarter Panels */}
      {[-0.87, 0.87].map((s) => (
        <mesh key={s} position={[s, 0.44, 0]}>
          <boxGeometry args={[0.04, 0.38, 2.8]} />
          <meshStandardMaterial color="#1e3a8a" roughness={0.4} />
        </mesh>
      ))}
      {/* Front Push Bumper / Bull Bar */}
      <mesh position={[0, 0.36, 2.12]} castShadow>
        <boxGeometry args={[1.5, 0.32, 0.14]} />
        <meshStandardMaterial color="#111827" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Cabin & Tinted Windows */}
      <mesh position={[0, 0.88, -0.22]} geometry={CAR_CABIN_GEO} material={CAR_CABIN_MAT} castShadow />
      {/* Wheels */}
      {[-0.82, 0.82].flatMap((wx) =>
        [-1.25, 1.25].map((wz) => (
          <mesh key={`${wx}-${wz}`} position={[wx, 0.28, wz]} rotation={[0, 0, Math.PI / 2]} geometry={CAR_WHEEL_GEO} material={CAR_WHEEL_MAT} />
        ))
      )}
      {/* Roof Lightbar */}
      <group position={[0, 1.24, -0.22]}>
        <mesh castShadow>
          <boxGeometry args={[1.1, 0.12, 0.32]} />
          <meshStandardMaterial color="#1e293b" metalness={0.6} />
        </mesh>
        {/* Blue Strobe Light (Left) */}
        <mesh position={[-0.34, 0.08, 0]}>
          <boxGeometry args={[0.34, 0.12, 0.26]} />
          <meshStandardMaterial ref={blueStrobeRef} color="#2563eb" emissive="#1d4ed8" emissiveIntensity={1.5} roughness={0.1} />
        </mesh>
        {/* Red Strobe Light (Right) */}
        <mesh position={[0.34, 0.08, 0]}>
          <boxGeometry args={[0.34, 0.12, 0.26]} />
          <meshStandardMaterial ref={redStrobeRef} color="#dc2626" emissive="#b91c1c" emissiveIntensity={1.5} roughness={0.1} />
        </mesh>
      </group>
    </group>
  );
}

type PlayerTelemetryRef = MutableRefObject<{ x: number; z: number; speed: number; yaw: number; y?: number }>;

type NpcKnockback = {
  active: boolean;
  timeLeft: number;
  cooldown: number;
  originX: number;
  originZ: number;
  originYaw: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  spinX: number;
  spinZ: number;
};

function createNpcKnockback(): NpcKnockback {
  return { active: false, timeLeft: 0, cooldown: 0, originX: 0, originZ: 0, originYaw: 0, velocityX: 0, velocityY: 0, velocityZ: 0, spinX: 0, spinZ: 0 };
}

function launchNpcFromVehicle(motion: NpcKnockback, x: number, z: number, player?: PlayerTelemetryRef["current"], yaw = 0) {
  if (!player || Math.abs(player.speed) < 2.5 || motion.active || motion.cooldown > 0) return false;
  const dx = x - player.x;
  const dz = z - player.z;
  const distance = Math.hypot(dx, dz);
  if (distance > 2.05) return false;

  const awayX = distance > 0.01 ? dx / distance : Math.sin(player.yaw);
  const awayZ = distance > 0.01 ? dz / distance : Math.cos(player.yaw);
  const impactSpeed = Math.min(22, Math.abs(player.speed));
  const forwardX = Math.sin(player.yaw) * Math.sign(player.speed || 1);
  const forwardZ = Math.cos(player.yaw) * Math.sign(player.speed || 1);
  motion.active = true;
  motion.timeLeft = 2.25;
  motion.cooldown = 3.2;
  motion.originX = x;
  motion.originZ = z;
  motion.originYaw = yaw;
  motion.velocityX = awayX * (4.5 + impactSpeed * 0.32) + forwardX * impactSpeed * 0.46;
  motion.velocityY = 5.2 + Math.min(3, impactSpeed * 0.12);
  motion.velocityZ = awayZ * (4.5 + impactSpeed * 0.32) + forwardZ * impactSpeed * 0.46;
  motion.spinX = (Math.random() - 0.5) * 8;
  motion.spinZ = (Math.random() < 0.5 ? -1 : 1) * (5 + impactSpeed * 0.12);
  return true;
}

function stepNpcKnockback(group: Group, motion: NpcKnockback, delta: number) {
  const dt = Math.min(delta, 0.05);
  motion.cooldown = Math.max(0, motion.cooldown - dt);
  if (!motion.active) return false;
  motion.timeLeft -= dt;
  motion.velocityY -= 9.8 * dt;
  motion.velocityX *= Math.exp(-0.72 * dt);
  motion.velocityZ *= Math.exp(-0.72 * dt);
  group.position.x += motion.velocityX * dt;
  group.position.y = Math.max(0, group.position.y + motion.velocityY * dt);
  group.position.z += motion.velocityZ * dt;
  if (group.position.y === 0 && motion.velocityY < 0) motion.velocityY = Math.max(0, -motion.velocityY * 0.18);
  group.rotation.x += motion.spinX * dt;
  group.rotation.z += motion.spinZ * dt;
  motion.spinX *= Math.exp(-1.3 * dt);
  motion.spinZ *= Math.exp(-1.3 * dt);

  if (motion.timeLeft <= 0) {
    motion.active = false;
    group.position.set(motion.originX, 0, motion.originZ);
    group.rotation.set(0, motion.originYaw, 0);
  }
  return true;
}

function PedestrianCharacter({
  npc,
  route,
  playerSimulationRef,
  input,
}: {
  npc: PedestrianNPC;
  route: PedestrianRoute;
  playerSimulationRef?: PlayerTelemetryRef;
  input?: { read: () => { horn?: boolean } };
}) {
  const groupRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);

  const reactionTimer = useRef(0);
  const reactionType = useRef<"none" | "evade" | "horn">("none");
  const bubbleRef = useRef<BubbleState>({ text: "", isAlert: false, visible: false });
  const knockbackRef = useRef(createNpcKnockback());

  // Compute total route length and segment lengths
  const { totalLength, segmentLengths } = useMemo(() => {
    const pts = route.waypoints;
    const segs: number[] = [];
    let sum = 0;
    for (let i = 0; i < pts.length; i += 1) {
      const nextIdx = (i + 1) % pts.length;
      if (!route.loop && nextIdx === 0) break;
      const dx = pts[nextIdx].x - pts[i].x;
      const dz = pts[nextIdx].z - pts[i].z;
      const dist = Math.hypot(dx, dz);
      segs.push(dist);
      sum += dist;
    }
    return { totalLength: Math.max(1, sum), segmentLengths: segs };
  }, [route]);

  const currentDistanceRef = useRef(npc.initialProgress * totalLength);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.1);

    if (stepNpcKnockback(groupRef.current, knockbackRef.current, dt)) {
      return;
    }

    // Only progress on route if not currently evading a near-miss
    if (reactionType.current !== "evade") {
      currentDistanceRef.current = (currentDistanceRef.current + npc.speed * dt) % totalLength;
    }

    // Determine current waypoint segment
    let accum = 0;
    let segIdx = 0;
    let segOffset = currentDistanceRef.current;
    for (let i = 0; i < segmentLengths.length; i += 1) {
      if (accum + segmentLengths[i] >= currentDistanceRef.current) {
        segIdx = i;
        segOffset = currentDistanceRef.current - accum;
        break;
      }
      accum += segmentLengths[i];
    }

    const pts = route.waypoints;
    const pA = pts[segIdx];
    const pB = pts[(segIdx + 1) % pts.length];
    const segLen = segmentLengths[segIdx] || 1;
    const t = Math.min(1, Math.max(0, segOffset / segLen));

    let curX = pA.x + (pB.x - pA.x) * t;
    let curZ = pA.z + (pB.z - pA.z) * t;
    let headingYaw = Math.atan2(pB.x - pA.x, pB.z - pA.z);

    // Check Player Interactions (Evasion & Horn)
    const player = playerSimulationRef?.current;
    const isHonking = Boolean(input?.read().horn);

    if (player) {
      const dist = Math.hypot(curX - player.x, curZ - player.z);
      const playerSpeed = Math.abs(player.speed);

      if (launchNpcFromVehicle(knockbackRef.current, curX, curZ, player, headingYaw)) {
        reactionTimer.current = 2.25;
        reactionType.current = "evade";
        bubbleRef.current = { text: "Whoa! Watch where you're going!", isAlert: true, visible: true };
        stepNpcKnockback(groupRef.current, knockbackRef.current, dt);
        return;
      }

      // 1. Near Miss Evasion (< 7.5m, player speed > 5 m/s)
      if (dist < 7.5 && playerSpeed > 5.0 && reactionTimer.current <= 0) {
        reactionTimer.current = 2.4;
        reactionType.current = "evade";
        const EVADE_EXCLAMATIONS = ["Whoa, slow down!", "Watch out!", "Hey, careful!", "Watch the road!"];
        bubbleRef.current = {
          text: EVADE_EXCLAMATIONS[Math.floor(Math.random() * EVADE_EXCLAMATIONS.length)],
          isAlert: true,
          visible: true,
        };
      }
      // 2. Horn Reaction (< 14m, player pressed H)
      else if (isHonking && dist < 14.0 && reactionTimer.current <= 0) {
        reactionTimer.current = 2.0;
        reactionType.current = "horn";
        const HORN_GREETINGS = ["Morning!", "Nice car!", "Beep beep!", "Have a great drive!"];
        bubbleRef.current = {
          text: HORN_GREETINGS[Math.floor(Math.random() * HORN_GREETINGS.length)],
          isAlert: false,
          visible: true,
        };
      }
    }

    if (reactionTimer.current > 0) {
      reactionTimer.current -= dt;
      if (reactionTimer.current <= 0) {
        reactionType.current = "none";
        bubbleRef.current.visible = false;
      }
    } else {
      bubbleRef.current.visible = false;
    }

    // Handle Evasion or Horn poses
    if (reactionType.current === "evade") {
      // Step slightly away
      if (player) {
        const dx = curX - player.x;
        const dz = curZ - player.z;
        const len = Math.hypot(dx, dz) || 1;
        curX += (dx / len) * 0.45;
        curZ += (dz / len) * 0.45;
      }
      // Both arms thrown up in alarm
      if (leftArmRef.current) leftArmRef.current.rotation.x = -2.2;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -2.2;
    } else if (reactionType.current === "horn") {
      // Face the player vehicle
      if (player) {
        headingYaw = Math.atan2(player.x - curX, player.z - curZ);
      }
      // Friendly waving arm
      const wave = Math.sin(currentDistanceRef.current * 12.0) * 0.4 + 1.2;
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = 0;
        rightArmRef.current.rotation.z = wave;
      }
    } else {
      // Standard walking cycle
      const walkPhase = currentDistanceRef.current * 4.2;
      const legAngle = Math.sin(walkPhase) * 0.42;
      const armAngle = Math.sin(walkPhase + Math.PI) * 0.38;

      if (leftLegRef.current) leftLegRef.current.rotation.x = legAngle;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -legAngle;
      if (leftArmRef.current) leftArmRef.current.rotation.x = armAngle;
      if (rightArmRef.current) {
        rightArmRef.current.rotation.z = 0;
        rightArmRef.current.rotation.x = -armAngle;
      }
    }

    groupRef.current.position.set(curX, 0, curZ);
    groupRef.current.rotation.y = headingYaw;
  });

  return (
    <group ref={groupRef}>
      {/* Speech Bubble */}
      <SpeechBubble bubbleRef={bubbleRef} />

      {/* Torso / Shirt */}
      <mesh position={[0, 1.02, 0]} geometry={NPC_TORSO_GEO} castShadow>
        <meshStandardMaterial color={npc.shirtColor} roughness={0.7} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.44, 0]} geometry={NPC_HEAD_GEO} material={NPC_SKIN_MAT} castShadow />

      {/* Hair */}
      <mesh position={[0, 1.58, 0]} geometry={NPC_HAIR_GEO}>
        <meshStandardMaterial color={npc.hairColor} roughness={0.8} />
      </mesh>

      {/* Left Leg */}
      <group ref={leftLegRef} position={[-0.11, 0.74, 0]}>
        <mesh position={[0, -0.36, 0]} geometry={NPC_LEG_GEO} castShadow>
          <meshStandardMaterial color={npc.pantsColor} roughness={0.8} />
        </mesh>
      </group>

      {/* Right Leg */}
      <group ref={rightLegRef} position={[0.11, 0.74, 0]}>
        <mesh position={[0, -0.36, 0]} geometry={NPC_LEG_GEO} castShadow>
          <meshStandardMaterial color={npc.pantsColor} roughness={0.8} />
        </mesh>
      </group>

      {/* Left Arm */}
      <group ref={leftArmRef} position={[-0.27, 1.22, 0]}>
        <mesh position={[0, -0.25, 0]} geometry={NPC_ARM_GEO}>
          <meshStandardMaterial color={npc.shirtColor} roughness={0.7} />
        </mesh>
      </group>

      {/* Right Arm */}
      <group ref={rightArmRef} position={[0.27, 1.22, 0]}>
        <mesh position={[0, -0.25, 0]} geometry={NPC_ARM_GEO}>
          <meshStandardMaterial color={npc.shirtColor} roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

// -------------------------------------------------------------
// STATIC LIVING NPCS (Guards, Conversationalists, Bench Sitters)
// -------------------------------------------------------------
function StaticLivingNPC({
  npc,
  playerSimulationRef,
  input,
}: {
  npc: StaticNPC;
  playerSimulationRef?: PlayerTelemetryRef;
  input?: { read: () => { horn?: boolean } };
}) {
  const groupRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const bubbleRef = useRef<BubbleState>({ text: "", isAlert: false, visible: false });
  const bubbleTimer = useRef(0);
  const convoIndex = useRef(0);
  const convoTimer = useRef(npc.id.includes("priya") ? 2.5 : 0);
  const knockbackRef = useRef(createNpcKnockback());

  const isSitting = npc.activity === "sitting";
  const isGuarding = npc.activity === "guarding";
  const isTalking = npc.activity === "talking";

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.1);
    const time = clock.getElapsedTime();
    const player = playerSimulationRef?.current;
    const isHonking = Boolean(input?.read().horn);

    if (groupRef.current && stepNpcKnockback(groupRef.current, knockbackRef.current, dt)) return;

    // 1. Check Player Proximity & Horn
    if (player) {
      const dist = Math.hypot(npc.x - player.x, npc.z - player.z);

      if (launchNpcFromVehicle(knockbackRef.current, npc.x, npc.z, player, npc.yaw) && groupRef.current) {
        bubbleRef.current = { text: "Hey! Watch where you're going!", isAlert: true, visible: true };
        bubbleTimer.current = 2.25;
        stepNpcKnockback(groupRef.current, knockbackRef.current, dt);
        return;
      }

      // Gate Guard greeting approaching vehicle
      if (isGuarding && dist < 22.0 && bubbleTimer.current <= 0) {
        bubbleRef.current = { text: "Welcome to Cedar Grove!", isAlert: false, visible: true };
        bubbleTimer.current = 3.2;
      }
      // Reaction to player honking horn
      if (isHonking && dist < 14.0 && bubbleTimer.current <= 0) {
        bubbleRef.current = { text: npc.defaultLines[0] || "Hello neighbour!", isAlert: false, visible: true };
        bubbleTimer.current = 2.4;
      }
    }

    // 2. Autonomous Conversational Dialogues (Marcus & Priya)
    if (isTalking) {
      convoTimer.current += dt;
      if (convoTimer.current >= 5.0) {
        convoTimer.current = 0;
        bubbleRef.current = {
          text: npc.defaultLines[convoIndex.current % npc.defaultLines.length],
          isAlert: false,
          visible: true,
        };
        convoIndex.current += 1;
        bubbleTimer.current = 2.8;
      }
    }

    if (bubbleTimer.current > 0) {
      bubbleTimer.current -= dt;
      if (bubbleTimer.current <= 0) bubbleRef.current.visible = false;
    } else {
      bubbleRef.current.visible = false;
    }

    // Gate Guard Waving Animation when greeting
    if (isGuarding && rightArmRef.current) {
      if (bubbleTimer.current > 0) {
        rightArmRef.current.rotation.z = Math.sin(time * 6.0) * 0.35 + 1.1;
        rightArmRef.current.rotation.x = 0;
      } else {
        rightArmRef.current.rotation.z = 0;
        rightArmRef.current.rotation.x = 0;
      }
    }
  });

  return (
    <group ref={groupRef} position={[npc.x, 0, npc.z]} rotation={[0, npc.yaw, 0]}>
      {/* Dialogue Speech Bubble */}
      <SpeechBubble bubbleRef={bubbleRef} />

      {/* Torso */}
      <mesh position={[0, isSitting ? 0.78 : 1.02, 0]} geometry={NPC_TORSO_GEO} castShadow>
        <meshStandardMaterial color={npc.shirtColor} roughness={0.7} />
      </mesh>

      {/* Head */}
      <mesh position={[0, isSitting ? 1.2 : 1.44, 0]} geometry={NPC_HEAD_GEO} material={NPC_SKIN_MAT} castShadow />

      {/* Hair */}
      <mesh position={[0, isSitting ? 1.34 : 1.58, 0]} geometry={NPC_HAIR_GEO}>
        <meshStandardMaterial color={npc.hairColor} roughness={0.8} />
      </mesh>

      {/* Left Leg */}
      <group position={[-0.11, isSitting ? 0.5 : 0.74, 0]} rotation={[isSitting ? -Math.PI / 2 : 0, 0, 0]}>
        <mesh position={[0, -0.36, 0]} geometry={NPC_LEG_GEO} castShadow>
          <meshStandardMaterial color={npc.pantsColor} roughness={0.8} />
        </mesh>
      </group>

      {/* Right Leg */}
      <group position={[0.11, isSitting ? 0.5 : 0.74, 0]} rotation={[isSitting ? -Math.PI / 2 : 0, 0, 0]}>
        <mesh position={[0, -0.36, 0]} geometry={NPC_LEG_GEO} castShadow>
          <meshStandardMaterial color={npc.pantsColor} roughness={0.8} />
        </mesh>
      </group>

      {/* Left Arm */}
      <group position={[-0.27, isSitting ? 0.98 : 1.22, 0]}>
        <mesh position={[0, -0.25, 0]} geometry={NPC_ARM_GEO}>
          <meshStandardMaterial color={npc.shirtColor} roughness={0.7} />
        </mesh>
      </group>

      {/* Right Arm */}
      <group ref={rightArmRef} position={[0.27, isSitting ? 0.98 : 1.22, 0]}>
        <mesh position={[0, -0.25, 0]} geometry={NPC_ARM_GEO}>
          <meshStandardMaterial color={npc.shirtColor} roughness={0.7} />
        </mesh>
      </group>

      {/* Reading Book for Grandma Rose */}
      {npc.id === "npc-sit-rose" && (
        <mesh position={[0, 0.65, 0.32]} rotation={[0.4, 0, 0]} castShadow>
          <boxGeometry args={[0.32, 0.05, 0.24]} />
          <meshStandardMaterial color="#1e40af" roughness={0.5} />
        </mesh>
      )}

      {/* Coffee Cup for Oliver */}
      {npc.id === "npc-cafe-oliver" && (
        <mesh position={[0.18, 0.62, 0.32]} castShadow>
          <cylinderGeometry args={[0.06, 0.05, 0.12, 8]} />
          <meshStandardMaterial color="#f0ede1" roughness={0.3} />
        </mesh>
      )}
    </group>
  );
}

// -------------------------------------------------------------
// CHILDREN PLAYING TAG IN CENTRAL PARK
// -------------------------------------------------------------
function KidsTagGame() {
  const kid1Ref = useRef<Group>(null);
  const kid2Ref = useRef<Group>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current * 1.6;

    // Playful oval chase path on the park lawn (Center X = 31.5, Z = -29)
    const k1X = 31.5 + Math.sin(t) * 9.5;
    const k1Z = -29 + Math.cos(t) * 7.5;
    const k1Yaw = Math.atan2(Math.cos(t) * 9.5, -Math.sin(t) * 7.5);

    const k2X = 31.5 + Math.sin(t - 0.42) * 9.5;
    const k2Z = -29 + Math.cos(t - 0.42) * 7.5;
    const k2Yaw = Math.atan2(Math.cos(t - 0.42) * 9.5, -Math.sin(t - 0.42) * 7.5);

    if (kid1Ref.current) {
      kid1Ref.current.position.set(k1X, 0, k1Z);
      kid1Ref.current.rotation.y = k1Yaw;
    }
    if (kid2Ref.current) {
      kid2Ref.current.position.set(k2X, 0, k2Z);
      kid2Ref.current.rotation.y = k2Yaw;
    }
  });

  return (
    <group>
      {/* Kid 1 (Timmy in bright yellow shirt) */}
      <group ref={kid1Ref} scale={[0.78, 0.78, 0.78]}>
        <mesh position={[0, 0.88, 0]} geometry={NPC_TORSO_GEO} castShadow>
          <meshStandardMaterial color="#facc15" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.26, 0]} geometry={NPC_HEAD_GEO} material={NPC_SKIN_MAT} castShadow />
        <mesh position={[0, 1.38, 0]} geometry={NPC_HAIR_GEO}>
          <meshStandardMaterial color="#78350f" roughness={0.8} />
        </mesh>
        {[-0.1, 0.1].map((lx) => (
          <mesh key={lx} position={[lx, 0.32, 0]} geometry={NPC_LEG_GEO} castShadow>
            <meshStandardMaterial color="#2563eb" roughness={0.8} />
          </mesh>
        ))}
      </group>

      {/* Kid 2 (Lily in turquoise dress) */}
      <group ref={kid2Ref} scale={[0.74, 0.74, 0.74]}>
        <mesh position={[0, 0.88, 0]} geometry={NPC_TORSO_GEO} castShadow>
          <meshStandardMaterial color="#06b6d4" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.26, 0]} geometry={NPC_HEAD_GEO} material={NPC_SKIN_MAT} castShadow />
        <mesh position={[0, 1.38, 0]} geometry={NPC_HAIR_GEO}>
          <meshStandardMaterial color="#b45309" roughness={0.8} />
        </mesh>
        {[-0.1, 0.1].map((lx) => (
          <mesh key={lx} position={[lx, 0.32, 0]} geometry={NPC_LEG_GEO} castShadow>
            <meshStandardMaterial color="#f43f5e" roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function PedestrianManager({
  playerSimulationRef,
  input,
}: {
  playerSimulationRef?: PlayerTelemetryRef;
  input?: { read: () => { horn?: boolean } };
}) {
  const routeMap = useMemo(() => {
    const map = new Map<string, PedestrianRoute>();
    PEDESTRIAN_ROUTES.forEach((r) => map.set(r.id, r));
    return map;
  }, []);

  return (
    <group>
      {PEDESTRIAN_NPCS.map((npc) => {
        const route = routeMap.get(npc.routeId);
        if (!route) return null;
        return (
          <PedestrianCharacter
            key={npc.id}
            npc={npc}
            route={route}
            playerSimulationRef={playerSimulationRef}
            input={input}
          />
        );
      })}
    </group>
  );
}

function LivingNPCManager({
  playerSimulationRef,
  input,
}: {
  playerSimulationRef?: PlayerTelemetryRef;
  input?: { read: () => { horn?: boolean } };
}) {
  return (
    <group>
      {STATIC_LIVING_NPCS.map((npc) => (
        <StaticLivingNPC
          key={npc.id}
          npc={npc}
          playerSimulationRef={playerSimulationRef}
          input={input}
        />
      ))}
      <KidsTagGame />
    </group>
  );
}

// -------------------------------------------------------------
// COMPLETE GROUND SCENE COMPONENT
// -------------------------------------------------------------
export default function SocietyWorld({
  playerSimulationRef,
  input,
}: {
  playerSimulationRef?: PlayerTelemetryRef;
  input?: { read: () => { horn?: boolean; throttle?: number } };
} = {}) {
  return (
    <group>
      {/* Broad Landscape Ground Base Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[540, 540]} />
        <meshStandardMaterial color="#47633f" roughness={0.98} />
      </mesh>

      {/* Street & Road System */}
      <RoadSurfaces />
      <SidewalksAndCurbs />
      <RoadMarkingsAndCrosswalks />
      <Roundabout />

      {/* Buildings across all districts */}
      {SOCIETY_BUILDINGS.map((building) => {
        if (building.kind === "tower") return <TowerBuilding key={building.id} building={building} />;
        if (building.kind === "villa") return <VillaBuilding key={building.id} building={building} />;
        if (building.kind === "shop") return <ShopBuilding key={building.id} building={building} />;
        if (building.kind === "clubhouse") return <ClubhouseBuilding key={building.id} building={building} />;
        if (building.kind === "security") return <SecurityGatehouse key={building.id} building={building} />;
        return null;
      })}

      {/* Gate Portal & Boundary */}
      <EntrancePortal />
      <SocietyBoundaries />

      {/* Park, Sports, Amenities, Furniture */}
      <CentralPark />
      <TennisCourt />
      <SwimmingPool />
      <ParkingLots />
      <ParkedVehicles />
      <Streetlights />
      <Trees />

      {/* Foundational Police Patrol Cruiser */}
      <PolicePatrolVehicle playerSimulationRef={playerSimulationRef} input={input} />

      {/* Animated NPC Pedestrians & Living Community */}
      <PedestrianManager playerSimulationRef={playerSimulationRef} input={input} />
      <LivingNPCManager playerSimulationRef={playerSimulationRef} input={input} />
    </group>
  );
}
