import { create } from "zustand";

export type GamePhase = "menu" | "racing" | "exploring" | "paused" | "finished";
export type WorldMode = "circuit" | "society";

type GameStore = {
  phase: GamePhase;
  worldMode: WorldMode;
  speed: number;
  lap: number;
  elapsed: number;
  nitro: number;
  currentLapTime: number;
  bestLapTime: number;
  lapTimes: number[];
  lapProgress: number;
  collided: boolean;
  wrongWay: boolean;
  resetToken: number;
  startRace: () => void;
  startExploration: () => void;
  setWorldMode: (mode: WorldMode) => void;
  pauseRace: () => void;
  resumeRace: () => void;
  resumeExploration: () => void;
  returnToMenu: () => void;
  restartRace: () => void;
  finishRace: () => void;
  updateTelemetry: (speed: number, lap: number, elapsed: number, nitro: number, currentLapTime: number, lapProgress: number, collided: boolean, wrongWay: boolean) => void;
  recordLap: (lapTime: number) => void;
};

const resetTelemetry = { speed: 0, lap: 1, elapsed: 0, nitro: 100, currentLapTime: 0, bestLapTime: Infinity, lapTimes: [], lapProgress: 0, collided: false, wrongWay: false };

export const useGameStore = create<GameStore>((set) => ({
  phase: "menu",
  worldMode: "circuit",
  ...resetTelemetry,
  resetToken: 0,
  startRace: () => set((state) => ({ phase: "racing", worldMode: "circuit", ...resetTelemetry, resetToken: state.resetToken + 1 })),
  startExploration: () => set((state) => ({ phase: "exploring", worldMode: "society", ...resetTelemetry, resetToken: state.resetToken + 1 })),
  setWorldMode: (worldMode) => set((state) => ({ worldMode, resetToken: state.resetToken + 1 })),
  pauseRace: () => set({ phase: "paused" }),
  resumeRace: () => set({ phase: "racing" }),
  resumeExploration: () => set({ phase: "exploring" }),
  returnToMenu: () => set((state) => ({ phase: "menu", ...resetTelemetry, resetToken: state.resetToken + 1 })),
  restartRace: () => set((state) => ({ phase: "racing", worldMode: "circuit", ...resetTelemetry, resetToken: state.resetToken + 1 })),
  finishRace: () => set({ phase: "finished", speed: 0 }),
  updateTelemetry: (speed, lap, elapsed, nitro, currentLapTime, lapProgress, collided, wrongWay) => set({ speed, lap, elapsed, nitro, currentLapTime, lapProgress, collided, wrongWay }),
  recordLap: (lapTime) => set((state) => ({
    lapTimes: [...state.lapTimes, lapTime],
    bestLapTime: state.bestLapTime === Infinity ? lapTime : Math.min(state.bestLapTime, lapTime),
    currentLapTime: 0,
  })),
}));