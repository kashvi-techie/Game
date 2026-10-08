import { create } from "zustand";

export type GamePhase = "menu" | "racing" | "paused" | "finished";

type GameStore = {
  phase: GamePhase;
  speed: number;
  lap: number;
  elapsed: number;
  nitro: number;
  currentLapTime: number;
  bestLapTime: number;
  lapTimes: number[];
  lapProgress: number;
  collided: boolean;
  resetToken: number;
  startRace: () => void;
  pauseRace: () => void;
  resumeRace: () => void;
  returnToMenu: () => void;
  restartRace: () => void;
  finishRace: () => void;
  updateTelemetry: (speed: number, lap: number, elapsed: number, nitro: number, currentLapTime: number, lapProgress: number, collided: boolean) => void;
  recordLap: (lapTime: number) => void;
};

const resetTelemetry = { speed: 0, lap: 1, elapsed: 0, nitro: 100, currentLapTime: 0, bestLapTime: Infinity, lapTimes: [], lapProgress: 0, collided: false };

export const useGameStore = create<GameStore>((set) => ({
  phase: "menu",
  ...resetTelemetry,
  resetToken: 0,
  startRace: () => set((state) => ({ phase: "racing", ...resetTelemetry, resetToken: state.resetToken + 1 })),
  pauseRace: () => set({ phase: "paused" }),
  resumeRace: () => set({ phase: "racing" }),
  returnToMenu: () => set((state) => ({ phase: "menu", ...resetTelemetry, resetToken: state.resetToken + 1 })),
  restartRace: () => set((state) => ({ phase: "racing", ...resetTelemetry, resetToken: state.resetToken + 1 })),
  finishRace: () => set({ phase: "finished", speed: 0 }),
  updateTelemetry: (speed, lap, elapsed, nitro, currentLapTime, lapProgress) => set({ speed, lap, elapsed, nitro, currentLapTime, lapProgress }),
  recordLap: (lapTime) => set((state) => ({
    lapTimes: [...state.lapTimes, lapTime],
    bestLapTime: state.bestLapTime === Infinity ? lapTime : Math.min(state.bestLapTime, lapTime),
    currentLapTime: 0,
  })),
}));