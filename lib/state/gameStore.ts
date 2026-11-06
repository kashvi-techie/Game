import { create } from "zustand";

export type GamePhase = "menu" | "racing" | "exploring" | "paused" | "finished";
export type WorldMode = "circuit" | "society";
export type CameraPreset = "close" | "standard" | "far";
export type Gear = "D" | "R" | "N";
export type FlightTelemetry = {
  altitude: number;
  throttle: number;
  heading: number;
  pitch: number;
  roll: number;
  gearDown: boolean;
  grounded: boolean;
  crashed: boolean;
};

type GameStore = {
  phase: GamePhase;
  worldMode: WorldMode;
  aircraftMode: boolean;
  cameraPreset: CameraPreset;
  cameraToast: string | null;
  speed: number;
  gear: Gear;
  lap: number;
  elapsed: number;
  nitro: number;
  currentLapTime: number;
  bestLapTime: number;
  lapTimes: number[];
  lapProgress: number;
  collided: boolean;
  wrongWay: boolean;
  flightTelemetry: FlightTelemetry;
  resetToken: number;
  startRace: () => void;
  startExploration: () => void;
  setWorldMode: (mode: WorldMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  cycleCameraPreset: () => void;
  setAircraftMode: (active: boolean) => void;
  updateFlightTelemetry: (telemetry: FlightTelemetry, speed: number) => void;
  clearCameraToast: () => void;
  pauseRace: () => void;
  resumeRace: () => void;
  resumeExploration: () => void;
  returnToMenu: () => void;
  restartRace: () => void;
  finishRace: () => void;
  updateTelemetry: (
    speed: number,
    lap: number,
    elapsed: number,
    nitro: number,
    currentLapTime: number,
    lapProgress: number,
    collided: boolean,
    wrongWay: boolean,
    gear?: Gear,
  ) => void;
  recordLap: (lapTime: number) => void;
};

const resetTelemetry = {
  speed: 0,
  gear: "N" as Gear,
  lap: 1,
  elapsed: 0,
  nitro: 100,
  currentLapTime: 0,
  bestLapTime: Infinity,
  lapTimes: [],
  lapProgress: 0,
  collided: false,
  wrongWay: false,
  flightTelemetry: {
    altitude: 0,
    throttle: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    gearDown: true,
    grounded: true,
    crashed: false,
  },
};

const CAMERA_CYCLE: Record<CameraPreset, CameraPreset> = {
  close: "standard",
  standard: "far",
  far: "close",
};

export const useGameStore = create<GameStore>((set) => ({
  phase: "menu",
  worldMode: "circuit",
  aircraftMode: false,
  cameraPreset: "standard",
  cameraToast: null,
  ...resetTelemetry,
  resetToken: 0,
  startRace: () => set((state) => ({ phase: "racing", worldMode: "circuit", aircraftMode: false, ...resetTelemetry, resetToken: state.resetToken + 1 })),
  startExploration: () => set((state) => ({ phase: "exploring", worldMode: "society", aircraftMode: false, ...resetTelemetry, resetToken: state.resetToken + 1 })),
  setWorldMode: (worldMode) => set((state) => ({ worldMode, aircraftMode: false, resetToken: state.resetToken + 1 })),
  setCameraPreset: (cameraPreset) => set({ cameraPreset, cameraToast: `VIEW: ${cameraPreset.toUpperCase()}` }),
  cycleCameraPreset: () => set((state) => {
    const next = CAMERA_CYCLE[state.cameraPreset];
    return { cameraPreset: next, cameraToast: `VIEW: ${next.toUpperCase()}` };
  }),
  setAircraftMode: (aircraftMode) => set({ aircraftMode }),
  updateFlightTelemetry: (flightTelemetry, speed) => set({
    flightTelemetry,
    speed: Math.max(0, speed),
    gear: "D",
  }),
  clearCameraToast: () => set({ cameraToast: null }),
  pauseRace: () => set({ phase: "paused" }),
  resumeRace: () => set({ phase: "racing" }),
  resumeExploration: () => set({ phase: "exploring" }),
  returnToMenu: () => set((state) => ({ phase: "menu", aircraftMode: false, ...resetTelemetry, resetToken: state.resetToken + 1 })),
  restartRace: () => set((state) => ({ phase: "racing", worldMode: "circuit", aircraftMode: false, ...resetTelemetry, resetToken: state.resetToken + 1 })),
  finishRace: () => set({ phase: "finished", speed: 0, gear: "N" }),
  updateTelemetry: (speed, lap, elapsed, nitro, currentLapTime, lapProgress, collided, wrongWay, gear) => set({
    speed: Math.max(0, speed),
    gear: gear ?? (speed > 0.3 ? "D" : "N"),
    lap,
    elapsed,
    nitro,
    currentLapTime,
    lapProgress,
    collided,
    wrongWay,
  }),
  recordLap: (lapTime) => set((state) => ({
    lapTimes: [...state.lapTimes, lapTime],
    bestLapTime: state.bestLapTime === Infinity ? lapTime : Math.min(state.bestLapTime, lapTime),
    currentLapTime: 0,
  })),
}));
