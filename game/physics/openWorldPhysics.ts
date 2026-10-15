import type { ControllerControls } from "@/game/input/ControllerInputSource";
import { createRacingSimulation, type RacingSimulation } from "./racingPhysics";
import { SOCIETY_LIMIT, SOCIETY_OBSTACLES, SOCIETY_ROADS, SOCIETY_START, type SocietyRoad } from "@/game/world/societyLayout";

const CAR_HALF_WIDTH = 0.9;
const CAR_HALF_LENGTH = 1.75;

export function createOpenWorldSimulation(): RacingSimulation {
  return {
    ...createRacingSimulation(),
    ...SOCIETY_START,
  };
}

function overlapsObstacle(x: number, z: number, yaw: number) {
  if (Math.abs(x) > SOCIETY_LIMIT || Math.abs(z) > SOCIETY_LIMIT) return true;

  const halfX = Math.abs(Math.sin(yaw)) * CAR_HALF_LENGTH + Math.abs(Math.cos(yaw)) * CAR_HALF_WIDTH;
  const halfZ = Math.abs(Math.cos(yaw)) * CAR_HALF_LENGTH + Math.abs(Math.sin(yaw)) * CAR_HALF_WIDTH;
  return SOCIETY_OBSTACLES.some((obstacle) =>
    Math.abs(x - obstacle.x) < halfX + obstacle.width / 2
    && Math.abs(z - obstacle.z) < halfZ + obstacle.depth / 2,
  );
}

export function recoverOpenWorldSimulation(simulation: RacingSimulation, roads: readonly SocietyRoad[] = SOCIETY_ROADS) {
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

export function stepOpenWorldSimulation(simulation: RacingSimulation, controls: ControllerControls, delta: number) {
  const dt = Math.min(delta, 1 / 30);
  const boosting = controls.action1 && simulation.nitro > 0;
  const maxSpeed = boosting ? 42 : 32;
  const reverseSpeed = 10;

  simulation.collided = false;
  simulation.elapsed += dt;
  simulation.speed += controls.throttle * (boosting ? 19 : 13) * dt;
  if (controls.brake > 0) {
    if (simulation.speed > 0.35) simulation.speed = Math.max(0, simulation.speed - 25 * dt);
    else simulation.speed = Math.max(-reverseSpeed, simulation.speed - 9 * dt);
  } else {
    simulation.speed -= Math.sign(simulation.speed) * 2.2 * dt;
  }
  simulation.speed = Math.max(-reverseSpeed, Math.min(maxSpeed, simulation.speed));

  const direction = simulation.speed < 0 ? -1 : 1;
  const steering = Math.min(1, Math.abs(simulation.speed) / 4);
  simulation.yaw -= controls.steering * 1.65 * steering * direction * (controls.action2 ? 1.35 : 1) * dt;

  if (boosting) simulation.nitro = Math.max(0, simulation.nitro - 24 * dt);
  else simulation.nitro = Math.min(100, simulation.nitro + 7 * dt);

  const moveX = Math.sin(simulation.yaw) * simulation.speed * dt;
  const moveZ = Math.cos(simulation.yaw) * simulation.speed * dt;
  const samples = Math.max(1, Math.ceil(Math.max(Math.abs(moveX), Math.abs(moveZ)) / 0.35));
  let movedX = false;
  let movedZ = false;

  for (let sample = 0; sample < samples; sample += 1) {
    const nextX = simulation.x + moveX / samples;
    if (overlapsObstacle(nextX, simulation.z, simulation.yaw)) simulation.collided = true;
    else {
      simulation.x = nextX;
      movedX = true;
    }

    const nextZ = simulation.z + moveZ / samples;
    if (overlapsObstacle(simulation.x, nextZ, simulation.yaw)) simulation.collided = true;
    else {
      simulation.z = nextZ;
      movedZ = true;
    }
  }

  if (simulation.collided) simulation.speed *= movedX || movedZ ? 0.7 : 0.35;
  simulation.currentLapTime += dt;
  simulation.wrongWay = false;

  return { finished: false, lapCompleted: false, lapTime: 0 };
}

export function isOpenWorldCameraClear(x: number, z: number) {
  const clearance = 0.48;
  if (Math.abs(x) > SOCIETY_LIMIT || Math.abs(z) > SOCIETY_LIMIT) return false;
  return SOCIETY_OBSTACLES.every((obstacle) =>
    Math.abs(x - obstacle.x) >= obstacle.width / 2 + clearance
    || Math.abs(z - obstacle.z) >= obstacle.depth / 2 + clearance,
  );
}