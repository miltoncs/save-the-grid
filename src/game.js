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
} from "./data.js";

const TICK_SECONDS = 0.1;
const TOOL_BUILD = "build";
const TOOL_DEMOLISH = "demolish";
const TOOL_REROUTE = "reroute";
const ASSET_ORDER = ["plant", "substation", "storage"];
const PRIORITY_ORDER = ["low", "normal", "high"];
const DRAG_THRESHOLD_PX = 6;
const TERRAIN_MAP_IMAGE_URL = "/docs/mockups-ui-design/mockup-terrain-map.png";
const TERRAIN_MAP_METADATA_URL = "/docs/mockups-ui-design/mockup-terrain-map.metadata.json";
const ICON_SET_URLS = {
  town: {
    hamlet: "/docs/icons-circular/town-hamlet.svg",
    city: "/docs/icons-circular/town-city.svg",
    capital: "/docs/icons-circular/town-capital.svg",
  },
  resource: {
    wind: "/docs/icons-circular/plant-wind.svg",
    sun: "/docs/icons-circular/plant-solar.svg",
    natural_gas: "/docs/icons-circular/plant-gas.svg",
  },
};
const LIVABLE_TERRAINS = new Set(["plains", "river"]);
const TOWN_CAP_BY_DISTRICT = {
  "Urban Core": 5,
  "Industrial Belt": 4,
  "Coastal Corridor": 4,
  "Rural Cluster": 3,
};
const SPARSE_START_SEEDED_TOWNS = {
  capital: 2,
  north_industry: 1,
  south_farms: 1,
};
const RESOURCE_ZONE_COLORS = {
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatTime(seconds) {
  const clamped = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(clamped / 60)).padStart(2, "0");
  const ss = String(clamped % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pointInPolygon(point, polygon) {
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

function centroidFromPolygon(polygon) {
  if (!polygon.length) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const point of polygon) {
    sx += point.x;
    sy += point.y;
  }
  return { x: sx / polygon.length, y: sy / polygon.length };
}

function loadImageAsset(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function readJsonStorage(key, fallback) {
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

function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures in MVP.
  }
}

function toOrdinal(index) {
  const n = index + 1;
  if (n % 10 === 1 && n % 100 !== 11) return `${n}st`;
  if (n % 10 === 2 && n % 100 !== 12) return `${n}nd`;
  if (n % 10 === 3 && n % 100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function unlockedByFragmentation(fragmentation, regionId) {
  if (fragmentation === "none" || fragmentation === "open") return true;
  const alwaysOpen = new Set(["capital", "north_industry", "south_farms"]);
  if (fragmentation === "moderate") {
    const moderateOpen = new Set([
      "capital",
      "north_industry",
      "south_farms",
      "west_hydro",
      "east_coast",
    ]);
    return moderateOpen.has(regionId);
  }
  return alwaysOpen.has(regionId);
}

function normalizePopulationMode(mode) {
  if (mode === "off") {
    return { enabled: false, strength: 0 };
  }
  if (mode === "high") {
    return { enabled: true, strength: 1.45 };
  }
  return { enabled: true, strength: 1 };
}

function normalizeClimateIntensity(value) {
  if (typeof value === "number") return value;
  if (value === "low") return 0.82;
  if (value === "high") return 1.25;
  return 1;
}

function normalizeEventIntensity(value) {
  if (typeof value === "number") return value;
  if (value === "low") return 0.75;
  if (value === "high") return 1.3;
  return 1;
}

function normalizeFailureStrictness(value) {
  if (typeof value === "number") return value;
  if (value === "lenient") return 0.84;
  if (value === "strict") return 1.22;
  return 1;
}

function normalizeUnlockProfile(value) {
  if (value === "low") return 0.82;
  if (value === "high") return 1.3;
  return 1;
}

function normalizeTownEmergenceMode(value, populationEnabled = true) {
  if (value === "off" || value === "low" || value === "normal") return value;
  return populationEnabled ? "normal" : "low";
}

function getMissionTownEmergenceMode(missionId) {
  const missionIndex = CAMPAIGN_MISSIONS.findIndex((mission) => mission.id === missionId);
  if (missionIndex >= 0 && missionIndex <= 2) return "off";
  if (missionIndex >= 0 && missionIndex <= 4) return "low";
  return "normal";
}

function buildRunConfigFromStandardPreset(presetId) {
  const preset = STANDARD_PRESETS.find((item) => item.id === presetId) || STANDARD_PRESETS[0];
  const population = normalizePopulationMode(preset.populationMode);
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
    regionFragmentation: preset.regionFragmentation,
    unlockCostMultiplier: normalizeUnlockProfile(preset.unlockCostProfile),
    startingBudget: preset.budget,
    runTargetSec: 0,
    mission: null,
    sourcePresetId: preset.id,
    sparseStart: true,
    townEmergenceMode: "normal",
  };
}

function buildRunConfigFromCampaignMission(missionId) {
  const mission = CAMPAIGN_MISSIONS.find((item) => item.id === missionId) || CAMPAIGN_MISSIONS[0];
  const population = normalizePopulationMode(mission.populationMode);
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
    regionFragmentation: mission.fragmentation.toLowerCase() === "open" ? "open" : "high",
    unlockCostMultiplier: mission.fragmentation.toLowerCase() === "open" ? 0.95 : 1.12,
    startingBudget: mission.startingBudget,
    runTargetSec: mission.objective.targetDurationSec,
    mission,
    sourceMissionId: mission.id,
    sparseStart: true,
    townEmergenceMode: getMissionTownEmergenceMode(mission.id),
  };
}

function buildRunConfigFromCustom(customState) {
  const population = normalizePopulationMode(customState.populationMode);
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
    regionFragmentation: customState.regionFragmentation,
    unlockCostMultiplier: normalizeUnlockProfile(customState.unlockCostProfile),
    startingBudget: customState.budget,
    runTargetSec: customState.runTargetMinutes * 60,
    mission: null,
    sourceCustom: deepClone(customState),
    sparseStart: true,
    townEmergenceMode: normalizeTownEmergenceMode(null, population.enabled),
  };
}

class GameRuntime {
  constructor(options) {
    this.canvas = options.canvas;
    this.ctx = this.canvas.getContext("2d");
    this.config = deepClone(options.runConfig);
    this.applyRunConfigDefaults();
    this.snapshot = options.snapshot || null;
    this.callbacks = options.callbacks;
    this.settings = options.settings || DEFAULT_SETTINGS;

    this.running = false;
    this.paused = false;
    this.accumulator = 0;
    this.lastFrame = 0;
    this.renderPulse = 0;
    this.loopHandle = 0;
    this.mouse = {
      x: 0,
      y: 0,
      inside: false,
      edgePanReady: false,
      lastMoveX: null,
      lastMoveY: null,
    };
    this.pointerDown = {
      active: false,
      pointerId: null,
      button: null,
      startX: 0,
      startY: 0,
      startCamX: 0,
      startCamY: 0,
      dragging: false,
    };
    this.keyPan = {
      up: false,
      down: false,
      left: false,
      right: false,
    };

    this.zoomLevels = [0.55, 0.72, 0.9, 1.1, 1.32];
    this.camera = {
      x: BASE_MAP.width / 2,
      y: BASE_MAP.height / 2,
      zoomIndex: 2,
      dragActive: false,
      dragStartX: 0,
      dragStartY: 0,
      dragCamX: BASE_MAP.width / 2,
      dragCamY: BASE_MAP.height / 2,
    };

    this.tool = TOOL_BUILD;
    this.buildAssetType = "plant";
    this.selectedRegionId = null;
    this.highlightedAlertId = null;
    this.mapImage = null;
    this.mapImageReady = false;
    this.resourceZones = [];
    this.resourceZoneSummary = {
      wind: 0,
      sun: 0,
      natural_gas: 0,
    };
    this.resourceRevealHeld = false;
    this.iconSet = {
      town: {
        hamlet: null,
        city: null,
        capital: null,
      },
      resource: {
        wind: null,
        sun: null,
        natural_gas: null,
      },
    };

    this.state = this.snapshot ? this.rehydrateSnapshot(this.snapshot) : this.createFreshState();
    this.ensureRegionResourceProfiles();

    this.resizeObserver = null;
    this.boundResize = () => this.resizeCanvas();
    this.boundPointerMove = (event) => this.onPointerMove(event);
    this.boundPointerEnter = (event) => this.onPointerEnter(event);
    this.boundPointerLeave = () => this.onPointerLeave();
    this.boundPointerDown = (event) => this.onPointerDown(event);
    this.boundPointerUp = (event) => this.onPointerUp(event);
    this.boundWheel = (event) => this.onWheel(event);
    this.boundContextMenu = (event) => event.preventDefault();
    this.boundKeydown = (event) => this.onKeyDown(event);
    this.boundKeyup = (event) => this.onKeyUp(event);
    this.boundWindowBlur = () => this.onWindowBlur();

    this.bindInputs();
    this.resizeCanvas();
    this.pushHudUpdate();
    this.loadIconSet();
    this.loadMapAndResourceZones();
  }

  applyRunConfigDefaults() {
    if (this.config.sparseStart == null) {
      this.config.sparseStart = true;
    }
    this.config.townEmergenceMode = normalizeTownEmergenceMode(
      this.config.townEmergenceMode,
      this.config.populationEnabled !== false
    );
  }

  createEmptyResourceProfile() {
    return {
      wind: 0,
      sun: 0,
      natural_gas: 0,
    };
  }

  async loadIconSet() {
    const loads = [];
    for (const [groupKey, iconGroup] of Object.entries(ICON_SET_URLS)) {
      for (const [iconKey, iconUrl] of Object.entries(iconGroup)) {
        loads.push(
          loadImageAsset(iconUrl).then((image) => {
            this.iconSet[groupKey][iconKey] = image;
          })
        );
      }
    }
    await Promise.all(loads);
    this.render();
  }

  getTownCapForRegion(region) {
    return TOWN_CAP_BY_DISTRICT[region.districtType] || 4;
  }

  getSeededTownCount(region, unlocked, townCap) {
    if (!unlocked) return 0;
    if (this.config.sparseStart) {
      const seeded = SPARSE_START_SEEDED_TOWNS[region.id] || 0;
      return clamp(seeded, 0, townCap);
    }
    return clamp(Math.max(1, Math.round(townCap * 0.65)), 0, townCap);
  }

  getStarterAssetsForRegion(region, unlocked, seededTowns) {
    if (!unlocked) {
      return { plant: 0, substation: 0, storage: 0 };
    }
    if (!this.config.sparseStart) {
      return deepClone(region.starterAssets);
    }
    if (region.id === "capital") {
      return { plant: 2, substation: 1, storage: 0 };
    }
    if (seededTowns > 0) {
      return { plant: 0, substation: 1, storage: 0 };
    }
    return { plant: 0, substation: 0, storage: 0 };
  }

  getDemandAnchorForRegion(region) {
    const townCap = Math.max(1, Number(region.townCap) || this.getTownCapForRegion(region));
    const townCount = clamp(Number(region.townCount || 0), 0, townCap);
    if (townCount <= 0) return 0;
    const nominalBaseDemand = Number(region.nominalBaseDemand || region.baseDemand || 0);
    const townSaturation = townCount / townCap;
    return nominalBaseDemand * (0.08 + townSaturation * 0.88);
  }

  ensureRegionResourceProfiles() {
    for (const region of this.state.regions) {
      if (!region.resourceProfile) {
        region.resourceProfile = this.createEmptyResourceProfile();
      }
      region.resourceProfile.wind = clamp(Number(region.resourceProfile.wind || 0), 0, 1);
      region.resourceProfile.sun = clamp(Number(region.resourceProfile.sun || 0), 0, 1);
      region.resourceProfile.natural_gas = clamp(
        Number(region.resourceProfile.natural_gas || 0),
        0,
        1
      );
    }
  }

  async loadMapAndResourceZones() {
    const imagePromise = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = TERRAIN_MAP_IMAGE_URL;
    });

    const metadataPromise = fetch(TERRAIN_MAP_METADATA_URL)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);

    const [image, metadata] = await Promise.all([imagePromise, metadataPromise]);

    if (image) {
      this.mapImage = image;
      this.mapImageReady = true;
    }

    if (!metadata || !Array.isArray(metadata.resource_zones)) {
      this.render();
      return;
    }

    const sourceWidth = Number(metadata?.image?.width) || image?.naturalWidth || BASE_MAP.width;
    const sourceHeight = Number(metadata?.image?.height) || image?.naturalHeight || BASE_MAP.height;
    const scaleX = BASE_MAP.width / Math.max(1, sourceWidth);
    const scaleY = BASE_MAP.height / Math.max(1, sourceHeight);

    const zones = [];
    for (const rawZone of metadata.resource_zones) {
      if (!rawZone || !Array.isArray(rawZone.polygon) || rawZone.polygon.length < 3) continue;
      const resource = String(rawZone.resource || "");
      if (!RESOURCE_ZONE_COLORS[resource]) continue;
      const polygon = rawZone.polygon.map((point) => ({
        x: clamp(Number(point.x) * scaleX, 0, BASE_MAP.width),
        y: clamp(Number(point.y) * scaleY, 0, BASE_MAP.height),
      }));
      zones.push({
        id: String(rawZone.id || `zone-${zones.length + 1}`),
        resource,
        polygon,
        centroid: centroidFromPolygon(polygon),
      });
    }

    this.resourceZones = zones;
    this.resourceZoneSummary = {
      wind: zones.filter((zone) => zone.resource === "wind").length,
      sun: zones.filter((zone) => zone.resource === "sun").length,
      natural_gas: zones.filter((zone) => zone.resource === "natural_gas").length,
    };
    this.applyResourceCoverageToRegions();
    this.pushHudUpdate();
    this.render();
  }

  estimateZoneCoverageForRegion(region, zonePolygon) {
    // Fast radial sample to estimate overlap between a circular region and polygon zones.
    const samples = [{ x: region.x, y: region.y }];
    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12;
      samples.push({
        x: region.x + Math.cos(angle) * region.radius * 0.55,
        y: region.y + Math.sin(angle) * region.radius * 0.55,
      });
      samples.push({
        x: region.x + Math.cos(angle) * region.radius * 0.92,
        y: region.y + Math.sin(angle) * region.radius * 0.92,
      });
    }

    let insideCount = 0;
    for (const sample of samples) {
      if (pointInPolygon(sample, zonePolygon)) insideCount += 1;
    }
    return insideCount / samples.length;
  }

  applyResourceCoverageToRegions() {
    for (const region of this.state.regions) {
      const profile = this.createEmptyResourceProfile();
      for (const zone of this.resourceZones) {
        const coverage = this.estimateZoneCoverageForRegion(region, zone.polygon);
        if (coverage <= 0) continue;
        profile[zone.resource] = clamp(profile[zone.resource] + coverage, 0, 1);
      }
      region.resourceProfile = profile;
    }
  }

  createFreshState() {
    const regions = BASE_MAP.regions.map((region) => {
      const unlocked = unlockedByFragmentation(this.config.regionFragmentation, region.id);
      const townCap = this.getTownCapForRegion(region);
      const townCount = this.getSeededTownCount(region, unlocked, townCap);
      const assets = this.getStarterAssetsForRegion(region, unlocked, townCount);
      const demandAnchor = unlocked ? this.getDemandAnchorForRegion({ ...region, townCap, townCount }) : 0;
      return {
        ...deepClone(region),
        unlocked,
        priority: "normal",
        townCount,
        townCap,
        nominalBaseDemand: region.baseDemand,
        stableServiceSeconds: townCount > 0 ? 8 : 0,
        outageSeconds: 0,
        assets,
        resourceProfile: this.createEmptyResourceProfile(),
        demand: demandAnchor,
        targetDemand: demandAnchor,
        served: demandAnchor,
        unmet: 0,
        utilization: demandAnchor > 0 ? 1 : 0,
        demandEventMultiplier: 1,
        lineEventMultiplier: 1,
        selected: false,
        cooldownUntil: 0,
      };
    });

    const links = BASE_MAP.links.map((link) => ({
      ...deepClone(link),
      used: 0,
      safeCapacity: link.baseCapacity,
      hardCapacity: link.baseCapacity * 1.15,
      stress: 0,
      overload: false,
    }));

    return {
      runtimeSeconds: 0,
      budget: this.config.startingBudget,
      reliability: 84,
      score: 0,
      hiddenTrust: 75,
      lawsuits: 0,
      totalDemand: 0,
      totalServed: 0,
      totalUnmet: 0,
      seasonIndex: 0,
      seasonTimer: 0,
      seasonLabel: "neutral",
      alerts: [],
      incidents: [],
      objectiveLog: [],
      timeline: [
        {
          at: 0,
          text: "Run initiated by the Energy Directory.",
        },
      ],
      townsEmerged: 0,
      nextTownEmergenceAt: randomRange(44, 70),
      nextEventAt: randomRange(20, 34),
      nextNewsAt: 7,
      nextLawsuitEligibleAt: 45,
      collapseSeconds: 0,
      regions,
      links,
    };
  }

  rehydrateSnapshot(snapshot) {
    const safe = deepClone(snapshot);
    safe.links = safe.links || [];
    safe.regions = safe.regions || [];
    safe.alerts = safe.alerts || [];
    safe.incidents = safe.incidents || [];
    safe.timeline = safe.timeline || [];
    for (const region of safe.regions) {
      region.townCap = Math.max(1, Number(region.townCap) || this.getTownCapForRegion(region));
      const fallbackTownCount = region.unlocked ? 1 : 0;
      region.townCount = clamp(
        Number(region.townCount ?? fallbackTownCount),
        0,
        region.townCap
      );
      region.nominalBaseDemand = Number(region.nominalBaseDemand || region.baseDemand || 0);
      region.stableServiceSeconds = Math.max(0, Number(region.stableServiceSeconds || 0));
      region.outageSeconds = Math.max(0, Number(region.outageSeconds || 0));
    }
    if (!safe.nextEventAt) safe.nextEventAt = safe.runtimeSeconds + randomRange(20, 34);
    if (!safe.nextNewsAt) safe.nextNewsAt = safe.runtimeSeconds + 7;
    if (!safe.nextLawsuitEligibleAt) safe.nextLawsuitEligibleAt = safe.runtimeSeconds + 45;
    if (!safe.nextTownEmergenceAt) safe.nextTownEmergenceAt = safe.runtimeSeconds + randomRange(44, 70);
    if (!Number.isFinite(safe.townsEmerged)) safe.townsEmerged = 0;
    safe.totalDemand = safe.totalDemand || 0;
    safe.totalServed = safe.totalServed || 0;
    safe.totalUnmet = safe.totalUnmet || 0;
    return safe;
  }

  bindInputs() {
    this.canvas.addEventListener("pointermove", this.boundPointerMove);
    this.canvas.addEventListener("pointerenter", this.boundPointerEnter);
    this.canvas.addEventListener("pointerleave", this.boundPointerLeave);
    this.canvas.addEventListener("pointerdown", this.boundPointerDown);
    window.addEventListener("pointerup", this.boundPointerUp);
    this.canvas.addEventListener("wheel", this.boundWheel, { passive: false });
    this.canvas.addEventListener("contextmenu", this.boundContextMenu);
    window.addEventListener("keydown", this.boundKeydown);
    window.addEventListener("keyup", this.boundKeyup);
    window.addEventListener("blur", this.boundWindowBlur);
    window.addEventListener("resize", this.boundResize);
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.canvas.parentElement);
  }

  unbindInputs() {
    this.canvas.removeEventListener("pointermove", this.boundPointerMove);
    this.canvas.removeEventListener("pointerenter", this.boundPointerEnter);
    this.canvas.removeEventListener("pointerleave", this.boundPointerLeave);
    this.canvas.removeEventListener("pointerdown", this.boundPointerDown);
    window.removeEventListener("pointerup", this.boundPointerUp);
    this.canvas.removeEventListener("wheel", this.boundWheel);
    this.canvas.removeEventListener("contextmenu", this.boundContextMenu);
    window.removeEventListener("keydown", this.boundKeydown);
    window.removeEventListener("keyup", this.boundKeyup);
    window.removeEventListener("blur", this.boundWindowBlur);
    window.removeEventListener("resize", this.boundResize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  resizeCanvas() {
    const holder = this.canvas.parentElement;
    if (!holder) return;
    const rect = holder.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(640, Math.floor(rect.width));
    const height = Math.max(380, Math.floor(rect.height));
    this.canvas.width = Math.floor(width * pixelRatio);
    this.canvas.height = Math.floor(height * pixelRatio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.clampCameraToMap(width, height);
    this.render();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    this.loopHandle = requestAnimationFrame((timestamp) => this.frame(timestamp));
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.loopHandle);
    this.unbindInputs();
  }

  frame(timestamp) {
    if (!this.running) return;
    const dt = Math.min(0.25, (timestamp - this.lastFrame) / 1000);
    this.lastFrame = timestamp;

    if (!this.paused) {
      this.accumulator += dt;
      while (this.accumulator >= TICK_SECONDS) {
        this.stepSimulation(TICK_SECONDS);
        this.accumulator -= TICK_SECONDS;
      }
    }

    this.renderPulse += dt;
    this.handleKeyboardPan(dt);
    this.handleEdgePan(dt);
    this.render();
    this.loopHandle = requestAnimationFrame((next) => this.frame(next));
  }

  advanceTime(ms) {
    const safeMs = Math.max(0, ms);
    const steps = Math.max(1, Math.round(safeMs / (TICK_SECONDS * 1000)));
    for (let i = 0; i < steps; i += 1) {
      if (!this.paused) {
        this.stepSimulation(TICK_SECONDS);
      }
      this.renderPulse += TICK_SECONDS;
    }
    this.render();
    return Promise.resolve();
  }

  syncPointerFromEvent(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = event.clientX - rect.left;
    this.mouse.y = event.clientY - rect.top;
    this.mouse.inside =
      this.mouse.x >= 0 &&
      this.mouse.y >= 0 &&
      this.mouse.x <= rect.width &&
      this.mouse.y <= rect.height;
  }

  onPointerEnter(event) {
    this.syncPointerFromEvent(event);
    this.mouse.edgePanReady = false;
    this.mouse.lastMoveX = this.mouse.x;
    this.mouse.lastMoveY = this.mouse.y;
  }

  onPointerLeave() {
    this.mouse.inside = false;
    this.mouse.edgePanReady = false;
    this.mouse.lastMoveX = null;
    this.mouse.lastMoveY = null;
    this.pointerDown.active = false;
    this.pointerDown.dragging = false;
    this.camera.dragActive = false;
  }

  onPointerMove(event) {
    this.syncPointerFromEvent(event);
    if (this.mouse.lastMoveX != null && this.mouse.lastMoveY != null) {
      const moveDistance = Math.hypot(
        this.mouse.x - this.mouse.lastMoveX,
        this.mouse.y - this.mouse.lastMoveY
      );
      if (moveDistance > 0.5) {
        this.mouse.edgePanReady = true;
      }
    }
    this.mouse.lastMoveX = this.mouse.x;
    this.mouse.lastMoveY = this.mouse.y;

    if (
      this.pointerDown.active &&
      this.pointerDown.button === 0 &&
      !this.pointerDown.dragging
    ) {
      const distance = Math.hypot(
        event.clientX - this.pointerDown.startX,
        event.clientY - this.pointerDown.startY
      );
      if (distance >= DRAG_THRESHOLD_PX) {
        this.pointerDown.dragging = true;
        this.camera.dragActive = true;
        this.camera.dragStartX = this.pointerDown.startX;
        this.camera.dragStartY = this.pointerDown.startY;
        this.camera.dragCamX = this.pointerDown.startCamX;
        this.camera.dragCamY = this.pointerDown.startCamY;
      }
    }

    if (this.camera.dragActive) {
      const zoom = this.zoomLevels[this.camera.zoomIndex];
      const dx = (event.clientX - this.camera.dragStartX) / zoom;
      const dy = (event.clientY - this.camera.dragStartY) / zoom;
      this.camera.x = this.camera.dragCamX - dx;
      this.camera.y = this.camera.dragCamY - dy;
      this.clampCameraToMap();
    }
  }

  onPointerDown(event) {
    this.syncPointerFromEvent(event);
    this.mouse.edgePanReady = true;
    if (
      event.button === 1 ||
      (event.button === 0 && event.altKey)
    ) {
      this.camera.dragActive = true;
      this.camera.dragStartX = event.clientX;
      this.camera.dragStartY = event.clientY;
      this.camera.dragCamX = this.camera.x;
      this.camera.dragCamY = this.camera.y;
      return;
    }

    if (event.button === 0) {
      this.pointerDown.active = true;
      this.pointerDown.pointerId = event.pointerId;
      this.pointerDown.button = event.button;
      this.pointerDown.startX = event.clientX;
      this.pointerDown.startY = event.clientY;
      this.pointerDown.startCamX = this.camera.x;
      this.pointerDown.startCamY = this.camera.y;
      this.pointerDown.dragging = false;
      if (typeof this.canvas.setPointerCapture === "function") {
        try {
          this.canvas.setPointerCapture(event.pointerId);
        } catch {
          // Ignore unsupported pointer-capture environments.
        }
      }
      return;
    }

    if (event.button === 2) {
      this.handleSecondaryClick();
      this.pushHudUpdate();
      return;
    }
  }

  onPointerUp(event) {
    this.syncPointerFromEvent(event);

    if (
      this.pointerDown.active &&
      this.pointerDown.pointerId === event.pointerId &&
      this.pointerDown.button === 0
    ) {
      const wasDrag = this.pointerDown.dragging || this.camera.dragActive;
      this.pointerDown.active = false;
      this.pointerDown.pointerId = null;
      this.pointerDown.button = null;
      this.pointerDown.dragging = false;
      this.camera.dragActive = false;
      if (typeof this.canvas.releasePointerCapture === "function") {
        try {
          this.canvas.releasePointerCapture(event.pointerId);
        } catch {
          // Ignore unsupported pointer-capture environments.
        }
      }
      if (!wasDrag) {
        this.handlePrimaryClick();
      }
      return;
    }

    this.camera.dragActive = false;
  }

  onWheel(event) {
    event.preventDefault();
    const delta = Math.sign(event.deltaY);
    this.camera.zoomIndex = clamp(this.camera.zoomIndex - delta, 0, this.zoomLevels.length - 1);
    this.clampCameraToMap();
  }

  onKeyDown(event) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
      return;
    }

    if (event.code === "KeyW" || event.code === "ArrowUp") {
      event.preventDefault();
      this.keyPan.up = true;
      return;
    }

    if (event.code === "KeyS" || event.code === "ArrowDown") {
      event.preventDefault();
      this.keyPan.down = true;
      return;
    }

    if (event.code === "KeyA" || event.code === "ArrowLeft") {
      event.preventDefault();
      this.keyPan.left = true;
      return;
    }

    if (event.code === "KeyD" || event.code === "ArrowRight") {
      event.preventDefault();
      this.keyPan.right = true;
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      this.togglePause();
      return;
    }

    if (event.code === "Digit1") {
      this.tool = TOOL_BUILD;
      this.buildAssetType = "plant";
      this.pushHudUpdate();
      return;
    }

    if (event.code === "Digit2") {
      this.tool = TOOL_BUILD;
      this.buildAssetType = "substation";
      this.pushHudUpdate();
      return;
    }

    if (event.code === "Digit3") {
      this.tool = TOOL_BUILD;
      this.buildAssetType = "storage";
      this.pushHudUpdate();
      return;
    }

    if (event.code === "KeyX") {
      this.tool = TOOL_DEMOLISH;
      this.pushHudUpdate();
      return;
    }

    if (event.code === "KeyR") {
      if (!this.resourceRevealHeld) {
        this.resourceRevealHeld = true;
        this.render();
      }
      return;
    }

    if (event.code === "KeyE" || event.code === "KeyB") {
      this.tool = TOOL_REROUTE;
      this.pushHudUpdate();
      return;
    }

    if (event.code === "Tab") {
      event.preventDefault();
      this.cycleCriticalAlert();
      return;
    }

    if (event.code === "Enter") {
      this.cycleCriticalAlert();
      return;
    }

    if (event.code === "Escape") {
      this.selectedRegionId = null;
      this.pushHudUpdate();
      return;
    }

    if (event.code === "KeyF") {
      this.toggleFullscreen();
    }
  }

  onKeyUp(event) {
    if (event.code === "KeyW" || event.code === "ArrowUp") {
      this.keyPan.up = false;
      return;
    }
    if (event.code === "KeyS" || event.code === "ArrowDown") {
      this.keyPan.down = false;
      return;
    }
    if (event.code === "KeyA" || event.code === "ArrowLeft") {
      this.keyPan.left = false;
      return;
    }
    if (event.code === "KeyD" || event.code === "ArrowRight") {
      this.keyPan.right = false;
      return;
    }
    if (event.code === "KeyR") {
      if (this.resourceRevealHeld) {
        this.resourceRevealHeld = false;
        this.render();
      }
    }
  }

  onWindowBlur() {
    this.keyPan.up = false;
    this.keyPan.down = false;
    this.keyPan.left = false;
    this.keyPan.right = false;
    this.resourceRevealHeld = false;
    this.pointerDown.active = false;
    this.pointerDown.dragging = false;
    this.camera.dragActive = false;
  }

  togglePause() {
    this.paused = !this.paused;
    this.pushAlert(
      this.paused ? "Simulation paused." : "Simulation resumed.",
      this.paused ? "advisory" : "warning",
      5
    );
    this.pushHudUpdate();
  }

  cycleCriticalAlert() {
    const critical = this.state.alerts.filter((alert) => alert.level === "critical");
    if (!critical.length) return;
    const currentIndex = critical.findIndex((item) => item.id === this.highlightedAlertId);
    const next = critical[(currentIndex + 1) % critical.length];
    this.highlightedAlertId = next.id;
    this.callbacks.onHighlightAlert(next.id);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      return;
    }
    document.exitFullscreen().catch(() => {});
  }

  screenToWorld(screenX, screenY) {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const zoom = this.zoomLevels[this.camera.zoomIndex];
    const wx = this.camera.x + (screenX - width / 2) / zoom;
    const wy = this.camera.y + (screenY - height / 2) / zoom;
    return { x: wx, y: wy };
  }

  worldToScreen(worldX, worldY) {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const zoom = this.zoomLevels[this.camera.zoomIndex];
    const sx = (worldX - this.camera.x) * zoom + width / 2;
    const sy = (worldY - this.camera.y) * zoom + height / 2;
    return { x: sx, y: sy };
  }

  clampCameraToMap(viewWidth = this.canvas.clientWidth, viewHeight = this.canvas.clientHeight) {
    const zoom = this.zoomLevels[this.camera.zoomIndex] || 1;
    if (!viewWidth || !viewHeight || zoom <= 0) return;

    const halfViewWorldWidth = viewWidth / (2 * zoom);
    const halfViewWorldHeight = viewHeight / (2 * zoom);
    const mapMidX = BASE_MAP.width / 2;
    const mapMidY = BASE_MAP.height / 2;

    if (halfViewWorldWidth >= mapMidX) {
      this.camera.x = mapMidX;
    } else {
      this.camera.x = clamp(this.camera.x, halfViewWorldWidth, BASE_MAP.width - halfViewWorldWidth);
    }

    if (halfViewWorldHeight >= mapMidY) {
      this.camera.y = mapMidY;
    } else {
      this.camera.y = clamp(
        this.camera.y,
        halfViewWorldHeight,
        BASE_MAP.height - halfViewWorldHeight
      );
    }
  }

  findRegionAt(worldX, worldY) {
    for (let i = this.state.regions.length - 1; i >= 0; i -= 1) {
      const region = this.state.regions[i];
      const dx = worldX - region.x;
      const dy = worldY - region.y;
      if (Math.hypot(dx, dy) <= region.radius) {
        return region;
      }
    }
    return null;
  }

  findRegion(regionId) {
    return this.state.regions.find((region) => region.id === regionId) || null;
  }

  findLink(linkId) {
    return this.state.links.find((link) => link.id === linkId) || null;
  }

  handleBuild(region) {
    const rule = ASSET_RULES[this.buildAssetType];
    if (!rule) return;

    if (this.state.runtimeSeconds < region.cooldownUntil) {
      this.pushAlert(
        `${region.name} slot cooling down after demolition.`,
        "advisory",
        4
      );
      return;
    }

    const terrainFactor = TERRAIN_COST_MULTIPLIERS[region.terrain] || 1;
    const globalCostFactor = this.getModifierValue("build_cost", 1);
    const rawCost = rule.cost * terrainFactor * this.config.infraCostMultiplier * globalCostFactor;
    const cost = Math.ceil(rawCost);

    if (this.state.budget < cost) {
      this.pushAlert("Insufficient budget for selected build.", "warning", 5);
      return;
    }

    region.assets[this.buildAssetType] += 1;
    this.state.budget -= cost;
    this.state.score += 5;
    this.logTimeline(`Built ${rule.label} in ${region.name} (${cost} budget).`);
    this.pushAlert(`${rule.label} commissioned in ${region.name}.`, "advisory", 4);
  }

  handleDemolish(region) {
    const assetType = this.buildAssetType;
    const rule = ASSET_RULES[assetType];
    if (!rule) return;

    if (region.assets[assetType] <= 0) {
      this.pushAlert(`No ${rule.label.toLowerCase()} available to demolish.`, "advisory", 4);
      return;
    }

    region.assets[assetType] -= 1;
    const refund = Math.floor(rule.cost * rule.refundRatio);
    this.state.budget += refund;
    region.cooldownUntil = this.state.runtimeSeconds + 4.5;
    this.logTimeline(`Demolished ${rule.label} in ${region.name} (+${refund} budget refund).`);
    this.pushAlert(`${rule.label} demolished in ${region.name}.`, "warning", 4);
  }

  handleReroute(region) {
    const currentIndex = PRIORITY_ORDER.indexOf(region.priority);
    region.priority = PRIORITY_ORDER[(currentIndex + 1) % PRIORITY_ORDER.length];
    this.logTimeline(`${region.name} routing priority set to ${region.priority.toUpperCase()}.`);
    this.pushAlert(`${region.name} rerouted to ${region.priority} priority.`, "advisory", 4);
  }

  tryUnlockRegion(region) {
    if (region.unlocked) return;
    const baseCost = region.unlockCost * this.config.unlockCostMultiplier;
    const cost = Math.ceil(baseCost);

    if (this.state.budget < cost) {
      this.pushAlert(`Cannot unlock ${region.name}: need ${cost} budget.`, "warning", 5);
      return;
    }

    region.unlocked = true;
    this.state.budget -= cost;
    this.state.score += 30;
    this.logTimeline(`Unlocked ${region.name} for ${cost} budget.`);
    if ((region.townCount || 0) > 0) {
      this.pushAlert(`${region.name} unlocked. New demand obligations activated.`, "warning", 6);
    } else {
      this.pushAlert(
        `${region.name} unlocked. Sparse terrain active; towns may emerge with stable nearby service.`,
        "advisory",
        7
      );
    }
  }

  handlePrimaryClick() {
    const worldPoint = this.screenToWorld(this.mouse.x, this.mouse.y);
    const region = this.findRegionAt(worldPoint.x, worldPoint.y);
    if (!region) {
      this.selectedRegionId = null;
      this.pushHudUpdate();
      return;
    }

    this.selectedRegionId = region.id;
    if (this.tool === TOOL_BUILD) {
      if (!region.unlocked) {
        this.tryUnlockRegion(region);
      } else {
        this.handleBuild(region);
      }
    } else if (this.tool === TOOL_DEMOLISH) {
      this.handleDemolish(region);
    } else if (this.tool === TOOL_REROUTE) {
      this.handleReroute(region);
    }
    this.pushHudUpdate();
  }

  handleSecondaryClick() {
    const worldPoint = this.screenToWorld(this.mouse.x, this.mouse.y);
    const region = this.findRegionAt(worldPoint.x, worldPoint.y);
    if (!region) {
      this.selectedRegionId = null;
      this.pushHudUpdate();
      return;
    }
    this.selectedRegionId = region.id;
    this.handleDemolish(region);
    this.pushHudUpdate();
  }

  handleKeyboardPan(dt) {
    const panX = (this.keyPan.right ? 1 : 0) - (this.keyPan.left ? 1 : 0);
    const panY = (this.keyPan.down ? 1 : 0) - (this.keyPan.up ? 1 : 0);
    if (!panX && !panY) return;

    const speed = 520;
    const zoom = this.zoomLevels[this.camera.zoomIndex];
    const magnitude = Math.hypot(panX, panY) || 1;
    const nx = panX / magnitude;
    const ny = panY / magnitude;

    this.camera.x += (nx * speed * dt) / zoom;
    this.camera.y += (ny * speed * dt) / zoom;
    this.clampCameraToMap();
  }

  handleEdgePan(dt) {
    if (!this.mouse.inside || !this.mouse.edgePanReady || this.camera.dragActive) return;
    const edge = 28;
    const speed = 340;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    let panX = 0;
    let panY = 0;

    if (this.mouse.x <= edge) panX -= 1;
    if (this.mouse.x >= width - edge) panX += 1;
    if (this.mouse.y <= edge) panY -= 1;
    if (this.mouse.y >= height - edge) panY += 1;

    if (!panX && !panY) return;
    const zoom = this.zoomLevels[this.camera.zoomIndex];
    this.camera.x += (panX * speed * dt) / zoom;
    this.camera.y += (panY * speed * dt) / zoom;
    this.clampCameraToMap();
  }

  stepSimulation(dt) {
    this.state.runtimeSeconds += dt;

    this.updateSeason(dt);
    this.expireIncidents();
    this.spawnEventsIfNeeded();
    this.updateDemand(dt);
    this.resolveGrid();
    this.updateTownServiceStability(dt);
    this.updateTownEmergence();
    this.updateEconomyAndReliability(dt);
    this.updateScoring(dt);
    this.evaluateObjectiveAndEndConditions(dt);
    this.emitNewsIfNeeded();

    this.trimAlerts();
    this.pushHudUpdate();
  }

  updateSeason(dt) {
    if (this.config.seasonalProfile === "neutral") {
      this.state.seasonLabel = "neutral";
      return;
    }

    this.state.seasonTimer += dt;
    const seasonLength = this.config.mode === "campaign" ? 85 : 100;

    if (this.state.seasonTimer >= seasonLength) {
      this.state.seasonTimer = 0;
      this.state.seasonIndex = (this.state.seasonIndex + 1) % SEASON_ORDER.length;
      this.state.seasonLabel = SEASON_ORDER[this.state.seasonIndex];
      this.pushAlert(
        `Season shift: ${this.state.seasonLabel.toUpperCase()} pressure active.`,
        "advisory",
        6
      );
    }

    if (!this.state.seasonLabel || this.state.seasonLabel === "neutral") {
      this.state.seasonLabel = SEASON_ORDER[this.state.seasonIndex % SEASON_ORDER.length];
    }

    if (this.config.seasonalProfile === "winter-peak") {
      this.state.seasonLabel = "winter";
    } else if (this.config.seasonalProfile === "summer-peak") {
      this.state.seasonLabel = "summer";
    }
  }

  expireIncidents() {
    const now = this.state.runtimeSeconds;
    this.state.incidents = this.state.incidents.filter((incident) => {
      if (incident.expiresAt <= now) {
        this.logTimeline(`Incident resolved: ${incident.title}.`);
        this.pushAlert(`${incident.title} resolved.`, "advisory", 4);
        return false;
      }
      return true;
    });
  }

  spawnEventsIfNeeded() {
    if (this.state.runtimeSeconds < this.state.nextEventAt) {
      return;
    }

    const intervalBase = randomRange(24, 40);
    this.state.nextEventAt = this.state.runtimeSeconds + intervalBase / this.config.eventIntensity;

    const unlockedRegions = this.state.regions.filter(
      (region) => region.unlocked && (region.townCount || 0) > 0
    );
    const activeRegions = unlockedRegions.length
      ? unlockedRegions
      : this.state.regions.filter((region) => region.unlocked);
    if (!activeRegions.length) {
      return;
    }

    const coastRegions = activeRegions.filter((region) => region.terrain === "coast");
    const coldRegions = activeRegions.filter((region) => region.climate === "cold");
    const warmRegions = activeRegions.filter((region) => region.climate === "warm");

    const events = [];

    if (warmRegions.length) {
      const target = pickRandom(warmRegions);
      events.push({
        title: `Heat wave in ${target.name}`,
        body: "Cooling demand surges in warm regions.",
        level: "warning",
        duration: 22,
        type: "demand_boost",
        regionId: target.id,
        multiplier: 1.28,
      });
    }

    if (coldRegions.length) {
      const target = pickRandom(coldRegions);
      events.push({
        title: `Cold snap in ${target.name}`,
        body: "Heating pressure increases cold-region load.",
        level: "warning",
        duration: 20,
        type: "demand_boost",
        regionId: target.id,
        multiplier: 1.25,
      });
    }

    if (coastRegions.length) {
      const target = pickRandom(coastRegions);
      events.push({
        title: `Coastal storm near ${target.name}`,
        body: "Transmission resilience is reduced in coastal links.",
        level: "critical",
        duration: 18,
        type: "line_cap",
        regionId: target.id,
        multiplier: 0.65,
      });
    }

    events.push({
      title: "Fuel price shock",
      body: "Operating burden rises temporarily.",
      level: "warning",
      duration: 20,
      type: "operating_cost",
      multiplier: 1.28,
    });

    events.push({
      title: "Policy rebate window",
      body: "Infrastructure costs temporarily reduced.",
      level: "advisory",
      duration: 16,
      type: "build_cost",
      multiplier: 0.82,
    });

    const selected = pickRandom(events);
    const incident = {
      id: `incident-${Math.round(performance.now() * Math.random())}`,
      ...selected,
      startsAt: this.state.runtimeSeconds,
      expiresAt: this.state.runtimeSeconds + selected.duration,
    };

    this.state.incidents.push(incident);
    this.pushAlert(`${incident.title}: ${incident.body}`, incident.level, incident.duration);
    this.logTimeline(`Incident triggered: ${incident.title}.`);
  }

  updateDemand(dt) {
    const seasonLabel = this.state.seasonLabel || "neutral";
    const seasonProfile = CLIMATE_MULTIPLIERS[seasonLabel] || CLIMATE_MULTIPLIERS.neutral;

    for (const region of this.state.regions) {
      if (!region.unlocked) {
        region.demand = 0;
        region.targetDemand = 0;
        region.served = 0;
        region.unmet = 0;
        region.utilization = 0;
        continue;
      }

      if (this.config.populationEnabled) {
        region.population += region.growthRate * this.config.populationStrength * dt;
      }

      const demandAnchor = this.getDemandAnchorForRegion(region);
      if (demandAnchor <= 0) {
        region.targetDemand = 0;
        region.demand = lerp(region.demand, 0, 0.45);
        region.served = 0;
        region.unmet = 0;
        region.utilization = 1;
        continue;
      }

      const climateMultiplier =
        1 + ((seasonProfile[region.climate] || 1) - 1) * this.config.climateIntensity;
      const populationMultiplier =
        1 + ((region.population - 20) / 100) * 0.52 * this.config.demandGrowthMultiplier;
      const volatility =
        region.districtType === "Industrial Belt"
          ? 1 + Math.sin(this.state.runtimeSeconds * 0.45) * 0.1
          : region.districtType === "Urban Core"
            ? 1 + Math.sin(this.state.runtimeSeconds * 0.22 + region.x * 0.01) * 0.06
            : 1 + Math.sin(this.state.runtimeSeconds * 0.13 + region.y * 0.008) * 0.04;

      const incidentDemand = this.getIncidentMultiplierForRegion(region.id, "demand_boost");
      const targetDemand = clamp(
        demandAnchor * populationMultiplier * climateMultiplier * volatility * incidentDemand,
        8,
        420
      );

      region.targetDemand = targetDemand;
      region.demand = lerp(region.demand, targetDemand, 0.36);
      region.served = 0;
      region.unmet = 0;
      region.utilization = 0;
    }
  }

  isRegionLivableForTown(region) {
    return LIVABLE_TERRAINS.has(region.terrain);
  }

  hasStableNeighborService(region) {
    if (region.id === "capital") {
      return this.state.reliability >= 58 || region.utilization >= 0.78;
    }

    for (const link of this.state.links) {
      if (link.a !== region.id && link.b !== region.id) continue;
      if (link.safeCapacity <= 0 || link.overload) continue;

      const neighborId = link.a === region.id ? link.b : link.a;
      const neighbor = this.findRegion(neighborId);
      if (!neighbor || !neighbor.unlocked) continue;

      const neighborStable =
        ((neighbor.townCount || 0) > 0 ? neighbor.utilization >= 0.8 : true) &&
        (neighbor.outageSeconds || 0) < 5;
      if (neighborStable) {
        return true;
      }
    }
    return false;
  }

  updateTownServiceStability(dt) {
    for (const region of this.state.regions) {
      if (!region.unlocked) {
        region.stableServiceSeconds = 0;
        region.outageSeconds = 0;
        continue;
      }

      const hasDemand = region.demand > 1;
      const localStable = !hasDemand || region.utilization >= 0.84;
      const stableNeighbor = this.hasStableNeighborService(region);
      const stable = localStable && stableNeighbor && this.state.reliability >= 52;

      if (stable) {
        region.stableServiceSeconds = clamp(region.stableServiceSeconds + dt, 0, 360);
      } else {
        region.stableServiceSeconds = Math.max(0, region.stableServiceSeconds - dt * 1.2);
      }

      if ((region.townCount || 0) > 0 && hasDemand && region.utilization < 0.5) {
        region.outageSeconds = clamp(region.outageSeconds + dt, 0, 360);
      } else {
        region.outageSeconds = Math.max(0, region.outageSeconds - dt * 0.8);
      }
    }
  }

  getTownEmergenceProfile() {
    if (this.config.townEmergenceMode === "off") return null;
    if (this.config.townEmergenceMode === "low") {
      return {
        minStableSeconds: 28,
        intervalMin: 85,
        intervalMax: 125,
        maxEmergences: 4,
        reliabilityFloor: 64,
      };
    }
    return {
      minStableSeconds: 16,
      intervalMin: 48,
      intervalMax: 82,
      maxEmergences: 10,
      reliabilityFloor: 56,
    };
  }

  updateTownEmergence() {
    const profile = this.getTownEmergenceProfile();
    if (!profile) return;
    if (this.state.runtimeSeconds < this.state.nextTownEmergenceAt) return;

    this.state.nextTownEmergenceAt =
      this.state.runtimeSeconds + randomRange(profile.intervalMin, profile.intervalMax);

    if (this.state.townsEmerged >= profile.maxEmergences) return;
    if (this.state.reliability < profile.reliabilityFloor) return;

    const candidates = this.state.regions.filter((region) => {
      if (!region.unlocked) return false;
      if (!this.isRegionLivableForTown(region)) return false;
      if ((region.townCount || 0) >= (region.townCap || 1)) return false;
      if ((region.stableServiceSeconds || 0) < profile.minStableSeconds) return false;
      if ((region.outageSeconds || 0) >= 8) return false;
      return this.hasStableNeighborService(region);
    });

    if (!candidates.length) return;

    const scored = candidates
      .map((region) => {
        const openSlots = Math.max(1, (region.townCap || 1) - (region.townCount || 0));
        return {
          region,
          score: openSlots * 2.2 + (region.stableServiceSeconds || 0) * 0.08 + Math.random(),
        };
      })
      .sort((a, b) => b.score - a.score);

    const target = scored[0].region;
    target.townCount = clamp((target.townCount || 0) + 1, 0, target.townCap || 1);
    target.population += randomRange(3.5, 8.5);
    target.stableServiceSeconds = Math.max(0, target.stableServiceSeconds - 8);
    this.state.townsEmerged += 1;
    this.state.score += 12;
    this.logTimeline(`Town emerged in ${target.name}; new local demand activated.`);
    this.pushAlert(`New town emerged in ${target.name}. Demand baseline increased.`, "warning", 6);
  }

  resolveGrid() {
    for (const link of this.state.links) {
      link.used = 0;
      link.stress = 0;
      link.overload = false;
      const a = this.findRegion(link.a);
      const b = this.findRegion(link.b);
      if (!a || !b || !a.unlocked || !b.unlocked) {
        link.safeCapacity = 0;
        link.hardCapacity = 0;
        continue;
      }

      const substationBoost = ((a.assets.substation || 0) + (b.assets.substation || 0)) * 9;
      const lineEventMultiplier = this.getLineModifierForLink(link);
      link.safeCapacity = (link.baseCapacity + substationBoost) * lineEventMultiplier;
      link.hardCapacity = link.safeCapacity * 1.15;
    }

    const unlocked = this.state.regions.filter((region) => region.unlocked);
    let pool = 0;

    for (const region of unlocked) {
      const resource = region.resourceProfile || this.createEmptyResourceProfile();
      const plantBoostMultiplier = clamp(
        1 + resource.wind * 0.16 + resource.sun * 0.14 + resource.natural_gas * 0.2,
        1,
        1.5
      );
      const storageBoostMultiplier = clamp(1 + resource.wind * 0.05 + resource.sun * 0.08, 1, 1.2);
      const localGeneration =
        region.assets.plant * ASSET_RULES.plant.generation * plantBoostMultiplier +
        region.assets.storage * ASSET_RULES.storage.generation * storageBoostMultiplier;

      const localServed = Math.min(localGeneration, region.demand);
      region.served = localServed;
      region.unmet = Math.max(0, region.demand - localServed);
      pool += Math.max(0, localGeneration - localServed);
    }

    const prioritySort = { high: 0, normal: 1, low: 2 };
    const targets = unlocked
      .filter((region) => region.unmet > 0)
      .sort((a, b) => {
        const p = prioritySort[a.priority] - prioritySort[b.priority];
        if (p !== 0) return p;
        return b.unmet - a.unmet;
      });

    for (const target of targets) {
      if (pool <= 0.0001) break;
      if (target.id === "capital") continue;

      const path = this.findPath("capital", target.id);
      if (!path.length) continue;

      let transferable = Infinity;
      for (const linkId of path) {
        const link = this.findLink(linkId);
        if (!link) continue;
        transferable = Math.min(transferable, Math.max(0, link.hardCapacity - link.used));
      }

      if (!Number.isFinite(transferable) || transferable <= 0) continue;

      const moved = Math.min(target.unmet, pool, transferable);
      target.served += moved;
      target.unmet -= moved;
      pool -= moved;

      for (const linkId of path) {
        const link = this.findLink(linkId);
        if (!link) continue;
        link.used += moved;
        link.stress = link.safeCapacity > 0 ? link.used / link.safeCapacity : 0;
        link.overload = link.used > link.safeCapacity;
      }
    }

    for (const region of unlocked) {
      region.unmet = clamp(region.unmet, 0, region.demand);
      region.utilization = region.demand > 0 ? region.served / region.demand : 1;
    }

    this.state.totalDemand = unlocked.reduce((acc, region) => acc + region.demand, 0);
    this.state.totalServed = unlocked.reduce((acc, region) => acc + region.served, 0);
    this.state.totalUnmet = unlocked.reduce((acc, region) => acc + region.unmet, 0);
  }

  findPath(startId, endId) {
    if (startId === endId) return [];

    const queue = [[startId, []]];
    const visited = new Set([startId]);

    while (queue.length) {
      const [nodeId, path] = queue.shift();
      for (const link of this.state.links) {
        if (link.safeCapacity <= 0) continue;
        let nextId = null;
        if (link.a === nodeId) nextId = link.b;
        if (link.b === nodeId) nextId = link.a;
        if (!nextId || visited.has(nextId)) continue;

        visited.add(nextId);
        const nextPath = [...path, link.id];
        if (nextId === endId) {
          return nextPath;
        }
        queue.push([nextId, nextPath]);
      }
    }

    return [];
  }

  updateEconomyAndReliability(dt) {
    const unlocked = this.state.regions.filter((region) => region.unlocked);

    const operatingBase = unlocked.reduce((acc, region) => {
      const resource = region.resourceProfile || this.createEmptyResourceProfile();
      const plantOperatingMultiplier = clamp(
        1 - resource.natural_gas * 0.12 - resource.wind * 0.05 - resource.sun * 0.04,
        0.72,
        1
      );
      return (
        acc +
        region.assets.plant * ASSET_RULES.plant.operatingCostPerSecond * plantOperatingMultiplier +
        region.assets.substation * ASSET_RULES.substation.operatingCostPerSecond +
        region.assets.storage * ASSET_RULES.storage.operatingCostPerSecond
      );
    }, 0);

    const operatingMultiplier = this.getModifierValue("operating_cost", 1);
    const operatingCost = operatingBase * operatingMultiplier;

    const revenue = this.state.totalServed * 0.108;
    const unmetPenalty = this.state.totalUnmet * 0.12 * this.config.failureStrictness;
    const overloadPenalty =
      this.state.links.filter((link) => link.overload).length * 1.4 * this.config.failureStrictness;
    const lawsuitPenalty = this.state.lawsuits * 0.18;

    this.state.budget += (revenue - operatingCost - unmetPenalty - overloadPenalty - lawsuitPenalty) * dt;

    const unmetRatio =
      this.state.totalDemand > 0 ? this.state.totalUnmet / this.state.totalDemand : 0;
    const overloadRatio =
      this.state.links.length > 0
        ? this.state.links.filter((link) => link.overload).length / this.state.links.length
        : 0;

    const assetReliabilityBonus = unlocked.reduce((acc, region) => {
      const resource = region.resourceProfile || this.createEmptyResourceProfile();
      const resourceReliability =
        (resource.wind * 0.26 + resource.sun * 0.2 + resource.natural_gas * 0.18) *
        (region.assets.plant + region.assets.storage * 0.6);
      return (
        acc +
        region.assets.plant * ASSET_RULES.plant.reliabilityBonus +
        region.assets.substation * ASSET_RULES.substation.reliabilityBonus +
        region.assets.storage * ASSET_RULES.storage.reliabilityBonus +
        resourceReliability
      );
    }, 0);

    const targetReliability = clamp(
      100 - unmetRatio * 160 - overloadRatio * 85 + assetReliabilityBonus * 0.2,
      0,
      100
    );

    this.state.reliability = clamp(
      lerp(this.state.reliability, targetReliability, 0.2 * dt * 10),
      0,
      100
    );

    if (this.state.reliability < 20) {
      this.state.collapseSeconds += dt;
    } else {
      this.state.collapseSeconds = Math.max(0, this.state.collapseSeconds - dt * 1.6);
    }

    let trustPressure = 0;
    for (const region of unlocked) {
      const unmetShare = region.demand > 0 ? region.unmet / region.demand : 0;
      if (unmetShare > 0.35) {
        trustPressure += unmetShare * 2.1;
      } else {
        trustPressure -= 0.55;
      }
    }

    this.state.hiddenTrust = clamp(this.state.hiddenTrust - trustPressure * dt * 1.6, 0, 100);

    if (
      this.state.hiddenTrust < 18 &&
      this.state.runtimeSeconds > this.state.nextLawsuitEligibleAt
    ) {
      this.state.lawsuits += 1;
      this.state.hiddenTrust = clamp(this.state.hiddenTrust + 22, 0, 100);
      this.state.nextLawsuitEligibleAt = this.state.runtimeSeconds + 70;
      this.state.budget -= 140;
      this.pushAlert("Underserved-region lawsuit filed against the Power Department.", "critical", 8);
      this.logTimeline("Lawsuit penalty triggered after sustained underserved regions.");
    }

    if (unmetRatio > 0.32) {
      this.pushTransientAlertOnce(
        "grid-stress",
        "Grid stress rising: unmet demand sustained beyond warning threshold.",
        "warning",
        4
      );
    }

    if (this.state.reliability < 35) {
      this.pushTransientAlertOnce(
        "reliability-critical",
        "Reliability entering critical range.",
        "critical",
        4
      );
    }

    if (this.state.budget < 160) {
      this.pushTransientAlertOnce(
        "budget-low",
        "Treasury warning: budget reserves running low.",
        "warning",
        4
      );
    }
  }

  updateScoring(dt) {
    const servedScore = this.state.totalServed * dt * 2.2;
    const reliabilityScore = this.state.reliability * dt * 0.6;
    const penalty = this.state.totalUnmet * dt * 0.7 + this.state.lawsuits * dt * 0.4;
    this.state.score = Math.max(0, this.state.score + servedScore + reliabilityScore - penalty);
  }

  evaluateObjectiveAndEndConditions() {
    if (this.state.budget <= 0) {
      this.finishRun("defeat", "Bankruptcy triggered: budget reached zero.");
      return;
    }

    const collapseThreshold = 16 / this.config.failureStrictness;
    if (this.state.reliability <= collapseThreshold && this.state.collapseSeconds >= 15) {
      this.finishRun("defeat", "Reliability collapse: sustained national blackout risk.");
      return;
    }

    if (this.config.mode === "campaign" && this.config.mission) {
      if (this.state.runtimeSeconds >= this.config.runTargetSec) {
        const mission = this.config.mission;
        const unlockedCount = this.state.regions.filter((region) => region.unlocked).length;
        const objective = mission.objective;
        const objectivePass =
          this.state.reliability >= objective.reliabilityFloor &&
          unlockedCount >= (objective.requiredUnlocked || 0) &&
          (objective.budgetFloor == null || this.state.budget >= objective.budgetFloor) &&
          (objective.maxLawsuits == null || this.state.lawsuits <= objective.maxLawsuits);

        if (objectivePass) {
          this.finishRun("victory", `Mission complete: ${mission.codename}.`);
        } else {
          this.finishRun("defeat", `Mission failed: ${mission.codename} objectives not met.`);
        }
        return;
      }
    }

    if (this.config.mode === "custom" && this.config.runTargetSec > 0) {
      if (this.state.runtimeSeconds >= this.config.runTargetSec) {
        const goodReliability = this.state.reliability >= 64;
        const notBankrupt = this.state.budget > 0;
        this.finishRun(
          goodReliability && notBankrupt ? "victory" : "defeat",
          goodReliability && notBankrupt
            ? "Custom run target reached with stable grid performance."
            : "Custom run ended with unstable grid conditions."
        );
      }
    }
  }

  emitNewsIfNeeded() {
    if (this.state.runtimeSeconds < this.state.nextNewsAt) return;
    this.state.nextNewsAt = this.state.runtimeSeconds + randomRange(11, 18);
    const blurb = pickRandom(NEWS_BLURBS);
    this.callbacks.onNews(blurb);
  }

  finishRun(result, reason) {
    const summary = this.buildEndSummary(result, reason);
    this.stop();
    this.callbacks.onRunEnd(summary);
  }

  buildEndSummary(result, reason) {
    const finalScore = Math.round(
      this.state.score + this.state.budget * 0.4 + this.state.reliability * 12 - this.state.lawsuits * 35
    );

    const demandServedRatio =
      this.state.totalDemand > 0 ? this.state.totalServed / this.state.totalDemand : 1;

    return {
      result,
      reason,
      runLabel: this.config.label,
      runClass: this.config.leaderboardEligible ? this.config.leaderboardClass : "custom",
      leaderboardEligible: this.config.leaderboardEligible,
      durationSec: this.state.runtimeSeconds,
      finalScore,
      reliability: this.state.reliability,
      budget: this.state.budget,
      lawsuits: this.state.lawsuits,
      demandServedRatio,
      season: this.state.seasonLabel,
      timeline: this.state.timeline.slice(-8),
      config: deepClone(this.config),
    };
  }

  getIncidentMultiplierForRegion(regionId, type) {
    let multiplier = 1;
    const now = this.state.runtimeSeconds;
    for (const incident of this.state.incidents) {
      if (incident.type !== type) continue;
      if (incident.regionId && incident.regionId !== regionId) continue;
      if (incident.expiresAt <= now) continue;
      multiplier *= incident.multiplier || 1;
    }
    return multiplier;
  }

  getModifierValue(type, fallback) {
    let value = fallback;
    const now = this.state.runtimeSeconds;
    for (const incident of this.state.incidents) {
      if (incident.type !== type) continue;
      if (incident.expiresAt <= now) continue;
      value *= incident.multiplier || 1;
    }
    return value;
  }

  getLineModifierForLink(link) {
    const now = this.state.runtimeSeconds;
    let multiplier = 1;

    for (const incident of this.state.incidents) {
      if (incident.type !== "line_cap") continue;
      if (incident.expiresAt <= now) continue;
      if (!incident.regionId) continue;
      if (link.a === incident.regionId || link.b === incident.regionId) {
        multiplier *= incident.multiplier || 1;
      }
    }

    return multiplier;
  }

  pushAlert(text, level = "advisory", ttl = 5) {
    const id = `alert-${Math.round(performance.now() * Math.random())}`;
    this.state.alerts.unshift({
      id,
      text,
      level,
      createdAt: this.state.runtimeSeconds,
      expiresAt: this.state.runtimeSeconds + ttl,
    });

    if (level === "critical") {
      this.highlightedAlertId = id;
      this.callbacks.onHighlightAlert(id);
    }
  }

  pushTransientAlertOnce(marker, text, level, ttl) {
    const now = this.state.runtimeSeconds;
    const present = this.state.alerts.some(
      (alert) =>
        alert.marker === marker &&
        alert.expiresAt > now
    );

    if (!present) {
      const id = `alert-${marker}`;
      this.state.alerts.unshift({
        id,
        marker,
        text,
        level,
        createdAt: now,
        expiresAt: now + ttl,
      });
    }
  }

  trimAlerts() {
    const now = this.state.runtimeSeconds;
    this.state.alerts = this.state.alerts
      .filter((alert) => alert.expiresAt > now)
      .slice(0, 9);
  }

  logTimeline(text) {
    this.state.timeline.push({
      at: Math.floor(this.state.runtimeSeconds),
      text,
    });
    if (this.state.timeline.length > 64) {
      this.state.timeline.shift();
    }
  }

  getSelectedRegion() {
    if (!this.selectedRegionId) return null;
    return this.findRegion(this.selectedRegionId);
  }

  render() {
    const ctx = this.ctx;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return;

    this.clampCameraToMap(width, height);
    ctx.clearRect(0, 0, width, height);
    this.drawMapBackdrop(ctx, width, height);
    this.drawLinks(ctx);
    this.drawRegions(ctx);
    this.drawOverlay(ctx, width, height);
  }

  drawMapBackdrop(ctx, width, height) {
    const topLeft = this.worldToScreen(0, 0);
    const bottomRight = this.worldToScreen(BASE_MAP.width, BASE_MAP.height);
    const drawWidth = bottomRight.x - topLeft.x;
    const drawHeight = bottomRight.y - topLeft.y;

    if (this.mapImageReady && this.mapImage) {
      ctx.fillStyle = "#0d1216";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(this.mapImage, topLeft.x, topLeft.y, drawWidth, drawHeight);
    } else {
      const fallbackGradient = ctx.createLinearGradient(0, 0, width, height);
      fallbackGradient.addColorStop(0, "#131a20");
      fallbackGradient.addColorStop(1, "#090d11");
      ctx.fillStyle = fallbackGradient;
      ctx.fillRect(0, 0, width, height);
    }

    if (this.resourceRevealHeld && this.resourceZones.length) {
      for (const zone of this.resourceZones) {
        const zoneStyle = RESOURCE_ZONE_COLORS[zone.resource];
        if (!zoneStyle) continue;
        ctx.beginPath();
        zone.polygon.forEach((point, index) => {
          const screen = this.worldToScreen(point.x, point.y);
          if (index === 0) ctx.moveTo(screen.x, screen.y);
          else ctx.lineTo(screen.x, screen.y);
        });
        ctx.closePath();
        ctx.fillStyle = zoneStyle.fill;
        ctx.fill();
        ctx.strokeStyle = zoneStyle.stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      if (this.zoomLevels[this.camera.zoomIndex] >= 0.9) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = '600 12px "IBM Plex Mono", monospace';
        const iconSize = clamp(58 * this.zoomLevels[this.camera.zoomIndex], 34, 70);
        const iconHalf = iconSize / 2;
        const fallbackLabelWidth = 88;
        const fallbackLabelHalfWidth = fallbackLabelWidth / 2;
        const fallbackLabelHeight = 18;
        const fallbackLabelHalfHeight = fallbackLabelHeight / 2;
        for (const zone of this.resourceZones) {
          const c = this.worldToScreen(zone.centroid.x, zone.centroid.y);
          const icon = this.iconSet.resource[zone.resource] || null;
          const edgePadding = icon ? iconHalf : fallbackLabelWidth;
          if (
            c.x < -edgePadding ||
            c.x > width + edgePadding ||
            c.y < -edgePadding ||
            c.y > height + edgePadding
          ) {
            continue;
          }

          if (icon) {
            const iconX = clamp(c.x, iconHalf + 4, width - iconHalf - 4);
            const iconY = clamp(c.y, iconHalf + 4, height - iconHalf - 4);
            ctx.save();
            ctx.globalAlpha = 0.96;
            ctx.drawImage(icon, iconX - iconHalf, iconY - iconHalf, iconSize, iconSize);
            ctx.restore();
          } else {
            const labelX = clamp(
              c.x,
              fallbackLabelHalfWidth + 4,
              width - fallbackLabelHalfWidth - 4
            );
            const labelY = clamp(
              c.y,
              fallbackLabelHalfHeight + 4,
              height - fallbackLabelHalfHeight - 4
            );
            ctx.fillStyle = "rgba(15, 29, 41, 0.85)";
            ctx.fillRect(
              labelX - fallbackLabelHalfWidth,
              labelY - fallbackLabelHalfHeight,
              fallbackLabelWidth,
              fallbackLabelHeight
            );
            ctx.fillStyle = "#ecf8ff";
            ctx.fillText(zone.resource.replace("_", " ").toUpperCase(), labelX, labelY + 0.5);
          }
        }
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    }

    const vignette = ctx.createLinearGradient(0, 0, width, height);
    vignette.addColorStop(0, "rgba(4, 15, 24, 0.16)");
    vignette.addColorStop(1, "rgba(4, 15, 24, 0.3)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  drawLinks(ctx) {
    for (const link of this.state.links) {
      const a = this.findRegion(link.a);
      const b = this.findRegion(link.b);
      if (!a || !b || !a.unlocked || !b.unlocked) continue;

      const sa = this.worldToScreen(a.x, a.y);
      const sb = this.worldToScreen(b.x, b.y);

      const stress = link.safeCapacity > 0 ? link.used / link.safeCapacity : 0;
      let color = "rgba(114, 208, 142, 0.62)";
      if (stress > 0.8) color = "rgba(244, 180, 88, 0.8)";
      if (stress > 1) color = "rgba(255, 98, 98, 0.92)";

      ctx.strokeStyle = color;
      ctx.lineWidth = clamp(2 + (link.safeCapacity / 90) * this.zoomLevels[this.camera.zoomIndex], 2, 9);
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();

      const t = (this.renderPulse * 0.5) % 1;
      const pulseX = lerp(sa.x, sb.x, t);
      const pulseY = lerp(sa.y, sb.y, t);
      ctx.fillStyle = stress > 1 ? "#ff8b8b" : "#e6fff2";
      ctx.beginPath();
      ctx.arc(pulseX, pulseY, 2.5 + Math.min(4, stress * 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  getTownIconForRegion(region) {
    if (region.id === "capital") return this.iconSet.town.capital;
    const townCount = Math.max(0, Number(region.townCount || 0));
    const townCap = Math.max(1, Number(region.townCap || 1));
    if (townCount >= Math.ceil(townCap * 0.66)) return this.iconSet.town.city;
    return this.iconSet.town.hamlet;
  }

  drawTownMarkers(ctx, point, radius, region) {
    const zoom = this.zoomLevels[this.camera.zoomIndex];
    const townCount = Math.max(0, Math.round(region.townCount || 0));
    if (!townCount) return;
    const visibleTownMarkers = zoom <= 0.72 ? 1 : townCount;
    const iconSize = clamp(28 * zoom, 18, 34);
    const icon = this.getTownIconForRegion(region);

    for (let i = 0; i < visibleTownMarkers; i += 1) {
      const angle = (Math.PI * 2 * i) / Math.max(1, visibleTownMarkers);
      const orbit = radius * (0.32 + (i % 2) * 0.08);
      const tx = point.x + Math.cos(angle) * orbit;
      const ty = point.y + Math.sin(angle) * orbit;

      if (icon) {
        ctx.save();
        ctx.globalAlpha = region.unlocked ? 0.96 : 0.72;
        ctx.drawImage(icon, tx - iconSize / 2, ty - iconSize / 2, iconSize, iconSize);
        ctx.restore();
      } else {
        const markerRadius = clamp(1.8 * zoom, 1.2, 3.3);
        ctx.beginPath();
        ctx.arc(tx, ty, markerRadius + 0.7, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(8, 24, 38, 0.8)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(tx, ty, markerRadius, 0, Math.PI * 2);
        ctx.fillStyle = region.unlocked ? "rgba(227, 245, 232, 0.9)" : "rgba(205, 223, 214, 0.72)";
        ctx.fill();
      }
    }
  }

  drawRegions(ctx) {
    const selectedId = this.selectedRegionId;

    for (const region of this.state.regions) {
      const point = this.worldToScreen(region.x, region.y);
      const radius = region.radius * this.zoomLevels[this.camera.zoomIndex];

      const climateColor =
        region.climate === "cold"
          ? "#86afde"
          : region.climate === "warm"
            ? "#d8a46e"
            : "#7ab98a";

      const lockOverlay = region.unlocked ? 0 : 0.58;
      const serviceRatio = region.demand > 0 ? region.served / region.demand : 1;
      const serviceTint =
        serviceRatio > 0.9 ? "rgba(129, 225, 156, 0.45)" : serviceRatio > 0.72 ? "rgba(246, 194, 106, 0.44)" : "rgba(255, 99, 99, 0.52)";

      ctx.fillStyle = `rgba(20, 33, 46, ${0.72 + lockOverlay})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = climateColor;
      ctx.globalAlpha = 0.33;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * 0.94, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = serviceTint;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * 0.68, 0, Math.PI * 2);
      ctx.fill();
      this.drawTownMarkers(ctx, point, radius, region);

      ctx.lineWidth = selectedId === region.id ? 4 : 2;
      ctx.strokeStyle = selectedId === region.id ? "#f4f7d5" : "rgba(235, 245, 237, 0.5)";
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      if (!region.unlocked) {
        ctx.strokeStyle = "rgba(255, 230, 188, 0.5)";
        ctx.lineWidth = 1;
        for (let offset = -radius; offset <= radius; offset += 8) {
          ctx.beginPath();
          ctx.moveTo(point.x - radius, point.y + offset);
          ctx.lineTo(point.x + radius, point.y + offset + radius * 0.5);
          ctx.stroke();
        }
      }

      const farZoom = this.zoomLevels[this.camera.zoomIndex] <= 0.72;
      if (farZoom) continue;

      ctx.fillStyle = "#f0f7ef";
      ctx.textAlign = "center";
      ctx.font = `600 ${Math.max(11, 11 * this.zoomLevels[this.camera.zoomIndex])}px "IBM Plex Sans", sans-serif`;
      ctx.fillText(region.name, point.x, point.y - radius * 0.18);

      const demandText = region.unlocked
        ? `${Math.round(region.served)}/${Math.round(region.demand)} MW`
        : `Locked: ${Math.ceil(region.unlockCost * this.config.unlockCostMultiplier)} budget`;

      ctx.fillStyle = "rgba(246, 251, 250, 0.92)";
      ctx.font = `500 ${Math.max(10, 10 * this.zoomLevels[this.camera.zoomIndex])}px "IBM Plex Mono", monospace`;
      ctx.fillText(demandText, point.x, point.y + radius * 0.12);

      ctx.fillStyle = "rgba(202, 233, 219, 0.9)";
      ctx.fillText(`Towns ${region.townCount}/${region.townCap}`, point.x, point.y + radius * 0.34);

      if (region.unlocked) {
        const assetText = `P${region.assets.plant} S${region.assets.substation} B${region.assets.storage}`;
        ctx.fillStyle = "rgba(194, 229, 212, 0.88)";
        ctx.fillText(assetText, point.x, point.y + radius * 0.56);
      }
    }
  }

  drawOverlay(ctx, width, height) {
    if (this.paused) {
      ctx.fillStyle = "rgba(8, 18, 26, 0.74)";
      ctx.fillRect(width / 2 - 128, 66, 256, 56);
      ctx.strokeStyle = "rgba(242, 246, 214, 0.42)";
      ctx.lineWidth = 1.3;
      ctx.strokeRect(width / 2 - 128, 66, 256, 56);
      ctx.fillStyle = "#f4f7d8";
      ctx.font = '600 22px "Rajdhani", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("Simulation Paused", width / 2, 101);
      ctx.textAlign = "left";
    }
  }

  pushHudUpdate() {
    const selected = this.getSelectedRegion();
    const objective = this.buildObjectiveStatus();

    this.callbacks.onHud({
      runLabel: this.config.label,
      budget: this.state.budget,
      reliability: this.state.reliability,
      unmetDemand: this.state.totalUnmet,
      servedDemand: this.state.totalServed,
      timer: this.state.runtimeSeconds,
      season: this.state.seasonLabel,
      populationActive: this.config.populationEnabled,
      lawsuits: this.state.lawsuits,
      score: this.state.score,
      paused: this.paused,
      tool: this.tool,
      buildAssetType: this.buildAssetType,
      resourceLayerVisible: this.resourceRevealHeld,
      townEmergenceMode: this.config.townEmergenceMode,
      townsEmerged: this.state.townsEmerged || 0,
      nextTownEmergenceIn: Math.max(
        0,
        (this.state.nextTownEmergenceAt || this.state.runtimeSeconds) - this.state.runtimeSeconds
      ),
      objective,
      alerts: this.state.alerts,
      incidents: this.state.incidents,
      selectedRegion: selected,
    });
  }

  buildObjectiveStatus() {
    if (this.config.mode === "campaign" && this.config.mission) {
      const mission = this.config.mission;
      const unlockedCount = this.state.regions.filter((region) => region.unlocked).length;
      const progress = clamp(this.state.runtimeSeconds / mission.objective.targetDurationSec, 0, 1);
      return {
        title: mission.codename,
        text: mission.objective.description,
        progress,
        detail: `Unlocked ${unlockedCount}/${mission.objective.requiredUnlocked} | Reliability ${this.state.reliability.toFixed(1)}%`,
      };
    }

    if (this.config.mode === "custom") {
      const target = this.config.runTargetSec;
      const progress = target > 0 ? clamp(this.state.runtimeSeconds / target, 0, 1) : 0;
      return {
        title: "Custom Objective",
        text: `Survive until ${formatTime(target)} with stable reliability.`,
        progress,
        detail: `Reliability ${this.state.reliability.toFixed(1)}% | Budget ${Math.round(this.state.budget)}`,
      };
    }

    return {
      title: "Standard Run",
      text: "Survive and maximize score before collapse conditions trigger.",
      progress: 0,
      detail: `Current score ${Math.round(this.state.score)} | Reliability ${this.state.reliability.toFixed(1)}%`,
    };
  }

  serializeForSuspend() {
    return {
      runConfig: deepClone(this.config),
      gameState: deepClone(this.state),
      camera: deepClone(this.camera),
      tool: this.tool,
      buildAssetType: this.buildAssetType,
      selectedRegionId: this.selectedRegionId,
      paused: this.paused,
    };
  }

  hydrateRuntimeState(snapshotPayload) {
    if (!snapshotPayload) return;
    this.config = deepClone(snapshotPayload.runConfig || this.config);
    this.applyRunConfigDefaults();
    this.state = this.rehydrateSnapshot(snapshotPayload.gameState || this.state);
    this.ensureRegionResourceProfiles();
    if (this.resourceZones.length) {
      this.applyResourceCoverageToRegions();
    }
    this.camera = {
      ...this.camera,
      ...(snapshotPayload.camera || {}),
      dragActive: false,
    };
    this.camera.zoomIndex = clamp(
      Number(this.camera.zoomIndex) || 0,
      0,
      this.zoomLevels.length - 1
    );
    this.clampCameraToMap();
    this.tool = snapshotPayload.tool || TOOL_BUILD;
    this.buildAssetType = snapshotPayload.buildAssetType || "plant";
    this.selectedRegionId = snapshotPayload.selectedRegionId || null;
    this.paused = !!snapshotPayload.paused;
    this.resourceRevealHeld = false;
    this.pushHudUpdate();
  }

  renderGameToText() {
    const payload = {
      mode: this.config.mode,
      runLabel: this.config.label,
      coordinateSystem: {
        origin: "top-left of map world",
        xAxis: "positive right",
        yAxis: "positive down",
        mapSize: { width: BASE_MAP.width, height: BASE_MAP.height },
        camera: {
          x: Number(this.camera.x.toFixed(2)),
          y: Number(this.camera.y.toFixed(2)),
          zoom: this.zoomLevels[this.camera.zoomIndex],
        },
      },
      timerSeconds: Number(this.state.runtimeSeconds.toFixed(2)),
      paused: this.paused,
      season: this.state.seasonLabel,
      budget: Number(this.state.budget.toFixed(2)),
      score: Number(this.state.score.toFixed(2)),
      reliability: Number(this.state.reliability.toFixed(2)),
      totalDemand: Number(this.state.totalDemand.toFixed(2)),
      totalServed: Number(this.state.totalServed.toFixed(2)),
      totalUnmet: Number(this.state.totalUnmet.toFixed(2)),
      selectedTool: this.tool,
      selectedBuildAsset: this.buildAssetType,
      selectedRegionId: this.selectedRegionId,
      townEmergence: {
        mode: this.config.townEmergenceMode,
        townsEmerged: this.state.townsEmerged || 0,
        nextInSeconds: Number(
          Math.max(
            0,
            (this.state.nextTownEmergenceAt || this.state.runtimeSeconds) - this.state.runtimeSeconds
          ).toFixed(2)
        ),
      },
      terrainMap: {
        image: TERRAIN_MAP_IMAGE_URL,
        metadata: TERRAIN_MAP_METADATA_URL,
        loaded: this.mapImageReady,
        resourceLayerVisible: this.resourceRevealHeld,
        iconSetLoaded: {
          town: {
            hamlet: !!this.iconSet.town.hamlet,
            city: !!this.iconSet.town.city,
            capital: !!this.iconSet.town.capital,
          },
          resource: {
            wind: !!this.iconSet.resource.wind,
            sun: !!this.iconSet.resource.sun,
            natural_gas: !!this.iconSet.resource.natural_gas,
          },
        },
        resourceZoneCounts: { ...this.resourceZoneSummary },
      },
      regions: this.state.regions.map((region) => ({
        id: region.id,
        name: region.name,
        x: Number(region.x.toFixed(1)),
        y: Number(region.y.toFixed(1)),
        unlocked: region.unlocked,
        priority: region.priority,
        climate: region.climate,
        terrain: region.terrain,
        population: Number(region.population.toFixed(2)),
        demand: Number(region.demand.toFixed(2)),
        served: Number(region.served.toFixed(2)),
        unmet: Number(region.unmet.toFixed(2)),
        utilization: Number(region.utilization.toFixed(3)),
        towns: {
          count: Math.round(region.townCount || 0),
          cap: Math.round(region.townCap || 0),
          stableServiceSeconds: Number((region.stableServiceSeconds || 0).toFixed(2)),
          outageSeconds: Number((region.outageSeconds || 0).toFixed(2)),
        },
        resourceProfile: {
          wind: Number((region.resourceProfile?.wind || 0).toFixed(3)),
          sun: Number((region.resourceProfile?.sun || 0).toFixed(3)),
          naturalGas: Number((region.resourceProfile?.natural_gas || 0).toFixed(3)),
        },
        assets: { ...region.assets },
      })),
      resourceZones: this.resourceZones.map((zone) => ({
        id: zone.id,
        resource: zone.resource,
        centroid: {
          x: Number(zone.centroid.x.toFixed(1)),
          y: Number(zone.centroid.y.toFixed(1)),
        },
      })),
      links: this.state.links
        .filter((link) => link.safeCapacity > 0)
        .map((link) => ({
          id: link.id,
          a: link.a,
          b: link.b,
          used: Number(link.used.toFixed(2)),
          safeCapacity: Number(link.safeCapacity.toFixed(2)),
          stress: Number(link.stress.toFixed(3)),
          overload: link.overload,
        })),
      incidents: this.state.incidents.map((incident) => ({
        title: incident.title,
        level: incident.level,
        type: incident.type,
        regionId: incident.regionId || null,
        expiresIn: Number((incident.expiresAt - this.state.runtimeSeconds).toFixed(2)),
      })),
      alerts: this.state.alerts.map((alert) => ({
        id: alert.id,
        level: alert.level,
        text: alert.text,
      })),
    };

    return JSON.stringify(payload, null, 2);
  }
}

export class SaveTheGridApp {
  constructor(root) {
    this.root = root;
    this.currentScreen = "splash";
    this.runtime = null;

    this.records = readJsonStorage(STORAGE_KEYS.records, {
      standard: [],
      campaign: [],
      custom: [],
    });
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...readJsonStorage(STORAGE_KEYS.settings, {}),
    };
    this.campaignProgress = readJsonStorage(STORAGE_KEYS.campaignProgress, {
      unlockedMissionIndex: 0,
      missionBest: {},
    });
    this.suspendedRun = readJsonStorage(STORAGE_KEYS.suspendedRun, null);

    this.selectedStandardPresetId = STANDARD_PRESETS[0].id;
    this.customConfig = deepClone(CUSTOM_PRESETS[0]);

    this.splashTimeout = 0;
    this.boundSkipSplash = () => this.renderMainMenu();
    this.splashListenersActive = false;

    window.render_game_to_text = () => this.renderGameToTextBridge();
    window.advanceTime = (ms) => this.advanceTimeBridge(ms);

    this.setRunMode(false);
    this.renderSplash();
  }

  setRunMode(active) {
    document.body.classList.toggle("run-mode", active);
  }

  renderGameToTextBridge() {
    if (this.runtime) {
      return this.runtime.renderGameToText();
    }
    return JSON.stringify({
      mode: this.currentScreen,
      message: "No active run",
    });
  }

  advanceTimeBridge(ms) {
    if (this.runtime) {
      return this.runtime.advanceTime(ms);
    }
    return Promise.resolve();
  }

  cleanupRuntime() {
    if (!this.runtime) return;
    this.runtime.stop();
    this.runtime = null;
  }

  renderSplash() {
    this.setRunMode(false);
    this.cleanupRuntime();
    this.currentScreen = "splash";
    this.root.innerHTML = `
      <section class="screen splash-screen" id="splash-screen">
        <div class="pulse-grid" aria-hidden="true"></div>
        <div class="splash-content">
          <p class="eyebrow">National Energy Command</p>
          <h1>Save the Grid</h1>
          <p class="subtitle">The country modernizes in real-time. Keep the power stable.</p>
          <p class="hint">Press any key to continue</p>
          <p class="status" id="splash-status">Initializing grid simulation...</p>
        </div>
      </section>
    `;

    window.addEventListener("keydown", this.boundSkipSplash, { once: true });
    window.addEventListener("pointerdown", this.boundSkipSplash, { once: true });
    this.splashListenersActive = true;

    this.splashTimeout = window.setTimeout(() => {
      this.renderMainMenu();
    }, 1800);
  }

  renderMainMenu() {
    this.setRunMode(false);
    window.clearTimeout(this.splashTimeout);
    this.cleanupSplashListeners();
    this.currentScreen = "menu";
    this.cleanupRuntime();

    const hasContinue = !!this.suspendedRun;

    this.root.innerHTML = `
      <section class="screen menu-screen">
        <div class="menu-layout">
          <aside class="menu-column">
            <h2>Command Console</h2>
            <p class="menu-copy">Direct national power strategy through build, demolish, and reroute decisions.</p>
            <div class="menu-actions">
              ${hasContinue ? '<button class="action-btn" id="menu-continue">Continue Run</button>' : ""}
              <button class="action-btn action-btn-primary" id="start-btn">Quick Start</button>
              <button class="action-btn action-btn-primary" id="menu-new-run">New Run</button>
              <button class="action-btn" id="menu-campaign">Campaign Missions</button>
              <button class="action-btn" id="menu-custom">Custom Game</button>
              <button class="action-btn" id="menu-cosmetics" disabled>Cosmetics (Soon)</button>
              <button class="action-btn" id="menu-records">Records</button>
              <button class="action-btn" id="menu-settings">Settings</button>
              <button class="action-btn" id="menu-exit">Exit</button>
            </div>
            <p class="menu-footer">Local best score: ${this.bestScoreOverall()}</p>
          </aside>
          <div class="menu-map-preview" aria-hidden="true">
            <div class="grid-silhouette"></div>
            <div class="energy-rings"></div>
          </div>
          <aside class="menu-bulletin">
            <h3>National Bulletin</h3>
            <ul>
              <li>Early maps stay compact for fast readability.</li>
              <li>Basic runs begin sparse: terrain-first with few seeded towns.</li>
              <li>Population pressure activates in later missions.</li>
              <li>Fragmented regions require in-level capital to unlock.</li>
              <li>Completion unlocks progression, with no money carryover.</li>
            </ul>
          </aside>
        </div>
      </section>
    `;

    if (hasContinue) {
      this.root.querySelector("#menu-continue")?.addEventListener("click", () => {
        this.startRunFromSnapshot(this.suspendedRun);
      });
    }

    this.root.querySelector("#start-btn")?.addEventListener("click", () => {
      const config = buildRunConfigFromStandardPreset(this.selectedStandardPresetId);
      this.startRun(config);
    });
    this.root.querySelector("#menu-new-run")?.addEventListener("click", () => this.renderStandardSetup());
    this.root.querySelector("#menu-campaign")?.addEventListener("click", () => this.renderCampaignSelect());
    this.root.querySelector("#menu-custom")?.addEventListener("click", () => this.renderCustomSetup());
    this.root.querySelector("#menu-records")?.addEventListener("click", () => this.renderRecordsScreen());
    this.root.querySelector("#menu-settings")?.addEventListener("click", () => this.renderSettingsScreen());
    this.root.querySelector("#menu-exit")?.addEventListener("click", () => {
      this.pushToast("Exit is disabled in browser builds. Close the tab to leave.");
    });
  }

  cleanupSplashListeners() {
    if (!this.splashListenersActive) return;
    window.removeEventListener("keydown", this.boundSkipSplash);
    window.removeEventListener("pointerdown", this.boundSkipSplash);
    this.splashListenersActive = false;
  }

  bestScoreOverall() {
    const all = [...this.records.standard, ...this.records.campaign, ...this.records.custom];
    if (!all.length) return "0";
    const best = all.reduce((acc, run) => (run.finalScore > acc ? run.finalScore : acc), 0);
    return String(best);
  }

  renderStandardSetup() {
    this.setRunMode(false);
    this.currentScreen = "standard-setup";

    const presetMarkup = STANDARD_PRESETS.map((preset) => {
      const activeClass = preset.id === this.selectedStandardPresetId ? "preset-card active" : "preset-card";
      return `
        <button class="${activeClass}" data-preset="${preset.id}">
          <h3>${preset.label}</h3>
          <p>${preset.description}</p>
          <p>Growth x${preset.demandGrowthMultiplier.toFixed(2)} | Event x${preset.eventIntensity.toFixed(2)}</p>
          <p>Budget ${preset.budget} | Fragmentation ${preset.regionFragmentation}</p>
        </button>
      `;
    }).join("");

    this.root.innerHTML = `
      <section class="screen setup-screen">
        <header class="setup-header">
          <h2>Standard Run Setup</h2>
          <button class="ghost-btn" id="setup-back">Back to Menu</button>
        </header>
        <p class="setup-copy">Choose a leaderboard-eligible scenario profile.</p>
        <div class="preset-grid">${presetMarkup}</div>
        <footer class="setup-actions">
          <button class="action-btn action-btn-primary" id="start-standard-run">Start Standard Run</button>
        </footer>
      </section>
    `;

    this.root.querySelectorAll("[data-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedStandardPresetId = button.getAttribute("data-preset") || STANDARD_PRESETS[0].id;
        this.renderStandardSetup();
      });
    });

    this.root.querySelector("#setup-back")?.addEventListener("click", () => this.renderMainMenu());
    this.root.querySelector("#start-standard-run")?.addEventListener("click", () => {
      const config = buildRunConfigFromStandardPreset(this.selectedStandardPresetId);
      this.startRun(config);
    });
  }

  renderCampaignSelect() {
    this.setRunMode(false);
    this.currentScreen = "campaign-select";

    const missionCards = CAMPAIGN_MISSIONS.map((mission, index) => {
      const unlocked = index <= this.campaignProgress.unlockedMissionIndex;
      const best = this.campaignProgress.missionBest[mission.id];
      return `
        <article class="mission-card ${unlocked ? "" : "locked"}" data-mission="${mission.id}">
          <p class="mission-arc">${mission.arc}</p>
          <h3>${toOrdinal(index)} Mission: ${mission.codename}</h3>
          <p>${mission.premise}</p>
          <p class="mission-tags">
            <span>${mission.difficulty}</span>
            <span>${mission.mapScale}</span>
            <span>${mission.fragmentation}</span>
            <span>${mission.populationMode === "off" ? "Static Population" : "Growth Active"}</span>
            <span>${mission.seasonalMode === "off" ? "Neutral" : "Mixed Conditions"}</span>
          </p>
          <p class="mission-best">${best ? `Best ${best.finalScore} (${best.medal})` : "No completion record"}</p>
          ${unlocked ? "" : '<p class="mission-locked-label">Locked</p>'}
        </article>
      `;
    }).join("");

    this.root.innerHTML = `
      <section class="screen campaign-screen">
        <header class="setup-header">
          <h2>Campaign Missions</h2>
          <button class="ghost-btn" id="campaign-back">Back to Menu</button>
        </header>
        <p class="setup-copy">Complete missions sequentially to unlock the next level.</p>
        <div class="mission-grid">${missionCards}</div>
      </section>
    `;

    this.root.querySelector("#campaign-back")?.addEventListener("click", () => this.renderMainMenu());

    this.root.querySelectorAll("[data-mission]").forEach((card, index) => {
      card.addEventListener("click", () => {
        if (index > this.campaignProgress.unlockedMissionIndex) {
          this.pushToast("Mission is locked. Complete previous missions first.");
          return;
        }
        const missionId = card.getAttribute("data-mission");
        const config = buildRunConfigFromCampaignMission(missionId);
        this.startRun(config);
      });
    });
  }

  renderCustomSetup() {
    this.setRunMode(false);
    this.currentScreen = "custom-setup";

    const presetOptions = CUSTOM_PRESETS.map((preset) => {
      return `<option value="${preset.id}">${preset.label}</option>`;
    }).join("");

    this.root.innerHTML = `
      <section class="screen custom-screen">
        <header class="setup-header">
          <h2>Custom Game</h2>
          <button class="ghost-btn" id="custom-back">Back to Menu</button>
        </header>
        <p class="setup-copy">Tune scenario pressure. All Custom Game runs record in the separate Custom records table.</p>
        <form class="custom-form" id="custom-form">
          <label>
            Preset
            <select name="presetId">${presetOptions}</select>
          </label>
          <label>
            Starting Budget
            <input type="number" name="budget" min="400" max="2000" step="20" value="${this.customConfig.budget}">
          </label>
          <label>
            Demand Growth Multiplier
            <input type="number" name="demandGrowthMultiplier" min="0.5" max="1.8" step="0.05" value="${this.customConfig.demandGrowthMultiplier}">
          </label>
          <label>
            Event Intensity
            <select name="eventIntensity">
              ${CUSTOM_OPTIONS.eventIntensity.map((value) => `<option value="${value}" ${String(this.customConfig.eventIntensity) === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
          <label>
            Seasonal Profile
            <select name="seasonalProfile">
              ${CUSTOM_OPTIONS.seasonalProfile.map((value) => `<option value="${value}" ${this.customConfig.seasonalProfile === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
          <label>
            Population Growth
            <select name="populationMode">
              ${CUSTOM_OPTIONS.populationMode.map((value) => `<option value="${value}" ${this.customConfig.populationMode === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
          <label>
            Climate Intensity
            <select name="climateIntensity">
              ${CUSTOM_OPTIONS.climateIntensity.map((value) => `<option value="${value}" ${this.customConfig.climateIntensity === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
          <label>
            Infrastructure Cost Multiplier
            <input type="number" name="infraCostMultiplier" min="0.7" max="1.5" step="0.05" value="${this.customConfig.infraCostMultiplier}">
          </label>
          <label>
            Failure Strictness
            <select name="failureStrictness">
              ${CUSTOM_OPTIONS.failureStrictness.map((value) => `<option value="${value}" ${String(this.customConfig.failureStrictness) === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
          <label>
            Region Fragmentation
            <select name="regionFragmentation">
              ${CUSTOM_OPTIONS.regionFragmentation.map((value) => `<option value="${value}" ${this.customConfig.regionFragmentation === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
          <label>
            Region Unlock Cost Profile
            <select name="unlockCostProfile">
              ${CUSTOM_OPTIONS.unlockCostProfile.map((value) => `<option value="${value}" ${this.customConfig.unlockCostProfile === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
          <label>
            Run Target Duration (minutes)
            <select name="runTargetMinutes">
              ${CUSTOM_OPTIONS.runTargetMinutes.map((value) => `<option value="${value}" ${this.customConfig.runTargetMinutes === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
          <footer class="setup-actions">
            <button class="action-btn action-btn-primary" type="submit">Launch Custom Game</button>
          </footer>
        </form>
      </section>
    `;

    this.root.querySelector("#custom-back")?.addEventListener("click", () => this.renderMainMenu());

    const form = this.root.querySelector("#custom-form");
    const presetSelect = form.querySelector("select[name='presetId']");
    presetSelect.addEventListener("change", () => {
      const preset = CUSTOM_PRESETS.find((item) => item.id === presetSelect.value);
      if (preset) {
        this.customConfig = deepClone(preset);
        this.renderCustomSetup();
      }
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      this.customConfig = {
        presetId: formData.get("presetId"),
        budget: Number(formData.get("budget")),
        demandGrowthMultiplier: Number(formData.get("demandGrowthMultiplier")),
        eventIntensity: formData.get("eventIntensity"),
        seasonalProfile: formData.get("seasonalProfile"),
        populationMode: formData.get("populationMode"),
        climateIntensity: formData.get("climateIntensity"),
        infraCostMultiplier: Number(formData.get("infraCostMultiplier")),
        failureStrictness: formData.get("failureStrictness"),
        regionFragmentation: formData.get("regionFragmentation"),
        unlockCostProfile: formData.get("unlockCostProfile"),
        runTargetMinutes: Number(formData.get("runTargetMinutes")),
      };

      const config = buildRunConfigFromCustom(this.customConfig);
      this.startRun(config);
    });
  }

  renderRecordsScreen() {
    this.setRunMode(false);
    this.currentScreen = "records";

    const renderRows = (records) => {
      if (!records.length) {
        return `<tr><td colspan="6">No records yet.</td></tr>`;
      }
      return records
        .slice(0, 10)
        .map((entry, index) => {
          return `
            <tr>
              <td>${index + 1}</td>
              <td>${entry.runLabel}</td>
              <td>${entry.result}</td>
              <td>${entry.finalScore}</td>
              <td>${entry.reliability.toFixed(1)}%</td>
              <td>${new Date(entry.completedAt).toLocaleString()}</td>
            </tr>
          `;
        })
        .join("");
    };

    this.root.innerHTML = `
      <section class="screen records-screen">
        <header class="setup-header">
          <h2>Records</h2>
          <button class="ghost-btn" id="records-back">Back to Menu</button>
        </header>
        <div class="records-layout">
          <article>
            <h3>Standard</h3>
            <table>
              <thead><tr><th>#</th><th>Run</th><th>Result</th><th>Score</th><th>Reliability</th><th>When</th></tr></thead>
              <tbody>${renderRows(this.records.standard)}</tbody>
            </table>
          </article>
          <article>
            <h3>Campaign</h3>
            <table>
              <thead><tr><th>#</th><th>Run</th><th>Result</th><th>Score</th><th>Reliability</th><th>When</th></tr></thead>
              <tbody>${renderRows(this.records.campaign)}</tbody>
            </table>
          </article>
          <article>
            <h3>Custom</h3>
            <table>
              <thead><tr><th>#</th><th>Run</th><th>Result</th><th>Score</th><th>Reliability</th><th>When</th></tr></thead>
              <tbody>${renderRows(this.records.custom)}</tbody>
            </table>
          </article>
        </div>
      </section>
    `;

    this.root.querySelector("#records-back")?.addEventListener("click", () => this.renderMainMenu());
  }

  renderSettingsScreen() {
    this.setRunMode(false);
    this.currentScreen = "settings";

    this.root.innerHTML = `
      <section class="screen settings-screen">
        <header class="setup-header">
          <h2>Settings</h2>
          <button class="ghost-btn" id="settings-back">Back to Menu</button>
        </header>
        <form class="settings-form" id="settings-form">
          <label>
            UI Scale
            <select name="uiScale">
              <option value="compact" ${this.settings.uiScale === "compact" ? "selected" : ""}>Compact</option>
              <option value="normal" ${this.settings.uiScale === "normal" ? "selected" : ""}>Normal</option>
              <option value="large" ${this.settings.uiScale === "large" ? "selected" : ""}>Large</option>
            </select>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" name="highContrast" ${this.settings.highContrast ? "checked" : ""}>
            High contrast alerts
          </label>
          <label class="checkbox-row">
            <input type="checkbox" name="reducedMotion" ${this.settings.reducedMotion ? "checked" : ""}>
            Reduced motion
          </label>
          <footer class="setup-actions">
            <button class="action-btn action-btn-primary" type="submit">Save Settings</button>
          </footer>
        </form>
      </section>
    `;

    this.root.querySelector("#settings-back")?.addEventListener("click", () => this.renderMainMenu());
    this.root.querySelector("#settings-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      this.settings = {
        uiScale: formData.get("uiScale"),
        highContrast: !!formData.get("highContrast"),
        reducedMotion: !!formData.get("reducedMotion"),
      };
      writeJsonStorage(STORAGE_KEYS.settings, this.settings);
      this.pushToast("Settings saved.");
      this.renderMainMenu();
    });
  }

  buildRunScreenMarkup(newsTickerText) {
    return `
      <section class="screen run-screen" data-testid="in-run-screen" data-surface="run">
        <main class="map-shell" id="map-shell">
          <canvas id="game-canvas" aria-label="Grid map"></canvas>
        </main>

        <div class="floating-ui-layer">
          <div class="floating-group floating-top-left">
            <div class="floating-chip floating-chip-icon">GRID</div>
            <div class="floating-chip floating-chip-label" id="hud-run-label">Standard Run</div>
          </div>

          <div class="floating-group floating-top-right">
            <span class="floating-chip">Time <strong id="hud-timer">00:00</strong></span>
            <button class="ghost-btn floating-btn" id="run-pause-btn">Pause</button>
            <button class="ghost-btn floating-btn" id="run-save-exit-btn">Save &amp; Exit</button>
          </div>

          <section class="floating-group floating-objective floating-card">
            <h3 id="objective-title">Objective</h3>
            <p id="objective-text"></p>
            <div class="objective-progress"><span id="objective-progress-fill"></span></div>
            <p id="objective-detail" class="objective-detail"></p>
          </section>

          <section class="floating-group floating-alerts floating-card">
            <h3>Alert Rail</h3>
            <ul id="alert-list" class="alert-list"></ul>
          </section>

          <section class="floating-group floating-incidents floating-card">
            <h3>Incident Rail</h3>
            <ul id="incident-list" class="incident-list"></ul>
          </section>

          <div class="floating-group floating-bottom-left" id="hud-metrics">
            <span class="floating-chip">Budget <strong id="hud-budget">0</strong></span>
            <span class="floating-chip">Supply <strong id="hud-served">0</strong></span>
            <span class="floating-chip">Unmet <strong id="hud-unmet">0</strong></span>
            <span class="floating-chip">Reliability <strong id="hud-reliability">0%</strong></span>
            <span class="floating-chip">Score <strong id="hud-score">0</strong></span>
            <span class="floating-chip">Season <strong id="hud-season">neutral</strong></span>
            <span class="floating-chip">Lawsuits <strong id="hud-lawsuits">0</strong></span>
            <span class="floating-chip">Zoom <strong id="hud-zoom">1.00x</strong></span>
            <span class="floating-chip">Pan <strong>Drag / WASD</strong></span>
            <span class="floating-chip">Resources <strong id="hud-resource-visibility">Hidden (hold R)</strong></span>
            <span class="floating-chip">Towns <strong id="hud-town-emergence">0 emerged</strong></span>
          </div>

          <div class="floating-group floating-bottom-center">
            <div class="floating-dock">
              <button class="tool-btn floating-dock-btn" data-tool="build" data-testid="tool-build">Build</button>
              <button class="tool-btn floating-dock-btn" data-tool="demolish" data-testid="tool-demolish">Demolish</button>
              <button class="tool-btn floating-dock-btn" data-tool="reroute" data-testid="tool-reroute">Reroute</button>
              <span class="dock-separator" aria-hidden="true"></span>
              <button class="asset-btn floating-dock-btn" data-asset="plant" data-testid="asset-plant">Plant (1)</button>
              <button class="asset-btn floating-dock-btn" data-asset="substation" data-testid="asset-substation">Sub (2)</button>
              <button class="asset-btn floating-dock-btn" data-asset="storage" data-testid="asset-storage">Storage (3)</button>
            </div>
          </div>

          <div class="floating-group floating-map-controls">
            <button class="floating-map-btn" id="run-zoom-in-btn" aria-label="Zoom in">+</button>
            <button class="floating-map-btn" id="run-zoom-out-btn" aria-label="Zoom out">-</button>
            <button class="floating-map-btn" id="run-center-btn" aria-label="Center map">Center</button>
            <button class="floating-map-btn" id="run-fullscreen-btn" aria-label="Toggle fullscreen">Full</button>
          </div>

          <div class="floating-group floating-bottom-right">
            <div id="region-context" class="floating-card floating-region-context">
              <h3>Region Context</h3>
              <p>Select a region on the map.</p>
            </div>
            <div class="ticker floating-ticker" id="news-ticker">${newsTickerText}</div>
          </div>
        </div>
      </section>
    `;
  }

  attachRunUiListeners() {
    this.root.querySelectorAll("[data-tool]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!this.runtime) return;
        this.runtime.tool = button.getAttribute("data-tool");
        this.runtime.pushHudUpdate();
      });
    });

    this.root.querySelectorAll("[data-asset]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!this.runtime) return;
        this.runtime.tool = TOOL_BUILD;
        this.runtime.buildAssetType = button.getAttribute("data-asset");
        this.runtime.pushHudUpdate();
      });
    });

    this.root.querySelector("#run-pause-btn")?.addEventListener("click", () => {
      if (!this.runtime) return;
      this.runtime.togglePause();
    });

    this.root.querySelector("#run-save-exit-btn")?.addEventListener("click", () => {
      if (!this.runtime) return;
      const snapshot = this.runtime.serializeForSuspend();
      this.suspendedRun = snapshot;
      writeJsonStorage(STORAGE_KEYS.suspendedRun, snapshot);
      this.pushToast("Run suspended. Continue Run is now available from menu.");
      this.renderMainMenu();
    });

    this.root.querySelector("#run-zoom-in-btn")?.addEventListener("click", () => {
      if (!this.runtime) return;
      this.runtime.camera.zoomIndex = clamp(
        this.runtime.camera.zoomIndex + 1,
        0,
        this.runtime.zoomLevels.length - 1
      );
      this.runtime.clampCameraToMap();
      this.runtime.pushHudUpdate();
      this.runtime.render();
    });

    this.root.querySelector("#run-zoom-out-btn")?.addEventListener("click", () => {
      if (!this.runtime) return;
      this.runtime.camera.zoomIndex = clamp(
        this.runtime.camera.zoomIndex - 1,
        0,
        this.runtime.zoomLevels.length - 1
      );
      this.runtime.clampCameraToMap();
      this.runtime.pushHudUpdate();
      this.runtime.render();
    });

    this.root.querySelector("#run-center-btn")?.addEventListener("click", () => {
      if (!this.runtime) return;
      this.runtime.camera.x = BASE_MAP.width / 2;
      this.runtime.camera.y = BASE_MAP.height / 2;
      this.runtime.clampCameraToMap();
      this.runtime.pushHudUpdate();
      this.runtime.render();
    });

    this.root.querySelector("#run-fullscreen-btn")?.addEventListener("click", () => {
      if (!this.runtime) return;
      this.runtime.toggleFullscreen();
    });
  }

  startRun(runConfig) {
    this.setRunMode(true);
    this.currentScreen = "run";
    this.cleanupRuntime();
    this.root.innerHTML = this.buildRunScreenMarkup("National bulletin feed online.");

    const canvas = this.root.querySelector("#game-canvas");

    this.runtime = new GameRuntime({
      canvas,
      runConfig,
      settings: this.settings,
      callbacks: {
        onHud: (payload) => this.updateRunHud(payload),
        onRunEnd: (summary) => this.handleRunEnd(summary),
        onHighlightAlert: (alertId) => this.highlightAlert(alertId),
        onNews: (text) => {
          const ticker = this.root.querySelector("#news-ticker");
          if (ticker) ticker.textContent = text;
        },
      },
    });

    this.runtime.start();
    this.attachRunUiListeners();
  }

  startRunFromSnapshot(snapshot) {
    if (!snapshot || !snapshot.runConfig || !snapshot.gameState) {
      this.pushToast("Saved run data was invalid. Starting fresh menu.");
      this.suspendedRun = null;
      writeJsonStorage(STORAGE_KEYS.suspendedRun, null);
      this.renderMainMenu();
      return;
    }

    this.setRunMode(true);
    this.currentScreen = "run";
    this.cleanupRuntime();
    this.root.innerHTML = this.buildRunScreenMarkup("Resuming archived session...");

    const canvas = this.root.querySelector("#game-canvas");

    this.runtime = new GameRuntime({
      canvas,
      runConfig: snapshot.runConfig,
      snapshot: snapshot.gameState,
      settings: this.settings,
      callbacks: {
        onHud: (payload) => this.updateRunHud(payload),
        onRunEnd: (summary) => this.handleRunEnd(summary),
        onHighlightAlert: (alertId) => this.highlightAlert(alertId),
        onNews: (text) => {
          const ticker = this.root.querySelector("#news-ticker");
          if (ticker) ticker.textContent = text;
        },
      },
    });

    this.runtime.hydrateRuntimeState(snapshot);
    this.runtime.start();
    this.attachRunUiListeners();
    this.suspendedRun = snapshot;
  }

  updateRunHud(payload) {
    const $ = (selector) => this.root.querySelector(selector);

    const runLabelNode = $("#hud-run-label");
    const budgetNode = $("#hud-budget");
    const servedNode = $("#hud-served");
    const reliabilityNode = $("#hud-reliability");
    const unmetNode = $("#hud-unmet");
    const timerNode = $("#hud-timer");
    const seasonNode = $("#hud-season");
    const scoreNode = $("#hud-score");
    const lawsuitsNode = $("#hud-lawsuits");
    const zoomNode = $("#hud-zoom");
    const resourceLayerNode = $("#hud-resource-visibility");
    const townEmergenceNode = $("#hud-town-emergence");
    const pauseNode = $("#run-pause-btn");

    if (
      !budgetNode ||
      !servedNode ||
      !reliabilityNode ||
      !unmetNode ||
      !timerNode ||
      !seasonNode ||
      !scoreNode ||
      !lawsuitsNode
    ) {
      return;
    }

    if (runLabelNode) runLabelNode.textContent = payload.runLabel;
    budgetNode.textContent = Math.round(payload.budget).toString();
    servedNode.textContent = payload.servedDemand.toFixed(1);
    reliabilityNode.textContent = `${payload.reliability.toFixed(1)}%`;
    unmetNode.textContent = payload.unmetDemand.toFixed(1);
    timerNode.textContent = formatTime(payload.timer);
    seasonNode.textContent = payload.season.toUpperCase();
    scoreNode.textContent = Math.round(payload.score).toString();
    lawsuitsNode.textContent = String(payload.lawsuits);
    if (zoomNode && this.runtime) {
      zoomNode.textContent = `${this.runtime.zoomLevels[this.runtime.camera.zoomIndex].toFixed(2)}x`;
    }
    if (resourceLayerNode) {
      resourceLayerNode.textContent = payload.resourceLayerVisible ? "Visible" : "Hidden (hold R)";
    }
    if (townEmergenceNode) {
      const modeLabel = String(payload.townEmergenceMode || "normal").toUpperCase();
      townEmergenceNode.textContent = `${payload.townsEmerged} emerged (${modeLabel})`;
    }
    if (pauseNode) pauseNode.textContent = payload.paused ? "Resume" : "Pause";

    const toolButtons = this.root.querySelectorAll(".tool-btn");
    toolButtons.forEach((button) => {
      const isActive = button.getAttribute("data-tool") === payload.tool;
      button.classList.toggle("active", isActive);
    });

    const assetButtons = this.root.querySelectorAll(".asset-btn");
    assetButtons.forEach((button) => {
      const isActive = button.getAttribute("data-asset") === payload.buildAssetType;
      button.classList.toggle("active", isActive);
    });

    const objectiveTitle = $("#objective-title");
    const objectiveText = $("#objective-text");
    const objectiveDetail = $("#objective-detail");
    const objectiveFill = $("#objective-progress-fill");

    if (objectiveTitle) objectiveTitle.textContent = payload.objective.title;
    if (objectiveText) objectiveText.textContent = payload.objective.text;
    if (objectiveDetail) objectiveDetail.textContent = payload.objective.detail;
    if (objectiveFill) objectiveFill.style.width = `${Math.round(payload.objective.progress * 100)}%`;

    const incidentList = $("#incident-list");
    if (incidentList) {
      incidentList.innerHTML = payload.incidents.length
        ? payload.incidents
            .slice(0, 3)
            .map((incident) => {
              const level = ALERT_LEVELS[incident.level] || ALERT_LEVELS.advisory;
              return `<li style="--level:${level.color}"><strong>${incident.title}</strong><span>${incident.body}</span></li>`;
            })
            .join("")
        : "<li><span>No active incidents.</span></li>";
    }

    const alertList = $("#alert-list");
    if (alertList) {
      alertList.innerHTML = payload.alerts.length
        ? payload.alerts
            .slice(0, 4)
            .map((alert) => {
              const level = ALERT_LEVELS[alert.level] || ALERT_LEVELS.advisory;
              return `<li data-alert-id="${alert.id}" style="--level:${level.color}"><strong>${level.label}</strong><span>${alert.text}</span></li>`;
            })
            .join("")
        : "<li><span>No active alerts.</span></li>";
    }

    const regionContext = $("#region-context");
    const selected = payload.selectedRegion;
    if (!regionContext) return;

    if (!selected) {
      regionContext.innerHTML = "<h3>Region Context</h3><p>Select a region on the map.</p>";
      return;
    }

    const unlockCost = Math.ceil(selected.unlockCost * this.runtime.config.unlockCostMultiplier);
    const resourceProfile = selected.resourceProfile || {
      wind: 0,
      sun: 0,
      natural_gas: 0,
    };
    const townLine = `Towns ${selected.townCount || 0}/${selected.townCap || 0} | Stability ${(
      selected.stableServiceSeconds || 0
    ).toFixed(1)}s | Outage ${(
      selected.outageSeconds || 0
    ).toFixed(1)}s`;
    const resourceLine = `Resources W${Math.round(resourceProfile.wind * 100)}% S${Math.round(resourceProfile.sun * 100)}% G${Math.round(resourceProfile.natural_gas * 100)}%`;
    const selectedHtml = `
      <h3>${selected.name}</h3>
      <p>${selected.districtType} | ${selected.climate} climate | ${selected.terrain} terrain</p>
      <p>Priority ${selected.priority.toUpperCase()} | Population ${selected.population.toFixed(1)}</p>
      <p>Demand ${selected.demand.toFixed(1)} | Served ${selected.served.toFixed(1)} | Unmet ${selected.unmet.toFixed(1)}</p>
      <p>${townLine}</p>
      <p>Assets P${selected.assets.plant} S${selected.assets.substation} B${selected.assets.storage}</p>
      <p>${resourceLine}</p>
      <p>${selected.unlocked ? "Region active" : `Unlock cost: ${unlockCost}`}</p>
    `;
    regionContext.innerHTML = selectedHtml;
  }

  highlightAlert(alertId) {
    this.root.querySelectorAll("#alert-list li").forEach((item) => {
      const active = item.getAttribute("data-alert-id") === alertId;
      item.classList.toggle("highlight", active);
    });
  }

  handleRunEnd(summary) {
    this.runtime = null;

    this.suspendedRun = null;
    writeJsonStorage(STORAGE_KEYS.suspendedRun, null);

    const runClass = summary.leaderboardEligible ? summary.runClass : "custom";
    const targetBucket = this.records[runClass] ? runClass : "custom";

    const entry = {
      runLabel: summary.runLabel,
      result: summary.result,
      finalScore: summary.finalScore,
      reliability: summary.reliability,
      budget: summary.budget,
      completedAt: Date.now(),
    };

    this.records[targetBucket].push(entry);
    this.records[targetBucket].sort((a, b) => b.finalScore - a.finalScore);
    this.records[targetBucket] = this.records[targetBucket].slice(0, 20);
    writeJsonStorage(STORAGE_KEYS.records, this.records);

    if (summary.config.mode === "campaign" && summary.config.mission && summary.result === "victory") {
      const missionIndex = CAMPAIGN_MISSIONS.findIndex((m) => m.id === summary.config.mission.id);
      const nextIndex = Math.max(this.campaignProgress.unlockedMissionIndex, missionIndex + 1);
      this.campaignProgress.unlockedMissionIndex = Math.min(nextIndex, CAMPAIGN_MISSIONS.length - 1);

      const medal =
        summary.reliability >= 90 && summary.finalScore >= 2800
          ? "gold"
          : summary.reliability >= 82 && summary.finalScore >= 2200
            ? "silver"
            : "bronze";

      const existing = this.campaignProgress.missionBest[summary.config.mission.id];
      if (!existing || summary.finalScore > existing.finalScore) {
        this.campaignProgress.missionBest[summary.config.mission.id] = {
          finalScore: summary.finalScore,
          reliability: summary.reliability,
          medal,
        };
      }

      writeJsonStorage(STORAGE_KEYS.campaignProgress, this.campaignProgress);
    }

    this.renderEndScreen(summary, entry);
  }

  renderEndScreen(summary, recordEntry) {
    this.setRunMode(false);
    this.currentScreen = "end";

    const rankingBucket = summary.leaderboardEligible ? summary.runClass : "custom";
    const leaderboard = (this.records[rankingBucket] || []).slice(0, 5);
    const placement = leaderboard.findIndex(
      (entry) =>
        entry.finalScore === recordEntry.finalScore &&
        entry.completedAt === recordEntry.completedAt
    );

    const timelineItems = summary.timeline
      .map((moment) => `<li><strong>${formatTime(moment.at)}</strong> ${moment.text}</li>`)
      .join("");

    this.root.innerHTML = `
      <section class="screen end-screen">
        <header>
          <p class="eyebrow">${summary.result === "victory" ? "Grid Stabilized" : "Grid Under Strain"}</p>
          <h2>${summary.reason}</h2>
          <p>${summary.result === "victory" ? "National command retained system control." : "Run ended under collapse conditions."}</p>
        </header>

        <div class="end-metrics">
          <article><h3>Final Score</h3><p>${summary.finalScore}</p></article>
          <article><h3>Leaderboard</h3><p>${placement >= 0 ? toOrdinal(placement) : "Unranked"}</p></article>
          <article><h3>Reliability</h3><p>${summary.reliability.toFixed(1)}%</p></article>
          <article><h3>Budget</h3><p>${Math.round(summary.budget)}</p></article>
          <article><h3>Demand Served</h3><p>${Math.round(summary.demandServedRatio * 100)}%</p></article>
        </div>

        <section class="timeline-box">
          <h3>Key Timeline Moments</h3>
          <ul>${timelineItems || "<li>No timeline moments recorded.</li>"}</ul>
        </section>

        <footer class="setup-actions">
          <button class="action-btn action-btn-primary" id="end-retry">Retry</button>
          <button class="action-btn" id="end-new-run">New Run</button>
          <button class="action-btn" id="end-menu">Return to Menu</button>
        </footer>
      </section>
    `;

    this.root.querySelector("#end-retry")?.addEventListener("click", () => {
      this.startRun(summary.config);
    });
    this.root.querySelector("#end-new-run")?.addEventListener("click", () => this.renderStandardSetup());
    this.root.querySelector("#end-menu")?.addEventListener("click", () => this.renderMainMenu());
  }

  pushToast(message) {
    const existing = this.root.querySelector(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    this.root.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2400);
  }
}
