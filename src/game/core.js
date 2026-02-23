import {
  ALERT_LEVELS,
  ASSET_RULES,
  BASE_MAP,
  CAMPAIGN_MISSIONS,
  CLIMATE_MULTIPLIERS,
  CUSTOM_OPTIONS,
  CUSTOM_PRESETS,
  DEFAULT_SETTINGS,
  NEWS_BLURBS,
  SEASON_ORDER,
  STANDARD_PRESETS,
  STORAGE_KEYS,
  TERRAIN_COST_MULTIPLIERS,
} from "../data.js";

export {
  ALERT_LEVELS,
  ASSET_RULES,
  BASE_MAP,
  CAMPAIGN_MISSIONS,
  CLIMATE_MULTIPLIERS,
  CUSTOM_OPTIONS,
  CUSTOM_PRESETS,
  DEFAULT_SETTINGS,
  NEWS_BLURBS,
  SEASON_ORDER,
  STANDARD_PRESETS,
  STORAGE_KEYS,
  TERRAIN_COST_MULTIPLIERS,
};
export const TICK_SECONDS = 0.1;
export const TOOL_BUILD = "build";
export const TOOL_DEMOLISH = "demolish";
export const TOOL_REROUTE = "reroute";
export const TOOL_LINE = "line";
export const ASSET_ORDER = ["plant", "substation", "storage"];
export const PRIORITY_ORDER = ["low", "normal", "high"];
export const DRAG_THRESHOLD_PX = 6;
export const DEFAULT_TERRAIN_MAP_ID = "national-core";
export const DEFAULT_TERRAIN_MAP_IMAGE_URL = "/assets/maps/terrain/mockup-terrain-map.png";
export const DEFAULT_TERRAIN_MAP_METADATA_URL = "/data/maps/terrain/mockup-terrain-map.metadata.json";
export const MISSION_TERRAIN_MAP_BASE_URL = "/assets/maps/terrain/mission-terrain-maps";
export const ICON_SET_URLS = {
  town: {
    hamlet: "/assets/icons/circular/town-hamlet.svg",
    city: "/assets/icons/circular/town-city.svg",
    capital: "/assets/icons/circular/town-capital.svg",
  },
  resource: {
    wind: "/assets/icons/circular/plant-wind.svg",
    sun: "/assets/icons/circular/plant-solar.svg",
    natural_gas: "/assets/icons/circular/plant-gas.svg",
  },
  infrastructure: {
    substation: "/assets/icons/circular/substation.svg",
  },
  powerline: {
    horizontal: "/assets/patterns/powerlines/local-powerline-tile.svg",
    vertical: "/assets/patterns/powerlines/local-powerline-tile-vertical.svg",
  },
};
export const LIVABLE_TERRAINS = new Set(["plains", "river", "coast"]);
export const SPARSE_START_TOWN_IDS = new Set(["capital"]);
export const EMERGENCE_TOWN_NAMES = [
  "Andersville",
  "Carsonton",
  "Ella Town",
  "Bennettburg",
  "Marlowville",
  "Parkerton",
  "Riley Borough",
  "Quinn Town",
  "Sawyerville",
  "Jordanston",
  "Averyville",
  "Logan Town",
  "Finleyburg",
  "Caseyton",
];
export const LINE_BASE_BUILD_COST_PER_WORLD_UNIT = 0.34;
export const LINE_BASE_MAINTENANCE_PER_WORLD_UNIT = 0.0036;
export const LINE_DISTANCE_CAPACITY_FACTOR = 0.08;
export const LINE_MIN_CAPACITY = 58;
export const LINE_MAX_CAPACITY = 140;
export const DEV_MODE_BUDGET_FLOOR = 1_000_000_000;
export const TUTORIAL_STEP_DEFINITIONS = [
  {
    id: "build_plant",
    title: "Build a Plant",
    instruction: "Use Build and Plant (1), then place it on an open map point.",
  },
  {
    id: "build_substation",
    title: "Build a Substation",
    instruction: "Use Build and Sub (2), then place it on an open map point.",
  },
  {
    id: "build_line",
    title: "Build a Line",
    instruction: "Use Line (4) to connect two valid infrastructure endpoints.",
  },
  {
    id: "service_town",
    title: "Serve a Town",
    instruction: "Deliver active power service to at least one town.",
  },
  {
    id: "resource_reveal",
    title: "Reveal Resources",
    instruction: "Hold R to reveal the Resource Layer.",
  },
  {
    id: "reroute",
    title: "Use Reroute",
    instruction: "Use Reroute on a town point at least once.",
  },
  {
    id: "demolish",
    title: "Use Demolish",
    instruction: "Demolish at least one asset.",
  },
  {
    id: "pause_resume",
    title: "Pause and Resume",
    instruction: "Press Space or Pause button to pause, then resume simulation.",
  },
];
export const SUBSTATION_RADIUS_BY_PROFILE = {
  wide: 370,
  standard: 300,
  tight: 245,
};
export const LINE_MAINTENANCE_BY_PROFILE = {
  low: 0.82,
  standard: 1,
  high: 1.24,
};
export const RESOURCE_ZONE_COLORS = {
  wind: {
    fill: "rgba(96, 191, 255, 0.14)",
    stroke: "rgba(121, 205, 255, 0.78)",
  },
  sun: {
    fill: "rgba(255, 206, 92, 0.14)",
    stroke: "rgba(255, 218, 128, 0.78)",
  },
  natural_gas: {
    fill: "rgba(255, 129, 146, 0.14)",
    stroke: "rgba(255, 162, 173, 0.78)",
  },
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function formatTime(seconds) {
  const clamped = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(clamped / 60)).padStart(2, "0");
  const ss = String(clamped % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  const x = point.x;
  const y = point.y;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / Math.max(1e-6, yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function centroidFromPolygon(polygon) {
  if (!polygon.length) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const point of polygon) {
    sx += point.x;
    sy += point.y;
  }
  return { x: sx / polygon.length, y: sy / polygon.length };
}

export function findBaseRegion(regionId) {
  const mapTowns = BASE_MAP.towns;
  return mapTowns.find((region) => region.id === regionId) || null;
}

export function pickTownArchetype(districtType = "") {
  if (districtType === "Industrial Belt") return "industrial";
  if (districtType === "Coastal Corridor") return "coastal";
  if (districtType === "Urban Core") return "metro";
  return "rural";
}

export function getMissionTerrainImageUrl(missionId) {
  return `${MISSION_TERRAIN_MAP_BASE_URL}/${missionId}.png`;
}

export function resolveTerrainMapProfile(config) {
  const selectedId = String(config?.mapSelectionId || config?.terrainMapId || "").trim();
  if (selectedId && selectedId !== DEFAULT_TERRAIN_MAP_ID) {
    const mission = CAMPAIGN_MISSIONS.find((item) => item.id === selectedId);
    if (mission) {
      return {
        id: mission.id,
        label: `${mission.codename} Terrain`,
        imageUrl: getMissionTerrainImageUrl(mission.id),
        metadataUrl: null,
      };
    }
  }

  if (config?.mode === "campaign" && config?.mission?.id) {
    return {
      id: config.mission.id,
      label: `${config.mission.codename} Terrain`,
      imageUrl: getMissionTerrainImageUrl(config.mission.id),
      metadataUrl: null,
    };
  }

  return {
    id: DEFAULT_TERRAIN_MAP_ID,
    label: "National Core Terrain",
    imageUrl: BASE_MAP.terrainMapImageUrl || DEFAULT_TERRAIN_MAP_IMAGE_URL,
    metadataUrl: BASE_MAP.terrainMapMetadataUrl || DEFAULT_TERRAIN_MAP_METADATA_URL,
  };
}

export function getMapSelectionOptions() {
  return [
    { id: DEFAULT_TERRAIN_MAP_ID, label: "National Core" },
    ...CAMPAIGN_MISSIONS.map((mission) => ({
      id: mission.id,
      label: `${mission.codename} Terrain`,
    })),
  ];
}

export function loadImageAsset(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

export function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures in MVP.
  }
}

export function toOrdinal(index) {
  const n = index + 1;
  if (n % 10 === 1 && n % 100 !== 11) return `${n}st`;
  if (n % 10 === 2 && n % 100 !== 12) return `${n}nd`;
  if (n % 10 === 3 && n % 100 !== 13) return `${n}rd`;
  return `${n}th`;
}

export function normalizePopulationMode(mode) {
  if (mode === "off") {
    return { enabled: false, strength: 0 };
  }
  if (mode === "high") {
    return { enabled: true, strength: 1.45 };
  }
  return { enabled: true, strength: 1 };
}

export function normalizeClimateIntensity(value) {
  if (typeof value === "number") return value;
  if (value === "low") return 0.82;
  if (value === "high") return 1.25;
  return 1;
}

export function normalizeEventIntensity(value) {
  if (typeof value === "number") return value;
  if (value === "low") return 0.75;
  if (value === "high") return 1.3;
  return 1;
}

export function normalizeFailureStrictness(value) {
  if (typeof value === "number") return value;
  if (value === "lenient") return 0.84;
  if (value === "strict") return 1.22;
  return 1;
}

export function normalizeTownEmergenceMode(value, populationEnabled = true) {
  if (value === "off") return "off";
  if (value === "limited" || value === "low") return "low";
  if (value === "high") return "high";
  if (value === "normal") return "normal";
  return populationEnabled ? "normal" : "low";
}

export function normalizeSubstationRadiusProfile(value) {
  if (value === "wide" || value === "tight" || value === "standard") return value;
  return "standard";
}

export function normalizeLineMaintenanceProfile(value) {
  if (value === "low" || value === "high" || value === "standard") return value;
  return "standard";
}

export function getMissionTownEmergenceMode(mission, populationEnabled) {
  if (!mission) return populationEnabled ? "normal" : "off";
  return normalizeTownEmergenceMode(mission.townEmergenceMode, populationEnabled);
}

export function getMissionSubstationRadiusProfile(mission) {
  if (mission.mapScale === "Large") return "tight";
  if (mission.mapScale === "Small") return "wide";
  return "standard";
}

export function getMissionLineMaintenanceProfile(mission) {
  if (mission.difficulty === "Expert" || mission.difficulty === "Hard") return "high";
  if (mission.difficulty === "Easy") return "low";
  return "standard";
}

export function buildRunConfigFromStandardPreset(presetId) {
  const preset = STANDARD_PRESETS.find((item) => item.id === presetId) || STANDARD_PRESETS[0];
  const population = normalizePopulationMode(preset.populationMode);
  const terrainProfile = resolveTerrainMapProfile({
    mode: "standard",
    mapSelectionId: DEFAULT_TERRAIN_MAP_ID,
  });
  return {
    mode: "standard",
    label: `Standard Run (${preset.label})`,
    leaderboardClass: "standard",
    leaderboardEligible: preset.leaderboardEligible,
    demandGrowthMultiplier: preset.demandGrowthMultiplier,
    eventIntensity: normalizeEventIntensity(preset.eventIntensity),
    seasonalProfile: preset.seasonalProfile,
    climateIntensity: normalizeClimateIntensity(preset.climateIntensity),
    infraCostMultiplier: preset.infraCostMultiplier,
    failureStrictness: normalizeFailureStrictness(preset.failureStrictness),
    populationEnabled: population.enabled,
    populationStrength: population.strength,
    substationRadiusProfile: normalizeSubstationRadiusProfile(preset.substationRadiusProfile),
    substationRadius: SUBSTATION_RADIUS_BY_PROFILE[
      normalizeSubstationRadiusProfile(preset.substationRadiusProfile)
    ],
    lineMaintenanceProfile: normalizeLineMaintenanceProfile(preset.lineMaintenanceProfile),
    lineMaintenanceMultiplier: LINE_MAINTENANCE_BY_PROFILE[
      normalizeLineMaintenanceProfile(preset.lineMaintenanceProfile)
    ],
    startingBudget: preset.budget,
    runTargetSec: 0,
    mission: null,
    sourcePresetId: preset.id,
    mapSelectionId: terrainProfile.id,
    terrainMapId: terrainProfile.id,
    terrainMapLabel: terrainProfile.label,
    terrainMapImageUrl: terrainProfile.imageUrl,
    terrainMapMetadataUrl: terrainProfile.metadataUrl,
    sparseStart: true,
    townEmergenceMode: normalizeTownEmergenceMode(preset.townEmergenceMode, population.enabled),
  };
}

export function buildRunConfigFromCampaignMission(missionId) {
  const mission = CAMPAIGN_MISSIONS.find((item) => item.id === missionId) || CAMPAIGN_MISSIONS[0];
  const population = normalizePopulationMode(mission.populationMode);
  const terrainProfile = resolveTerrainMapProfile({
    mode: "campaign",
    mission,
  });
  return {
    mode: "campaign",
    label: `Campaign Mission: ${mission.codename}`,
    leaderboardClass: "campaign",
    leaderboardEligible: true,
    demandGrowthMultiplier: mission.difficulty === "Easy" ? 0.92 : mission.difficulty === "Normal" ? 1 : mission.difficulty === "Hard" ? 1.15 : 1.28,
    eventIntensity: mission.difficulty === "Easy" ? 0.85 : mission.difficulty === "Normal" ? 1 : mission.difficulty === "Hard" ? 1.2 : 1.35,
    seasonalProfile: mission.seasonalMode === "on" ? "mixed" : "neutral",
    climateIntensity: mission.seasonalMode === "on" ? 1.05 : 1,
    infraCostMultiplier: mission.difficulty === "Easy" ? 0.95 : mission.difficulty === "Normal" ? 1 : mission.difficulty === "Hard" ? 1.12 : 1.18,
    failureStrictness: mission.difficulty === "Easy" ? 0.9 : mission.difficulty === "Normal" ? 1 : mission.difficulty === "Hard" ? 1.14 : 1.25,
    populationEnabled: population.enabled,
    populationStrength: population.strength,
    substationRadiusProfile: getMissionSubstationRadiusProfile(mission),
    substationRadius: SUBSTATION_RADIUS_BY_PROFILE[getMissionSubstationRadiusProfile(mission)],
    lineMaintenanceProfile: getMissionLineMaintenanceProfile(mission),
    lineMaintenanceMultiplier: LINE_MAINTENANCE_BY_PROFILE[getMissionLineMaintenanceProfile(mission)],
    startingBudget: mission.startingBudget,
    runTargetSec: mission.objective.targetDurationSec,
    mission,
    sourceMissionId: mission.id,
    mapSelectionId: terrainProfile.id,
    terrainMapId: terrainProfile.id,
    terrainMapLabel: terrainProfile.label,
    terrainMapImageUrl: terrainProfile.imageUrl,
    terrainMapMetadataUrl: terrainProfile.metadataUrl,
    sparseStart: false,
    townEmergenceMode: getMissionTownEmergenceMode(mission, population.enabled),
  };
}

export function buildRunConfigFromCustom(customState) {
  const population = normalizePopulationMode(customState.populationMode);
  const terrainProfile = resolveTerrainMapProfile({
    mode: "custom",
    mapSelectionId: customState.mapSelectionId,
  });
  return {
    mode: "custom",
    label: "Custom Game",
    leaderboardClass: "custom",
    leaderboardEligible: false,
    demandGrowthMultiplier: customState.demandGrowthMultiplier,
    eventIntensity: normalizeEventIntensity(customState.eventIntensity),
    seasonalProfile: customState.seasonalProfile,
    climateIntensity: normalizeClimateIntensity(customState.climateIntensity),
    infraCostMultiplier: customState.infraCostMultiplier,
    failureStrictness: normalizeFailureStrictness(customState.failureStrictness),
    populationEnabled: population.enabled,
    populationStrength: population.strength,
    substationRadiusProfile: normalizeSubstationRadiusProfile(customState.substationRadiusProfile),
    substationRadius: SUBSTATION_RADIUS_BY_PROFILE[
      normalizeSubstationRadiusProfile(customState.substationRadiusProfile)
    ],
    lineMaintenanceProfile: normalizeLineMaintenanceProfile(customState.lineMaintenanceProfile),
    lineMaintenanceMultiplier: LINE_MAINTENANCE_BY_PROFILE[
      normalizeLineMaintenanceProfile(customState.lineMaintenanceProfile)
    ],
    startingBudget: customState.budget,
    runTargetSec: customState.runTargetMinutes * 60,
    mission: null,
    mapSelectionId: terrainProfile.id,
    terrainMapId: terrainProfile.id,
    terrainMapLabel: terrainProfile.label,
    terrainMapImageUrl: terrainProfile.imageUrl,
    terrainMapMetadataUrl: terrainProfile.metadataUrl,
    sourceCustom: deepClone(customState),
    sparseStart: true,
    townEmergenceMode: normalizeTownEmergenceMode(
      customState.townEmergenceIntensity,
      population.enabled
    ),
  };
}

export function buildRunConfigForTutorial() {
  const terrainProfile = resolveTerrainMapProfile({
    mode: "tutorial",
    mapSelectionId: DEFAULT_TERRAIN_MAP_ID,
  });
  return {
    mode: "tutorial",
    label: "Tutorial",
    leaderboardClass: "custom",
    leaderboardEligible: false,
    demandGrowthMultiplier: 0.72,
    eventIntensity: 0.35,
    seasonalProfile: "neutral",
    climateIntensity: 0.8,
    infraCostMultiplier: 0.86,
    failureStrictness: 0.65,
    populationEnabled: false,
    populationStrength: 0,
    substationRadiusProfile: "wide",
    substationRadius: SUBSTATION_RADIUS_BY_PROFILE.wide,
    lineMaintenanceProfile: "low",
    lineMaintenanceMultiplier: LINE_MAINTENANCE_BY_PROFILE.low,
    startingBudget: 5000,
    runTargetSec: 0,
    mission: null,
    sourcePresetId: "tutorial",
    mapSelectionId: terrainProfile.id,
    terrainMapId: terrainProfile.id,
    terrainMapLabel: terrainProfile.label,
    terrainMapImageUrl: terrainProfile.imageUrl,
    terrainMapMetadataUrl: terrainProfile.metadataUrl,
    sparseStart: true,
    townEmergenceMode: "off",
  };
}
