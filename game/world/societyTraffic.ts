import type { PedestrianWaypoint } from "./societyLayout";

type TrafficRoute = {
  points: readonly PedestrianWaypoint[];
  segmentLengths: readonly number[];
  totalLength: number;
};

export type SocietyTrafficVehicle = {
  id: string;
  color: string;
  route: TrafficRoute;
  speed: number;
  progress: number;
  x: number;
  z: number;
  yaw: number;
  crashTimer: number;
  velocityX: number;
  velocityZ: number;
  roll: number;
  obstacle: {
    id: string;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    centerX: number;
    centerZ: number;
  };
};

function createRoute(points: readonly PedestrianWaypoint[]): TrafficRoute {
  const segmentLengths = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return Math.hypot(next.x - point.x, next.z - point.z);
  });
  return { points, segmentLengths, totalLength: segmentLengths.reduce((sum, length) => sum + length, 0) };
}

const CEDAR_LOOP = createRoute([
  { x: 0, z: -118 }, { x: 118, z: -118 }, { x: 118, z: 0 }, { x: 118, z: 118 },
  { x: 0, z: 118 }, { x: -118, z: 118 }, { x: -118, z: 0 }, { x: -118, z: -118 },
]);

const WEST_CITY_LOOP = createRoute([
  { x: 0, z: -134 }, { x: 0, z: -400 }, { x: -900, z: -400 }, { x: -900, z: 400 },
  { x: 0, z: 400 }, { x: 0, z: 118 }, { x: -62, z: 118 }, { x: -62, z: -118 },
  { x: 0, z: -118 },
]);

const INDUSTRIAL_LOOP = createRoute([
  { x: 0, z: 400 }, { x: 0, z: 660 }, { x: 500, z: 660 }, { x: 500, z: 950 },
  { x: 1100, z: 950 }, { x: 1100, z: 660 }, { x: 0, z: 660 },
]);

function routePosition(route: TrafficRoute, progress: number) {
  let distance = ((progress % route.totalLength) + route.totalLength) % route.totalLength;
  for (let index = 0; index < route.segmentLengths.length; index += 1) {
    const segmentLength = route.segmentLengths[index] || 1;
    if (distance <= segmentLength || index === route.segmentLengths.length - 1) {
      const start = route.points[index];
      const end = route.points[(index + 1) % route.points.length];
      const t = Math.min(1, distance / segmentLength);
      return {
        x: start.x + (end.x - start.x) * t,
        z: start.z + (end.z - start.z) * t,
        yaw: Math.atan2(end.x - start.x, end.z - start.z),
      };
    }
    distance -= segmentLength;
  }
  return { ...route.points[0], yaw: 0 };
}

function createVehicle(id: string, color: string, route: TrafficRoute, speed: number, initialProgress: number): SocietyTrafficVehicle {
  const progress = route.totalLength * initialProgress;
  const position = routePosition(route, progress);
  const halfWidth = 1.18;
  const halfDepth = 2.25;
  return {
    id, color, route, speed, progress, ...position, crashTimer: 0, velocityX: 0, velocityZ: 0, roll: 0,
    obstacle: {
      id,
      minX: position.x - halfWidth,
      maxX: position.x + halfWidth,
      minZ: position.z - halfDepth,
      maxZ: position.z + halfDepth,
      centerX: position.x,
      centerZ: position.z,
    },
  };
}

// Three ambient vehicles share authored road loops across Cedar Grove,
// Downtown, West Residential, and the port / industrial district.
export const SOCIETY_TRAFFIC_VEHICLES: SocietyTrafficVehicle[] = [
  createVehicle("traffic-sedan-blue", "#3478a5", CEDAR_LOOP, 7.2, 0.2),
  createVehicle("traffic-coupe-amber", "#d4833d", WEST_CITY_LOOP, 9.1, 0.42),
  createVehicle("traffic-hatchback-green", "#6a925d", INDUSTRIAL_LOOP, 8.2, 0.55),
];

export const SOCIETY_TRAFFIC_OBSTACLES = SOCIETY_TRAFFIC_VEHICLES.map((vehicle) => vehicle.obstacle);

function syncObstacle(vehicle: SocietyTrafficVehicle) {
  const obstacle = vehicle.obstacle;
  obstacle.minX = vehicle.x - 1.18;
  obstacle.maxX = vehicle.x + 1.18;
  obstacle.minZ = vehicle.z - 2.25;
  obstacle.maxZ = vehicle.z + 2.25;
  obstacle.centerX = vehicle.x;
  obstacle.centerZ = vehicle.z;
}

export function advanceSocietyTraffic(delta: number) {
  const dt = Math.min(delta, 0.05);
  for (const vehicle of SOCIETY_TRAFFIC_VEHICLES) {
    if (vehicle.crashTimer > 0) {
      vehicle.crashTimer = Math.max(0, vehicle.crashTimer - dt);
      vehicle.x += vehicle.velocityX * dt;
      vehicle.z += vehicle.velocityZ * dt;
      const drag = Math.exp(-1.5 * dt);
      vehicle.velocityX *= drag;
      vehicle.velocityZ *= drag;
      vehicle.roll *= Math.exp(-2.6 * dt);
      if (vehicle.crashTimer === 0) {
        vehicle.progress = (vehicle.progress + 28) % vehicle.route.totalLength;
        vehicle.roll = 0;
        vehicle.velocityX = 0;
        vehicle.velocityZ = 0;
        Object.assign(vehicle, routePosition(vehicle.route, vehicle.progress));
      }
    } else {
      vehicle.progress = (vehicle.progress + vehicle.speed * dt) % vehicle.route.totalLength;
      Object.assign(vehicle, routePosition(vehicle.route, vehicle.progress));
    }
    syncObstacle(vehicle);
  }
}

export function crashSocietyTrafficVehicle(id: string, awayX: number, awayZ: number, impactSpeed: number) {
  const vehicle = SOCIETY_TRAFFIC_VEHICLES.find((candidate) => candidate.id === id);
  if (!vehicle || vehicle.crashTimer > 0) return;
  vehicle.crashTimer = 2.4;
  vehicle.velocityX = awayX * (2.5 + Math.min(impactSpeed, 22) * 0.24);
  vehicle.velocityZ = awayZ * (2.5 + Math.min(impactSpeed, 22) * 0.24);
  vehicle.roll = id.charCodeAt(id.length - 1) % 2 === 0 ? 0.5 : -0.5;
}
