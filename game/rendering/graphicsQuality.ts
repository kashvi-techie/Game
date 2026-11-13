export type GraphicsQuality = "low" | "medium" | "high" | "ultra";

export type GraphicsPreset = {
  label: string;
  pixelRatioCap: number;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  shadowExtent: number;
  cameraFar: number;
  fogNear: number;
  fogFar: number;
};

// Renderer budgets are centralized here so the UI and R3F scene use the same
// settings. These are starting presets; the benchmark still needs to validate
// them on target hardware.
export const GRAPHICS_QUALITY_PRESETS: Record<GraphicsQuality, GraphicsPreset> = {
  low: {
    label: "LOW",
    pixelRatioCap: 1,
    shadowsEnabled: false,
    shadowMapSize: 512,
    shadowExtent: 130,
    cameraFar: 900,
    fogNear: 550,
    fogFar: 800,
  },
  medium: {
    label: "MEDIUM",
    pixelRatioCap: 1.25,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    shadowExtent: 150,
    cameraFar: 1300,
    fogNear: 850,
    fogFar: 1150,
  },
  high: {
    label: "HIGH",
    pixelRatioCap: 1.5,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    shadowExtent: 180,
    cameraFar: 1700,
    fogNear: 1150,
    fogFar: 1550,
  },
  ultra: {
    label: "ULTRA",
    pixelRatioCap: 1.75,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    shadowExtent: 220,
    cameraFar: 2200,
    fogNear: 1500,
    fogFar: 2000,
  },
};
