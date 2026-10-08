import type { ControllerControls } from "../input/ControllerInputSource";

export const TRACK_RADIUS_X = 32;
export const TRACK_RADIUS_Z = 50;
export const TRACK_HALF_WIDTH = 7;
export const RACE_LAPS = 3;
const TAU = Math.PI * 2;

export type RacingSimulation = {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  elapsed: number;
  lap: number;
  lapProgress: number;
  previousAngle: number;
  nitro: number;
  collided: boolean;
  currentLapTime: number;
};

export function createRacingSimulation(): RacingSimulation {
  return {
    x: 0,
    z: -TRACK_RADIUS_Z,
    yaw: Math.PI / 2,
    speed: 0,
    elapsed: 0,
    lap: 1,
    lapProgress: 0,
    previousAngle: 0,
    nitro: 100,
    collided: false,
    currentLapTime: 0,
  };
}

export function stepRacingSimulation(simulation: RacingSimulation, controls: ControllerControls, delta: number) {
  const dt = Math.min(delta, 1 / 30);
  const boosting = controls.action1 && simulation.nitro > 0;
  const maxSpeed = boosting ? 47 : 36;

  simulation.collided = false;
  simulation.elapsed += dt;
  simulation.currentLapTime += dt;
  simulation.speed += controls.throttle * (boosting ? 23 : 15) * dt;
  simulation.speed -= controls.brake * 26 * dt;
  simulation.speed -= (controls.throttle > 0 ? 1.1 : 3.2) * dt;
  simulation.speed = Math.max(0, Math.min(maxSpeed, simulation.speed));

  const steeringAuthority = Math.min(1, simulation.speed / 5);
  const handbrakeFactor = controls.action2 ? 1.45 : 1;
  simulation.yaw -= controls.steering * 1.9 * steeringAuthority * handbrakeFactor * dt;
  simulation.x += Math.sin(simulation.yaw) * simulation.speed * dt;
  simulation.z += Math.cos(simulation.yaw) * simulation.speed * dt;

  if (boosting) {
    simulation.nitro = Math.max(0, simulation.nitro - 28 * dt);
  } else {
    simulation.nitro = Math.min(100, simulation.nitro + 8 * dt);
  }

  const angle = (Math.atan2(simulation.x / TRACK_RADIUS_X, -simulation.z / TRACK_RADIUS_Z) + TAU) % TAU;
  let angleDelta = angle - simulation.previousAngle;
  if (angleDelta > Math.PI) angleDelta -= TAU;
  if (angleDelta < -Math.PI) angleDelta += TAU;
  let lapCompleted = false;
  if (angleDelta > 0 && simulation.speed > 1) {
    simulation.lapProgress += angleDelta;
    if (simulation.lapProgress >= TAU) {
      simulation.lapProgress -= TAU;
      simulation.lap += 1;
      lapCompleted = true;
    }
  }
  simulation.previousAngle = angle;

  const centerX = TRACK_RADIUS_X * Math.sin(angle);
  const centerZ = -TRACK_RADIUS_Z * Math.cos(angle);
  const tangentX = TRACK_RADIUS_X * Math.cos(angle);
  const tangentZ = TRACK_RADIUS_Z * Math.sin(angle);
  const tangentLength = Math.hypot(tangentX, tangentZ);
  const normalX = tangentZ / tangentLength;
  const normalZ = -tangentX / tangentLength;
  const lateralOffset = (simulation.x - centerX) * normalX + (simulation.z - centerZ) * normalZ;
  const maxOffset = TRACK_HALF_WIDTH - 0.9;

  if (Math.abs(lateralOffset) > maxOffset) {
    const correction = (Math.abs(lateralOffset) - maxOffset) * Math.sign(lateralOffset);
    simulation.x -= normalX * correction;
    simulation.z -= normalZ * correction;
    simulation.speed *= 0.58;
    simulation.collided = true;
  }

  return { finished: simulation.lap > RACE_LAPS, lapCompleted, lapTime: simulation.currentLapTime };
}