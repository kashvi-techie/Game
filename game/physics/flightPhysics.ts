import type { ControllerControls } from "../input/ControllerInputSource";
import {
  SOCIETY_BUILDINGS,
  SOCIETY_WORLD_BOUNDS,
  SOCIETY_LANDMARKS,
  SOCIETY_OBSTACLES,
  SOCIETY_START,
  SOCIETY_TREES,
  SOCIETY_WALLS,
} from "../world/societyLayout";

const GROUND_HEIGHT = 0.62;
const MAX_SPEED = 56;
const MAX_ALTITUDE = 150;
const MAX_PITCH = 0.4;
const MAX_ROLL = 0.68;

export type FlightSimulation = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  speed: number;
  verticalSpeed: number;
  throttle: number;
  gearDown: boolean;
  grounded: boolean;
  crashed: boolean;
};

const AIRCRAFT_START = { x: 0, y: GROUND_HEIGHT, z: -124, yaw: SOCIETY_START.yaw };

export function createFlightSimulation(): FlightSimulation {
  return {
    ...AIRCRAFT_START,
    pitch: 0,
    roll: 0,
    speed: 0,
    verticalSpeed: 0,
    throttle: 0,
    gearDown: true,
    grounded: true,
    crashed: false,
  };
}

export function resetFlightSimulation(simulation: FlightSimulation) {
  Object.assign(simulation, createFlightSimulation());
}

const buildingHeights = new Map(SOCIETY_BUILDINGS.map((building) => [building.id, building.height]));
const wallHeights = new Map(SOCIETY_WALLS.map((wall) => [wall.id, wall.height]));
const treeHeights = new Map(SOCIETY_TREES.map((tree) => [tree.id, tree.scale * 7.4]));
const landmarkHeights = new Map(SOCIETY_LANDMARKS.map((landmark) => [landmark.id, landmark.height]));
const FLIGHT_COLLISION_CELL_SIZE = 48;
const FLIGHT_COLLISION_GRID_WIDTH = Math.ceil(
  (SOCIETY_WORLD_BOUNDS.maxX - SOCIETY_WORLD_BOUNDS.minX) / FLIGHT_COLLISION_CELL_SIZE,
);
type FlightObstacle = (typeof SOCIETY_OBSTACLES)[number] & { height: number };
const flightCollisionGrid = new Map<number, FlightObstacle[]>();

function obstacleHeight(id: string) {
  return buildingHeights.get(id) ?? wallHeights.get(id) ?? treeHeights.get(id) ?? landmarkHeights.get(id) ?? 2.2;
}

function getFlightCollisionCell(x: number, z: number) {
  const cellX = Math.floor((x - SOCIETY_WORLD_BOUNDS.minX) / FLIGHT_COLLISION_CELL_SIZE);
  const cellZ = Math.floor((z - SOCIETY_WORLD_BOUNDS.minZ) / FLIGHT_COLLISION_CELL_SIZE);
  if (cellX < 0 || cellX >= FLIGHT_COLLISION_GRID_WIDTH || cellZ < 0 || cellZ >= FLIGHT_COLLISION_GRID_WIDTH) return -1;
  return cellZ * FLIGHT_COLLISION_GRID_WIDTH + cellX;
}

// Index each static obstacle into every cell crossed by its footprint plus the
// aircraft radius. This preserves the former AABB test while skipping distant
// scenery during the per-frame flight collision query.
SOCIETY_OBSTACLES.forEach((obstacle) => {
  const indexedObstacle: FlightObstacle = { ...obstacle, height: obstacleHeight(obstacle.id) };
  const radius = 3.2;
  const minCellX = Math.max(0, Math.floor((obstacle.x - obstacle.width / 2 - radius - SOCIETY_WORLD_BOUNDS.minX) / FLIGHT_COLLISION_CELL_SIZE));
  const maxCellX = Math.min(FLIGHT_COLLISION_GRID_WIDTH - 1, Math.floor((obstacle.x + obstacle.width / 2 + radius - SOCIETY_WORLD_BOUNDS.minX) / FLIGHT_COLLISION_CELL_SIZE));
  const minCellZ = Math.max(0, Math.floor((obstacle.z - obstacle.depth / 2 - radius - SOCIETY_WORLD_BOUNDS.minZ) / FLIGHT_COLLISION_CELL_SIZE));
  const maxCellZ = Math.min(FLIGHT_COLLISION_GRID_WIDTH - 1, Math.floor((obstacle.z + obstacle.depth / 2 + radius - SOCIETY_WORLD_BOUNDS.minZ) / FLIGHT_COLLISION_CELL_SIZE));

  for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      const cellIndex = cellZ * FLIGHT_COLLISION_GRID_WIDTH + cellX;
      let cell = flightCollisionGrid.get(cellIndex);
      if (!cell) {
        cell = [];
        flightCollisionGrid.set(cellIndex, cell);
      }
      cell.push(indexedObstacle);
    }
  }
});

function intersectsWorldObstacle(x: number, y: number, z: number, closuresOnly = false) {
  const aircraftRadius = 3.2;
  const cell = flightCollisionGrid.get(getFlightCollisionCell(x, z));
  if (!cell) return false;
  for (let index = 0; index < cell.length; index += 1) {
    const obstacle = cell[index];
    if (Math.abs(x - obstacle.x) > obstacle.width / 2 + aircraftRadius
      || Math.abs(z - obstacle.z) > obstacle.depth / 2 + aircraftRadius) continue;
    // Road closures are also flight exclusion planes: aircraft cannot bypass
    // unfinished district gates by flying over the road barricade.
    if (obstacle.category === "closure") return true;
    if (closuresOnly) continue;
    if (y - 1.3 < obstacle.height) return true;
  }
  return false;
}

export function stepFlightSimulation(
  simulation: FlightSimulation,
  controls: ControllerControls,
  delta: number,
) {
  const dt = Math.min(delta, 1 / 30);
  if (simulation.crashed) return;

  const throttleInput = controls.flightThrottle;
  const brakeInput = controls.flightBrake;
  simulation.throttle = Math.max(0, Math.min(1, simulation.throttle + (throttleInput - brakeInput) * dt * 0.42));
  const airbrake = controls.action1 ? (simulation.grounded ? 8 : 2.4) : 0;
  const groundBrake = simulation.grounded ? brakeInput * 12 : 0;
  const longitudinalAcceleration = simulation.throttle * 10.5
    - simulation.speed * (simulation.grounded ? 0.11 : 0.028)
    - airbrake
    - groundBrake;
  simulation.speed = Math.max(0, Math.min(MAX_SPEED, simulation.speed + longitudinalAcceleration * dt));

  const targetRoll = controls.steering * MAX_ROLL;
  simulation.roll += (targetRoll - simulation.roll) * (1 - Math.exp(-dt * 3.8));
  const targetPitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, controls.pitch * MAX_PITCH));
  simulation.pitch += (targetPitch - simulation.pitch) * (1 - Math.exp(-dt * 2.4));

  if (simulation.grounded) {
    const groundSteering = Math.min(1, simulation.speed / 8);
    simulation.yaw += controls.steering * groundSteering * dt * 0.58;
    simulation.roll *= Math.exp(-dt * 5);
  } else {
    const turnAuthority = Math.min(1, Math.max(0.18, simulation.speed / 20));
    simulation.yaw += Math.sin(simulation.roll) * turnAuthority * dt * 0.62;
  }

  const forwardX = Math.sin(simulation.yaw) * Math.cos(simulation.pitch);
  const forwardZ = Math.cos(simulation.yaw) * Math.cos(simulation.pitch);
  simulation.x += forwardX * simulation.speed * dt;
  simulation.z += forwardZ * simulation.speed * dt;

  const liftRatio = Math.max(0, Math.min(1, (simulation.speed - 10) / 22));
  const liftAcceleration = liftRatio * 9.81 * (1 + simulation.pitch * 1.4) * Math.cos(simulation.roll);
  const verticalAcceleration = simulation.grounded ? 0 : liftAcceleration - 9.81;
  simulation.verticalSpeed += verticalAcceleration * dt;
  simulation.y += simulation.verticalSpeed * dt;

  if (simulation.grounded && simulation.speed > 20 && simulation.pitch > 0.12 && liftAcceleration > 9.2) {
    simulation.grounded = false;
    simulation.verticalSpeed = Math.max(1.4, simulation.verticalSpeed);
  }

  if (!simulation.grounded && simulation.y <= GROUND_HEIGHT && simulation.verticalSpeed <= 0) {
    simulation.y = GROUND_HEIGHT;
    if (Math.abs(simulation.verticalSpeed) > 10) {
      simulation.crashed = true;
      simulation.speed = 0;
    } else {
      simulation.grounded = true;
      simulation.verticalSpeed = 0;
      simulation.pitch = Math.max(-0.06, Math.min(0.06, simulation.pitch));
      simulation.roll *= Math.exp(-dt * 7);
      simulation.speed = Math.max(0, simulation.speed - dt * (simulation.gearDown ? 1.5 : 3.6));
    }
  }

  const outsideWorld = simulation.x < SOCIETY_WORLD_BOUNDS.minX + 6
    || simulation.x > SOCIETY_WORLD_BOUNDS.maxX - 6
    || simulation.z < SOCIETY_WORLD_BOUNDS.minZ + 6
    || simulation.z > SOCIETY_WORLD_BOUNDS.maxZ - 6
    || simulation.y > MAX_ALTITUDE;
  const collidesWithWorld = simulation.grounded
    ? intersectsWorldObstacle(simulation.x, simulation.y, simulation.z, true)
    : intersectsWorldObstacle(simulation.x, simulation.y, simulation.z);
  if (outsideWorld || collidesWithWorld) {
    simulation.crashed = true;
    simulation.speed = 0;
    simulation.verticalSpeed = 0;
  }
}

export const FLIGHT_GROUND_HEIGHT = GROUND_HEIGHT;
