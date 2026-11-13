import type { ControllerControls } from "../input/ControllerInputSource";
import { createRacingSimulation, type RacingSimulation } from "./racingPhysics";
import {
  SOCIETY_OBSTACLES,
  SOCIETY_ROADS,
  SOCIETY_START,
  SOCIETY_WORLD_BOUNDS,
  type SocietyRoad,
} from "../world/societyLayout";
import { crashSocietyTrafficVehicle, SOCIETY_TRAFFIC_OBSTACLES } from "../world/societyTraffic";

// -------------------------------------------------------------
// SPATIAL HASH GRID FOR ULTRA-FAST O(1) OBSTACLE COLLISION
// -------------------------------------------------------------
const GRID_CELL_SIZE = 24;
const GRID_OFFSET_X = -SOCIETY_WORLD_BOUNDS.minX;
const GRID_OFFSET_Z = -SOCIETY_WORLD_BOUNDS.minZ;
const GRID_DIM_X = Math.ceil((SOCIETY_WORLD_BOUNDS.maxX - SOCIETY_WORLD_BOUNDS.minX) / GRID_CELL_SIZE);
const GRID_DIM_Z = Math.ceil((SOCIETY_WORLD_BOUNDS.maxZ - SOCIETY_WORLD_BOUNDS.minZ) / GRID_CELL_SIZE);

type ObstacleBox = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
};

const obstacleBoxes: ObstacleBox[] = SOCIETY_OBSTACLES.map((obs) => ({
  id: obs.id,
  minX: obs.x - obs.width / 2,
  maxX: obs.x + obs.width / 2,
  minZ: obs.z - obs.depth / 2,
  maxZ: obs.z + obs.depth / 2,
  centerX: obs.x,
  centerZ: obs.z,
}));

// Build spatial grid buckets
// Sparse buckets avoid allocating a mostly empty grid after the bounds grow.
const spatialGrid = new Map<number, ObstacleBox[]>();

function getCellIndex(cx: number, cz: number): number {
  if (cx < 0 || cx >= GRID_DIM_X || cz < 0 || cz >= GRID_DIM_Z) return -1;
  return cz * GRID_DIM_X + cx;
}

obstacleBoxes.forEach((box) => {
  const minCellX = Math.max(0, Math.floor((box.minX + GRID_OFFSET_X) / GRID_CELL_SIZE));
  const maxCellX = Math.min(GRID_DIM_X - 1, Math.floor((box.maxX + GRID_OFFSET_X) / GRID_CELL_SIZE));
  const minCellZ = Math.max(0, Math.floor((box.minZ + GRID_OFFSET_Z) / GRID_CELL_SIZE));
  const maxCellZ = Math.min(GRID_DIM_Z - 1, Math.floor((box.maxZ + GRID_OFFSET_Z) / GRID_CELL_SIZE));

  for (let cz = minCellZ; cz <= maxCellZ; cz += 1) {
    for (let cx = minCellX; cx <= maxCellX; cx += 1) {
      const idx = getCellIndex(cx, cz);
      if (idx >= 0) {
        let cell = spatialGrid.get(idx);
        if (!cell) {
          cell = [];
          spatialGrid.set(idx, cell);
        }
        cell.push(box);
      }
    }
  }
});

function getNearbyObstacles(
  x: number,
  z: number,
  searchRadius = 4.5,
  additionalObstacles: readonly ObstacleBox[] = [],
): ObstacleBox[] {
  const minCellX = Math.max(0, Math.floor((x - searchRadius + GRID_OFFSET_X) / GRID_CELL_SIZE));
  const maxCellX = Math.min(GRID_DIM_X - 1, Math.floor((x + searchRadius + GRID_OFFSET_X) / GRID_CELL_SIZE));
  const minCellZ = Math.max(0, Math.floor((z - searchRadius + GRID_OFFSET_Z) / GRID_CELL_SIZE));
  const maxCellZ = Math.min(GRID_DIM_Z - 1, Math.floor((z + searchRadius + GRID_OFFSET_Z) / GRID_CELL_SIZE));

  const result: ObstacleBox[] = [];
  const seen = new Set<string>();

  for (let cz = minCellZ; cz <= maxCellZ; cz += 1) {
    for (let cx = minCellX; cx <= maxCellX; cx += 1) {
      const idx = getCellIndex(cx, cz);
      if (idx < 0) continue;
      const cell = spatialGrid.get(idx);
      if (!cell) continue;
      for (let i = 0; i < cell.length; i += 1) {
        const obs = cell[i];
        if (!seen.has(obs.id)) {
          seen.add(obs.id);
          result.push(obs);
        }
      }
    }
  }
  for (const obstacle of additionalObstacles) {
    if (
      x + searchRadius >= obstacle.minX
      && x - searchRadius <= obstacle.maxX
      && z + searchRadius >= obstacle.minZ
      && z - searchRadius <= obstacle.maxZ
      && !seen.has(obstacle.id)
    ) {
      seen.add(obstacle.id);
      result.push(obstacle);
    }
  }
  for (const obstacle of SOCIETY_TRAFFIC_OBSTACLES) {
    if (
      x + searchRadius >= obstacle.minX
      && x - searchRadius <= obstacle.maxX
      && z + searchRadius >= obstacle.minZ
      && z - searchRadius <= obstacle.maxZ
      && !seen.has(obstacle.id)
    ) {
      seen.add(obstacle.id);
      result.push(obstacle);
    }
  }
  return result;
}

// -------------------------------------------------------------
// VEHICLE COLLISION BODY: MULTI-SPHERE CAPSULE
// -------------------------------------------------------------
// Using 3 collision spheres along vehicle centerline prevents artificial
// bounding box inflation when rotating against obstacles and walls.
const SPHERE_RADIUS = 0.82;
const SPHERE_OFFSETS = [-0.85, 0.0, 0.85] as const;

export function createOpenWorldSimulation(): RacingSimulation {
  return {
    ...createRacingSimulation(),
    ...SOCIETY_START,
  };
}

export function recoverOpenWorldSimulation(
  simulation: RacingSimulation,
  roads: readonly SocietyRoad[] = SOCIETY_ROADS,
) {
  let nearest = { x: SOCIETY_START.x, z: SOCIETY_START.z, yaw: SOCIETY_START.yaw, distance: Infinity };

  for (const road of roads) {
    const halfLength = road.length / 2;
    const halfWidth = road.width / 2;
    const x = road.axis === "x"
      ? Math.max(road.x - halfLength, Math.min(road.x + halfLength, simulation.x))
      : Math.max(road.x - halfWidth + 2, Math.min(road.x + halfWidth - 2, simulation.x));
    const z = road.axis === "z"
      ? Math.max(road.z - halfLength, Math.min(road.z + halfLength, simulation.z))
      : Math.max(road.z - halfWidth + 2, Math.min(road.z + halfWidth - 2, simulation.z));
    const distance = (x - simulation.x) ** 2 + (z - simulation.z) ** 2;
    if (distance >= nearest.distance) continue;

    const forward = road.axis === "x" ? Math.sin(simulation.yaw) : Math.cos(simulation.yaw);
    const positive = forward >= 0;
    const yaw = road.axis === "x" ? (positive ? Math.PI / 2 : -Math.PI / 2) : (positive ? 0 : Math.PI);
    nearest = { x, z, yaw, distance };
  }

  simulation.x = nearest.x;
  simulation.z = nearest.z;
  simulation.yaw = nearest.yaw;
  simulation.speed = 0;
  simulation.collided = true;
  simulation.wrongWay = false;
}

// -------------------------------------------------------------
// PHYSICS STEP WITH RESOLUTION & DE-PENETRATION
// -------------------------------------------------------------
export function stepOpenWorldSimulation(
  simulation: RacingSimulation,
  controls: ControllerControls,
  delta: number,
  additionalObstacles: readonly ObstacleBox[] = [],
) {
  const dt = Math.min(delta, 1 / 30);
  const boosting = controls.action1 && simulation.nitro > 0;
  const maxForwardSpeed = boosting ? 43 : 33; // ~155 km/h boost, ~119 km/h base
  const maxReverseSpeed = 10.5; // ~38 km/h reverse
  const accelRate = boosting ? 22 : 14.5;
  const brakeRate = 24;
  const coastDrag = 3.2;

  simulation.collided = false;
  simulation.elapsed += dt;

  // 1. ARCADE TRANSMISSION & SPEED CONTROL
  const currentSpeed = simulation.speed;

  if (currentSpeed >= 0.15) {
    // FORWARD DRIVING STATE
    if (controls.throttle > 0) {
      simulation.speed += controls.throttle * accelRate * dt;
    } else {
      simulation.speed -= coastDrag * dt;
    }

    if (controls.brake > 0) {
      // Service Brake
      simulation.speed -= controls.brake * brakeRate * dt;
      if (simulation.speed < 0.1) simulation.speed = 0;
    }

    if (simulation.speed < 0.1) simulation.speed = 0;
    simulation.speed = Math.min(maxForwardSpeed, simulation.speed);
  } else if (currentSpeed <= -0.15) {
    // REVERSE DRIVING STATE
    if (controls.brake > 0) {
      // Brake pedal acts as reverse throttle
      simulation.speed -= controls.brake * (accelRate * 0.75) * dt;
      simulation.speed = Math.max(-maxReverseSpeed, simulation.speed);
    } else {
      simulation.speed += coastDrag * dt;
    }

    if (controls.throttle > 0) {
      // Throttle acts as reverse brake
      simulation.speed += controls.throttle * brakeRate * dt;
      if (simulation.speed > -0.1) simulation.speed = 0;
    }

    if (simulation.speed > -0.1) simulation.speed = 0;
  } else {
    // STANDSTILL / NEUTRAL STATE
    simulation.speed = 0;

    if (controls.throttle > 0) {
      simulation.speed += controls.throttle * accelRate * dt;
    } else if (controls.brake > 0) {
      simulation.speed -= controls.brake * (accelRate * 0.75) * dt;
    }
  }

  // 2. NITRO BOOST RESOURCE
  if (boosting) {
    simulation.nitro = Math.max(0, simulation.nitro - 25 * dt);
  } else {
    simulation.nitro = Math.min(100, simulation.nitro + 7.5 * dt);
  }

  // 3. RESPONSIVE STEERING WITH LOW-SPEED DRY STEERING & HIGH-SPEED STABILITY
  const absSpeed = Math.abs(simulation.speed);
  // Guarantee low-speed authority (0.42 minimum) so car never gets stuck unable to turn
  const lowSpeedAuthority = Math.max(0.42, Math.min(1.0, absSpeed / 3.8));
  // High-speed damping prevents twitchy oversteer at top speed
  const highSpeedDamping = absSpeed > 18 ? Math.max(0.72, 1.0 - (absSpeed - 18) * 0.014) : 1.0;
  const handbrakeFactor = controls.action2 ? 1.4 : 1.0;
  const reverseSteerDir = simulation.speed < -0.2 ? -1 : 1;

  simulation.yaw -= controls.steering * 1.95 * lowSpeedAuthority * highSpeedDamping * handbrakeFactor * reverseSteerDir * dt;

  // 4. PREDICTIVE MOVEMENT & SPHERICAL COLLISION RESOLUTION
  const forwardX = Math.sin(simulation.yaw);
  const forwardZ = Math.cos(simulation.yaw);
  const moveDist = simulation.speed * dt;

  let nextX = simulation.x + forwardX * moveDist;
  let nextZ = simulation.z + forwardZ * moveDist;

  // Boundary clamp
  const minX = SOCIETY_WORLD_BOUNDS.minX + 1.2;
  const maxX = SOCIETY_WORLD_BOUNDS.maxX - 1.2;
  const minZ = SOCIETY_WORLD_BOUNDS.minZ + 1.2;
  const maxZ = SOCIETY_WORLD_BOUNDS.maxZ - 1.2;
  if (nextX < minX || nextX > maxX) {
    nextX = Math.max(minX, Math.min(maxX, nextX));
    simulation.collided = true;
    simulation.speed *= 0.5;
  }
  if (nextZ < minZ || nextZ > maxZ) {
    nextZ = Math.max(minZ, Math.min(maxZ, nextZ));
    simulation.collided = true;
    simulation.speed *= 0.5;
  }

  // Query nearby obstacles from spatial grid
  const candidates = getNearbyObstacles(nextX, nextZ, 5.0, additionalObstacles);

  // Check and push out for each collision sphere
  let hadCollision = false;
  for (let s = 0; s < SPHERE_OFFSETS.length; s += 1) {
    const offset = SPHERE_OFFSETS[s];
    const sx = nextX + forwardX * offset;
    const sz = nextZ + forwardZ * offset;

    for (let i = 0; i < candidates.length; i += 1) {
      const obs = candidates[i];
      const closestX = Math.max(obs.minX, Math.min(obs.maxX, sx));
      const closestZ = Math.max(obs.minZ, Math.min(obs.maxZ, sz));

      const dx = sx - closestX;
      const dz = sz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < SPHERE_RADIUS * SPHERE_RADIUS) {
        hadCollision = true;
        const dist = Math.sqrt(distSq);
        const overlap = SPHERE_RADIUS - dist;

        let nx = dx;
        let nz = dz;
        if (dist > 0.0001) {
          nx /= dist;
          nz /= dist;
        } else {
          // Exactly centered, push outward from box center
          const ox = sx - obs.centerX;
          const oz = sz - obs.centerZ;
          const oLen = Math.hypot(ox, oz) || 1;
          nx = ox / oLen;
          nz = oz / oLen;
        }

        if (obs.id.startsWith("traffic-")) {
          crashSocietyTrafficVehicle(obs.id, -nx, -nz, Math.abs(simulation.speed));
        }

        // Push out vehicle position smoothly to clear the overlap
        nextX += nx * (overlap + 0.02);
        nextZ += nz * (overlap + 0.02);

        // Project velocity onto wall plane to allow smooth sliding
        const velX = forwardX * simulation.speed;
        const velZ = forwardZ * simulation.speed;
        const dot = velX * nx + velZ * nz;
        if (dot < 0) {
          const slideX = velX - dot * nx;
          const slideZ = velZ - dot * nz;
          const newSpeed = Math.hypot(slideX, slideZ) * 0.88;
          simulation.speed = simulation.speed >= 0 ? newSpeed : -newSpeed;
        }
      }
    }
  }

  if (hadCollision) {
    simulation.collided = true;
    if (Math.abs(simulation.speed) > 2.5) {
      simulation.speed *= 0.8;
    }
  }

  simulation.x = nextX;
  simulation.z = nextZ;
  simulation.currentLapTime += dt;
  simulation.wrongWay = false;

  return { finished: false, lapCompleted: false, lapTime: 0 };
}

// -------------------------------------------------------------
// ULTRA-FAST CAMERA OCCLUSION CHECK
// -------------------------------------------------------------
export function isOpenWorldCameraClear(x: number, z: number) {
  const clearance = 0.45;
  if (
    x < SOCIETY_WORLD_BOUNDS.minX || x > SOCIETY_WORLD_BOUNDS.maxX
    || z < SOCIETY_WORLD_BOUNDS.minZ || z > SOCIETY_WORLD_BOUNDS.maxZ
  ) return false;

  // This check runs several times per rendered camera frame. Walk the nearby
  // grid buckets directly so it does not allocate a result array or Set.
  const searchRadius = clearance + 1.5;
  const minCellX = Math.max(0, Math.floor((x - searchRadius + GRID_OFFSET_X) / GRID_CELL_SIZE));
  const maxCellX = Math.min(GRID_DIM_X - 1, Math.floor((x + searchRadius + GRID_OFFSET_X) / GRID_CELL_SIZE));
  const minCellZ = Math.max(0, Math.floor((z - searchRadius + GRID_OFFSET_Z) / GRID_CELL_SIZE));
  const maxCellZ = Math.min(GRID_DIM_Z - 1, Math.floor((z + searchRadius + GRID_OFFSET_Z) / GRID_CELL_SIZE));

  for (let cz = minCellZ; cz <= maxCellZ; cz += 1) {
    for (let cx = minCellX; cx <= maxCellX; cx += 1) {
      const idx = getCellIndex(cx, cz);
      if (idx < 0) continue;
      const cell = spatialGrid.get(idx);
      if (!cell) continue;
      for (let i = 0; i < cell.length; i += 1) {
        const obs = cell[i];
        if (
          x >= obs.minX - clearance
          && x <= obs.maxX + clearance
          && z >= obs.minZ - clearance
          && z <= obs.maxZ + clearance
        ) {
          return false;
        }
      }
    }
  }
  return true;
}
