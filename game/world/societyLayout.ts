export type RoadAxis = "x" | "z";

export type SocietyRoad = {
  id: string;
  x: number;
  z: number;
  width: number;
  length: number;
  axis: RoadAxis;
};

export type SocietyBuilding = {
  id: string;
  kind: "tower" | "home" | "shop" | "clubhouse" | "security";
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  floors: number;
  color: string;
};

export type SocietyWall = {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
};

export type SocietyTree = { x: number; z: number; scale: number };
export type SocietyParking = { x: number; z: number; width: number; depth: number };

export const SOCIETY_LIMIT = 244;
export const SOCIETY_ROADS: SocietyRoad[] = [
  { id: "perimeter-north", axis: "x", x: 0, z: -118, width: 16, length: 236 },
  { id: "perimeter-south", axis: "x", x: 0, z: 118, width: 16, length: 236 },
  { id: "perimeter-west", axis: "z", x: -118, z: 0, width: 16, length: 236 },
  { id: "perimeter-east", axis: "z", x: 118, z: 0, width: 16, length: 236 },
  { id: "central-spine", axis: "z", x: 0, z: 0, width: 18, length: 236 },
  { id: "west-avenue", axis: "z", x: -58, z: 0, width: 13, length: 236 },
  { id: "east-avenue", axis: "z", x: 58, z: 0, width: 13, length: 236 },
  { id: "central-roundabout-street", axis: "x", x: 0, z: 0, width: 14, length: 124 },
  { id: "north-cross-street", axis: "x", x: 0, z: -58, width: 13, length: 236 },
  { id: "south-cross-street", axis: "x", x: 0, z: 58, width: 13, length: 236 },
  { id: "south-entry", axis: "z", x: 0, z: 143, width: 18, length: 50 },
  { id: "east-exit", axis: "x", x: 145, z: 0, width: 18, length: 54 },
  { id: "outer-east-link", axis: "x", x: 194, z: 0, width: 20, length: 78 },
  { id: "outer-east-boulevard", axis: "z", x: 228, z: 0, width: 20, length: 236 },
  { id: "outer-south-link", axis: "z", x: 0, z: 194, width: 20, length: 78 },
  { id: "outer-south-boulevard", axis: "x", x: 0, z: 228, width: 20, length: 236 },
];

export const SOCIETY_BUILDINGS: SocietyBuilding[] = [
  { id: "cedar-tower", kind: "tower", x: -88, z: -87, width: 36, depth: 31, height: 54, floors: 14, color: "#758786" },
  { id: "maple-tower", kind: "tower", x: 87, z: -87, width: 36, depth: 31, height: 61, floors: 16, color: "#8a9389" },
  { id: "garden-tower", kind: "tower", x: -88, z: 0, width: 34, depth: 34, height: 46, floors: 12, color: "#a39b86" },
  { id: "willow-home-1", kind: "home", x: -48, z: -88, width: 18, depth: 22, height: 11, floors: 2, color: "#b9ad91" },
  { id: "willow-home-2", kind: "home", x: -24, z: -88, width: 18, depth: 22, height: 12, floors: 2, color: "#9eaa9d" },
  { id: "willow-home-3", kind: "home", x: 30, z: -88, width: 18, depth: 22, height: 10, floors: 2, color: "#c0b294" },
  { id: "elm-home-1", kind: "home", x: -48, z: 87, width: 18, depth: 21, height: 11, floors: 2, color: "#9b9c88" },
  { id: "elm-home-2", kind: "home", x: -21, z: 87, width: 18, depth: 21, height: 12, floors: 2, color: "#c1b394" },
  { id: "elm-home-3", kind: "home", x: 29, z: 87, width: 18, depth: 21, height: 10, floors: 2, color: "#9baba0" },
  { id: "market-row", kind: "shop", x: -88, z: 87, width: 36, depth: 28, height: 12, floors: 2, color: "#a99478" },
  { id: "clubhouse", kind: "clubhouse", x: 87, z: 83, width: 38, depth: 28, height: 14, floors: 2, color: "#b3a486" },
  { id: "security-west", kind: "security", x: -16, z: 119, width: 10, depth: 8, height: 5, floors: 1, color: "#a5aa9a" },
  { id: "security-east", kind: "security", x: 16, z: 119, width: 10, depth: 8, height: 5, floors: 1, color: "#a5aa9a" },
];

export const SOCIETY_WALLS: SocietyWall[] = [
  { id: "wall-north", x: 0, z: -140, width: 280, depth: 2, height: 3.2 },
  { id: "wall-west", x: -140, z: 0, width: 2, depth: 280, height: 3.2 },
  { id: "wall-east-upper", x: 140, z: -75, width: 2, depth: 130, height: 3.2 },
  { id: "wall-east-lower", x: 140, z: 75, width: 2, depth: 130, height: 3.2 },
  { id: "wall-south-west", x: -74.5, z: 140, width: 131, depth: 2, height: 3.2 },
  { id: "wall-south-east", x: 74.5, z: 140, width: 131, depth: 2, height: 3.2 },
];

export const SOCIETY_TREES: SocietyTree[] = [
  ...Array.from({ length: 12 }, (_, index) => ({ x: 15 + (index % 4) * 10, z: -47 + Math.floor(index / 4) * 11, scale: 0.88 + (index % 3) * 0.1 })),
  ...Array.from({ length: 8 }, (_, index) => ({ x: -110 + (index % 2) * 43, z: -42 + Math.floor(index / 2) * 27, scale: 0.82 + (index % 4) * 0.1 })),
  ...Array.from({ length: 8 }, (_, index) => ({ x: 72 + (index % 2) * 34, z: 62 + Math.floor(index / 2) * 19, scale: 0.78 + (index % 3) * 0.11 })),
];

export const SOCIETY_PARKING: SocietyParking[] = [
  { x: -88, z: 49, width: 34, depth: 12 },
  { x: -88, z: -36, width: 34, depth: 12 },
  { x: 87, z: -53, width: 34, depth: 12 },
];

export const SOCIETY_SPORTS_COURT = { x: -88, z: 30, width: 34, depth: 24 };
export const SOCIETY_POOL = { x: 87, z: 37, width: 22, depth: 13 };

export const SOCIETY_OBSTACLES = [
  ...SOCIETY_BUILDINGS.map(({ id, x, z, width, depth }) => ({ id, x, z, width, depth })),
  ...SOCIETY_WALLS.map(({ id, x, z, width, depth }) => ({ id, x, z, width, depth })),
  ...SOCIETY_TREES.map(({ x, z, scale }, index) => ({ id: `tree-${index}`, x, z, width: scale * 1.5, depth: scale * 1.5 })),
  { id: "pool", x: SOCIETY_POOL.x, z: SOCIETY_POOL.z, width: SOCIETY_POOL.width + 5, depth: SOCIETY_POOL.depth + 5 },
  { id: "sports-court", ...SOCIETY_SPORTS_COURT },
];

export const SOCIETY_START = { x: 0, z: 132, yaw: Math.PI };