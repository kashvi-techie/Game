export type RoadAxis = "x" | "z";

export type SocietyRoad = {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  length: number;
  axis: RoadAxis;
};

export type SocietyRoadClosure = {
  id: string;
  roadId: string;
  x: number;
  z: number;
  roadAxis: RoadAxis;
  roadWidth: number;
  facingYaw: number;
};

export type SocietyWorldBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type SocietyDistrictId =
  | "cedar-grove"
  | "downtown"
  | "west-residential"
  | "industrial"
  | "mountains"
  | "beaches"
  | "port"
  | "airport";

export type SocietyDistrict = {
  id: SocietyDistrictId;
  name: string;
  bounds: SocietyWorldBounds;
  character: "neighborhood" | "urban" | "industrial" | "natural" | "coastal" | "aviation";
};

export type SocietyRoadConnection = {
  id: string;
  x: number;
  z: number;
  roadIds: string[];
  districtId: SocietyDistrictId;
};

export type SocietyLandmark = {
  id: string;
  name: string;
  districtId: SocietyDistrictId;
  kind: "tower" | "house" | "warehouse" | "terminal" | "hangar" | "mountain" | "runway" | "beach" | "harbor-water" | "port-crane";
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  collidable?: boolean;
};

export type SocietyIntersection = {
  id: string;
  x: number;
  z: number;
  widthX: number; // width of E-W road
  widthZ: number; // width of N-S road
  crosswalks?: boolean;
};

export type SocietyBuilding = {
  id: string;
  name: string;
  kind: "tower" | "villa" | "shop" | "clubhouse" | "security";
  zone: "residential" | "recreation" | "green" | "market" | "community" | "entrance";
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  floors: number;
  color: string;
  accentColor: string;
  roofType?: "flat" | "parapet" | "penthouse" | "gabled";
};

export type SocietyWall = {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
};

export type SocietyTree = {
  id: string;
  x: number;
  z: number;
  scale: number;
  kind?: "pine" | "deciduous" | "palm";
};

export type SocietyParking = {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  stalls: number;
  axis: RoadAxis;
};

export type SocietyParkedCar = {
  id: string;
  x: number;
  z: number;
  yaw: number;
  color: string;
};

export type SocietyTennisCourt = {
  x: number;
  z: number;
  courtWidth: number; // in X
  courtDepth: number; // in Z
  fenceWidth: number;
  fenceDepth: number;
  fenceHeight: number;
  netLength: number;
};

export type SocietyPark = {
  x: number;
  z: number;
  width: number;
  depth: number;
};

export type PedestrianWaypoint = { x: number; z: number };
export type PedestrianRoute = {
  id: string;
  name: string;
  loop: boolean;
  waypoints: PedestrianWaypoint[];
};

export type PedestrianNPC = {
  id: string;
  name: string;
  routeId: string;
  initialProgress: number; // 0 to 1
  speed: number;
  shirtColor: string;
  pantsColor: string;
  hairColor: string;
};

// -------------------------------------------------------------
// GLOBAL DIMENSIONS & CONSTANTS
// -------------------------------------------------------------
export const SOCIETY_WORLD_BOUNDS: SocietyWorldBounds = {
  minX: -1536,
  maxX: 1536,
  minZ: -1536,
  maxZ: 1536,
};

// Kept as a compatibility alias for existing systems which use a symmetric bound.
export const SOCIETY_LIMIT = Math.max(
  Math.abs(SOCIETY_WORLD_BOUNDS.minX),
  Math.abs(SOCIETY_WORLD_BOUNDS.maxX),
  Math.abs(SOCIETY_WORLD_BOUNDS.minZ),
  Math.abs(SOCIETY_WORLD_BOUNDS.maxZ),
);

export const SOCIETY_DISTRICTS: SocietyDistrict[] = [
  { id: "cedar-grove", name: "Cedar Grove", bounds: { minX: -150, maxX: 150, minZ: -150, maxZ: 150 }, character: "neighborhood" },
  { id: "downtown", name: "Downtown", bounds: { minX: -450, maxX: 350, minZ: 250, maxZ: 850 }, character: "urban" },
  { id: "west-residential", name: "West Residential", bounds: { minX: -1150, maxX: -250, minZ: -350, maxZ: 600 }, character: "neighborhood" },
  { id: "industrial", name: "Industrial District", bounds: { minX: 350, maxX: 850, minZ: 700, maxZ: 1200 }, character: "industrial" },
  { id: "mountains", name: "Northwest Range", bounds: { minX: -1350, maxX: -250, minZ: -1430, maxZ: -700 }, character: "natural" },
  { id: "beaches", name: "East Coast Beaches", bounds: { minX: 1050, maxX: 1450, minZ: -250, maxZ: 650 }, character: "coastal" },
  { id: "port", name: "Harbor Port", bounds: { minX: 850, maxX: 1450, minZ: 700, maxZ: 1320 }, character: "industrial" },
  { id: "airport", name: "Coastal Airport", bounds: { minX: 250, maxX: 1250, minZ: -1200, maxZ: -450 }, character: "aviation" },
];

export const MAIN_AVENUE_WIDTH = 14;      // Central Spine
export const SECONDARY_ROAD_WIDTH = 12;   // All cross streets & side avenues
export const SIDEWALK_WIDTH = 2.4;
export const CURB_WIDTH = 0.22;

// -------------------------------------------------------------
// ROAD NETWORK
// -------------------------------------------------------------
export const SOCIETY_ROADS: SocietyRoad[] = [
  // Central North-South Spine (Through main gate at Z = -134 to South Perimeter Z = 118)
  { id: "central-spine-north", name: "CENTRAL AVENUE N", axis: "z", x: 0, z: -67, width: MAIN_AVENUE_WIDTH, length: 134 },
  { id: "central-spine-south", name: "CENTRAL AVENUE S", axis: "z", x: 0, z: 59, width: MAIN_AVENUE_WIDTH, length: 118 },

  // Secondary North-South Boulevards
  { id: "west-boulevard", name: "WEST BOULEVARD", axis: "z", x: -62, z: 0, width: SECONDARY_ROAD_WIDTH, length: 236 },
  { id: "east-boulevard", name: "EAST BOULEVARD", axis: "z", x: 62, z: 0, width: SECONDARY_ROAD_WIDTH, length: 236 },

  // Outer Perimeter North-South Roads
  { id: "perimeter-west", name: "WEST PERIMETER DRIVE", axis: "z", x: -118, z: 0, width: SECONDARY_ROAD_WIDTH, length: 236 },
  { id: "perimeter-east", name: "EAST PERIMETER DRIVE", axis: "z", x: 118, z: 0, width: SECONDARY_ROAD_WIDTH, length: 236 },

  // Outer Perimeter East-West Roads
  { id: "perimeter-north", name: "NORTH PERIMETER DRIVE", axis: "x", x: 0, z: -118, width: SECONDARY_ROAD_WIDTH, length: 236 },
  { id: "perimeter-south", name: "SOUTH PERIMETER DRIVE", axis: "x", x: 0, z: 118, width: SECONDARY_ROAD_WIDTH, length: 236 },

  // Internal East-West Cross Streets
  { id: "north-cross-street", name: "NORTH CROSS STREET", axis: "x", x: 0, z: -58, width: SECONDARY_ROAD_WIDTH, length: 236 },
  { id: "central-cross-west", name: "CENTRAL STREET W", axis: "x", x: -62, z: 0, width: SECONDARY_ROAD_WIDTH, length: 112 },
  { id: "central-cross-east", name: "CENTRAL STREET E", axis: "x", x: 62, z: 0, width: SECONDARY_ROAD_WIDTH, length: 112 },
  { id: "south-cross-street", name: "SOUTH CROSS STREET", axis: "x", x: 0, z: 58, width: SECONDARY_ROAD_WIDTH, length: 236 },

  // Expansion roads: Cedar Grove stays unchanged; these extend from its north
  // entrance and southern avenue into the first neighboring districts.
  { id: "north-city-approach", name: "NORTH CITY APPROACH", axis: "z", x: 0, z: -267, width: 18, length: 266 },
  { id: "west-residential-link", name: "WEST RESIDENTIAL LINK", axis: "x", x: -450, z: -400, width: 18, length: 900 },
  { id: "west-residential-avenue", name: "WEST RESIDENTIAL AVENUE", axis: "z", x: -900, z: 50, width: 16, length: 900 },
  { id: "airport-east-connector", name: "AIRPORT PARKWAY", axis: "x", x: 420, z: -400, width: 20, length: 840 },
  { id: "airport-north-approach", name: "AIRPORT NORTH APPROACH", axis: "z", x: 840, z: -650, width: 18, length: 500 },
  { id: "airport-terminal-access", name: "AIRPORT TERMINAL ACCESS", axis: "x", x: 900, z: -580, width: 12, length: 120 },
  { id: "airport-runway-service", name: "AIRPORT RUNWAY SERVICE", axis: "x", x: 960, z: -900, width: 12, length: 240 },
  { id: "central-downtown-extension", name: "CENTRAL AVENUE SOUTH", axis: "z", x: 0, z: 389, width: 18, length: 542 },
  { id: "west-downtown-connector", name: "WEST DOWNTOWN CONNECTOR", axis: "x", x: -450, z: 400, width: 14, length: 900 },
  { id: "harbor-freight-east", name: "HARBOR FREIGHT ROAD", axis: "x", x: 550, z: 660, width: 20, length: 1100 },
  { id: "industrial-collector", name: "INDUSTRIAL COLLECTOR", axis: "z", x: 500, z: 805, width: 16, length: 290 },
  { id: "industry-port-connector", name: "PORT SERVICE ROAD", axis: "x", x: 800, z: 950, width: 16, length: 600 },
  { id: "port-access-road", name: "PORT ACCESS ROAD", axis: "z", x: 1100, z: 960, width: 16, length: 600 },
  { id: "coastal-avenue", name: "EAST COAST ROAD", axis: "z", x: 1200, z: 200, width: 14, length: 1000 },
  { id: "coastal-port-link", name: "COASTAL PORT LINK", axis: "x", x: 1150, z: 700, width: 14, length: 100 },
];

export const SOCIETY_ROAD_CONNECTIONS: SocietyRoadConnection[] = [
  { id: "north-gate", x: 0, z: -134, roadIds: ["central-spine-north", "north-city-approach"], districtId: "cedar-grove" },
  { id: "north-west-arterial", x: 0, z: -400, roadIds: ["north-city-approach", "west-residential-link", "airport-east-connector"], districtId: "west-residential" },
  { id: "west-residential-north", x: -900, z: -400, roadIds: ["west-residential-link", "west-residential-avenue"], districtId: "west-residential" },
  { id: "west-residential-south", x: -900, z: 400, roadIds: ["west-residential-avenue", "west-downtown-connector"], districtId: "west-residential" },
  { id: "downtown-west-junction", x: 0, z: 400, roadIds: ["west-downtown-connector", "central-downtown-extension"], districtId: "downtown" },
  { id: "airport-junction", x: 840, z: -400, roadIds: ["airport-east-connector", "airport-north-approach"], districtId: "airport" },
  { id: "airport-terminal-junction", x: 840, z: -580, roadIds: ["airport-north-approach", "airport-terminal-access"], districtId: "airport" },
  { id: "airport-runway-junction", x: 840, z: -900, roadIds: ["airport-north-approach", "airport-runway-service"], districtId: "airport" },
  { id: "cedar-south-gate", x: 0, z: 118, roadIds: ["central-spine-south", "central-downtown-extension"], districtId: "cedar-grove" },
  { id: "downtown-freight-junction", x: 0, z: 660, roadIds: ["central-downtown-extension", "harbor-freight-east"], districtId: "downtown" },
  { id: "industry-north", x: 500, z: 660, roadIds: ["harbor-freight-east", "industrial-collector"], districtId: "industrial" },
  { id: "industry-south", x: 500, z: 950, roadIds: ["industrial-collector", "industry-port-connector"], districtId: "industrial" },
  { id: "port-west", x: 1100, z: 950, roadIds: ["industry-port-connector", "port-access-road"], districtId: "port" },
  { id: "coastal-port-junction", x: 1200, z: 700, roadIds: ["coastal-avenue", "coastal-port-link"], districtId: "port" },
];

// These three exposed road ends lead directly into areas that are not part of
// the current release. Cedar Grove, the airport terminal, and runway access
// remain open and usable.
export const SOCIETY_ROAD_CLOSURES: SocietyRoadClosure[] = [
  { id: "closure-west-residential-south", roadId: "west-residential-avenue", x: -900, z: 500, roadAxis: "z", roadWidth: 16, facingYaw: Math.PI },
  { id: "closure-coastal-north", roadId: "coastal-avenue", x: 1200, z: -300, roadAxis: "z", roadWidth: 14, facingYaw: 0 },
  { id: "closure-port-north", roadId: "port-access-road", x: 1100, z: 1260, roadAxis: "z", roadWidth: 16, facingYaw: Math.PI },
];

// Coastline points run from the north-east shore toward the south-east bay.
// They define where the simple land base gives way to the ocean surface.
export const SOCIETY_COASTLINE = [
  { x: 1450, z: -420 },
  { x: 1390, z: -120 },
  { x: 1420, z: 240 },
  { x: 1380, z: 560 },
  { x: 1450, z: 760 },
  { x: 1390, z: 930 },
  { x: 1450, z: 1160 },
  { x: 1280, z: 1450 },
  { x: 900, z: 1536 },
];

export const SOCIETY_INTERSECTIONS: SocietyIntersection[] = [
  // North Perimeter Junctions
  { id: "int-nw", x: -118, z: -118, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: false },
  { id: "int-wb-n-perim", x: -62, z: -118, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: true },
  { id: "int-c-n-perim", x: 0, z: -118, widthX: SECONDARY_ROAD_WIDTH, widthZ: MAIN_AVENUE_WIDTH, crosswalks: true },
  { id: "int-eb-n-perim", x: 62, z: -118, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: true },
  { id: "int-ne", x: 118, z: -118, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: false },

  // North Cross Street (Z = -58) Junctions
  { id: "int-w-n", x: -118, z: -58, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: true },
  { id: "int-wb-n", x: -62, z: -58, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: true },
  { id: "int-c-n", x: 0, z: -58, widthX: SECONDARY_ROAD_WIDTH, widthZ: MAIN_AVENUE_WIDTH, crosswalks: true },
  { id: "int-eb-n", x: 62, z: -58, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: true },
  { id: "int-e-n", x: 118, z: -58, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: true },

  // Central Street (Z = 0) Junctions
  { id: "int-w-mid", x: -118, z: 0, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: true },
  { id: "int-wb-mid", x: -62, z: 0, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: true },
  // (0, 0) is the Central Roundabout
  { id: "int-eb-mid", x: 62, z: 0, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: true },
  { id: "int-e-mid", x: 118, z: 0, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: true },

  // South Cross Street (Z = 58) Junctions
  { id: "int-w-s", x: -118, z: 58, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: true },
  { id: "int-wb-s", x: -62, z: 58, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: true },
  { id: "int-c-s", x: 0, z: 58, widthX: SECONDARY_ROAD_WIDTH, widthZ: MAIN_AVENUE_WIDTH, crosswalks: true },
  { id: "int-eb-s", x: 62, z: 58, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: true },
  { id: "int-e-s", x: 118, z: 58, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: true },

  // South Perimeter Junctions
  { id: "int-sw", x: -118, z: 118, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: false },
  { id: "int-wb-s-perim", x: -62, z: 118, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: true },
  { id: "int-c-s-perim", x: 0, z: 118, widthX: SECONDARY_ROAD_WIDTH, widthZ: MAIN_AVENUE_WIDTH, crosswalks: true },
  { id: "int-eb-s-perim", x: 62, z: 118, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: true },
  { id: "int-se", x: 118, z: 118, widthX: SECONDARY_ROAD_WIDTH, widthZ: SECONDARY_ROAD_WIDTH, crosswalks: false },
];

export const SOCIETY_ROUNDABOUT = {
  x: 0,
  z: 0,
  radius: 6.2,
};

// -------------------------------------------------------------
// DEDICATED RECREATION ZONE (Plot NE4: Center X = 90, Z = -29)
// -------------------------------------------------------------
export const SOCIETY_TENNIS_COURT: SocietyTennisCourt = {
  x: 90,
  z: -29,
  courtWidth: 26,     // Playing surface width in X
  courtDepth: 14,     // Playing surface depth in Z
  fenceWidth: 28,     // Perimeter security fence
  fenceDepth: 16,
  fenceHeight: 3.2,
  netLength: 13,
};

// -------------------------------------------------------------
// DEDICATED GREEN ZONE / CENTRAL PARK (Plot NE3: Center X = 31.5, Z = -29)
// -------------------------------------------------------------
export const SOCIETY_PARK: SocietyPark = {
  x: 31.5,
  z: -29,
  width: 36,
  depth: 34,
};

// -------------------------------------------------------------
// BUILDINGS (Residential, Commercial, Community, Entrance)
// -------------------------------------------------------------
export const SOCIETY_BUILDINGS: SocietyBuilding[] = [
  // --- NORTH MAIN ENTRANCE SECURITY CABINS (Z = -134) ---
  { id: "security-gate-west", name: "SECURITY CONTROL W", kind: "security", zone: "entrance", x: -11.5, z: -134, width: 5.5, depth: 5, height: 4.8, floors: 1, color: "#8a9184", accentColor: "#d5f05d" },
  { id: "security-gate-east", name: "SECURITY CONTROL E", kind: "security", zone: "entrance", x: 11.5, z: -134, width: 5.5, depth: 5, height: 4.8, floors: 1, color: "#8a9184", accentColor: "#d5f05d" },

  // --- RESIDENTIAL APARTMENT TOWERS ---
  // Block NW1 (North-West)
  { id: "cedar-crest", name: "CEDAR CREST", kind: "tower", zone: "residential", x: -90, z: -88, width: 26, depth: 24, height: 52, floors: 14, color: "#6e7e7d", accentColor: "#d5f05d", roofType: "penthouse" },
  // Block NW2 (Mid-West North)
  { id: "oak-ridge", name: "OAK RIDGE TOWER", kind: "tower", zone: "residential", x: -90, z: -29, width: 24, depth: 24, height: 46, floors: 12, color: "#79837c", accentColor: "#e88f6a", roofType: "parapet" },
  // Block NE1 (North-East Inner)
  { id: "horizon-heights", name: "HORIZON HEIGHTS", kind: "tower", zone: "residential", x: 31.5, z: -88, width: 26, depth: 24, height: 58, floors: 16, color: "#828c81", accentColor: "#7cc4ba", roofType: "penthouse" },
  // Block NE2 (North-East Outer)
  { id: "skyline-east", name: "SKYLINE EAST", kind: "tower", zone: "residential", x: 90, z: -88, width: 24, depth: 24, height: 48, floors: 13, color: "#737f84", accentColor: "#d5f05d", roofType: "parapet" },
  // Block SW2 (South-West)
  { id: "pineview-tower", name: "PINEVIEW TOWER", kind: "tower", zone: "residential", x: -90, z: 88, width: 24, depth: 24, height: 46, floors: 12, color: "#6f7b76", accentColor: "#e5a14d", roofType: "parapet" },
  // Block SE2 (Mid-East South)
  { id: "terrace-court", name: "TERRACE COURT", kind: "tower", zone: "residential", x: 90, z: 29, width: 26, depth: 24, height: 44, floors: 12, color: "#697a78", accentColor: "#d5f05d", roofType: "penthouse" },
  // Block SE4 (South-East Outer)
  { id: "southgate-tower", name: "SOUTHGATE TOWER", kind: "tower", zone: "residential", x: 90, z: 88, width: 26, depth: 24, height: 50, floors: 13, color: "#78817a", accentColor: "#7cc4ba", roofType: "parapet" },

  // --- TOWNHOUSE / VILLA CLUSTERS ---
  // Block NC1 (North-Center Inner): Maple Villas 1 & 2
  { id: "villa-maple-1", name: "MAPLE VILLA A", kind: "villa", zone: "residential", x: -40, z: -88, width: 15, depth: 20, height: 11.5, floors: 2, color: "#b5ab94", accentColor: "#6a5c49", roofType: "gabled" },
  { id: "villa-maple-2", name: "MAPLE VILLA B", kind: "villa", zone: "residential", x: -22, z: -88, width: 15, depth: 20, height: 11.5, floors: 2, color: "#9da89b", accentColor: "#566453", roofType: "gabled" },

  // Block NC2 (Mid-West North Inner): Maple Villas 3 & 4
  { id: "villa-maple-3", name: "MAPLE VILLA C", kind: "villa", zone: "residential", x: -40, z: -29, width: 15, depth: 20, height: 11.5, floors: 2, color: "#b8a68d", accentColor: "#6c5a45", roofType: "gabled" },
  { id: "villa-maple-4", name: "MAPLE VILLA D", kind: "villa", zone: "residential", x: -22, z: -29, width: 15, depth: 20, height: 11.5, floors: 2, color: "#a3aaa0", accentColor: "#4f5f50", roofType: "gabled" },

  // Block SC2 (South-Center Inner): Cypress Villas 1 & 2
  { id: "villa-cypress-1", name: "CYPRESS VILLA 1", kind: "villa", zone: "residential", x: -40, z: 88, width: 15, depth: 20, height: 11.5, floors: 2, color: "#a99f88", accentColor: "#5c503e", roofType: "gabled" },
  { id: "villa-cypress-2", name: "CYPRESS VILLA 2", kind: "villa", zone: "residential", x: -22, z: 88, width: 15, depth: 20, height: 11.5, floors: 2, color: "#b6b19f", accentColor: "#695e4e", roofType: "gabled" },

  // Block SE3 (South-East Inner): Palms Villas 1 & 2
  { id: "villa-palms-1", name: "PALMS VILLA 1", kind: "villa", zone: "residential", x: 22, z: 88, width: 15, depth: 20, height: 11.5, floors: 2, color: "#9aa497", accentColor: "#4d5b4b", roofType: "gabled" },
  { id: "villa-palms-2", name: "PALMS VILLA 2", kind: "villa", zone: "residential", x: 40, z: 88, width: 15, depth: 20, height: 11.5, floors: 2, color: "#c2b296", accentColor: "#746146", roofType: "gabled" },

  // --- DEDICATED MARKET ZONE (Block SW1: Center X = -90, Z = 29) ---
  // A coherent commercial block with 4 storefronts
  { id: "market-fresh", name: "CEDAR FRESH MARKET", kind: "shop", zone: "market", x: -101, z: 35, width: 12, depth: 16, height: 8.5, floors: 1, color: "#a59072", accentColor: "#d97838" },
  { id: "market-cafe", name: "BAKERY & CAFE", kind: "shop", zone: "market", x: -88, z: 35, width: 12, depth: 16, height: 8.5, floors: 1, color: "#b77964", accentColor: "#e5a14d" },
  { id: "market-pharmacy", name: "CARE PHARMACY", kind: "shop", zone: "market", x: -75, z: 35, width: 12, depth: 16, height: 8.5, floors: 1, color: "#729980", accentColor: "#4ea878" },

  // --- COMMUNITY ZONE (Block SE1: Center X = 31.5, Z = 29) ---
  // Grand Community Clubhouse
  { id: "clubhouse-main", name: "GRAND CLUBHOUSE", kind: "clubhouse", zone: "community", x: 31.5, z: 29, width: 26, depth: 22, height: 14, floors: 2, color: "#b7aa8d", accentColor: "#786d52", roofType: "parapet" },
];

// -------------------------------------------------------------
// BOUNDARY WALLS
// -------------------------------------------------------------
export const SOCIETY_WALLS: SocietyWall[] = [
  // North Boundary (left and right of North Main Gate opening at X in [-10, 10])
  { id: "wall-north-west", x: -74, z: -138, width: 128, depth: 2.2, height: 3.4 },
  { id: "wall-north-east", x: 74, z: -138, width: 128, depth: 2.2, height: 3.4 },

  // South Boundary (left and right of South Gate opening at X in [-10, 10])
  { id: "wall-south-west", x: -74, z: 138, width: 128, depth: 2.2, height: 3.4 },
  { id: "wall-south-east", x: 74, z: 138, width: 128, depth: 2.2, height: 3.4 },

  // West Boundary
  { id: "wall-west", x: -138, z: 0, width: 2.2, depth: 276, height: 3.4 },

  // East Boundary
  { id: "wall-east", x: 138, z: 0, width: 2.2, depth: 276, height: 3.4 },
];

// -------------------------------------------------------------
// DEDICATED PARKING AREAS
// -------------------------------------------------------------
export const SOCIETY_PARKING: SocietyParking[] = [
  // Commercial District Parking Lot (Block SC1: X = -31.5, Z = 29)
  { id: "parking-market", x: -31.5, z: 29, width: 28, depth: 12, stalls: 8, axis: "x" },

  // Tower NW1 Parking (Block NW1: X = -90, Z = -66)
  { id: "parking-nw1", x: -90, z: -68, width: 24, depth: 10, stalls: 6, axis: "x" },

  // Tower NE2 Parking (Block NE2: X = 90, Z = -68)
  { id: "parking-ne2", x: 90, z: -68, width: 24, depth: 10, stalls: 6, axis: "x" },

  // Clubhouse Parking (Block SE1: X = 31.5, Z = 16)
  { id: "parking-club", x: 31.5, z: 16, width: 24, depth: 10, stalls: 6, axis: "x" },

  // Tower SE4 Parking (Block SE4: X = 90, Z = 68)
  { id: "parking-se4", x: 90, z: 68, width: 24, depth: 10, stalls: 6, axis: "x" },
];

// -------------------------------------------------------------
// PARKED VEHICLES (Safely inside parking stalls)
// -------------------------------------------------------------
export const SOCIETY_PARKED_CARS: SocietyParkedCar[] = [
  // Commercial Lot (Z = 29)
  { id: "car-m-1", x: -40, z: 29, yaw: 0, color: "#b33939" },
  { id: "car-m-2", x: -34, z: 29, yaw: 0, color: "#2d4a68" },
  { id: "car-m-3", x: -28, z: 29, yaw: 0, color: "#e3e1d8" },
  { id: "car-m-4", x: -22, z: 29, yaw: 0, color: "#45504c" },

  // NW1 Lot (Z = -68)
  { id: "car-nw-1", x: -96, z: -68, yaw: 0, color: "#314b53" },
  { id: "car-nw-2", x: -88, z: -68, yaw: 0, color: "#e8804c" },

  // NE2 Lot (Z = -68)
  { id: "car-ne-1", x: 84, z: -68, yaw: 0, color: "#2f383b" },
  { id: "car-ne-2", x: 92, z: -68, yaw: 0, color: "#a4b596" },

  // Clubhouse Lot (Z = 16)
  { id: "car-club-1", x: 26, z: 16, yaw: 0, color: "#8a2b2b" },
  { id: "car-club-2", x: 34, z: 16, yaw: 0, color: "#25343f" },
];

// -------------------------------------------------------------
// INTENTIONAL GREENERY (Central Park, Courtyards, Parkway Buffers)
// -------------------------------------------------------------
function generateSafeTrees(): SocietyTree[] {
  const trees: SocietyTree[] = [];
  let idCounter = 1;

  // 1. Central Park Grove (Block NE3: X in [16, 47], Z in [-43, -15])
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      // Leave center clearing for gazebo at (31.5, -29)
      const x = 18 + col * 9;
      const z = -41 + row * 12;
      if (Math.abs(x - 31.5) < 7 && Math.abs(z - (-29)) < 7) continue;
      trees.push({
        id: `tree-park-${idCounter++}`,
        x,
        z,
        scale: 0.95 + ((col + row) % 3) * 0.1,
        kind: (col + row) % 2 === 0 ? "deciduous" : "pine",
      });
    }
  }

  // 2. North Entrance Parkway Buffers (X = -14.5 and 14.5, Z north of -125)
  [-148, -142, -136, -128].forEach((z) => {
    trees.push({ id: `tree-gate-w-${idCounter++}`, x: -14.5, z, scale: 1.1, kind: "palm" });
    trees.push({ id: `tree-gate-e-${idCounter++}`, x: 14.5, z, scale: 1.1, kind: "palm" });
  });

  // 3. Residential Courtyard Groves (Safely inside residential plots behind towers)
  // NW1 Courtyard (behind Cedar Crest)
  trees.push({ id: `tree-nw1-1`, x: -90, z: -101, scale: 0.9, kind: "pine" });
  trees.push({ id: `tree-nw1-2`, x: -78, z: -101, scale: 0.95, kind: "deciduous" });

  // NE2 Courtyard (behind Skyline East)
  trees.push({ id: `tree-ne2-1`, x: 90, z: -101, scale: 0.9, kind: "pine" });
  trees.push({ id: `tree-ne2-2`, x: 78, z: -101, scale: 0.95, kind: "deciduous" });

  // SE4 Courtyard (behind Southgate Tower)
  trees.push({ id: `tree-se4-1`, x: 90, z: 101, scale: 0.9, kind: "pine" });
  trees.push({ id: `tree-se4-2`, x: 78, z: 101, scale: 0.95, kind: "deciduous" });

  // SW2 Courtyard (behind Pineview)
  trees.push({ id: `tree-sw2-1`, x: -90, z: 101, scale: 0.9, kind: "pine" });
  trees.push({ id: `tree-sw2-2`, x: -78, z: 101, scale: 0.95, kind: "deciduous" });

  // Clubhouse Courtyard Buffer
  trees.push({ id: `tree-club-1`, x: 44, z: 41, scale: 0.95, kind: "deciduous" });
  trees.push({ id: `tree-club-2`, x: 19, z: 41, scale: 0.95, kind: "deciduous" });

  return trees;
}

export const SOCIETY_TREES: SocietyTree[] = generateSafeTrees();

// -------------------------------------------------------------
// NPC PEDESTRIAN ROUTES & POPULATION
// -------------------------------------------------------------
export const PEDESTRIAN_ROUTES: PedestrianRoute[] = [
  // Route 1: Central Park Leisure Loop
  {
    id: "route-park-loop",
    name: "Park Jogging & Walking Loop",
    loop: true,
    waypoints: [
      { x: 18, z: -41 },
      { x: 45, z: -41 },
      { x: 45, z: -17 },
      { x: 18, z: -17 },
    ],
  },
  // Route 2: Market Promenade Stroll
  {
    id: "route-market-plaza",
    name: "Market Promenade",
    loop: true,
    waypoints: [
      { x: -103, z: 24 },
      { x: -75, z: 24 },
      { x: -75, z: 20 },
      { x: -103, z: 20 },
    ],
  },
  // Route 3: West Boulevard Sidewalk Walk
  {
    id: "route-west-sidewalk",
    name: "West Boulevard Walkway",
    loop: true,
    waypoints: [
      { x: -54.8, z: -100 },
      { x: -54.8, z: -40 },
      { x: -54.8, z: 40 },
      { x: -54.8, z: 100 },
      { x: -69.2, z: 100 },
      { x: -69.2, z: 40 },
      { x: -69.2, z: -40 },
      { x: -69.2, z: -100 },
    ],
  },
  // Route 4: East Boulevard & Tennis Access Walk
  {
    id: "route-east-sidewalk",
    name: "East Boulevard & Recreation Path",
    loop: true,
    waypoints: [
      { x: 54.8, z: -50 },
      { x: 54.8, z: -29 },
      { x: 74, z: -29 },   // Walks to tennis court gate!
      { x: 54.8, z: -29 },
      { x: 54.8, z: 30 },
      { x: 38, z: 30 },    // Walks into clubhouse plaza
      { x: 54.8, z: 30 },
      { x: 54.8, z: -50 },
    ],
  },
];

export const PEDESTRIAN_NPCS: PedestrianNPC[] = [
  // Central Park Walkers & Joggers
  { id: "npc-1", name: "Jogger Leo", routeId: "route-park-loop", initialProgress: 0.0, speed: 2.4, shirtColor: "#3b82f6", pantsColor: "#1e293b", hairColor: "#451a03" },
  { id: "npc-2", name: "Walker Maya", routeId: "route-park-loop", initialProgress: 0.35, speed: 1.4, shirtColor: "#ec4899", pantsColor: "#475569", hairColor: "#b45309" },
  { id: "npc-3", name: "Resident Sam", routeId: "route-park-loop", initialProgress: 0.7, speed: 1.2, shirtColor: "#10b981", pantsColor: "#334155", hairColor: "#18181b" },

  // Market Shoppers
  { id: "npc-4", name: "Shopper Anna", routeId: "route-market-plaza", initialProgress: 0.1, speed: 1.1, shirtColor: "#f59e0b", pantsColor: "#1f2937", hairColor: "#78350f" },
  { id: "npc-5", name: "Shopper David", routeId: "route-market-plaza", initialProgress: 0.55, speed: 1.3, shirtColor: "#8b5cf6", pantsColor: "#374151", hairColor: "#1c1917" },
  { id: "npc-6", name: "Cafe Visitor Zoe", routeId: "route-market-plaza", initialProgress: 0.85, speed: 0.9, shirtColor: "#ef4444", pantsColor: "#111827", hairColor: "#ca8a04" },

  // West Boulevard Pedestrians
  { id: "npc-7", name: "Walker Kevin", routeId: "route-west-sidewalk", initialProgress: 0.15, speed: 1.5, shirtColor: "#06b6d4", pantsColor: "#1e293b", hairColor: "#292524" },
  { id: "npc-8", name: "Walker Elena", routeId: "route-west-sidewalk", initialProgress: 0.65, speed: 1.4, shirtColor: "#84cc16", pantsColor: "#334155", hairColor: "#713f12" },

  // East Boulevard & Tennis Players
  { id: "npc-9", name: "Tennis Player Alex", routeId: "route-east-sidewalk", initialProgress: 0.2, speed: 1.8, shirtColor: "#f43f5e", pantsColor: "#f8fafc", hairColor: "#172554" },
  { id: "npc-10", name: "Club Member Nina", routeId: "route-east-sidewalk", initialProgress: 0.6, speed: 1.3, shirtColor: "#6366f1", pantsColor: "#1e1b4b", hairColor: "#3f3f46" },

  // Additional residents keep the park, market, and sidewalks lively.
  { id: "npc-11", name: "Jogger Asha", routeId: "route-park-loop", initialProgress: 0.52, speed: 2.1, shirtColor: "#f97316", pantsColor: "#334155", hairColor: "#292524" },
  { id: "npc-12", name: "Walker Noah", routeId: "route-park-loop", initialProgress: 0.88, speed: 1.25, shirtColor: "#0ea5e9", pantsColor: "#1e293b", hairColor: "#78350f" },
  { id: "npc-13", name: "Shopper Grace", routeId: "route-market-plaza", initialProgress: 0.3, speed: 1.15, shirtColor: "#a855f7", pantsColor: "#475569", hairColor: "#451a03" },
  { id: "npc-14", name: "Shopper Omar", routeId: "route-market-plaza", initialProgress: 0.72, speed: 1.35, shirtColor: "#14b8a6", pantsColor: "#1f2937", hairColor: "#18181b" },
  { id: "npc-15", name: "Runner Chloe", routeId: "route-west-sidewalk", initialProgress: 0.42, speed: 2.2, shirtColor: "#e11d48", pantsColor: "#334155", hairColor: "#713f12" },
  { id: "npc-16", name: "Resident Eli", routeId: "route-east-sidewalk", initialProgress: 0.82, speed: 1.4, shirtColor: "#eab308", pantsColor: "#334155", hairColor: "#1c1917" },
];

export type LivingActivity = "walking" | "sitting" | "talking" | "playing" | "guarding";

export type StaticNPC = {
  id: string;
  name: string;
  role: string;
  activity: LivingActivity;
  x: number;
  z: number;
  yaw: number;
  shirtColor: string;
  pantsColor: string;
  hairColor: string;
  dialoguePartnerId?: string;
  defaultLines: string[];
};

export const STATIC_LIVING_NPCS: StaticNPC[] = [
  // North Entrance Gate Guard
  {
    id: "npc-guard-roy",
    name: "Officer Roy",
    role: "Gate Security",
    activity: "guarding",
    x: -8.8,
    z: -131,
    yaw: Math.PI,
    shirtColor: "#1e3a5f",
    pantsColor: "#0f172a",
    hairColor: "#1c1917",
    defaultLines: ["Welcome to Cedar Grove!", "Please observe the 30 km/h speed limit.", "Have a great day, driver!"],
  },
  // Conversationalists by Central Park
  {
    id: "npc-talk-marcus",
    name: "Marcus",
    role: "Resident",
    activity: "talking",
    x: 32.2,
    z: -18.5,
    yaw: 0.4,
    shirtColor: "#0284c7",
    pantsColor: "#334155",
    hairColor: "#451a03",
    dialoguePartnerId: "npc-talk-priya",
    defaultLines: [
      "Did you check out the new park fountain?",
      "The landscaping here is really coming together.",
      "See you at the community clubhouse later!",
    ],
  },
  {
    id: "npc-talk-priya",
    name: "Priya",
    role: "Resident",
    activity: "talking",
    x: 33.6,
    z: -18.1,
    yaw: -2.7,
    shirtColor: "#d946ef",
    pantsColor: "#475569",
    hairColor: "#18181b",
    dialoguePartnerId: "npc-talk-marcus",
    defaultLines: [
      "Yes, the water tiers look gorgeous!",
      "I was just heading to Cedar Cafe for cold brew.",
      "Definitely, badminton court at five!",
    ],
  },
  // Park Bench Sitters
  {
    id: "npc-sit-rose",
    name: "Grandma Rose",
    role: "Book Reader",
    activity: "sitting",
    x: 23.5,
    z: -29,
    yaw: Math.PI / 2,
    shirtColor: "#84cc16",
    pantsColor: "#64748b",
    hairColor: "#e2e8f0",
    defaultLines: ["Such a peaceful morning for reading.", "The fresh flowers smell wonderful."],
  },
  {
    id: "npc-sit-ben",
    name: "Ben",
    role: "Relaxing Resident",
    activity: "sitting",
    x: 39.5,
    z: -29,
    yaw: -Math.PI / 2,
    shirtColor: "#f97316",
    pantsColor: "#1e293b",
    hairColor: "#78350f",
    defaultLines: ["Great afternoon to unwind.", "Love sitting under these pines."],
  },
  // Cafe Terrace Patron
  {
    id: "npc-cafe-oliver",
    name: "Oliver",
    role: "Cafe Patron",
    activity: "sitting",
    x: -85.2,
    z: 25.5,
    yaw: Math.PI,
    shirtColor: "#059669",
    pantsColor: "#1e293b",
    hairColor: "#292524",
    defaultLines: ["Best espresso in the society.", "Pastries are fresh out of the oven!"],
  },
];

export const POLICE_PATROL_ROUTE: PedestrianWaypoint[] = [
  { x: 0, z: -118 },
  { x: 118, z: -118 },
  { x: 118, z: 0 },
  { x: 118, z: 118 },
  { x: 0, z: 118 },
  { x: -118, z: 118 },
  { x: -118, z: 0 },
  { x: -118, z: -118 },
];

// -------------------------------------------------------------
// SPAWN POINT & VEHICLE START
// -------------------------------------------------------------
// Starts at North Grand Entrance, facing South (yaw = 0) down the central avenue
export const SOCIETY_START = {
  x: 0,
  z: -140,
  yaw: 0,
};

// The first expansion milestone uses lightweight blockout meshes. These have
// explicit footprints so ground and aircraft collision remain aligned with
// the rendered city landmarks.
export const SOCIETY_LANDMARKS: SocietyLandmark[] = [
  // Northwest range and the lower pass remain outside the main city blocks.
  { id: "mountain-west-peak", name: "West Range", districtId: "mountains", kind: "mountain", x: -1120, z: -1160, width: 520, depth: 480, height: 300, color: "#596b5c", collidable: true },
  { id: "mountain-north-peak", name: "North Range", districtId: "mountains", kind: "mountain", x: -730, z: -1290, width: 520, depth: 400, height: 360, color: "#67796a", collidable: true },
  { id: "mountain-pass-peak", name: "Pass Ridge", districtId: "mountains", kind: "mountain", x: -430, z: -1050, width: 400, depth: 500, height: 260, color: "#536759", collidable: true },

  // Downtown skyline blockout, south of the existing Cedar Grove avenue.
  { id: "downtown-tower-west", name: "Civic Tower", districtId: "downtown", kind: "tower", x: -250, z: 420, width: 48, depth: 48, height: 112, color: "#61777a", collidable: true },
  { id: "downtown-tower-center", name: "Central Tower", districtId: "downtown", kind: "tower", x: -110, z: 550, width: 58, depth: 58, height: 156, color: "#526a72", collidable: true },
  { id: "downtown-tower-east", name: "Harborview Tower", districtId: "downtown", kind: "tower", x: 175, z: 440, width: 46, depth: 52, height: 124, color: "#71817d", collidable: true },
  { id: "downtown-tower-south", name: "Exchange Tower", districtId: "downtown", kind: "tower", x: 160, z: 760, width: 54, depth: 58, height: 138, color: "#6d7777", collidable: true },

  // A short, authored residential strip anchors the west road connection.
  { id: "west-home-north", name: "Westfield Homes North", districtId: "west-residential", kind: "house", x: -1030, z: -170, width: 44, depth: 36, height: 14, color: "#9a927f", collidable: true },
  { id: "west-home-central", name: "Westfield Homes Central", districtId: "west-residential", kind: "house", x: -1030, z: 40, width: 48, depth: 38, height: 16, color: "#879180", collidable: true },
  { id: "west-home-south", name: "Westfield Homes South", districtId: "west-residential", kind: "house", x: -1030, z: 260, width: 42, depth: 38, height: 13, color: "#a79b84", collidable: true },

  // Airport grounds, runway and terminal access blockout.
  { id: "airport-runway", name: "Coastal Airport Runway", districtId: "airport", kind: "runway", x: 1120, z: -900, width: 44, depth: 650, height: 0.08, color: "#343a3b" },
  { id: "airport-terminal", name: "Coastal Airport Terminal", districtId: "airport", kind: "terminal", x: 930, z: -510, width: 128, depth: 54, height: 22, color: "#a6aca5", collidable: true },
  { id: "airport-hangar", name: "Airport Hangar", districtId: "airport", kind: "hangar", x: 920, z: -1080, width: 92, depth: 76, height: 24, color: "#818b87", collidable: true },

  // Industrial blocks sit west of the docks; their footprints avoid the roads.
  { id: "industry-warehouse-north", name: "North Freight Depot", districtId: "industrial", kind: "warehouse", x: 680, z: 820, width: 150, depth: 92, height: 24, color: "#777d78", collidable: true },
  { id: "industry-warehouse-south", name: "South Freight Depot", districtId: "industrial", kind: "warehouse", x: 690, z: 1090, width: 142, depth: 96, height: 21, color: "#8a877d", collidable: true },

  // A small working harbor and a pair of beach blocks establish the coastline.
  { id: "harbor-basin", name: "Harbor Basin", districtId: "port", kind: "harbor-water", x: 1260, z: 1030, width: 260, depth: 260, height: 0.05, color: "#315d68" },
  { id: "harbor-crane-north", name: "North Harbor Crane", districtId: "port", kind: "port-crane", x: 1030, z: 820, width: 26, depth: 28, height: 58, color: "#c76c47", collidable: true },
  { id: "harbor-crane-south", name: "South Harbor Crane", districtId: "port", kind: "port-crane", x: 1240, z: 1220, width: 26, depth: 28, height: 52, color: "#d28a4b", collidable: true },
  { id: "east-beach", name: "East Coast Beach", districtId: "beaches", kind: "beach", x: 1320, z: 280, width: 180, depth: 300, height: 0.12, color: "#c8b887" },
  { id: "south-beach", name: "South Coast Beach", districtId: "beaches", kind: "beach", x: 1280, z: 1390, width: 250, depth: 90, height: 0.12, color: "#c8b887" },
];

// -------------------------------------------------------------
// FOOTPRINT & COLLISION SYSTEM
// -------------------------------------------------------------
export type Footprint = {
  id: string;
  name: string;
  category: "building" | "court" | "fence" | "park" | "parking" | "wall" | "gate" | "car";
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export const SOCIETY_OBSTACLES = [
  // Buildings
  ...SOCIETY_BUILDINGS.map(({ id, name, x, z, width, depth }) => ({
    id,
    name,
    category: "building" as const,
    x,
    z,
    width,
    depth,
  })),

  // Boundary Walls
  ...SOCIETY_WALLS.map(({ id, x, z, width, depth }) => ({
    id,
    name: id,
    category: "wall" as const,
    x,
    z,
    width,
    depth,
  })),

  // Dedicated Tennis Court & Fence Enclosure
  {
    id: "tennis-court-enclosure",
    name: "Tennis Court Fence",
    category: "court" as const,
    x: SOCIETY_TENNIS_COURT.x,
    z: SOCIETY_TENNIS_COURT.z,
    width: SOCIETY_TENNIS_COURT.fenceWidth,
    depth: SOCIETY_TENNIS_COURT.fenceDepth,
  },

  // Central Roundabout Obelisk
  {
    id: "roundabout-obelisk",
    name: "Roundabout Monument",
    category: "wall" as const,
    x: 0,
    z: 0,
    width: 6.4,
    depth: 6.4,
  },

  // North Gate Pylons
  { id: "gate-pylon-w", name: "Gate Pylon W", category: "gate" as const, x: -10, z: -134, width: 2.2, depth: 2.6 },
  { id: "gate-pylon-e", name: "Gate Pylon E", category: "gate" as const, x: 10, z: -134, width: 2.2, depth: 2.6 },

  // Parked Cars
  ...SOCIETY_PARKED_CARS.map(({ id, x, z }) => ({
    id,
    name: id,
    category: "car" as const,
    x,
    z,
    width: 2.2,
    depth: 4.4,
  })),

  // Trees (Trunk collision)
  ...SOCIETY_TREES.map(({ id, x, z, scale }) => ({
    id,
    name: id,
    category: "wall" as const,
    x,
    z,
    width: scale * 1.2,
    depth: scale * 1.2,
  })),

  // New solid landmark blockouts share the same collision footprint source.
  ...SOCIETY_LANDMARKS.filter((landmark) => landmark.collidable).map((landmark) => ({
    id: landmark.id,
    name: landmark.name,
    category: "building" as const,
    x: landmark.x,
    z: landmark.z,
    width: landmark.width,
    depth: landmark.depth,
  })),

  // Physical closure footprints use the same collision grid as buildings.
  ...SOCIETY_ROAD_CLOSURES.map((closure) => ({
    id: closure.id,
    name: "Road closure",
    category: "closure" as const,
    x: closure.x,
    z: closure.z,
    width: closure.roadAxis === "z" ? closure.roadWidth + 1 : 1,
    depth: closure.roadAxis === "x" ? closure.roadWidth + 1 : 1,
  })),
];

// -------------------------------------------------------------
// FOOTPRINT OVERLAP VALIDATION UTILITY
// -------------------------------------------------------------
export type OverlapReport = {
  valid: boolean;
  conflicts: string[];
};

export function validateSocietyFootprints(): OverlapReport {
  const conflicts: string[] = [];

  // Check 1: Road Corridors vs Static Solid Obstacles (Buildings, Tennis Court Fence)
  const solidObstacles = [
    ...SOCIETY_BUILDINGS.map((b) => ({
      id: b.id,
      name: b.name,
      minX: b.x - b.width / 2,
      maxX: b.x + b.width / 2,
      minZ: b.z - b.depth / 2,
      maxZ: b.z + b.depth / 2,
    })),
    {
      id: "tennis-court",
      name: "Tennis Court & Fence",
      minX: SOCIETY_TENNIS_COURT.x - SOCIETY_TENNIS_COURT.fenceWidth / 2,
      maxX: SOCIETY_TENNIS_COURT.x + SOCIETY_TENNIS_COURT.fenceWidth / 2,
      minZ: SOCIETY_TENNIS_COURT.z - SOCIETY_TENNIS_COURT.fenceDepth / 2,
      maxZ: SOCIETY_TENNIS_COURT.z + SOCIETY_TENNIS_COURT.fenceDepth / 2,
    },
  ];

  // Every road defines a drivable asphalt corridor
  SOCIETY_ROADS.forEach((road) => {
    const isX = road.axis === "x";
    const roadMinX = isX ? road.x - road.length / 2 : road.x - road.width / 2;
    const roadMaxX = isX ? road.x + road.length / 2 : road.x + road.width / 2;
    const roadMinZ = isX ? road.z - road.width / 2 : road.z - road.length / 2;
    const roadMaxZ = isX ? road.z + road.width / 2 : road.z + road.length / 2;

    solidObstacles.forEach((obs) => {
      // Check AABB intersection
      const overlapX = Math.max(0, Math.min(roadMaxX, obs.maxX) - Math.max(roadMinX, obs.minX));
      const overlapZ = Math.max(0, Math.min(roadMaxZ, obs.maxZ) - Math.max(roadMinZ, obs.minZ));
      if (overlapX > 0.05 && overlapZ > 0.05) {
        conflicts.push(`CRITICAL OVERLAP: ${obs.name} intersects road "${road.name}" by [${overlapX.toFixed(2)}m x ${overlapZ.toFixed(2)}m]`);
      }
    });
  });

  // Check 2: Solid Obstacle vs Solid Obstacle
  for (let i = 0; i < solidObstacles.length; i += 1) {
    for (let j = i + 1; j < solidObstacles.length; j += 1) {
      const a = solidObstacles[i];
      const b = solidObstacles[j];
      const overlapX = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
      const overlapZ = Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
      if (overlapX > 0.05 && overlapZ > 0.05) {
        conflicts.push(`INTER-BUILDING COLLISION: "${a.name}" overlaps with "${b.name}"`);
      }
    }
  }

  // Check 3: Trees vs Road Drivable Surface
  SOCIETY_ROADS.forEach((road) => {
    const isX = road.axis === "x";
    const roadMinX = isX ? road.x - road.length / 2 : road.x - road.width / 2;
    const roadMaxX = isX ? road.x + road.length / 2 : road.x + road.width / 2;
    const roadMinZ = isX ? road.z - road.width / 2 : road.z - road.length / 2;
    const roadMaxZ = isX ? road.z + road.width / 2 : road.z + road.length / 2;

    SOCIETY_TREES.forEach((tree) => {
      if (tree.x > roadMinX && tree.x < roadMaxX && tree.z > roadMinZ && tree.z < roadMaxZ) {
        conflicts.push(`TREE BLOCKING ROAD: Tree "${tree.id}" at (${tree.x}, ${tree.z}) is inside road "${road.name}"`);
      }
    });
  });

  return {
    valid: conflicts.length === 0,
    conflicts,
  };
}
