import * as GameCore from "./core.js";

const {
  ALERT_LEVELS,
  ASSET_RULES,
  BASE_MAP,
  CAMPAIGN_MISSIONS,
  CLIMATE_MULTIPLIERS,
  CUSTOM_OPTIONS,
  CUSTOM_PRESETS,
  DEFAULT_SETTINGS,
  SEASON_ORDER,
  STANDARD_PRESETS,
  STORAGE_KEYS,
  TERRAIN_COST_MULTIPLIERS,
  TICK_SECONDS,
  TOOL_PAN,
  TOOL_BUILD,
  TOOL_DEMOLISH,
  TOOL_REROUTE,
  TOOL_LINE,
  ASSET_ORDER,
  PRIORITY_ORDER,
  DRAG_THRESHOLD_PX,
  DEFAULT_TERRAIN_MAP_ID,
  DEFAULT_TERRAIN_MAP_IMAGE_URL,
  DEFAULT_TERRAIN_MAP_METADATA_URL,
  MISSION_TERRAIN_MAP_BASE_URL,
  ICON_SET_URLS,
  LIVABLE_TERRAINS,
  SPARSE_START_TOWN_IDS,
  EMERGENCE_TOWN_NAMES,
  LINE_BASE_BUILD_COST_PER_WORLD_UNIT,
  LINE_BASE_MAINTENANCE_PER_WORLD_UNIT,
  LINE_DISTANCE_CAPACITY_FACTOR,
  LINE_MIN_CAPACITY,
  LINE_MAX_CAPACITY,
  DEV_MODE_BUDGET_FLOOR,
  TUTORIAL_STEP_DEFINITIONS,
  SUBSTATION_RADIUS_BY_PROFILE,
  LINE_MAINTENANCE_BY_PROFILE,
  RESOURCE_ZONE_COLORS,
  clamp,
  lerp,
  deepClone,
  formatTime,
  formatCompactMoney,
  randomRange,
  pickRandom,
  pointInPolygon,
  centroidFromPolygon,
  findBaseRegion,
  pickTownArchetype,
  getMissionTerrainImageUrl,
  resolveTerrainMapProfile,
  getMapSelectionOptions,
  loadImageAsset,
  readJsonStorage,
  writeJsonStorage,
  toOrdinal,
  normalizePopulationMode,
  normalizeClimateIntensity,
  normalizeEventIntensity,
  normalizeFailureStrictness,
  normalizeTownEmergenceMode,
  normalizeSubstationRadiusProfile,
  normalizeLineMaintenanceProfile,
  getMissionTownEmergenceMode,
  getMissionSubstationRadiusProfile,
  getMissionLineMaintenanceProfile,
  buildRunConfigFromStandardPreset,
  buildRunConfigFromCampaignMission,
  buildRunConfigFromCustom,
  buildRunConfigForTutorial,
} = GameCore;

const MAP_OBJECT_ICON_WORLD_SIZE = 17.5;
const MAP_OBJECT_INTERACTION_RADIUS_WORLD = 24;
const DEMOLITION_DURATION_SECONDS = 20;
const DEMOLITION_BUILDING_REFUND_RATIO = 0.5;
const DEMOLITION_LINE_REFUND_RATIO = 0.5;
const LINE_WATER_OR_SNOW_PIXEL_SURCHARGE = 10;
const INFRASTRUCTURE_NODE_RADIUS = 22;
const BUILDING_MIN_SPACING_MULTIPLIER = 1.5;
const PLANT_TYPE_ORDER = ["wind", "sun", "natural_gas"];
const PLANT_TYPE_VALUES = new Set(PLANT_TYPE_ORDER);
const DEFAULT_PLANT_TYPE = "wind";
const PLANT_TYPE_DEMOLISH_LABELS = {
  wind: "Wind Powerplant",
  sun: "Solar Powerplant",
  natural_gas: "Natural Gas Powerplant",
};
const DEMOLISH_ASSET_LABELS = {
  substation: "Substation",
  storage: "Battery",
};
const LONG_RANGE_LINE_MAX_DISTANCE = 1000;
const LONG_RANGE_TOWER_COUNT_RATIO = 0.25;
const SIMPLIFIED_LINE_RENDER_ZOOM_THRESHOLD = 0.9;
const STORAGE_UNIT_CAPACITY_MWH = 20;
const STORAGE_CHARGE_DRAW_MW = 20;
const IN_GAME_HOUR_REAL_SECONDS = 120;
const IN_GAME_HOURS_PER_REAL_SECOND = 1 / IN_GAME_HOUR_REAL_SECONDS;
const PRIORITY_DEFAULT = "nominal";
const PRIORITY_ELEVATED = "elevated";
const LEGACY_PRIORITY_MAP = {
  low: PRIORITY_DEFAULT,
  normal: PRIORITY_DEFAULT,
  high: PRIORITY_ELEVATED,
  nominal: PRIORITY_DEFAULT,
  elevated: PRIORITY_ELEVATED,
};
const LEGACY_ZOOM_LEVELS = [0.55, 0.72, 0.9, 1.1, 1.32, 1.64, 1.98, 2.32, 2.64, 3.08, 3.52, 3.96, 4.4, 4.84, 5.28];
const MIN_CAMERA_ZOOM = 0.55;
const MAX_CAMERA_ZOOM = 8;
const DEFAULT_CAMERA_ZOOM = 2.64;
const ZOOM_WHEEL_SENSITIVITY = 0.0016;
const ZOOM_SMOOTHING_PER_SECOND = 12;
const ZOOM_EPSILON = 0.0001;
const CAMERA_PAN_OVERSCROLL_VIEWPORTS = 0.5;

export class GameRuntime {
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

    this.camera = {
      x: BASE_MAP.width / 2,
      y: BASE_MAP.height / 2,
      zoom: DEFAULT_CAMERA_ZOOM,
      zoomTarget: DEFAULT_CAMERA_ZOOM,
      dragActive: false,
      dragStartX: 0,
      dragStartY: 0,
      dragCamX: BASE_MAP.width / 2,
      dragCamY: BASE_MAP.height / 2,
    };
    this.zoomFocus = null;

    this.tool = TOOL_PAN;
    this.buildAssetType = "plant";
    this.buildPlantType = DEFAULT_PLANT_TYPE;
    this.selectedRegionId = null;
    this.lineBuildStartRegionId = null;
    this.lineCostPreview = null;
    this.highlightedAlertId = null;
    this.mapImage = null;
    this.mapImageReady = false;
    this.mapPixelData = null;
    this.mapPixelWidth = 0;
    this.mapPixelHeight = 0;
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
      infrastructure: {
        substation: null,
      },
      powerline: {
        localHorizontal: null,
        localVertical: null,
        longHorizontal: null,
        longVertical: null,
      },
      overlay: {
        priorityElevated: null,
      },
    };

    this.state = this.snapshot ? this.rehydrateSnapshot(this.snapshot) : this.createFreshState();
    this.enforceInfrastructureOccupancyRules();
    this.pruneEmptyInfrastructureNodes();
    this.ensureRegionResourceProfiles();
    this.applyDevModeState();
    if (this.config.mode === "tutorial") {
      const step = this.getCurrentTutorialStep();
      if (step) {
        this.pushAlert(`Tutorial step: ${step.title}. ${step.instruction}`, "advisory", 12);
      }
    }

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
    this.config.devMode = !!this.config.devMode;
    this.config.substationRadiusProfile = normalizeSubstationRadiusProfile(
      this.config.substationRadiusProfile
    );
    this.config.substationRadius = SUBSTATION_RADIUS_BY_PROFILE[this.config.substationRadiusProfile];
    this.config.lineMaintenanceProfile = normalizeLineMaintenanceProfile(
      this.config.lineMaintenanceProfile
    );
    this.config.lineMaintenanceMultiplier =
      Number(this.config.lineMaintenanceMultiplier) ||
      LINE_MAINTENANCE_BY_PROFILE[this.config.lineMaintenanceProfile];
    this.config.townEmergenceMode = normalizeTownEmergenceMode(
      this.config.townEmergenceMode,
      this.config.populationEnabled !== false
    );
    const terrainProfile = resolveTerrainMapProfile(this.config);
    this.config.mapSelectionId = terrainProfile.id;
    this.config.terrainMapId = terrainProfile.id;
    this.config.terrainMapLabel = terrainProfile.label;
    this.config.terrainMapImageUrl = terrainProfile.imageUrl;
    this.config.terrainMapMetadataUrl = terrainProfile.metadataUrl;
    if (this.config.mode === "tutorial") {
      this.config.populationEnabled = false;
      this.config.populationStrength = 0;
      this.config.seasonalProfile = "neutral";
      this.config.townEmergenceMode = "low";
      this.config.eventIntensity = Math.min(0.35, Number(this.config.eventIntensity || 0.35));
      this.config.startingBudget = Math.max(5000, Number(this.config.startingBudget || 0));
      this.config.leaderboardEligible = false;
      this.config.leaderboardClass = "custom";
    }
  }

  createEmptyResourceProfile() {
    return {
      wind: 0,
      sun: 0,
      natural_gas: 0,
    };
  }

  normalizePlantType(value) {
    return PLANT_TYPE_VALUES.has(value) ? value : DEFAULT_PLANT_TYPE;
  }

  normalizePriority(value) {
    const normalized = LEGACY_PRIORITY_MAP[String(value || "").toLowerCase()];
    return PRIORITY_ORDER.includes(normalized) ? normalized : PRIORITY_DEFAULT;
  }

  getNextBuildPlantType(currentType = this.buildPlantType) {
    const normalizedType = this.normalizePlantType(currentType);
    const currentIndex = PLANT_TYPE_ORDER.indexOf(normalizedType);
    if (currentIndex < 0) return DEFAULT_PLANT_TYPE;
    const nextIndex = (currentIndex + 1) % PLANT_TYPE_ORDER.length;
    return PLANT_TYPE_ORDER[nextIndex] || DEFAULT_PLANT_TYPE;
  }

  inferPlantTypeFromRegionResource(region) {
    const profile = region?.resourceProfile || {};
    const candidates = ["wind", "sun", "natural_gas"];
    let bestType = DEFAULT_PLANT_TYPE;
    let bestValue = -Infinity;
    for (const candidate of candidates) {
      const raw = candidate === "natural_gas" ? profile.natural_gas ?? profile.naturalGas : profile[candidate];
      const value = Number(raw ?? 0) || 0;
      if (value > bestValue) {
        bestValue = value;
        bestType = candidate;
      }
    }
    return bestType;
  }

  getDemolishAssetLabel(region, assetType) {
    if (assetType === "plant") {
      const plantType = this.normalizePlantType(region?.plantType);
      return PLANT_TYPE_DEMOLISH_LABELS[plantType] || "Powerplant";
    }
    return DEMOLISH_ASSET_LABELS[assetType] || (ASSET_RULES[assetType]?.label ?? "Asset");
  }

  createEmptyAssetBuildCosts() {
    return {
      plant: [],
      substation: [],
      storage: [],
    };
  }

  normalizeAssetBuildCostHistory(values) {
    if (!Array.isArray(values)) return [];
    return values
      .map((value) => Math.max(0, Math.round(Number(value) || 0)))
      .filter((value) => value > 0);
  }

  ensureRegionAssetBuildCosts(region) {
    if (!region) return this.createEmptyAssetBuildCosts();
    const existing = region.assetBuildCosts && typeof region.assetBuildCosts === "object"
      ? region.assetBuildCosts
      : {};
    const normalized = this.createEmptyAssetBuildCosts();
    for (const assetType of ASSET_ORDER) {
      normalized[assetType] = this.normalizeAssetBuildCostHistory(existing[assetType]);
      const assetCount = Math.max(0, Number(region.assets?.[assetType] || 0));
      if (normalized[assetType].length > assetCount) {
        normalized[assetType] = normalized[assetType].slice(-assetCount);
      }
    }
    region.assetBuildCosts = normalized;
    return normalized;
  }

  enforceSingleAssetOccupancyForInfrastructure(region) {
    if (!region || this.isTownEntity(region)) return;
    const normalizedAssets = { plant: 0, substation: 0, storage: 0 };
    for (const assetType of ASSET_ORDER) {
      normalizedAssets[assetType] = Math.max(0, Number(region.assets?.[assetType] || 0));
    }
    region.assets = normalizedAssets;

    const activeAssetTypes = ASSET_ORDER.filter((assetType) => normalizedAssets[assetType] > 0);
    if (!activeAssetTypes.length) {
      region.storageChargeMWh = 0;
      this.ensureRegionAssetBuildCosts(region);
      return;
    }

    const keepAssetType = activeAssetTypes[0];
    region.assets = { plant: 0, substation: 0, storage: 0 };
    region.assets[keepAssetType] = 1;

    const ledger = this.ensureRegionAssetBuildCosts(region);
    for (const assetType of ASSET_ORDER) {
      if (assetType === keepAssetType) {
        const history = this.normalizeAssetBuildCostHistory(ledger[assetType]);
        const keepValue = history.length
          ? history[history.length - 1]
          : this.estimateAssetBuildCost(region, assetType);
        ledger[assetType] = keepValue > 0 ? [keepValue] : [];
      } else {
        ledger[assetType] = [];
      }
    }

    if (keepAssetType !== "plant") {
      region.plantType = DEFAULT_PLANT_TYPE;
    }
    if (keepAssetType !== "storage") {
      region.storageChargeMWh = 0;
    } else {
      this.normalizeRegionStorageCharge(region, { legacyDefaultToFull: true });
    }
  }

  enforceInfrastructureOccupancyRules() {
    for (const region of this.state.regions) {
      this.enforceSingleAssetOccupancyForInfrastructure(region);
    }
  }

  estimateAssetBuildCost(region, assetType) {
    const rule = ASSET_RULES[assetType];
    if (!rule) return 0;
    const terrainFactor = TERRAIN_COST_MULTIPLIERS[region?.terrain] || 1;
    const globalCostFactor = this.getModifierValue("build_cost", 1);
    const rawCost = rule.cost * terrainFactor * this.config.infraCostMultiplier * globalCostFactor;
    return Math.max(0, Math.ceil(rawCost));
  }

  peekDemolishAssetValue(region, assetType) {
    const ledger = this.ensureRegionAssetBuildCosts(region);
    const history = ledger[assetType];
    if (history.length) {
      return Math.max(0, Number(history[history.length - 1] || 0));
    }
    return this.estimateAssetBuildCost(region, assetType);
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

  getSeededTownCount(region) {
    if (!this.config.sparseStart) return 1;
    return SPARSE_START_TOWN_IDS.has(region.id) ? 1 : 0;
  }

  getStarterAssetsForRegion(region, seededTowns) {
    if (!this.config.sparseStart) {
      return { plant: 0, substation: 0, storage: 0 };
    }
    if (seededTowns > 0) {
      return { plant: 0, substation: 0, storage: 0 };
    }
    return { plant: 0, substation: 0, storage: 0 };
  }

  getDemandAnchorForRegion(region) {
    const townCount = Math.max(0, Number(region.townCount || 0));
    if (townCount <= 0) return 0;
    const nominalBaseDemand = Number(region.nominalBaseDemand || region.baseDemand || 0);
    return nominalBaseDemand;
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

  getStorageUnitCount(region) {
    return Math.max(0, Number(region?.assets?.storage || 0));
  }

  getStorageCapacityMWhForUnits(storageUnits) {
    return Math.max(0, storageUnits) * STORAGE_UNIT_CAPACITY_MWH;
  }

  getRegionStorageCapacityMWh(region) {
    return this.getStorageCapacityMWhForUnits(this.getStorageUnitCount(region));
  }

  normalizeRegionStorageCharge(region, { legacyDefaultToFull = false } = {}) {
    if (!region) return 0;
    const storageUnits = this.getStorageUnitCount(region);
    const capacityMWh = this.getStorageCapacityMWhForUnits(storageUnits);
    const serializedCharge = Number(region.storageChargeMWh);
    const fallbackCharge = legacyDefaultToFull ? capacityMWh : 0;
    const normalizedCharge = Number.isFinite(serializedCharge) ? serializedCharge : fallbackCharge;
    region.storageChargeMWh = clamp(normalizedCharge, 0, capacityMWh);
    return region.storageChargeMWh;
  }

  getStorageChargeDemandMW(region, dt) {
    const storageUnits = this.getStorageUnitCount(region);
    if (storageUnits <= 0 || dt <= 0) return 0;
    const capacityMWh = this.getStorageCapacityMWhForUnits(storageUnits);
    if (capacityMWh <= 0) return 0;
    const currentStoredMWh = this.normalizeRegionStorageCharge(region);
    const remainingMWh = Math.max(0, capacityMWh - currentStoredMWh);
    if (remainingMWh <= 1e-6) return 0;
    const maxDrawByRate = storageUnits * STORAGE_CHARGE_DRAW_MW;
    const maxDrawByCapacity = remainingMWh / (dt * IN_GAME_HOURS_PER_REAL_SECOND);
    return Math.max(0, Math.min(maxDrawByRate, maxDrawByCapacity));
  }

  addStorageChargeFromGrid(region, drawMW, dt) {
    if (!region || drawMW <= 0 || dt <= 0) return 0;
    const capacityMWh = this.getRegionStorageCapacityMWh(region);
    if (capacityMWh <= 0) {
      region.storageChargeMWh = 0;
      return 0;
    }
    const currentStoredMWh = this.normalizeRegionStorageCharge(region);
    const addedMWh = Math.max(0, drawMW * dt * IN_GAME_HOURS_PER_REAL_SECOND);
    region.storageChargeMWh = clamp(currentStoredMWh + addedMWh, 0, capacityMWh);
    return region.storageChargeMWh - currentStoredMWh;
  }

  createTutorialProgressState(existing = null) {
    const safe = existing && typeof existing === "object" ? existing : {};
    const totalSteps = TUTORIAL_STEP_DEFINITIONS.length;
    const completedSteps = clamp(
      Number(safe.completedSteps || safe.currentStep || 0),
      0,
      totalSteps
    );
    const completed = !!safe.completed || completedSteps >= totalSteps;
    return {
      currentStep: completed ? totalSteps : completedSteps,
      completedSteps: completed ? totalSteps : completedSteps,
      totalSteps,
      completed,
      pauseSeen: !!safe.pauseSeen,
      resumeSeen: !!safe.resumeSeen,
    };
  }

  getCurrentTutorialStep() {
    if (this.config.mode !== "tutorial") return null;
    if (!this.state.tutorial) {
      this.state.tutorial = this.createTutorialProgressState();
    }
    if (this.state.tutorial.completed) return null;
    return TUTORIAL_STEP_DEFINITIONS[this.state.tutorial.currentStep] || null;
  }

  completeTutorialStep() {
    if (this.config.mode !== "tutorial") return;
    if (!this.state.tutorial) {
      this.state.tutorial = this.createTutorialProgressState();
    }

    const currentStep = this.getCurrentTutorialStep();
    if (!currentStep) return;

    this.state.tutorial.currentStep += 1;
    this.state.tutorial.completedSteps = this.state.tutorial.currentStep;
    this.pushAlert(`Tutorial step complete: ${currentStep.title}.`, "advisory", 6);
    this.logTimeline(`Tutorial step complete: ${currentStep.title}.`);

    if (this.state.tutorial.currentStep >= this.state.tutorial.totalSteps) {
      this.state.tutorial.completed = true;
      this.pushAlert(
        "Tutorial complete. Continue practicing or use Save & Exit from the top bar.",
        "advisory",
        8
      );
      this.logTimeline("Tutorial complete. Core controls verified.");
      this.pushHudUpdate();
      return;
    }

    const nextStep = this.getCurrentTutorialStep();
    if (nextStep) {
      this.pushAlert(
        `Next tutorial step: ${nextStep.title}. ${nextStep.instruction}`,
        "advisory",
        8
      );
    }
  }

  recordTutorialAction(action, details = {}) {
    if (this.config.mode !== "tutorial") return;
    const currentStep = this.getCurrentTutorialStep();
    if (!currentStep) return;

    const matches =
      (currentStep.id === "build_plant" &&
        action === "build" &&
        details.assetType === "plant" &&
        details.onOpenPoint) ||
      (currentStep.id === "build_substation" &&
        action === "build" &&
        details.assetType === "substation" &&
        details.onOpenPoint) ||
      (currentStep.id === "build_line" && action === "line_built") ||
      (currentStep.id === "service_town" && action === "service_active") ||
      (currentStep.id === "resource_reveal" && action === "resource_reveal") ||
      (currentStep.id === "reroute" && action === "reroute" && details.isTown) ||
      (currentStep.id === "demolish" && action === "demolish") ||
      (currentStep.id === "pause_resume" && action === "pause_resume");

    if (matches) {
      this.completeTutorialStep();
    }
  }

  evaluateTutorialPassiveProgress() {
    if (this.config.mode !== "tutorial") return;
    const currentStep = this.getCurrentTutorialStep();
    if (!currentStep) return;

    if (currentStep.id === "service_town") {
      const servedTown = this.state.regions.some(
        (region) =>
          this.isTownEntity(region) &&
          region.coveredBySubstation &&
          (region.served || 0) > 0.1
      );
      if (servedTown) {
        this.recordTutorialAction("service_active");
      }
    }
  }

  isDevModeEnabled() {
    return !!this.config.devMode;
  }

  applyDevModeState() {
    if (!this.isDevModeEnabled()) return;
    this.state.budget = Math.max(DEV_MODE_BUDGET_FLOOR, Number(this.state.budget) || 0);
    this.state.collapseSeconds = 0;
  }

  async loadMapAndResourceZones() {
    const terrainMapImageUrl = this.config.terrainMapImageUrl || DEFAULT_TERRAIN_MAP_IMAGE_URL;
    const terrainMapMetadataUrl =
      this.config.terrainMapMetadataUrl == null
        ? null
        : this.config.terrainMapMetadataUrl || DEFAULT_TERRAIN_MAP_METADATA_URL;

    const imagePromise = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = terrainMapImageUrl;
    });

    const metadataPromise = terrainMapMetadataUrl
      ? fetch(terrainMapMetadataUrl)
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null)
      : Promise.resolve(null);

    const [image, metadata] = await Promise.all([imagePromise, metadataPromise]);

    if (image) {
      this.mapImage = image;
      this.mapImageReady = true;
      this.cacheMapPixelsForLineCost(image);
    } else {
      this.mapPixelData = null;
      this.mapPixelWidth = 0;
      this.mapPixelHeight = 0;
    }

    let zones = [];
    const metadataResourceZones = Array.isArray(metadata?.resourceZones)
      ? metadata.resourceZones
      : Array.isArray(metadata?.resource_zones)
        ? metadata.resource_zones
        : [];
    if (metadata && metadataResourceZones.length) {
      const sourceWidth = Number(metadata?.image?.width) || image?.naturalWidth || BASE_MAP.width;
      const sourceHeight = Number(metadata?.image?.height) || image?.naturalHeight || BASE_MAP.height;
      const scaleX = BASE_MAP.width / Math.max(1, sourceWidth);
      const scaleY = BASE_MAP.height / Math.max(1, sourceHeight);

      for (const rawZone of metadataResourceZones) {
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
    } else if (Array.isArray(BASE_MAP.resourceZones) && BASE_MAP.resourceZones.length) {
      zones = BASE_MAP.resourceZones
        .map((rawZone, index) => {
          if (!rawZone || !Array.isArray(rawZone.polygon) || rawZone.polygon.length < 3) return null;
          const resource = String(rawZone.resource || "");
          if (!RESOURCE_ZONE_COLORS[resource]) return null;
          const polygon = rawZone.polygon.map((point) => ({
            x: clamp(Number(point.x), 0, BASE_MAP.width),
            y: clamp(Number(point.y), 0, BASE_MAP.height),
          }));
          if (polygon.length < 3) return null;
          return {
            id: String(rawZone.id || `zone-${index + 1}`),
            resource,
            polygon,
            centroid: centroidFromPolygon(polygon),
          };
        })
        .filter(Boolean);
    }

    if (!zones.length) {
      this.render();
      return;
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

  cacheMapPixelsForLineCost(image) {
    if (!image) return;
    try {
      const canvas = document.createElement("canvas");
      const width = Math.max(1, Number(image.naturalWidth || image.width || 0));
      const height = Math.max(1, Number(image.naturalHeight || image.height || 0));
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      this.mapPixelData = imageData.data;
      this.mapPixelWidth = width;
      this.mapPixelHeight = height;
    } catch {
      this.mapPixelData = null;
      this.mapPixelWidth = 0;
      this.mapPixelHeight = 0;
    }
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
    const mapTowns = BASE_MAP.towns;
    const sourceTowns = this.config.sparseStart
      ? mapTowns.filter((region) => SPARSE_START_TOWN_IDS.has(region.id))
      : mapTowns;
    const towns = sourceTowns.map((region) => {
      const townCount = this.getSeededTownCount(region);
      const assets = this.getStarterAssetsForRegion(region, townCount);
      const demandAnchor = this.getDemandAnchorForRegion({ ...region, townCount });
      return {
        ...deepClone(region),
        entityType: "town",
        priority: PRIORITY_DEFAULT,
        townCount,
        townCap: 1,
        nominalBaseDemand: region.baseDemand,
        stableServiceSeconds: townCount > 0 ? 8 : 0,
        outageSeconds: 0,
        coveredBySubstation: false,
        coverageSourceId: null,
        coverageDistance: 0,
        assets,
        storageChargeMWh: 0,
        storageChargingMw: 0,
        assetBuildCosts: this.createEmptyAssetBuildCosts(),
        plantType: DEFAULT_PLANT_TYPE,
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

    const links = BASE_MAP.links.map((link) => {
      return {
        ...deepClone(link),
        built: false,
        flowFrom: link.a,
        flowTo: link.b,
        length: Math.hypot(
          (findBaseRegion(link.a)?.x || 0) - (findBaseRegion(link.b)?.x || 0),
          (findBaseRegion(link.a)?.y || 0) - (findBaseRegion(link.b)?.y || 0)
        ),
        lineBuildCost: 0,
        used: 0,
        safeCapacity: 0,
        hardCapacity: 0,
        stress: 0,
        overload: false,
      };
    });

    return {
      runtimeSeconds: 0,
      budget: this.isDevModeEnabled() ? DEV_MODE_BUDGET_FLOOR : this.config.startingBudget,
      reliability: 84,
      score: 0,
      hiddenTrust: 75,
      lawsuits: 0,
      totalDemand: 0,
      totalServed: 0,
      totalUnmet: 0,
      totalGeneration: 0,
      storageChargingMw: 0,
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
      pendingDemolitions: [],
      nextLineId: 1,
      nextTownId: 1,
      nextNodeId: 1,
      nextTownEmergenceAt: randomRange(44, 70),
      nextEventAt: randomRange(20, 34),
      nextLawsuitEligibleAt: 45,
      collapseSeconds: 0,
      tutorial: this.config.mode === "tutorial" ? this.createTutorialProgressState() : null,
      towns,
      regions: towns,
      links,
    };
  }

  rehydrateSnapshot(snapshot) {
    const safe = deepClone(snapshot);
    safe.links = safe.links || [];
    safe.towns = safe.towns || safe.regions || [];
    safe.regions = safe.towns;
    safe.alerts = safe.alerts || [];
    safe.incidents = safe.incidents || [];
    safe.timeline = safe.timeline || [];
    safe.pendingDemolitions = Array.isArray(safe.pendingDemolitions)
      ? safe.pendingDemolitions
          .map((item, index) => {
            const assetType = String(item?.assetType || "");
            if (!ASSET_RULES[assetType]) return null;
            return {
              id: String(item?.id || `pending-demo-${index + 1}`),
              regionId: String(item?.regionId || ""),
              regionName: String(item?.regionName || ""),
              assetType,
              assetLabel: String(item?.assetLabel || ASSET_RULES[assetType].label),
              refund: Math.max(0, Number(item?.refund || 0)),
              buildingValue: Math.max(0, Number(item?.buildingValue || 0)),
              startedAt: Math.max(0, Number(item?.startedAt || 0)),
              completesAt: Math.max(0, Number(item?.completesAt || 0)),
            };
          })
          .filter((item) => item && item.regionId)
      : [];
    for (const region of safe.regions) {
      if (!region.entityType) {
        region.entityType = String(region.id || "").startsWith("node-") ? "node" : "town";
      }
      region.townCap = region.entityType === "town" ? 1 : 0;
      region.townCount = region.entityType === "town" ? 1 : 0;
      region.nominalBaseDemand =
        region.entityType === "town"
          ? Number(region.nominalBaseDemand || region.baseDemand || 0)
          : 0;
      region.stableServiceSeconds = Math.max(0, Number(region.stableServiceSeconds || 0));
      region.outageSeconds = Math.max(0, Number(region.outageSeconds || 0));
      region.coveredBySubstation = !!region.coveredBySubstation;
      region.coverageSourceId = region.coverageSourceId || null;
      region.coverageDistance = Math.max(0, Number(region.coverageDistance || 0));
      region.storageChargingMw = 0;
      region.priority = this.normalizePriority(region.priority);
      region.baseDemand = region.entityType === "town" ? Number(region.baseDemand || 0) : 0;
      region.population = region.entityType === "town" ? Number(region.population || 0) : 0;
      region.growthRate = region.entityType === "town" ? Number(region.growthRate || 0) : 0;
      if (!region.assets) {
        region.assets = { plant: 0, substation: 0, storage: 0 };
      }
      region.assets.plant = Math.max(0, Number(region.assets.plant || 0));
      region.assets.substation = Math.max(0, Number(region.assets.substation || 0));
      region.assets.storage = Math.max(0, Number(region.assets.storage || 0));
      this.normalizeRegionStorageCharge(region, { legacyDefaultToFull: true });
      this.ensureRegionAssetBuildCosts(region);
      const serializedPlantType = region.plantType;
      if (PLANT_TYPE_VALUES.has(serializedPlantType)) {
        region.plantType = this.normalizePlantType(serializedPlantType);
      } else if (region.assets.plant > 0) {
        region.plantType = this.inferPlantTypeFromRegionResource(region);
      } else {
        region.plantType = DEFAULT_PLANT_TYPE;
      }
    }
    for (const link of safe.links) {
      link.a = String(link.a || "");
      link.b = String(link.b || "");
      const flowFrom = String(link.flowFrom || "");
      const flowTo = String(link.flowTo || "");
      const flowMatchesEndpoints =
        (flowFrom === link.a && flowTo === link.b) ||
        (flowFrom === link.b && flowTo === link.a);
      if (flowMatchesEndpoints) {
        link.flowFrom = flowFrom;
        link.flowTo = flowTo;
      } else {
        link.flowFrom = link.a;
        link.flowTo = link.b;
      }
      link.built = !!link.built;
      if (!Number.isFinite(link.length) || link.length <= 0) {
        const a = findBaseRegion(link.a);
        const b = findBaseRegion(link.b);
        link.length = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
      }
      if (!Number.isFinite(link.lineBuildCost) || link.lineBuildCost < 0) {
        link.lineBuildCost = 0;
      }
    }
    if (!safe.nextEventAt) safe.nextEventAt = safe.runtimeSeconds + randomRange(20, 34);
    if (!safe.nextLawsuitEligibleAt) safe.nextLawsuitEligibleAt = safe.runtimeSeconds + 45;
    if (!safe.nextTownEmergenceAt) safe.nextTownEmergenceAt = safe.runtimeSeconds + randomRange(44, 70);
    if (!Number.isFinite(safe.townsEmerged)) safe.townsEmerged = 0;
    if (!Number.isFinite(safe.nextTownId)) {
      const maxTownId = safe.regions.reduce((max, town) => {
        const match = /^town-(\d+)$/.exec(String(town.id || ""));
        if (!match) return max;
        return Math.max(max, Number(match[1]) || 0);
      }, 0);
      safe.nextTownId = maxTownId + 1;
    }
    if (!Number.isFinite(safe.nextLineId)) safe.nextLineId = 1;
    if (!Number.isFinite(safe.nextNodeId)) {
      const maxNodeId = safe.regions.reduce((max, entity) => {
        const match = /^node-(\d+)$/.exec(String(entity.id || ""));
        if (!match) return max;
        return Math.max(max, Number(match[1]) || 0);
      }, 0);
      safe.nextNodeId = maxNodeId + 1;
    }
    safe.totalDemand = safe.totalDemand || 0;
    safe.totalServed = safe.totalServed || 0;
    safe.totalUnmet = safe.totalUnmet || 0;
    safe.totalGeneration = safe.totalGeneration || 0;
    safe.storageChargingMw = Math.max(0, Number(safe.storageChargingMw || 0));
    if (this.config.mode === "tutorial") {
      safe.tutorial = this.createTutorialProgressState(safe.tutorial);
    } else {
      safe.tutorial = null;
    }
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
    this.updateZoom(dt);
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
      this.updateZoom(TICK_SECONDS);
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
      this.zoomFocus = null;
      const zoom = this.getCameraZoom();
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

  getCameraZoom() {
    const zoom = Number(this.camera.zoom);
    if (Number.isFinite(zoom) && zoom > 0) return zoom;
    return DEFAULT_CAMERA_ZOOM;
  }

  getTargetZoom() {
    const zoomTarget = Number(this.camera.zoomTarget);
    if (Number.isFinite(zoomTarget) && zoomTarget > 0) return zoomTarget;
    return this.getCameraZoom();
  }

  setZoomTarget(nextZoom) {
    const numericZoom = Number(nextZoom);
    if (!Number.isFinite(numericZoom) || numericZoom <= 0) return false;
    const clampedZoom = clamp(numericZoom, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
    if (Math.abs(clampedZoom - this.getTargetZoom()) <= ZOOM_EPSILON) return false;
    this.camera.zoomTarget = clampedZoom;
    return true;
  }

  setZoomFocusAtScreenPoint(screenX, screenY) {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) {
      this.zoomFocus = null;
      return;
    }

    const focusX = clamp(Number(screenX), 0, width);
    const focusY = clamp(Number(screenY), 0, height);
    const world = this.screenToWorld(focusX, focusY);
    this.zoomFocus = {
      screenX: focusX,
      screenY: focusY,
      worldX: world.x,
      worldY: world.y,
    };
  }

  setZoomFocusFromWheelEvent(event) {
    const rect = this.canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const pointerInside =
      localX >= 0 &&
      localX <= rect.width &&
      localY >= 0 &&
      localY <= rect.height;
    if (pointerInside) {
      this.setZoomFocusAtScreenPoint(localX, localY);
      return;
    }

    if (this.mouse.inside) {
      this.setZoomFocusAtScreenPoint(this.mouse.x, this.mouse.y);
      return;
    }

    this.setZoomFocusAtScreenPoint(rect.width / 2, rect.height / 2);
  }

  applyZoomFocusToCamera() {
    if (!this.zoomFocus) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const zoom = this.getCameraZoom();
    if (!width || !height || zoom <= 0) {
      this.zoomFocus = null;
      return;
    }

    this.camera.x = this.zoomFocus.worldX - (this.zoomFocus.screenX - width / 2) / zoom;
    this.camera.y = this.zoomFocus.worldY - (this.zoomFocus.screenY - height / 2) / zoom;
  }

  normalizeWheelDelta(event) {
    const rawDelta = Number(event.deltaY);
    if (!Number.isFinite(rawDelta) || rawDelta === 0) return 0;
    if (event.deltaMode === 1) return rawDelta * 16;
    if (event.deltaMode === 2) return rawDelta * Math.max(this.canvas.clientHeight, 1);
    return rawDelta;
  }

  updateZoom(dt) {
    const targetZoom = this.getTargetZoom();
    if (!Number.isFinite(targetZoom) || targetZoom <= 0) return;

    const currentZoom = this.getCameraZoom();
    const blend = 1 - Math.exp(-ZOOM_SMOOTHING_PER_SECOND * Math.max(0, dt));
    const nextZoom = Math.abs(targetZoom - currentZoom) <= ZOOM_EPSILON
      ? targetZoom
      : lerp(currentZoom, targetZoom, blend);
    this.camera.zoom = clamp(
      nextZoom,
      MIN_CAMERA_ZOOM,
      MAX_CAMERA_ZOOM
    );
    this.applyZoomFocusToCamera();
    this.clampCameraToMap();
    if (Math.abs(targetZoom - this.camera.zoom) <= ZOOM_EPSILON) {
      this.zoomFocus = null;
    }
  }

  onWheel(event) {
    event.preventDefault();
    const normalizedDelta = this.normalizeWheelDelta(event);
    if (normalizedDelta === 0) return;
    const currentTargetZoom = this.getTargetZoom();
    const scale = Math.exp(-normalizedDelta * ZOOM_WHEEL_SENSITIVITY);
    if (!Number.isFinite(scale) || scale <= 0) return;
    const nextTargetZoom = currentTargetZoom * scale;
    const targetAdjusted = this.setZoomTarget(nextTargetZoom);
    if (targetAdjusted) {
      this.setZoomFocusFromWheelEvent(event);
    }
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
      const currentPlantType = this.normalizePlantType(this.buildPlantType);
      const alreadyWindPlantBuildTool =
        this.tool === TOOL_BUILD &&
        this.buildAssetType === "plant" &&
        currentPlantType === "wind";
      this.tool = TOOL_BUILD;
      this.buildAssetType = "plant";
      this.buildPlantType = alreadyWindPlantBuildTool
        ? this.getNextBuildPlantType(this.buildPlantType)
        : DEFAULT_PLANT_TYPE;
      this.pushHudUpdate();
      return;
    }

    if (event.code === "Digit2") {
      this.tool = TOOL_BUILD;
      this.buildAssetType = "plant";
      this.buildPlantType = "sun";
      this.pushHudUpdate();
      return;
    }

    if (event.code === "Digit3") {
      this.tool = TOOL_BUILD;
      this.buildAssetType = "plant";
      this.buildPlantType = "natural_gas";
      this.pushHudUpdate();
      return;
    }

    if (event.code === "Digit4") {
      this.tool = TOOL_BUILD;
      this.buildAssetType = "substation";
      this.pushHudUpdate();
      return;
    }

    if (event.code === "Digit5") {
      this.tool = TOOL_BUILD;
      this.buildAssetType = "storage";
      this.pushHudUpdate();
      return;
    }

    if (event.code === "Digit6" || event.code === "KeyL") {
      this.tool = TOOL_LINE;
      this.pushHudUpdate();
      return;
    }

    if (event.code === "KeyX") {
      this.tool = TOOL_DEMOLISH;
      this.pushHudUpdate();
      return;
    }

    if (event.code === "KeyR") {
      if (event.repeat) return;
      this.resourceRevealHeld = !this.resourceRevealHeld;
      if (this.resourceRevealHeld) {
        this.recordTutorialAction("resource_reveal");
      }
      this.pushHudUpdate();
      this.render();
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
      event.preventDefault();
      this.tool = TOOL_PAN;
      this.selectedRegionId = null;
      this.clearLineSelection();
      this.callbacks.onDismissDemolishConfirm?.();
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
  }

  onWindowBlur() {
    this.keyPan.up = false;
    this.keyPan.down = false;
    this.keyPan.left = false;
    this.keyPan.right = false;
    this.clearLineSelection();
    this.pointerDown.active = false;
    this.pointerDown.dragging = false;
    this.camera.dragActive = false;
  }

  togglePause() {
    this.paused = !this.paused;
    if (this.config.mode === "tutorial") {
      this.state.tutorial = this.createTutorialProgressState(this.state.tutorial);
      if (this.paused) {
        this.state.tutorial.pauseSeen = true;
      } else if (this.state.tutorial.pauseSeen) {
        this.state.tutorial.resumeSeen = true;
      }
      if (this.state.tutorial.pauseSeen && this.state.tutorial.resumeSeen) {
        this.recordTutorialAction("pause_resume");
      }
    }
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
    const zoom = this.getCameraZoom();
    const wx = this.camera.x + (screenX - width / 2) / zoom;
    const wy = this.camera.y + (screenY - height / 2) / zoom;
    return { x: wx, y: wy };
  }

  worldToScreen(worldX, worldY) {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const zoom = this.getCameraZoom();
    const sx = (worldX - this.camera.x) * zoom + width / 2;
    const sy = (worldY - this.camera.y) * zoom + height / 2;
    return { x: sx, y: sy };
  }

  clampCameraToMap(viewWidth = this.canvas.clientWidth, viewHeight = this.canvas.clientHeight) {
    const zoom = this.getCameraZoom();
    if (!viewWidth || !viewHeight || zoom <= 0) return;

    const viewportWorldWidth = viewWidth / zoom;
    const viewportWorldHeight = viewHeight / zoom;
    const halfViewWorldWidth = viewWidth / (2 * zoom);
    const halfViewWorldHeight = viewHeight / (2 * zoom);
    const overscrollX = viewportWorldWidth * CAMERA_PAN_OVERSCROLL_VIEWPORTS;
    const overscrollY = viewportWorldHeight * CAMERA_PAN_OVERSCROLL_VIEWPORTS;
    const minX = halfViewWorldWidth - overscrollX;
    const maxX = BASE_MAP.width - halfViewWorldWidth + overscrollX;
    const minY = halfViewWorldHeight - overscrollY;
    const maxY = BASE_MAP.height - halfViewWorldHeight + overscrollY;

    this.camera.x = clamp(this.camera.x, Math.min(minX, maxX), Math.max(minX, maxX));
    this.camera.y = clamp(this.camera.y, Math.min(minY, maxY), Math.max(minY, maxY));
  }

  isTownEntity(entity) {
    return !!entity && entity.entityType !== "node";
  }

  inferLocalBiomeAtPoint(x, y) {
    const anchors = this.state.regions.filter((entity) => this.isTownEntity(entity));
    if (!anchors.length) {
      return {
        terrain: "plains",
        climate: "temperate",
        districtType: "Rural Cluster",
      };
    }
    let nearest = anchors[0];
    let nearestDistance = Infinity;
    for (const anchor of anchors) {
      const distance = Math.hypot(anchor.x - x, anchor.y - y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = anchor;
      }
    }
    return {
      terrain: nearest.terrain || "plains",
      climate: nearest.climate || "temperate",
      districtType: nearest.districtType || "Rural Cluster",
    };
  }

  createInfrastructureNode(worldX, worldY) {
    const nextIndex = Math.max(1, Number(this.state.nextNodeId || 1));
    const id = `node-${nextIndex}`;
    this.state.nextNodeId = nextIndex + 1;
    const localBiome = this.inferLocalBiomeAtPoint(worldX, worldY);
    return {
      id,
      name: `Grid Point ${nextIndex}`,
      entityType: "node",
      x: clamp(worldX, 0, BASE_MAP.width),
      y: clamp(worldY, 0, BASE_MAP.height),
      radius: INFRASTRUCTURE_NODE_RADIUS,
      districtType: localBiome.districtType,
      terrain: localBiome.terrain,
      climate: localBiome.climate,
      baseDemand: 0,
      population: 0,
      growthRate: 0,
      starterAssets: { plant: 0, substation: 0, storage: 0 },
      strategicValue: "Player-placed infrastructure anchor",
      priority: PRIORITY_DEFAULT,
      townCount: 0,
      townCap: 0,
      nominalBaseDemand: 0,
      stableServiceSeconds: 0,
      outageSeconds: 0,
      coveredBySubstation: false,
      coverageSourceId: null,
      coverageDistance: 0,
      assets: { plant: 0, substation: 0, storage: 0 },
      storageChargeMWh: 0,
      storageChargingMw: 0,
      assetBuildCosts: this.createEmptyAssetBuildCosts(),
      plantType: DEFAULT_PLANT_TYPE,
      resourceProfile: this.createEmptyResourceProfile(),
      demand: 0,
      targetDemand: 0,
      served: 0,
      unmet: 0,
      utilization: 1,
      demandEventMultiplier: 1,
      lineEventMultiplier: 1,
      selected: false,
      cooldownUntil: 0,
    };
  }

  getTownInteractionRadius(entity) {
    if (!entity) return 0;
    return MAP_OBJECT_INTERACTION_RADIUS_WORLD;
  }

  findRegionAt(worldX, worldY) {
    for (let i = this.state.regions.length - 1; i >= 0; i -= 1) {
      const region = this.state.regions[i];
      const dx = worldX - region.x;
      const dy = worldY - region.y;
      if (Math.hypot(dx, dy) <= this.getTownInteractionRadius(region)) {
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

  findLineBetween(aId, bId) {
    return (
      this.state.links.find(
        (link) => (link.a === aId && link.b === bId) || (link.a === bId && link.b === aId)
      ) || null
    );
  }

  calculateLineLength(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  pointToSegmentDistance(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= 0.0001) {
      return Math.hypot(px - ax, py - ay);
    }
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    return Math.hypot(px - cx, py - cy);
  }

  findBuiltLineAtScreen(screenX, screenY, maxDistancePx = 12) {
    let bestLine = null;
    let bestDistance = Infinity;
    for (const line of this.state.links) {
      if (!line?.built) continue;
      const a = this.findRegion(line.a);
      const b = this.findRegion(line.b);
      if (!a || !b) continue;
      const sa = this.worldToScreen(a.x, a.y);
      const sb = this.worldToScreen(b.x, b.y);
      const distance = this.pointToSegmentDistance(screenX, screenY, sa.x, sa.y, sb.x, sb.y);
      if (distance > maxDistancePx || distance >= bestDistance) continue;
      bestDistance = distance;
      bestLine = line;
    }
    return bestLine;
  }

  estimateLineCapacity(length) {
    return clamp(
      Math.round(LINE_MAX_CAPACITY - length * LINE_DISTANCE_CAPACITY_FACTOR),
      LINE_MIN_CAPACITY,
      LINE_MAX_CAPACITY
    );
  }

  estimateLineBuildCost(a, b) {
    const distance = this.calculateLineLength(a, b);
    const terrainFactor =
      ((TERRAIN_COST_MULTIPLIERS[a.terrain] || 1) + (TERRAIN_COST_MULTIPLIERS[b.terrain] || 1)) /
      2;
    const rawCost =
      distance *
      LINE_BASE_BUILD_COST_PER_WORLD_UNIT *
      terrainFactor *
      this.config.infraCostMultiplier *
      this.getModifierValue("build_cost", 1);
    const baseCost = Math.ceil(rawCost);
    const blueOrWhitePixelsCrossed = this.countBlueOrWhitePixelsAlongLine(a, b);
    const terrainSurcharge = blueOrWhitePixelsCrossed * LINE_WATER_OR_SNOW_PIXEL_SURCHARGE;
    return baseCost + terrainSurcharge;
  }

  getLineDemolishLabel(line) {
    const a = this.findRegion(line?.a);
    const b = this.findRegion(line?.b);
    if (!a || !b) return "Long-Range Powerline";
    return `Line ${a.name} -> ${b.name}`;
  }

  estimateLineDemolishRefund(line) {
    const lineValue = Math.max(0, Number(line?.lineBuildCost || 0));
    return Math.max(0, Math.floor(lineValue * DEMOLITION_LINE_REFUND_RATIO));
  }

  demolishBuiltLine(line) {
    if (!line || !line.built) return false;
    const startRegion = this.findRegion(line.a);
    const endRegion = this.findRegion(line.b);
    const startName = startRegion?.name || "Point A";
    const endName = endRegion?.name || "Point B";
    const refund = this.estimateLineDemolishRefund(line);
    if (refund > 0) {
      this.state.budget += refund;
    }
    line.built = false;
    line.used = 0;
    line.safeCapacity = 0;
    line.hardCapacity = 0;
    line.stress = 0;
    line.overload = false;
    this.state.score += 4;
    const refundSuffix = refund > 0 ? ` (+${refund} budget)` : "";
    this.logTimeline(`Demolished Line ${startName} -> ${endName}${refundSuffix}.`);
    this.pushAlert(`Line removed between ${startName} and ${endName}${refundSuffix}.`, "warning", 4);
    return true;
  }

  worldPointToMapPixel(point) {
    if (!point || !this.mapPixelWidth || !this.mapPixelHeight) return null;
    const x = clamp(
      Math.round((clamp(Number(point.x || 0), 0, BASE_MAP.width) / Math.max(1, BASE_MAP.width)) * (this.mapPixelWidth - 1)),
      0,
      this.mapPixelWidth - 1
    );
    const y = clamp(
      Math.round((clamp(Number(point.y || 0), 0, BASE_MAP.height) / Math.max(1, BASE_MAP.height)) * (this.mapPixelHeight - 1)),
      0,
      this.mapPixelHeight - 1
    );
    return { x, y };
  }

  getMapPixelColorAt(x, y) {
    if (!this.mapPixelData || !this.mapPixelWidth || !this.mapPixelHeight) return null;
    const px = clamp(Math.round(x), 0, this.mapPixelWidth - 1);
    const py = clamp(Math.round(y), 0, this.mapPixelHeight - 1);
    const index = (py * this.mapPixelWidth + px) * 4;
    const r = this.mapPixelData[index];
    const g = this.mapPixelData[index + 1];
    const b = this.mapPixelData[index + 2];
    const a = this.mapPixelData[index + 3];
    return { r, g, b, a };
  }

  isWaterMapPixelAt(x, y) {
    const color = this.getMapPixelColorAt(x, y);
    if (!color || color.a < 8) return false;
    return color.b >= 150 && color.b >= color.g + 20 && color.b >= color.r + 40;
  }

  isSnowMapPixelAt(x, y) {
    const color = this.getMapPixelColorAt(x, y);
    if (!color || color.a < 8) return false;
    return color.r >= 220 && color.g >= 220 && color.b >= 220;
  }

  isBlueOrWhiteMapPixelAt(x, y) {
    return this.isWaterMapPixelAt(x, y) || this.isSnowMapPixelAt(x, y);
  }

  isWaterWorldPoint(point) {
    const pixel = this.worldPointToMapPixel(point);
    if (!pixel) return false;
    return this.isWaterMapPixelAt(pixel.x, pixel.y);
  }

  countBlueOrWhitePixelsAlongLine(a, b) {
    const start = this.worldPointToMapPixel(a);
    const end = this.worldPointToMapPixel(b);
    if (!start || !end) return 0;

    let x0 = start.x;
    let y0 = start.y;
    const x1 = end.x;
    const y1 = end.y;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let crossed = 0;

    while (true) {
      if (this.isBlueOrWhiteMapPixelAt(x0, y0)) {
        crossed += 1;
      }
      if (x0 === x1 && y0 === y1) break;
      const err2 = err * 2;
      if (err2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (err2 < dx) {
        err += dx;
        y0 += sy;
      }
    }

    return crossed;
  }

  getConnectedBuiltLines(regionId) {
    return this.state.links.filter(
      (link) => link.built && (link.a === regionId || link.b === regionId)
    );
  }

  removeInfrastructureRegion(regionId) {
    if (!regionId) return false;
    const region = this.findRegion(regionId);
    if (!region || this.isTownEntity(region)) return false;

    this.state.regions = this.state.regions.filter((entry) => entry.id !== regionId);
    this.state.links = this.state.links.filter(
      (link) => link.a !== regionId && link.b !== regionId
    );
    if (this.selectedRegionId === regionId) {
      this.selectedRegionId = null;
    }
    if (this.lineBuildStartRegionId === regionId) {
      this.clearLineSelection();
    }
    return true;
  }

  pruneEmptyInfrastructureNodes() {
    const orphanIds = new Set(
      this.state.regions
        .filter(
          (region) => !this.isTownEntity(region) && this.getRegionTotalAssets(region) <= 0
        )
        .map((region) => region.id)
    );
    if (!orphanIds.size) return 0;

    this.state.regions = this.state.regions.filter((region) => !orphanIds.has(region.id));
    this.state.links = this.state.links.filter(
      (link) => !orphanIds.has(link.a) && !orphanIds.has(link.b)
    );
    if (this.selectedRegionId && orphanIds.has(this.selectedRegionId)) {
      this.selectedRegionId = null;
    }
    if (this.lineBuildStartRegionId && orphanIds.has(this.lineBuildStartRegionId)) {
      this.clearLineSelection();
    }
    if (Array.isArray(this.state.pendingDemolitions)) {
      this.state.pendingDemolitions = this.state.pendingDemolitions.filter(
        (item) => !orphanIds.has(item.regionId)
      );
    }
    return orphanIds.size;
  }

  getRegionTotalAssets(region) {
    if (!region?.assets) return 0;
    let total = 0;
    for (const assetType of ASSET_ORDER) {
      total += Math.max(0, Number(region.assets[assetType] || 0));
    }
    return total;
  }

  getInfrastructureNodeRadius(region) {
    return Math.max(1, Number(region?.radius || INFRASTRUCTURE_NODE_RADIUS));
  }

  getBuildPlacementRadius(region) {
    if (!region) return INFRASTRUCTURE_NODE_RADIUS;
    if (this.isTownEntity(region)) {
      return MAP_OBJECT_INTERACTION_RADIUS_WORLD;
    }
    return this.getInfrastructureNodeRadius(region);
  }

  getRerouteRadiusWorld() {
    return Math.max(
      1,
      Number(this.config.substationRadius || SUBSTATION_RADIUS_BY_PROFILE.standard || 100)
    );
  }

  isPriorityTargetRegion(region) {
    if (!region) return false;
    if (this.isTownEntity(region)) return true;
    return this.getRegionTotalAssets(region) > 0;
  }

  getRerouteTargetsInRange(centerX, centerY, radiusWorld = this.getRerouteRadiusWorld()) {
    const radius = Math.max(1, Number(radiusWorld || 0));
    return this.state.regions.filter((region) => {
      if (!this.isPriorityTargetRegion(region)) return false;
      return Math.hypot(region.x - centerX, region.y - centerY) <= radius;
    });
  }

  findInfrastructureBuildSpacingConflict(worldX, worldY, ignoreRegionId = null) {
    const newBuildRadius = INFRASTRUCTURE_NODE_RADIUS;
    for (const candidate of this.state.regions) {
      if (!candidate || candidate.id === ignoreRegionId) continue;
      const candidateOccupied =
        this.isTownEntity(candidate) || this.getRegionTotalAssets(candidate) > 0;
      if (!candidateOccupied) continue;
      const minSpacing =
        BUILDING_MIN_SPACING_MULTIPLIER *
        Math.max(newBuildRadius, this.getBuildPlacementRadius(candidate));
      const distance = Math.hypot(candidate.x - worldX, candidate.y - worldY);
      if (distance < minSpacing) {
        return { candidate, distance, minSpacing };
      }
    }
    return null;
  }

  willLoseLineEndpointAfterDemolition(region, assetType) {
    let remainingAssets = 0;
    for (const type of ASSET_ORDER) {
      const count = Math.max(0, Number(region?.assets?.[type] || 0));
      remainingAssets += type === assetType ? Math.max(0, count - 1) : count;
    }
    return remainingAssets <= 0;
  }

  estimateDemolishRefund(region, assetType, buildingValue = this.peekDemolishAssetValue(region, assetType)) {
    const buildingRefund = Math.max(
      0,
      Math.floor(Math.max(0, Number(buildingValue || 0)) * DEMOLITION_BUILDING_REFUND_RATIO)
    );
    if (!this.willLoseLineEndpointAfterDemolition(region, assetType)) {
      return buildingRefund;
    }
    const lineRefund = this.getConnectedBuiltLines(region.id).reduce((total, line) => {
      const lineValue = Math.max(0, Number(line.lineBuildCost || 0));
      return total + Math.floor(lineValue * DEMOLITION_LINE_REFUND_RATIO);
    }, 0);
    return buildingRefund + lineRefund;
  }

  demolishConnectedLinesForRegion(regionId) {
    const lines = this.getConnectedBuiltLines(regionId);
    if (!lines.length) {
      return { count: 0, refund: 0 };
    }
    let refund = 0;
    for (const line of lines) {
      const lineValue = Math.max(0, Number(line.lineBuildCost || 0));
      refund += Math.floor(lineValue * DEMOLITION_LINE_REFUND_RATIO);
      line.built = false;
      line.used = 0;
      line.safeCapacity = 0;
      line.hardCapacity = 0;
      line.stress = 0;
      line.overload = false;
    }
    return { count: lines.length, refund };
  }

  getMaxLineRange() {
    return LONG_RANGE_LINE_MAX_DISTANCE;
  }

  canEndpointHostLine(region) {
    if (!region) return false;
    if (this.isTownEntity(region)) return false;
    return this.getRegionTotalAssets(region) > 0;
  }

  clearLineSelection() {
    this.lineBuildStartRegionId = null;
    this.lineCostPreview = null;
  }

  handleLineTool(region) {
    if (!this.lineBuildStartRegionId) {
      if (!this.canEndpointHostLine(region)) {
        const text = this.isTownEntity(region)
          ? "Towns are demand points. Build a plant/substation/battery on an infrastructure point first."
          : "Line endpoint must have a plant, substation, or battery before connecting.";
        this.pushAlert(
          text,
          "advisory",
          4
        );
        return;
      }
      this.lineBuildStartRegionId = region.id;
      this.lineCostPreview = null;
      this.pushAlert(`Line start selected: ${region.name}. Choose endpoint point.`, "advisory", 5);
      return;
    }

    const startRegion = this.findRegion(this.lineBuildStartRegionId);
    if (!startRegion) {
      this.clearLineSelection();
      return;
    }
    if (startRegion.id === region.id) {
      this.clearLineSelection();
      this.pushAlert("Line endpoint cleared.", "advisory", 3);
      return;
    }
    if (!this.canEndpointHostLine(startRegion) || !this.canEndpointHostLine(region)) {
      const text = this.isTownEntity(region) || this.isTownEntity(startRegion)
        ? "Line endpoints must be infrastructure points with a plant, substation, or battery."
        : "Line endpoints require plant/substation/battery infrastructure at both points.";
      this.pushAlert(
        text,
        "warning",
        5
      );
      return;
    }

    const existing = this.findLineBetween(startRegion.id, region.id);
    const lineLength = this.calculateLineLength(startRegion, region);
    const buildCost = this.estimateLineBuildCost(startRegion, region);
    this.lineCostPreview = {
      from: startRegion.id,
      to: region.id,
      cost: buildCost,
      capacity: this.estimateLineCapacity(lineLength),
    };

    if (existing && existing.built) {
      existing.built = false;
      const refund = Math.max(12, Math.floor((existing.lineBuildCost || buildCost) * 0.42));
      this.state.budget += refund;
      this.state.score += 4;
      this.logTimeline(`Removed Line ${startRegion.name} -> ${region.name} (+${refund} budget).`);
      this.pushAlert(
        `Line removed between ${startRegion.name} and ${region.name}.`,
        "warning",
        4
      );
      this.clearLineSelection();
      return;
    }

    const maxRange = this.getMaxLineRange();
    if (lineLength > maxRange) {
      this.pushAlert(
        `Endpoint out of range. Maximum ${Math.round(maxRange)} (current ${Math.round(lineLength)}).`,
        "warning",
        5
      );
      return;
    }

    if (!this.isDevModeEnabled() && this.state.budget < buildCost) {
      this.pushAlert(`Insufficient budget for Line (${buildCost}).`, "warning", 5);
      return;
    }

    let line = existing;
    if (!line) {
      const length = lineLength;
      line = {
        id: `line-${this.state.nextLineId++}`,
        a: startRegion.id,
        b: region.id,
        flowFrom: startRegion.id,
        flowTo: region.id,
        baseCapacity: this.estimateLineCapacity(length),
        built: true,
        length,
        lineBuildCost: buildCost,
        used: 0,
        safeCapacity: 0,
        hardCapacity: 0,
        stress: 0,
        overload: false,
      };
      this.state.links.push(line);
    } else {
      line.built = true;
      line.flowFrom = startRegion.id;
      line.flowTo = region.id;
      line.lineBuildCost = buildCost;
      if (!Number.isFinite(line.length) || line.length <= 0) {
        line.length = this.calculateLineLength(startRegion, region);
      }
      if (!Number.isFinite(line.baseCapacity) || line.baseCapacity <= 0) {
        line.baseCapacity = this.estimateLineCapacity(line.length);
      }
    }

    if (!this.isDevModeEnabled()) {
      this.state.budget -= buildCost;
    }
    this.state.score += 10;
    this.logTimeline(
      `Built Line ${startRegion.name} -> ${region.name} (${buildCost} budget, cap ${line.baseCapacity}).`
    );
    this.pushAlert(`Line commissioned: ${startRegion.name} to ${region.name}.`, "advisory", 5);
    this.recordTutorialAction("line_built");
    this.clearLineSelection();
  }

  handleBuild(region, worldPoint) {
    const rule = ASSET_RULES[this.buildAssetType];
    if (!rule) return;
    let target = region || null;
    let shouldInsertTarget = false;
    const clickedOpenPoint = !target;

    if (target && this.isTownEntity(target)) {
      this.pushAlert(
        "Towns are demand points. Build infrastructure on open map points.",
        "advisory",
        4
      );
      return null;
    }

    if (!target) {
      if (!worldPoint) return null;
      if (
        worldPoint.x < 0 ||
        worldPoint.x > BASE_MAP.width ||
        worldPoint.y < 0 ||
        worldPoint.y > BASE_MAP.height
      ) {
        this.pushAlert("Cannot build outside map bounds.", "warning", 4);
        return null;
      }

      const nearbyNode = this.state.regions.find(
        (candidate) =>
          !this.isTownEntity(candidate) &&
          Math.hypot(candidate.x - worldPoint.x, candidate.y - worldPoint.y) <=
            this.getTownInteractionRadius(candidate)
      );

      target = nearbyNode || this.createInfrastructureNode(worldPoint.x, worldPoint.y);
      shouldInsertTarget = !nearbyNode;
    }

    if (this.getRegionTotalAssets(target) > 0) {
      this.pushAlert(
        `${target.name} already hosts infrastructure. Buildings must be placed on separate points.`,
        "warning",
        5
      );
      return null;
    }

    const spacingConflict = this.findInfrastructureBuildSpacingConflict(
      target.x,
      target.y,
      target.id
    );
    if (spacingConflict) {
      this.pushAlert(
        `Build location too close to ${spacingConflict.candidate.name}. Minimum spacing is ${BUILDING_MIN_SPACING_MULTIPLIER}x radius.`,
        "warning",
        5
      );
      return null;
    }

    if (this.state.runtimeSeconds < target.cooldownUntil) {
      this.pushAlert(
        `${target.name} location cooling down after demolition.`,
        "advisory",
        4
      );
      return null;
    }

    const terrainFactor = TERRAIN_COST_MULTIPLIERS[target.terrain] || 1;
    const globalCostFactor = this.getModifierValue("build_cost", 1);
    const rawCost = rule.cost * terrainFactor * this.config.infraCostMultiplier * globalCostFactor;
    const cost = Math.ceil(rawCost);

    if (!this.isDevModeEnabled() && this.state.budget < cost) {
      this.pushAlert("Insufficient budget for selected build.", "warning", 5);
      return null;
    }

    if (shouldInsertTarget) {
      this.state.regions.push(target);
      if (this.resourceZones.length) {
        this.applyResourceCoverageToRegions();
      }
    }

    target.assets[this.buildAssetType] += 1;
    if (this.buildAssetType === "storage") {
      // New batteries always start empty; keep existing stored charge unchanged.
      this.normalizeRegionStorageCharge(target);
    }
    const assetBuildCosts = this.ensureRegionAssetBuildCosts(target);
    assetBuildCosts[this.buildAssetType].push(cost);
    if (this.buildAssetType === "plant") {
      target.plantType = this.normalizePlantType(this.buildPlantType);
    }
    if (!this.isDevModeEnabled()) {
      this.state.budget -= cost;
    }
    this.state.score += 5;
    this.logTimeline(`Built ${rule.label} at ${target.name} (${cost} budget).`);
    this.pushAlert(`${rule.label} commissioned at ${target.name}.`, "advisory", 4);
    this.recordTutorialAction("build", {
      assetType: this.buildAssetType,
      onOpenPoint: clickedOpenPoint,
    });
    return target;
  }

  handleDemolish(region, preferredAssetType = this.buildAssetType) {
    const candidate = this.getDemolishCandidate(region, preferredAssetType);
    if (!candidate) {
      this.pushAlert(`No removable assets available at ${region.name}.`, "advisory", 4);
      return false;
    }

    const { assetType } = candidate;
    const assetLabel = this.getDemolishAssetLabel(region, assetType);
    const existingPending = this.findPendingDemolition(region.id, assetType);
    if (existingPending) {
      this.pushAlert(
        `${assetLabel} demolition already in progress at ${region.name}.`,
        "advisory",
        4
      );
      return false;
    }
    const startedAt = this.state.runtimeSeconds;
    const completesAt = startedAt + DEMOLITION_DURATION_SECONDS;
    this.state.pendingDemolitions.push({
      id: `pending-demo-${Math.round(performance.now() * Math.random())}`,
      regionId: region.id,
      regionName: region.name,
      assetType,
      assetLabel,
      refund: candidate.refund,
      buildingValue: candidate.buildingValue,
      startedAt,
      completesAt,
    });
    region.cooldownUntil = Math.max(Number(region.cooldownUntil || 0), completesAt);
    this.logTimeline(
      `Demolition started for ${assetLabel} in ${region.name} (${DEMOLITION_DURATION_SECONDS}s).`
    );
    this.pushAlert(
      `${assetLabel} demolition started in ${region.name} (${DEMOLITION_DURATION_SECONDS}s).`,
      "warning",
      4
    );
    this.recordTutorialAction("demolish");
    return true;
  }

  getDemolishCandidate(region, preferredAssetType = this.buildAssetType) {
    if (!region || !region.assets) return null;
    const preferred = ASSET_RULES[preferredAssetType] ? preferredAssetType : null;
    const order = preferred
      ? [preferred, ...ASSET_ORDER.filter((assetType) => assetType !== preferred)]
      : [...ASSET_ORDER];
    for (const assetType of order) {
      const count = Number(region.assets[assetType] || 0);
      const rule = ASSET_RULES[assetType];
      if (rule && count > 0) {
        const buildingValue = this.peekDemolishAssetValue(region, assetType);
        return {
          assetType,
          refund: this.estimateDemolishRefund(region, assetType, buildingValue),
          buildingValue,
        };
      }
    }
    return null;
  }

  confirmDemolish(regionId, assetType = null) {
    const region = this.findRegion(regionId);
    if (!region) return false;
    this.selectedRegionId = region.id;
    const demolished = this.handleDemolish(region, assetType || this.buildAssetType);
    this.pushHudUpdate();
    return demolished;
  }

  confirmDemolishLine(lineId) {
    const line = this.findLink(lineId);
    if (!line || !line.built) return false;
    const demolished = this.demolishBuiltLine(line);
    this.pushHudUpdate();
    return demolished;
  }

  findPendingDemolition(regionId, assetType = null) {
    const pending = this.state.pendingDemolitions || [];
    return (
      pending.find(
        (item) =>
          item.regionId === regionId &&
          (assetType == null || item.assetType === assetType)
      ) || null
    );
  }

  recomputeRegionDemolitionCooldown(regionId) {
    const region = this.findRegion(regionId);
    if (!region) return;
    const pending = this.state.pendingDemolitions || [];
    const nextCooldown = pending
      .filter((item) => item.regionId === regionId)
      .reduce((max, item) => Math.max(max, Number(item.completesAt || 0)), 0);
    region.cooldownUntil = Math.max(this.state.runtimeSeconds, nextCooldown);
  }

  cancelPendingDemolition(regionId, assetType = null) {
    const pending = this.state.pendingDemolitions || [];
    const index = pending.findIndex(
      (item) =>
        item.regionId === regionId &&
        (assetType == null || item.assetType === assetType)
    );
    if (index < 0) return false;

    const [removed] = pending.splice(index, 1);
    this.state.pendingDemolitions = pending;
    this.recomputeRegionDemolitionCooldown(regionId);

    const assetLabel = removed?.assetLabel || ASSET_RULES[removed?.assetType]?.label || "Asset";
    const regionName =
      removed?.regionName || this.findRegion(regionId)?.name || "selected location";
    this.logTimeline(`Demolition canceled for ${assetLabel} in ${regionName}.`);
    this.pushAlert(`${assetLabel} demolition canceled in ${regionName}.`, "advisory", 4);
    return true;
  }

  updatePendingDemolitions() {
    const pending = this.state.pendingDemolitions || [];
    if (!pending.length) return;

    const now = this.state.runtimeSeconds;
    const remaining = [];
    for (const item of pending) {
      if (item.completesAt > now) {
        remaining.push(item);
        continue;
      }
      const region = this.findRegion(item.regionId);
      if (!region || !region.assets) {
        continue;
      }
      const count = Number(region.assets[item.assetType] || 0);
      if (count > 0) {
        region.assets[item.assetType] = Math.max(0, count - 1);
        const assetBuildCosts = this.ensureRegionAssetBuildCosts(region);
        const buildHistory = assetBuildCosts[item.assetType];
        let buildingValue = Math.max(0, Number(item.buildingValue || 0));
        if (buildHistory.length) {
          const removedValue = Math.max(0, Number(buildHistory.pop() || 0));
          if (buildingValue <= 0) {
            buildingValue = removedValue;
          }
        }
        if (buildingValue <= 0) {
          buildingValue = this.estimateAssetBuildCost(region, item.assetType);
        }
        const buildingRefund = Math.max(
          0,
          Math.floor(buildingValue * DEMOLITION_BUILDING_REFUND_RATIO)
        );
        let lineRefund = 0;
        let lineCount = 0;
        if (!this.canEndpointHostLine(region)) {
          const lineDemolition = this.demolishConnectedLinesForRegion(region.id);
          lineRefund = lineDemolition.refund;
          lineCount = lineDemolition.count;
        }
        const totalRefund = buildingRefund + lineRefund;
        if (totalRefund > 0) {
          this.state.budget += totalRefund;
        }
        if (item.assetType === "storage") {
          this.normalizeRegionStorageCharge(region);
        }
        if (item.assetType === "plant" && region.assets.plant <= 0) {
          region.plantType = DEFAULT_PLANT_TYPE;
        }
        const regionCleared =
          !this.isTownEntity(region) && this.getRegionTotalAssets(region) <= 0
            ? this.removeInfrastructureRegion(region.id)
            : false;
        const refundSuffix = totalRefund > 0 ? ` (+${totalRefund} budget)` : "";
        const clearedSuffix = regionCleared ? " Location cleared." : "";
        if (lineCount > 0) {
          this.logTimeline(
            `Demolished ${item.assetLabel} in ${region.name}; decommissioned ${lineCount} connected line${lineCount === 1 ? "" : "s"}${refundSuffix}.${clearedSuffix}`
          );
          this.pushAlert(
            `${item.assetLabel} demolished in ${region.name}. ${lineCount} connected line${lineCount === 1 ? "" : "s"} removed${refundSuffix}.${clearedSuffix}`,
            "warning",
            4
          );
        } else {
          this.logTimeline(
            `Demolished ${item.assetLabel} in ${region.name}${refundSuffix}.${clearedSuffix}`
          );
          this.pushAlert(
            `${item.assetLabel} demolished in ${region.name}${refundSuffix}.${clearedSuffix}`,
            "warning",
            4
          );
        }
      }
    }
    this.state.pendingDemolitions = remaining.filter((item) => !!this.findRegion(item.regionId));
  }

  clearAllPriorityModifiers() {
    let cleared = 0;
    for (const region of this.state.regions) {
      const previous = this.normalizePriority(region.priority);
      if (previous !== PRIORITY_DEFAULT) {
        cleared += 1;
      }
      region.priority = PRIORITY_DEFAULT;
    }
    if (cleared > 0) {
      this.logTimeline(`Cleared elevated priority from ${cleared} location${cleared === 1 ? "" : "s"}.`);
      this.pushAlert(`Priority reset: ${cleared} location${cleared === 1 ? "" : "s"} returned to nominal.`, "advisory", 4);
    } else {
      this.pushAlert("Priority reset: all locations already nominal.", "advisory", 3);
    }
    this.pushHudUpdate();
  }

  handleReroute(worldPoint, sourceRegion = null) {
    if (!worldPoint && !sourceRegion) return;
    const centerX = worldPoint ? worldPoint.x : sourceRegion.x;
    const centerY = worldPoint ? worldPoint.y : sourceRegion.y;
    const radiusWorld = this.getRerouteRadiusWorld();
    const targets = this.getRerouteTargetsInRange(centerX, centerY, radiusWorld);
    if (!targets.length) {
      this.pushAlert("No cities or infrastructure in reroute radius.", "advisory", 4);
      return;
    }

    let elevatedCount = 0;
    let townCount = 0;
    let infrastructureCount = 0;
    for (const target of targets) {
      if (this.isTownEntity(target)) {
        townCount += 1;
      } else {
        infrastructureCount += 1;
      }
      const previous = this.normalizePriority(target.priority);
      target.priority = PRIORITY_ELEVATED;
      if (previous !== PRIORITY_ELEVATED) {
        elevatedCount += 1;
      }
    }

    const radiusText = Math.round(radiusWorld);
    if (elevatedCount > 0) {
      this.logTimeline(
        `Reroute elevated priority for ${elevatedCount}/${targets.length} location${targets.length === 1 ? "" : "s"} (${townCount} city, ${infrastructureCount} infrastructure) within ${radiusText} radius.`
      );
      this.pushAlert(
        `Priority elevated for ${elevatedCount}/${targets.length} location${targets.length === 1 ? "" : "s"} in reroute radius.`,
        "advisory",
        4
      );
    } else {
      this.pushAlert(
        `All ${targets.length} location${targets.length === 1 ? "" : "s"} in reroute radius are already elevated.`,
        "advisory",
        4
      );
    }
    this.recordTutorialAction("reroute", { isTown: this.isTownEntity(sourceRegion) });
  }

  handlePrimaryClick() {
    this.callbacks.onDismissDemolishConfirm?.();
    const worldPoint = this.screenToWorld(this.mouse.x, this.mouse.y);
    const region = this.findRegionAt(worldPoint.x, worldPoint.y);

    if (this.tool === TOOL_PAN) {
      this.selectedRegionId = region ? region.id : null;
      this.pushHudUpdate();
      return;
    }

    if (this.tool === TOOL_BUILD) {
      const target = this.handleBuild(region, worldPoint);
      this.selectedRegionId = target ? target.id : region ? region.id : null;
      if (target) {
        this.tool = TOOL_PAN;
      }
      this.pushHudUpdate();
      return;
    }

    if (this.tool === TOOL_REROUTE) {
      this.selectedRegionId = region ? region.id : null;
      this.handleReroute(worldPoint, region);
      this.tool = TOOL_PAN;
      this.pushHudUpdate();
      return;
    }

    if (!region) {
      this.selectedRegionId = null;
      this.pushHudUpdate();
      return;
    }

    this.selectedRegionId = region.id;
    if (this.tool === TOOL_DEMOLISH) {
      this.handleDemolish(region);
    } else if (this.tool === TOOL_LINE) {
      this.handleLineTool(region);
    }
    this.pushHudUpdate();
  }

  handleSecondaryClick() {
    this.callbacks.onDismissDemolishConfirm?.();
    const worldPoint = this.screenToWorld(this.mouse.x, this.mouse.y);
    const region = this.findRegionAt(worldPoint.x, worldPoint.y);
    if (!region) {
      const line = this.findBuiltLineAtScreen(this.mouse.x, this.mouse.y);
      if (line) {
        this.selectedRegionId = null;
        this.callbacks.onRequestDemolishConfirm?.({
          lineId: line.id,
          assetLabel: this.getLineDemolishLabel(line),
          refund: this.estimateLineDemolishRefund(line),
          confirmDetail: "Line removal is immediate after confirmation.",
          x: this.mouse.x,
          y: this.mouse.y,
        });
        this.pushHudUpdate();
        return;
      }
      this.selectedRegionId = null;
      this.pushHudUpdate();
      return;
    }

    this.selectedRegionId = region.id;
    const pendingForPreferredAsset =
      ASSET_RULES[this.buildAssetType] ? this.findPendingDemolition(region.id, this.buildAssetType) : null;
    const pendingDemolition = pendingForPreferredAsset || this.findPendingDemolition(region.id);
    if (pendingDemolition) {
      this.cancelPendingDemolition(region.id, pendingDemolition.assetType);
      this.pushHudUpdate();
      return;
    }

    const demolishCandidate = this.getDemolishCandidate(region, this.buildAssetType);
    if (!demolishCandidate) {
      this.pushAlert(`No removable assets available at ${region.name}.`, "advisory", 4);
      this.pushHudUpdate();
      return;
    }

    this.callbacks.onRequestDemolishConfirm?.({
      regionId: region.id,
      regionName: region.name,
      assetType: demolishCandidate.assetType,
      assetLabel: this.getDemolishAssetLabel(region, demolishCandidate.assetType),
      refund: demolishCandidate.refund,
      x: this.mouse.x,
      y: this.mouse.y,
    });
    this.pushHudUpdate();
  }

  handleKeyboardPan(dt) {
    const panX = (this.keyPan.right ? 1 : 0) - (this.keyPan.left ? 1 : 0);
    const panY = (this.keyPan.down ? 1 : 0) - (this.keyPan.up ? 1 : 0);
    if (!panX && !panY) return;

    this.zoomFocus = null;
    const speed = 520;
    const zoom = this.getCameraZoom();
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
    this.zoomFocus = null;
    const zoom = this.getCameraZoom();
    this.camera.x += (panX * speed * dt) / zoom;
    this.camera.y += (panY * speed * dt) / zoom;
    this.clampCameraToMap();
  }

  stepSimulation(dt) {
    this.state.runtimeSeconds += dt;

    this.updatePendingDemolitions();
    this.updateSeason(dt);
    this.expireIncidents();
    this.spawnEventsIfNeeded();
    this.updateDemand(dt);
    this.updateTownCoverage();
    this.resolveGrid(dt);
    this.evaluateTutorialPassiveProgress();
    this.updateTownServiceStability(dt);
    this.updateTownEmergence();
    this.updateEconomyAndReliability(dt);
    this.updateScoring(dt);
    this.applyDevModeState();
    this.evaluateObjectiveAndEndConditions(dt);

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
    if (this.config.mode === "tutorial") {
      return;
    }
    if (this.state.runtimeSeconds < this.state.nextEventAt) {
      return;
    }

    const intervalBase = randomRange(24, 40);
    this.state.nextEventAt = this.state.runtimeSeconds + intervalBase / this.config.eventIntensity;

    const activeTowns = this.state.regions.filter((entity) => this.isTownEntity(entity));
    if (!activeTowns.length) {
      return;
    }

    const coastRegions = activeTowns.filter((region) => region.terrain === "coast");
    const coldRegions = activeTowns.filter((region) => region.climate === "cold");
    const warmRegions = activeTowns.filter((region) => region.climate === "warm");

    const events = [];

    if (warmRegions.length) {
      const target = pickRandom(warmRegions);
      events.push({
        title: `Heat wave in ${target.name}`,
        body: "Cooling demand surges across warm climate zones.",
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
        body: "Heating pressure increases cold-climate town load.",
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
        body: "Manual line resilience is reduced around coastal routes.",
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
        region.climate === "warm"
          ? 1 + Math.sin(this.state.runtimeSeconds * 0.19 + region.x * 0.008) * 0.08
          : region.terrain === "river"
            ? 1 + Math.sin(this.state.runtimeSeconds * 0.14 + region.y * 0.008) * 0.05
            : 1 + Math.sin(this.state.runtimeSeconds * 0.24 + region.x * 0.006) * 0.07;

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

  computeGenerationForEntity(entity) {
    if (this.isTownEntity(entity)) return 0;
    const resource = entity.resourceProfile || this.createEmptyResourceProfile();
    const plantBoostMultiplier = clamp(
      1 + resource.wind * 0.16 + resource.sun * 0.14 + resource.natural_gas * 0.2,
      1,
      1.5
    );
    return entity.assets.plant * ASSET_RULES.plant.generation * plantBoostMultiplier;
  }

  calculateStoredPowerMWh() {
    return this.state.regions.reduce((total, region) => {
      const charge = this.normalizeRegionStorageCharge(region);
      return total + charge;
    }, 0);
  }

  buildTownComponents() {
    const adjacency = new Map();
    for (const town of this.state.regions) {
      adjacency.set(town.id, []);
    }

    for (const link of this.state.links) {
      if (!link.built || link.safeCapacity <= 0) continue;
      if (!adjacency.has(link.a) || !adjacency.has(link.b)) continue;
      adjacency.get(link.a).push(link.b);
      adjacency.get(link.b).push(link.a);
    }

    const componentByTown = new Map();
    let nextComponentId = 1;

    for (const town of this.state.regions) {
      if (componentByTown.has(town.id)) continue;
      const componentId = `component-${nextComponentId++}`;
      const queue = [town.id];
      componentByTown.set(town.id, componentId);
      while (queue.length) {
        const currentId = queue.shift();
        const neighbors = adjacency.get(currentId) || [];
        for (const neighborId of neighbors) {
          if (componentByTown.has(neighborId)) continue;
          componentByTown.set(neighborId, componentId);
          queue.push(neighborId);
        }
      }
    }

    return componentByTown;
  }

  getPoweredSubstationIds() {
    const powered = new Set();
    const componentByTown = this.buildTownComponents();
    const generationByComponent = new Map();

    for (const town of this.state.regions) {
      const componentId = componentByTown.get(town.id) || town.id;
      const generation = this.computeGenerationForEntity(town);
      generationByComponent.set(
        componentId,
        (generationByComponent.get(componentId) || 0) + generation
      );
    }

    for (const town of this.state.regions) {
      if (this.isTownEntity(town)) continue;
      if ((town.assets.substation || 0) <= 0) continue;
      const componentId = componentByTown.get(town.id) || town.id;
      if ((generationByComponent.get(componentId) || 0) > 0.0001) {
        powered.add(town.id);
      }
    }

    return powered;
  }

  getCoverageForPoint(x, y, poweredSubstations = this.getPoweredSubstationIds()) {
    const radius = this.config.substationRadius || SUBSTATION_RADIUS_BY_PROFILE.standard;
    let bestDistance = Infinity;
    let bestSourceId = null;

    for (const sourceId of poweredSubstations) {
      const source = this.findRegion(sourceId);
      if (!source) continue;
      const distance = Math.hypot(source.x - x, source.y - y);
      if (distance > radius) continue;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestSourceId = sourceId;
      }
    }

    if (!bestSourceId) return null;
    return {
      sourceId: bestSourceId,
      distance: bestDistance,
    };
  }

  updateTownCoverage() {
    const poweredSubstations = this.getPoweredSubstationIds();

    for (const entity of this.state.regions) {
      entity.coveredBySubstation = false;
      entity.coverageSourceId = null;
      entity.coverageDistance = 0;
      if (!this.isTownEntity(entity)) {
        continue;
      }

      const coverage = this.getCoverageForPoint(entity.x, entity.y, poweredSubstations);
      if (coverage) {
        entity.coveredBySubstation = true;
        entity.coverageSourceId = coverage.sourceId;
        entity.coverageDistance = coverage.distance;
      }
    }
  }

  isRegionLivableForTown(region) {
    return LIVABLE_TERRAINS.has(region.terrain);
  }

  getTownFertilityWeight(terrain) {
    if (terrain === "plains") return 1.35;
    if (terrain === "river") return 1.28;
    if (terrain === "coast") return 1.04;
    return 0.85;
  }

  hasStableNeighborService(region) {
    if (region.id === "capital") {
      return this.state.reliability >= 58 || (region.coveredBySubstation && region.utilization >= 0.74);
    }

    if (region.coveredBySubstation && region.utilization >= 0.7) {
      return true;
    }

    for (const link of this.state.links) {
      if (link.a !== region.id && link.b !== region.id) continue;
      if (!link.built) continue;
      if (link.safeCapacity <= 0 || link.overload) continue;

      const neighborId = link.a === region.id ? link.b : link.a;
      const neighbor = this.findRegion(neighborId);
      if (!neighbor) continue;
      if (!this.isTownEntity(neighbor)) {
        if ((neighbor.assets.plant || 0) > 0 || (neighbor.assets.substation || 0) > 0) {
          return true;
        }
        continue;
      }

      const neighborStable =
        neighbor.utilization >= 0.8 &&
        neighbor.coveredBySubstation &&
        (neighbor.outageSeconds || 0) < 5;
      if (neighborStable) {
        return true;
      }
    }
    return false;
  }

  updateTownServiceStability(dt) {
    for (const region of this.state.regions) {
      if (!this.isTownEntity(region)) continue;
      const hasDemand = region.demand > 1;
      const localStable = !hasDemand || (region.coveredBySubstation && region.utilization >= 0.84);
      const stableNeighbor = this.hasStableNeighborService(region);
      const stable = localStable && stableNeighbor && this.state.reliability >= 52;

      if (stable) {
        region.stableServiceSeconds = clamp(region.stableServiceSeconds + dt, 0, 360);
      } else {
        region.stableServiceSeconds = Math.max(0, region.stableServiceSeconds - dt * 1.2);
      }

      if (hasDemand && region.utilization < 0.5) {
        region.outageSeconds = clamp(region.outageSeconds + dt, 0, 360);
      } else {
        region.outageSeconds = Math.max(0, region.outageSeconds - dt * 0.8);
      }
    }
  }

  getTownEmergenceProfile() {
    if (this.config.townEmergenceMode === "off") return null;
    if (this.config.townEmergenceMode === "high") {
      return {
        minStableSeconds: 12,
        intervalMin: 34,
        intervalMax: 58,
        maxEmergences: 14,
        reliabilityFloor: 52,
        minDemandMetRatio: 0.62,
      };
    }
    if (this.config.townEmergenceMode === "low") {
      if (this.config.mode === "tutorial") {
        return {
          minStableSeconds: 34,
          intervalMin: 130,
          intervalMax: 190,
          maxEmergences: 6,
          reliabilityFloor: 58,
          minDemandMetRatio: 0.9,
        };
      }
      return {
        minStableSeconds: 28,
        intervalMin: 85,
        intervalMax: 125,
        maxEmergences: 4,
        reliabilityFloor: 64,
        minDemandMetRatio: 0.82,
      };
    }
    return {
      minStableSeconds: 16,
      intervalMin: 48,
      intervalMax: 82,
      maxEmergences: 10,
      reliabilityFloor: 56,
      minDemandMetRatio: 0.74,
    };
  }

  getUnspawnedTownAnchors() {
    const existingTownIds = new Set(this.state.regions.map((town) => town.id));
    const mapTowns = BASE_MAP.towns;
    return mapTowns.filter((anchor) => !existingTownIds.has(anchor.id));
  }

  getNearestTown(x, y) {
    let best = null;
    let bestDistance = Infinity;
    for (const town of this.state.regions) {
      if (!this.isTownEntity(town)) continue;
      const distance = Math.hypot(town.x - x, town.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = town;
      }
    }
    return best;
  }

  pickEmergentTownName(indexValue = this.state.nextTownId) {
    const index = Math.max(0, Number(indexValue || 1) - 1);
    const base = EMERGENCE_TOWN_NAMES[index % EMERGENCE_TOWN_NAMES.length];
    const suffix = Math.floor(index / EMERGENCE_TOWN_NAMES.length);
    return suffix > 0 ? `${base} ${suffix + 1}` : base;
  }

  pickEmergenceSponsor(sponsoringTowns) {
    if (!sponsoringTowns.length) return null;
    if (sponsoringTowns.length === 1) return sponsoringTowns[0];

    const weighted = sponsoringTowns.map((town) => {
      const fertilityWeight = this.getTownFertilityWeight(town.terrain);
      const serviceWeight = clamp((town.utilization || 0) * 0.8 + 0.35, 0.35, 1.15);
      return {
        town,
        weight: fertilityWeight * serviceWeight,
      };
    });

    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0.0001) return pickRandom(sponsoringTowns);

    let roll = Math.random() * totalWeight;
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll <= 0) {
        return entry.town;
      }
    }
    return weighted[weighted.length - 1].town;
  }

  generateEmergentTownAnchor(sponsoringTowns) {
    if (!sponsoringTowns.length) return null;

    const mapPadding = 110;
    const minTownSpacing = 170;
    for (let attempt = 0; attempt < 36; attempt += 1) {
      const sponsor = this.pickEmergenceSponsor(sponsoringTowns);
      if (!sponsor) break;
      const angle = Math.random() * Math.PI * 2;
      const distance = randomRange(180, 420);
      const x = clamp(
        sponsor.x + Math.cos(angle) * distance,
        mapPadding,
        BASE_MAP.width - mapPadding
      );
      const y = clamp(
        sponsor.y + Math.sin(angle) * distance,
        mapPadding,
        BASE_MAP.height - mapPadding
      );
      const tooClose = this.state.regions.some(
        (town) => Math.hypot(town.x - x, town.y - y) < minTownSpacing
      );
      if (tooClose) continue;
      if (this.isWaterWorldPoint({ x, y })) continue;

      const nearest = this.getNearestTown(x, y) || sponsor;
      const archetypeSource = nearest || sponsor;
      return {
        id: null,
        name: this.pickEmergentTownName(this.state.nextTownId),
        x,
        y,
        radius: randomRange(54, 66),
        districtType: archetypeSource.districtType || "Rural Cluster",
        terrain: archetypeSource.terrain || "plains",
        climate: archetypeSource.climate || "temperate",
        baseDemand: clamp((archetypeSource.baseDemand || 52) * randomRange(0.72, 1.08), 26, 118),
        population: clamp((archetypeSource.population || 34) * randomRange(0.6, 0.9), 14, 82),
        growthRate: clamp((archetypeSource.growthRate || 0.45) * randomRange(0.85, 1.2), 0.25, 1.25),
        starterAssets: { plant: 0, substation: 0, storage: 0 },
        strategicValue: `${pickTownArchetype(archetypeSource.districtType)} growth settlement`,
      };
    }

    return null;
  }

  createEmergentTownFromAnchor(anchor) {
    if (this.isWaterWorldPoint(anchor)) return null;
    const pendingTownIndex = Number(this.state.nextTownId || 1);
    const resolvedId = anchor.id || `town-${pendingTownIndex}`;
    const resolvedName = anchor.name || this.pickEmergentTownName(pendingTownIndex);
    if (!anchor.id) {
      this.state.nextTownId = pendingTownIndex + 1;
    }
    const initialDemand = clamp(anchor.baseDemand * randomRange(0.26, 0.42), 8, anchor.baseDemand);
    const population = Math.max(8, Number(anchor.population || 24) * randomRange(0.32, 0.48));
    return {
      ...deepClone(anchor),
      id: resolvedId,
      name: resolvedName,
      radius: Number(anchor.radius || randomRange(54, 66)),
      priority: PRIORITY_DEFAULT,
      townCount: 1,
      townCap: 1,
      nominalBaseDemand: Number(anchor.baseDemand || initialDemand),
      population,
      growthRate: Number(anchor.growthRate || 0.42),
      stableServiceSeconds: 0,
      outageSeconds: 0,
      coveredBySubstation: false,
      coverageSourceId: null,
      coverageDistance: 0,
      assets: { plant: 0, substation: 0, storage: 0 },
      storageChargeMWh: 0,
      storageChargingMw: 0,
      assetBuildCosts: this.createEmptyAssetBuildCosts(),
      plantType: DEFAULT_PLANT_TYPE,
      resourceProfile: this.createEmptyResourceProfile(),
      demand: initialDemand,
      targetDemand: initialDemand,
      served: 0,
      unmet: initialDemand,
      utilization: 0,
      demandEventMultiplier: 1,
      lineEventMultiplier: 1,
      selected: false,
      cooldownUntil: 0,
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
    const poweredSubstations = this.getPoweredSubstationIds();
    if (!poweredSubstations.size) return;
    const totalDemand = this.state.regions.reduce(
      (sum, region) => sum + (this.isTownEntity(region) ? Math.max(0, Number(region.demand || 0)) : 0),
      0
    );
    const totalServed = this.state.regions.reduce(
      (sum, region) => sum + (this.isTownEntity(region) ? Math.max(0, Number(region.served || 0)) : 0),
      0
    );
    const demandMetRatio = totalDemand <= 0.01 ? 1 : totalServed / totalDemand;
    if (demandMetRatio < Number(profile.minDemandMetRatio || 0)) return;

    const sponsoringTowns = this.state.regions.filter((town) => {
      if (!this.isTownEntity(town)) return false;
      if (!this.isRegionLivableForTown(town)) return false;
      if ((town.stableServiceSeconds || 0) < profile.minStableSeconds) return false;
      if ((town.outageSeconds || 0) >= 6) return false;
      if (!town.coveredBySubstation) return false;
      return town.utilization >= 0.72 && this.hasStableNeighborService(town);
    });
    if (!sponsoringTowns.length) return;

    const anchorCandidates = this.getUnspawnedTownAnchors()
      .filter((anchor) => this.isRegionLivableForTown(anchor))
      .filter((anchor) => !this.isWaterWorldPoint(anchor))
      .map((anchor) => {
        const nearestStableTownDistance = sponsoringTowns.reduce((nearest, sponsor) => {
          const distance = Math.hypot(anchor.x - sponsor.x, anchor.y - sponsor.y);
          return Math.min(nearest, distance);
        }, Infinity);
        if (!Number.isFinite(nearestStableTownDistance)) return null;
        const fertilityWeight = this.getTownFertilityWeight(anchor.terrain);
        return {
          anchor,
          score:
            clamp(2.4 - nearestStableTownDistance / 520, 0.2, 2.4) +
            fertilityWeight * 0.75 +
            Math.random() * 0.6,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    const syntheticAnchor = this.generateEmergentTownAnchor(sponsoringTowns);
    if (
      syntheticAnchor &&
      this.isRegionLivableForTown(syntheticAnchor) &&
      !this.isWaterWorldPoint(syntheticAnchor)
    ) {
      const nearestStableTownDistance = sponsoringTowns.reduce((nearest, sponsor) => {
        const distance = Math.hypot(syntheticAnchor.x - sponsor.x, syntheticAnchor.y - sponsor.y);
        return Math.min(nearest, distance);
      }, Infinity);
      const fertilityWeight = this.getTownFertilityWeight(syntheticAnchor.terrain);
      anchorCandidates.push({
        anchor: syntheticAnchor,
        score:
          clamp(2.2 - nearestStableTownDistance / 560, 0.25, 2.2) +
          fertilityWeight * 0.62 +
          Math.random() * 0.45,
      });
      anchorCandidates.sort((a, b) => b.score - a.score);
    }

    if (!anchorCandidates.length) return;

    const selected = anchorCandidates[0];
    const town = this.createEmergentTownFromAnchor(selected.anchor);
    if (!town) return;
    if (this.resourceZones.length) {
      const profileWeights = this.createEmptyResourceProfile();
      for (const zone of this.resourceZones) {
        const coverage = this.estimateZoneCoverageForRegion(town, zone.polygon);
        if (coverage <= 0) continue;
        profileWeights[zone.resource] = clamp(profileWeights[zone.resource] + coverage, 0, 1);
      }
      town.resourceProfile = profileWeights;
    }

    this.state.regions.push(town);
    this.updateTownCoverage();
    this.state.townsEmerged += 1;
    this.state.score += 12;
    this.logTimeline(`Town emerged on the map: ${town.name}. New local demand activated.`);
    this.pushAlert(`New town emerged: ${town.name}. Demand baseline increased.`, "warning", 6);
  }

  resolveGrid(dt = TICK_SECONDS) {
    for (const link of this.state.links) {
      link.used = 0;
      link.stress = 0;
      link.overload = false;
      const a = this.findRegion(link.a);
      const b = this.findRegion(link.b);
      if (!a || !b || !link.built) {
        link.safeCapacity = 0;
        link.hardCapacity = 0;
        continue;
      }

      const substationBoost = ((a.assets.substation || 0) + (b.assets.substation || 0)) * 9;
      const lineEventMultiplier = this.getLineModifierForLink(link);
      link.safeCapacity = (link.baseCapacity + substationBoost) * lineEventMultiplier;
      link.hardCapacity = link.safeCapacity * 1.15;
    }

    const towns = this.state.regions;
    const componentByTown = this.buildTownComponents();
    const generationByComponent = new Map();
    const coveredByComponent = new Map();
    const storageByComponent = new Map();

    for (const town of towns) {
      const componentId = componentByTown.get(town.id) || town.id;
      const generation = this.computeGenerationForEntity(town);
      generationByComponent.set(componentId, (generationByComponent.get(componentId) || 0) + generation);
      town.served = 0;
      town.unmet = town.demand;
      town.storageChargingMw = 0;

      const storageUnits = this.getStorageUnitCount(town);
      if (storageUnits > 0) {
        this.normalizeRegionStorageCharge(town);
        if (!storageByComponent.has(componentId)) {
          storageByComponent.set(componentId, []);
        }
        storageByComponent.get(componentId).push(town);
      } else if (Number(town.storageChargeMWh || 0) !== 0) {
        town.storageChargeMWh = 0;
      }

      if (town.coveredBySubstation && town.coverageSourceId) {
        const sourceComponent = componentByTown.get(town.coverageSourceId) || town.coverageSourceId;
        if (!coveredByComponent.has(sourceComponent)) {
          coveredByComponent.set(sourceComponent, []);
        }
        coveredByComponent.get(sourceComponent).push(town);
      }
    }

    const prioritySort = { elevated: 0, nominal: 1 };
    const remainingGenerationByComponent = new Map();
    for (const [componentId, coveredTowns] of coveredByComponent.entries()) {
      let pool = generationByComponent.get(componentId) || 0;
      if (pool > 0.0001) {
        coveredTowns.sort((a, b) => {
          const p =
            prioritySort[this.normalizePriority(a.priority)] -
            prioritySort[this.normalizePriority(b.priority)];
          if (p !== 0) return p;
          return b.demand - a.demand;
        });

        for (const town of coveredTowns) {
          if (pool <= 0.0001) break;
          const moved = Math.min(town.unmet, pool);
          town.served += moved;
          town.unmet -= moved;
          pool -= moved;
        }
      }
      remainingGenerationByComponent.set(componentId, pool);
    }

    for (const [componentId, generation] of generationByComponent.entries()) {
      if (!remainingGenerationByComponent.has(componentId)) {
        remainingGenerationByComponent.set(componentId, generation);
      }
    }

    let totalStorageChargingMw = 0;
    const storageDrawByComponent = new Map();
    for (const [componentId, storageRegions] of storageByComponent.entries()) {
      let pool = remainingGenerationByComponent.get(componentId) || 0;
      if (pool <= 0.0001) continue;
      storageRegions.sort((a, b) => {
        const p =
          prioritySort[this.normalizePriority(a.priority)] -
          prioritySort[this.normalizePriority(b.priority)];
        if (p !== 0) return p;
        return a.id.localeCompare(b.id);
      });

      for (const storageRegion of storageRegions) {
        if (pool <= 0.0001) break;
        const requestedMw = this.getStorageChargeDemandMW(storageRegion, dt);
        if (requestedMw <= 0) continue;
        const drawMw = Math.min(requestedMw, pool);
        if (drawMw <= 0) continue;
        this.addStorageChargeFromGrid(storageRegion, drawMw, dt);
        storageRegion.storageChargingMw = (storageRegion.storageChargingMw || 0) + drawMw;
        totalStorageChargingMw += drawMw;
        storageDrawByComponent.set(
          componentId,
          (storageDrawByComponent.get(componentId) || 0) + drawMw
        );
        pool -= drawMw;
      }
      remainingGenerationByComponent.set(componentId, pool);
    }

    const componentServed = new Map();
    const componentLineCount = new Map();
    for (const town of towns) {
      if (!town.coveredBySubstation || !town.coverageSourceId) continue;
      const componentId = componentByTown.get(town.coverageSourceId) || town.coverageSourceId;
      componentServed.set(componentId, (componentServed.get(componentId) || 0) + town.served);
    }
    for (const [componentId, storageDraw] of storageDrawByComponent.entries()) {
      componentServed.set(componentId, (componentServed.get(componentId) || 0) + storageDraw);
    }

    for (const link of this.state.links) {
      if (!link.built || link.safeCapacity <= 0) continue;
      const componentId = componentByTown.get(link.a) || link.a;
      componentLineCount.set(componentId, (componentLineCount.get(componentId) || 0) + 1);
    }

    for (const link of this.state.links) {
      if (!link.built || link.safeCapacity <= 0) continue;
      const componentId = componentByTown.get(link.a) || link.a;
      const servedInComponent = componentServed.get(componentId) || 0;
      const lineCount = Math.max(1, componentLineCount.get(componentId) || 1);
      link.used = servedInComponent / lineCount;
      link.stress = link.safeCapacity > 0 ? link.used / link.safeCapacity : 0;
      link.overload = link.used > link.safeCapacity;
    }

    for (const town of towns) {
      town.unmet = clamp(town.unmet, 0, town.demand);
      town.utilization = town.demand > 0 ? town.served / town.demand : 1;
    }

    const townDemandTotal = towns.reduce(
      (acc, town) => acc + (this.isTownEntity(town) ? town.demand : 0),
      0
    );
    const townServedTotal = towns.reduce(
      (acc, town) => acc + (this.isTownEntity(town) ? town.served : 0),
      0
    );
    const townUnmetTotal = towns.reduce(
      (acc, town) => acc + (this.isTownEntity(town) ? town.unmet : 0),
      0
    );

    this.state.totalDemand = townDemandTotal + totalStorageChargingMw;
    this.state.totalServed = townServedTotal + totalStorageChargingMw;
    this.state.totalUnmet = townUnmetTotal;
    this.state.totalGeneration = Array.from(generationByComponent.values()).reduce(
      (acc, value) => acc + value,
      0
    );
    this.state.storageChargingMw = totalStorageChargingMw;
  }

  findPath(startId, endId) {
    if (startId === endId) return [];

    const queue = [[startId, []]];
    const visited = new Set([startId]);

    while (queue.length) {
      const [nodeId, path] = queue.shift();
      for (const link of this.state.links) {
        if (!link.built) continue;
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
    const regions = this.state.regions;
    const tutorialMode = this.config.mode === "tutorial";

    const operatingBase = regions.reduce((acc, region) => {
      if (this.isTownEntity(region)) return acc;
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
    const lineMaintenanceCost = this.state.links
      .filter((link) => link.built)
      .reduce(
        (acc, link) =>
          acc + (link.length || 0) * LINE_BASE_MAINTENANCE_PER_WORLD_UNIT * this.config.lineMaintenanceMultiplier,
        0
      );

    const revenue = this.state.totalServed * 0.108;
    const unmetPenalty = this.state.totalUnmet * 0.12 * this.config.failureStrictness;
    const overloadPenalty =
      this.state.links.filter((link) => link.overload).length * 1.4 * this.config.failureStrictness;
    const lawsuitPenalty = this.state.lawsuits * 0.18;

    this.state.budget +=
      (revenue - operatingCost - lineMaintenanceCost - unmetPenalty - overloadPenalty - lawsuitPenalty) * dt;

    const townDemandForReliability = regions.reduce(
      (total, region) => total + (this.isTownEntity(region) ? Math.max(0, Number(region.demand || 0)) : 0),
      0
    );
    const townUnmetForReliability = regions.reduce(
      (total, region) => total + (this.isTownEntity(region) ? Math.max(0, Number(region.unmet || 0)) : 0),
      0
    );
    const unmetRatio =
      townDemandForReliability > 0 ? townUnmetForReliability / townDemandForReliability : 0;
    const overloadRatio =
      this.state.links.length > 0
        ? this.state.links.filter((link) => link.overload).length / this.state.links.length
        : 0;

    const assetReliabilityBonus = regions.reduce((acc, region) => {
      if (this.isTownEntity(region)) return acc;
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
    for (const region of regions) {
      if (!this.isTownEntity(region)) continue;
      const unmetShare = region.demand > 0 ? region.unmet / region.demand : 0;
      if (unmetShare > 0.35) {
        trustPressure += unmetShare * 2.1;
      } else {
        trustPressure -= 0.55;
      }
    }

    this.state.hiddenTrust = clamp(this.state.hiddenTrust - trustPressure * dt * 1.6, 0, 100);

    if (
      !tutorialMode &&
      this.state.hiddenTrust < 18 &&
      this.state.runtimeSeconds > this.state.nextLawsuitEligibleAt
    ) {
      this.state.lawsuits += 1;
      this.state.hiddenTrust = clamp(this.state.hiddenTrust + 22, 0, 100);
      this.state.nextLawsuitEligibleAt = this.state.runtimeSeconds + 70;
      this.state.budget -= 140;
      this.pushAlert("Underserved-town lawsuit filed against the Power Department.", "critical", 8);
      this.logTimeline("Lawsuit penalty triggered after sustained underserved town service.");
    }

    if (tutorialMode) {
      this.state.hiddenTrust = 100;
      this.state.lawsuits = 0;
    }

    if (unmetRatio > 0.32) {
      this.pushTransientAlertOnce(
        "grid-stress",
        "Grid stress rising: unmet demand sustained beyond warning threshold.",
        "warning",
        4
      );
    }

    const uncoveredTowns = this.state.regions.filter(
      (region) => this.isTownEntity(region) && !region.coveredBySubstation
    ).length;
    if (uncoveredTowns > 0) {
      this.pushTransientAlertOnce(
        "coverage-gap",
        `Coverage gap detected: ${uncoveredTowns} town(s) outside powered substation radius.`,
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
    const devMode = this.isDevModeEnabled();
    if (this.config.mode === "tutorial") {
      return;
    }

    if (!devMode) {
      if (this.state.budget <= 0) {
        this.finishRun("defeat", "Bankruptcy triggered: budget reached zero.");
        return;
      }

      const collapseThreshold = 16 / this.config.failureStrictness;
      if (this.state.reliability <= collapseThreshold && this.state.collapseSeconds >= 15) {
        this.finishRun("defeat", "Reliability collapse: sustained national blackout risk.");
        return;
      }
    }

    if (this.config.mode === "campaign" && this.config.mission) {
      if (this.state.runtimeSeconds >= this.config.runTargetSec) {
        const mission = this.config.mission;
        const requiredStableTowns =
          mission.objective.requiredStableTowns ?? mission.objective.requiredUnlocked ?? 0;
        const servedTowns = this.state.regions.filter(
          (region) =>
            this.isTownEntity(region) &&
            region.coveredBySubstation &&
            (region.utilization || 0) >= 0.7
        ).length;
        const objective = mission.objective;
        const objectivePass =
          this.state.reliability >= objective.reliabilityFloor &&
          servedTowns >= requiredStableTowns &&
          (objective.budgetFloor == null || this.state.budget >= objective.budgetFloor) &&
          (objective.maxLawsuits == null || this.state.lawsuits <= objective.maxLawsuits);

        if (objectivePass || devMode) {
          const reason = objectivePass
            ? `Mission complete: ${mission.codename}.`
            : `Mission complete in Dev Mode: ${mission.codename}.`;
          this.finishRun("victory", reason);
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
        if (goodReliability && notBankrupt) {
          this.finishRun("victory", "Custom run target reached with stable grid performance.");
        } else if (devMode) {
          this.finishRun("victory", "Custom run target reached in Dev Mode.");
        } else {
          this.finishRun("defeat", "Custom run ended with unstable grid conditions.");
        }
      }
    }
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

  getRegionLineFlowTotals(regionId) {
    let incomingMw = 0;
    let outgoingMw = 0;
    for (const link of this.state.links) {
      if (!link.built) continue;
      const usedMw = Math.max(0, Number(link.used || 0));
      if (usedMw <= 0.0001) continue;

      const hasFlowEndpoints =
        this.findRegion(link.flowFrom) && this.findRegion(link.flowTo);
      const flowFrom = hasFlowEndpoints ? link.flowFrom : link.a;
      const flowTo = hasFlowEndpoints ? link.flowTo : link.b;

      if (flowFrom === regionId) {
        outgoingMw += usedMw;
      }
      if (flowTo === regionId) {
        incomingMw += usedMw;
      }
    }
    return { incomingMw, outgoingMw };
  }

  buildSelectedRegionPopup(region) {
    if (!region) return null;
    const anchor = this.worldToScreen(region.x, region.y);
    const localTownDemandMw = this.isTownEntity(region) ? Math.max(0, Number(region.demand || 0)) : 0;
    const storageDemandMw = Math.max(0, this.getStorageChargeDemandMW(region, TICK_SECONDS));
    const totalDemandMw = localTownDemandMw + storageDemandMw;
    const localTownServedMw = this.isTownEntity(region) ? Math.max(0, Number(region.served || 0)) : 0;
    const localStorageInMw = Math.max(0, Number(region.storageChargingMw || 0));
    const localDemandServedMw = localTownServedMw + localStorageInMw;
    const totalSupplyMw = Math.max(0, Number(this.computeGenerationForEntity(region) || 0));
    const lineFlow = this.getRegionLineFlowTotals(region.id);
    const powerInMw = lineFlow.incomingMw + totalSupplyMw;
    const powerOutMw = lineFlow.outgoingMw + localDemandServedMw;
    const powerStoredMWh = Math.max(0, Number(this.normalizeRegionStorageCharge(region)));
    const storedCapacityMWh = Math.max(0, Number(this.getRegionStorageCapacityMWh(region)));
    const showDemand = totalDemandMw > 0.05 || powerInMw > 0.05;
    const showSupply = totalSupplyMw > 0.05 || powerOutMw > 0.05;
    const showStored = storedCapacityMWh > 0;
    const kindLabel = this.isTownEntity(region) ? "City" : "Structure";

    return {
      id: region.id,
      name: region.name,
      kindLabel,
      anchorX: Number(anchor.x.toFixed(1)),
      anchorY: Number(anchor.y.toFixed(1)),
      totalDemandMw: Number(totalDemandMw.toFixed(2)),
      powerInMw: Number(powerInMw.toFixed(2)),
      powerInDiffMw: Number((powerInMw - totalDemandMw).toFixed(2)),
      totalSupplyMw: Number(totalSupplyMw.toFixed(2)),
      powerOutMw: Number(powerOutMw.toFixed(2)),
      powerOutDiffMw: Number((powerOutMw - totalSupplyMw).toFixed(2)),
      powerStoredMWh: Number(powerStoredMWh.toFixed(2)),
      storedCapacityMWh: Number(storedCapacityMWh.toFixed(2)),
      showDemand,
      showSupply,
      showStored,
    };
  }

  render() {
    const ctx = this.ctx;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return;

    const zoom = this.getCameraZoom();
    const pixelZoomedIn = zoom > 1;
    ctx.imageSmoothingEnabled = !pixelZoomedIn;
    if ("imageSmoothingQuality" in ctx) {
      ctx.imageSmoothingQuality = pixelZoomedIn ? "low" : "high";
    }

    this.clampCameraToMap(width, height);
    ctx.clearRect(0, 0, width, height);
    this.drawMapBackdrop(ctx, width, height);
    this.drawLinks(ctx);
    this.drawTownServiceLinks(ctx);
    this.drawRegions(ctx);
    this.drawOverlay(ctx, width, height);
  }

  drawMapBackdrop(ctx, width, height) {
    const topLeft = this.worldToScreen(0, 0);
    const bottomRight = this.worldToScreen(BASE_MAP.width, BASE_MAP.height);
    const zoom = this.getCameraZoom();
    const drawPixelCrisp = zoom > 1;
    const drawX = drawPixelCrisp ? Math.round(topLeft.x) : topLeft.x;
    const drawY = drawPixelCrisp ? Math.round(topLeft.y) : topLeft.y;
    const drawWidth = drawPixelCrisp
      ? Math.round(bottomRight.x - topLeft.x)
      : bottomRight.x - topLeft.x;
    const drawHeight = drawPixelCrisp
      ? Math.round(bottomRight.y - topLeft.y)
      : bottomRight.y - topLeft.y;

    if (this.mapImageReady && this.mapImage) {
      ctx.fillStyle = "#0d1216";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(this.mapImage, drawX, drawY, drawWidth, drawHeight);
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

      const zoom = this.getCameraZoom();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${clamp(13 * zoom, 10, 16)}px "IBM Plex Mono", monospace`;
      for (const zone of this.resourceZones) {
        const zoneCenter = zone.centroid || centroidFromPolygon(zone.polygon || []);
        if (!zoneCenter) continue;
        const c = this.worldToScreen(zoneCenter.x, zoneCenter.y);
        if (c.x < -120 || c.x > width + 120 || c.y < -26 || c.y > height + 26) {
          continue;
        }

        const label = zone.resource.replace(/_/g, " ").toUpperCase();
        const measured = ctx.measureText(label);
        const labelWidth = Math.ceil(measured.width + 18);
        const labelHeight = Math.ceil(clamp(18 * zoom, 16, 24));

        ctx.fillStyle = "rgba(15, 29, 41, 0.85)";
        ctx.fillRect(c.x - labelWidth / 2, c.y - labelHeight / 2, labelWidth, labelHeight);
        ctx.fillStyle = "#ecf8ff";
        ctx.fillText(label, c.x, c.y + 0.5);
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

  }

  drawLinks(ctx) {
    const zoom = this.getCameraZoom();
    for (const link of this.state.links) {
      if (!link.built) continue;
      const a = this.findRegion(link.a);
      const b = this.findRegion(link.b);
      if (!a || !b) continue;

      const sa = this.worldToScreen(a.x, a.y);
      const sb = this.worldToScreen(b.x, b.y);

      const stress = link.safeCapacity > 0 ? link.used / link.safeCapacity : 0;
      let color = "rgba(114, 208, 142, 0.62)";
      if (stress > 0.8) color = "rgba(244, 180, 88, 0.8)";
      if (stress > 1) color = "rgba(255, 98, 98, 0.92)";

      this.drawLongDistancePowerline(ctx, sa, sb, zoom, color);

      const flowStartRegion = this.findRegion(link.flowFrom);
      const flowEndRegion = this.findRegion(link.flowTo);
      const pulseStart = flowStartRegion && flowEndRegion ? flowStartRegion : a;
      const pulseEnd = flowStartRegion && flowEndRegion ? flowEndRegion : b;
      const flowFrom = this.worldToScreen(pulseStart.x, pulseStart.y);
      const flowTo = this.worldToScreen(pulseEnd.x, pulseEnd.y);

      const t = (this.renderPulse * 0.5) % 1;
      const pulseX = lerp(flowFrom.x, flowTo.x, t);
      const pulseY = lerp(flowFrom.y, flowTo.y, t);
      ctx.fillStyle = stress > 1 ? "#ff8b8b" : "#e6fff2";
      ctx.beginPath();
      ctx.arc(pulseX, pulseY, 2.5 + Math.min(4, stress * 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  getLongDistancePowerlineRenderMetrics(zoom) {
    const tileScale = clamp(zoom * 0.18, 0.16, 0.48);
    const corridorThickness = clamp(64 * tileScale, 10, 30);
    return {
      corridorThickness,
      shieldOffset: -corridorThickness * 0.42,
      conductorOffsets: [
        -corridorThickness * 0.22,
        -corridorThickness * 0.04,
        corridorThickness * 0.14,
        corridorThickness * 0.3,
      ],
      shieldStroke: clamp(0.45 + zoom * 0.18, 0.65, 1.35),
      conductorStroke: clamp(0.62 + zoom * 0.2, 0.86, 1.9),
      towerHeight: clamp(112 * tileScale, 15, 44),
      towerHalfBaseWidth: clamp(22 * tileScale, 3.5, 12),
      towerHalfNeckWidth: clamp(10 * tileScale, 1.8, 6.4),
      towerHalfCrossarmWidth: clamp(34 * tileScale, 6, 20),
      towerMainStroke: clamp(0.75 + zoom * 0.24, 0.86, 2.05),
      towerDetailStroke: clamp(0.44 + zoom * 0.11, 0.58, 1.2),
      insulatorRadius: clamp(0.65 + zoom * 0.18, 0.8, 2.2),
      towerSpacing: clamp(128 * tileScale, 22, 64) / Math.max(0.01, LONG_RANGE_TOWER_COUNT_RATIO),
    };
  }

  drawLongDistancePowerlineFallback(ctx, from, to, zoom, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = clamp(2 + zoom * 0.9, 2, 6);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  drawLongDistanceWireBundle(ctx, from, to, metrics, stressColor) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.6) return;
    const ux = dx / length;
    const uy = dy / length;
    const nx = -uy;
    const ny = ux;

    const drawOffsetWire = (offset, strokeStyle, lineWidth, alpha) => {
      const ox = nx * offset;
      const oy = ny * offset;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(from.x + ox, from.y + oy);
      ctx.lineTo(to.x + ox, to.y + oy);
      ctx.stroke();
    };

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = stressColor;
    ctx.lineWidth = metrics.corridorThickness;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    drawOffsetWire(metrics.shieldOffset, "#3b627f", metrics.shieldStroke, 0.92);
    for (const offset of metrics.conductorOffsets) {
      drawOffsetWire(offset, "#2d4e66", metrics.conductorStroke, 0.96);
    }

    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = stressColor;
    ctx.lineWidth = clamp(metrics.conductorStroke * 0.92, 0.75, 1.9);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  drawLongDistanceTowerUpright(ctx, x, y, metrics, stressColor) {
    const topY = y - metrics.towerHeight * 0.48;
    const capY = topY + metrics.towerHeight * 0.06;
    const crownY = topY + metrics.towerHeight * 0.13;
    const crossarmY = topY + metrics.towerHeight * 0.24;
    const braceY = y + metrics.towerHeight * 0.02;
    const lowerBraceY = y + metrics.towerHeight * 0.22;
    const baseY = y + metrics.towerHeight * 0.48;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "#5b718a";
    ctx.lineWidth = metrics.towerMainStroke;
    ctx.beginPath();
    ctx.moveTo(x - metrics.towerHalfCrossarmWidth * 0.82, crownY);
    ctx.lineTo(x - metrics.towerHalfCrossarmWidth, crossarmY);
    ctx.moveTo(x + metrics.towerHalfCrossarmWidth * 0.82, crownY);
    ctx.lineTo(x + metrics.towerHalfCrossarmWidth, crossarmY);
    ctx.moveTo(x - metrics.towerHalfBaseWidth, baseY);
    ctx.lineTo(x - metrics.towerHalfNeckWidth, braceY);
    ctx.moveTo(x + metrics.towerHalfBaseWidth, baseY);
    ctx.lineTo(x + metrics.towerHalfNeckWidth, braceY);
    ctx.moveTo(x, capY);
    ctx.lineTo(x, baseY);
    ctx.moveTo(x - metrics.towerHalfCrossarmWidth, crossarmY);
    ctx.lineTo(x + metrics.towerHalfCrossarmWidth, crossarmY);
    ctx.moveTo(x - metrics.towerHalfCrossarmWidth * 0.72, crownY);
    ctx.lineTo(x + metrics.towerHalfCrossarmWidth * 0.72, crownY);
    ctx.moveTo(x - metrics.towerHalfBaseWidth, baseY);
    ctx.lineTo(x + metrics.towerHalfBaseWidth, baseY);
    ctx.stroke();

    ctx.strokeStyle = "#4b6078";
    ctx.lineWidth = metrics.towerDetailStroke;
    ctx.beginPath();
    ctx.moveTo(x - metrics.towerHalfNeckWidth, braceY);
    ctx.lineTo(x + metrics.towerHalfBaseWidth * 0.96, baseY);
    ctx.moveTo(x + metrics.towerHalfNeckWidth, braceY);
    ctx.lineTo(x - metrics.towerHalfBaseWidth * 0.96, baseY);
    ctx.moveTo(x - metrics.towerHalfBaseWidth * 0.82, lowerBraceY);
    ctx.lineTo(x + metrics.towerHalfBaseWidth * 0.82, lowerBraceY);
    ctx.moveTo(x - metrics.towerHalfBaseWidth * 0.74, y + metrics.towerHeight * 0.34);
    ctx.lineTo(x + metrics.towerHalfBaseWidth * 0.74, y + metrics.towerHeight * 0.34);
    ctx.stroke();

    ctx.fillStyle = "#b8d3e2";
    ctx.strokeStyle = "#2d4e66";
    ctx.lineWidth = metrics.towerDetailStroke;
    const capPoints = [
      [x - metrics.towerHalfCrossarmWidth, crossarmY],
      [x, crossarmY],
      [x + metrics.towerHalfCrossarmWidth, crossarmY],
      [x - metrics.towerHalfCrossarmWidth * 0.82, crownY],
      [x + metrics.towerHalfCrossarmWidth * 0.82, crownY],
    ];
    for (const [capX, capPointY] of capPoints) {
      ctx.beginPath();
      ctx.arc(capX, capPointY, metrics.insulatorRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.strokeStyle = stressColor;
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = metrics.towerMainStroke * 1.35;
    ctx.beginPath();
    ctx.moveTo(x - metrics.towerHalfBaseWidth, baseY);
    ctx.lineTo(x - metrics.towerHalfNeckWidth, braceY);
    ctx.moveTo(x + metrics.towerHalfBaseWidth, baseY);
    ctx.lineTo(x + metrics.towerHalfNeckWidth, braceY);
    ctx.moveTo(x - metrics.towerHalfCrossarmWidth, crossarmY);
    ctx.lineTo(x + metrics.towerHalfCrossarmWidth, crossarmY);
    ctx.stroke();
    ctx.restore();
  }

  drawLongDistanceTowerSeries(ctx, from, to, metrics, stressColor) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.6) return;
    const ux = dx / length;
    const uy = dy / length;

    if (length < metrics.towerSpacing * 0.95) {
      this.drawLongDistanceTowerUpright(
        ctx,
        (from.x + to.x) * 0.5,
        (from.y + to.y) * 0.5,
        metrics,
        stressColor
      );
      return;
    }

    const startOffset = Math.min(metrics.towerSpacing * 0.65, length * 0.3);
    for (
      let distance = startOffset;
      distance < length - startOffset * 0.42;
      distance += metrics.towerSpacing
    ) {
      const x = from.x + ux * distance;
      const y = from.y + uy * distance;
      this.drawLongDistanceTowerUpright(ctx, x, y, metrics, stressColor);
    }
  }

  drawThinParallelLines(ctx, from, to, options = {}) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.6) return;

    const count = Math.max(1, Math.round(Number(options.count || 1)));
    const spacing = Math.max(0, Number(options.spacing || 0));
    const lineWidth = Math.max(0.2, Number(options.lineWidth || 0.8));
    const alpha = clamp(Number(options.alpha == null ? 1 : options.alpha), 0, 1);
    const strokeStyle = options.strokeStyle || "rgba(123, 173, 198, 0.82)";

    const nx = -dy / length;
    const ny = dx / length;
    const midpoint = (count - 1) / 2;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = strokeStyle;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - midpoint) * spacing;
      const ox = nx * offset;
      const oy = ny * offset;
      ctx.beginPath();
      ctx.moveTo(from.x + ox, from.y + oy);
      ctx.lineTo(to.x + ox, to.y + oy);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawLongDistancePowerline(ctx, from, to, zoom, stressColor) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.6) return;

    if (zoom <= SIMPLIFIED_LINE_RENDER_ZOOM_THRESHOLD) {
      this.drawThinParallelLines(ctx, from, to, {
        count: 3,
        spacing: clamp(1.6 + zoom * 1.1, 1.6, 2.7),
        lineWidth: clamp(0.32 + zoom * 0.34, 0.5, 0.9),
        strokeStyle: stressColor || "rgba(114, 208, 142, 0.72)",
        alpha: 0.9,
      });
      return;
    }

    const metrics = this.getLongDistancePowerlineRenderMetrics(zoom);
    this.drawLongDistanceWireBundle(ctx, from, to, metrics, stressColor);
    this.drawLongDistanceTowerSeries(ctx, from, to, metrics, stressColor);
  }

  drawTownServiceLinks(ctx) {
    const zoom = this.getCameraZoom();
    if (zoom <= 0.62) return;

    for (const town of this.state.regions) {
      if (!this.isTownEntity(town)) continue;
      if (!town.coveredBySubstation || !town.coverageSourceId) continue;
      const source = this.findRegion(town.coverageSourceId);
      if (!source) continue;
      if (source.id === town.id) continue;

      const from = this.worldToScreen(source.x, source.y);
      const to = this.worldToScreen(town.x, town.y);

      if (zoom <= SIMPLIFIED_LINE_RENDER_ZOOM_THRESHOLD) {
        this.drawThinParallelLines(ctx, from, to, {
          count: 2,
          spacing: clamp(1.1 + zoom * 0.9, 1.1, 2.1),
          lineWidth: clamp(0.26 + zoom * 0.3, 0.45, 0.82),
          strokeStyle: "rgba(123, 173, 198, 0.84)",
          alpha: 0.94,
        });
        continue;
      }

      const elbowX = to.x;
      const elbowY = from.y;
      const elbow = { x: elbowX, y: elbowY };

      this.drawLocalPowerlineSegment(ctx, from, elbow, zoom);
      this.drawLocalPowerlineSegment(ctx, elbow, to, zoom);
    }
  }

  getLocalPowerlineRenderMetrics(zoom) {
    const tileScale = clamp(zoom * 0.24, 0.18, 0.44);
    const corridorThickness = clamp(48 * tileScale, 8, 24);
    return {
      corridorThickness,
      horizontalTileWidth: 96 * tileScale,
      horizontalTileHeight: 48 * tileScale,
      verticalTileWidth: 48 * tileScale,
      verticalTileHeight: 96 * tileScale,
    };
  }

  drawLocalPowerlineFallbackSegment(ctx, start, end, zoom) {
    ctx.save();
    ctx.strokeStyle = "rgba(123, 173, 198, 0.7)";
    ctx.lineWidth = clamp(1.2 * zoom, 0.8, 2.3);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
  }

  drawHorizontalLocalPowerlineSegment(ctx, startX, endX, y, zoom) {
    const length = endX - startX;
    if (length <= 0.6) return;

    const metrics = this.getLocalPowerlineRenderMetrics(zoom);
    const tile = this.iconSet.powerline.localHorizontal;
    if (!tile) {
      this.drawLocalPowerlineFallbackSegment(
        ctx,
        { x: startX, y },
        { x: endX, y },
        zoom
      );
      return;
    }

    const halfThickness = metrics.corridorThickness / 2;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.rect(startX, y - halfThickness, length, metrics.corridorThickness);
    ctx.clip();
    for (let x = startX; x < endX + metrics.horizontalTileWidth; x += metrics.horizontalTileWidth) {
      ctx.drawImage(
        tile,
        x,
        y - metrics.horizontalTileHeight / 2,
        metrics.horizontalTileWidth,
        metrics.horizontalTileHeight
      );
    }
    ctx.restore();
  }

  drawVerticalLocalPowerlineSegment(ctx, x, startY, endY, zoom) {
    const length = endY - startY;
    if (length <= 0.6) return;

    const metrics = this.getLocalPowerlineRenderMetrics(zoom);
    const tile = this.iconSet.powerline.localVertical;
    if (!tile) {
      this.drawLocalPowerlineFallbackSegment(
        ctx,
        { x, y: startY },
        { x, y: endY },
        zoom
      );
      return;
    }

    const halfThickness = metrics.corridorThickness / 2;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.rect(x - halfThickness, startY, metrics.corridorThickness, length);
    ctx.clip();
    for (let y = startY; y < endY + metrics.verticalTileHeight; y += metrics.verticalTileHeight) {
      ctx.drawImage(
        tile,
        x - metrics.verticalTileWidth / 2,
        y,
        metrics.verticalTileWidth,
        metrics.verticalTileHeight
      );
    }
    ctx.restore();
  }

  drawLocalPowerlineSegment(ctx, from, to, zoom) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) <= 0.6 && Math.abs(dy) <= 0.6) return;

    if (Math.abs(dx) >= Math.abs(dy)) {
      const y = (from.y + to.y) * 0.5;
      const startX = Math.min(from.x, to.x);
      const endX = Math.max(from.x, to.x);
      this.drawHorizontalLocalPowerlineSegment(ctx, startX, endX, y, zoom);
      return;
    }

    const x = (from.x + to.x) * 0.5;
    const startY = Math.min(from.y, to.y);
    const endY = Math.max(from.y, to.y);
    this.drawVerticalLocalPowerlineSegment(ctx, x, startY, endY, zoom);
  }

  getMapObjectIconScreenSize() {
    return MAP_OBJECT_ICON_WORLD_SIZE * this.getCameraZoom();
  }

  getTownRenderRadius() {
    return this.getMapObjectIconScreenSize() / 2;
  }

  getRegionAssetTypes(region) {
    const assets = [];
    if ((region.assets?.plant || 0) > 0) assets.push("plant");
    if ((region.assets?.substation || 0) > 0) assets.push("substation");
    if ((region.assets?.storage || 0) > 0) assets.push("storage");
    return assets;
  }

  getAssetIconOffsets(assetCount, iconSize, orbitAroundTown) {
    if (assetCount <= 0) return [];
    if (assetCount === 1 && !orbitAroundTown) {
      return [{ x: 0, y: 0 }];
    }

    const orbitRadius = iconSize * (orbitAroundTown ? 0.95 : 0.78);
    const startAngle = assetCount === 1 ? 0 : -Math.PI / 2;
    const offsets = [];
    for (let i = 0; i < assetCount; i += 1) {
      const angle = startAngle + (i / assetCount) * Math.PI * 2;
      offsets.push({
        x: Math.cos(angle) * orbitRadius,
        y: Math.sin(angle) * orbitRadius,
      });
    }
    return offsets;
  }

  drawSelectionHalo(ctx, x, y, radius) {
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = "#f3fae9";
    ctx.beginPath();
    ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawDemolitionProgressRing(ctx, x, y, iconSize, pendingDemolition) {
    if (!pendingDemolition) return;
    const duration = Math.max(
      0.001,
      Number(pendingDemolition.completesAt || 0) - Number(pendingDemolition.startedAt || 0)
    );
    const remainingRatio = clamp(
      (Number(pendingDemolition.completesAt || 0) - this.state.runtimeSeconds) / duration,
      0,
      1
    );
    if (remainingRatio <= 0) return;

    const radius = iconSize * 0.62;
    const lineWidth = Math.max(1.2, iconSize * 0.095);

    ctx.save();
    ctx.strokeStyle = "rgba(255, 94, 94, 0.28)";
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 73, 73, 0.95)";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remainingRatio, false);
    ctx.stroke();
    ctx.restore();
  }

  getTownIconForRegion(region) {
    if (!this.isTownEntity(region)) return null;
    if (region.id === "capital") return this.iconSet.town.capital || null;
    if ((region.population || 0) >= 52) return this.iconSet.town.city || null;
    return this.iconSet.town.hamlet || null;
  }

  drawTownCircleIcon(ctx, x, y, iconSize, region) {
    const townIcon =
      this.getTownIconForRegion(region) ||
      this.iconSet.town.capital ||
      this.iconSet.town.city ||
      this.iconSet.town.hamlet;
    if (townIcon) {
      ctx.save();
      ctx.globalAlpha = 0.98;
      ctx.drawImage(townIcon, x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
      ctx.restore();
      return;
    }

    // Fallback if icon assets are unavailable: neutral marker only.
    ctx.save();
    ctx.fillStyle = "rgba(170, 212, 188, 0.95)";
    ctx.beginPath();
    ctx.arc(x, y, iconSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawInfrastructurePointIcon(ctx, x, y, iconSize) {
    ctx.save();
    ctx.fillStyle = "rgba(136, 153, 164, 0.88)";
    ctx.beginPath();
    ctx.arc(x, y, iconSize / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(16, 26, 35, 0.92)";
    ctx.beginPath();
    ctx.arc(x, y, iconSize * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  getResourceWeightForRegion(region, resourceKey) {
    const profile = region?.resourceProfile || {};
    if (resourceKey === "natural_gas") {
      return Number(profile.natural_gas ?? profile.naturalGas ?? 0) || 0;
    }
    return Number(profile[resourceKey] ?? 0) || 0;
  }

  getPlantIconForRegion(region) {
    const explicitType = this.normalizePlantType(region?.plantType);
    if ((region?.assets?.plant || 0) > 0 && this.iconSet.resource[explicitType]) {
      return this.iconSet.resource[explicitType];
    }

    const candidates = ["wind", "sun", "natural_gas"];
    let bestKey = "natural_gas";
    let bestValue = -Infinity;
    for (const key of candidates) {
      const value = this.getResourceWeightForRegion(region, key);
      if (value > bestValue) {
        bestValue = value;
        bestKey = key;
      }
    }
    return this.iconSet.resource[bestKey] || this.iconSet.resource.natural_gas || null;
  }

  drawAssetIcon(ctx, assetType, x, y, iconSize, region) {
    const half = iconSize / 2;
    const glyphStroke = Math.max(1.2, iconSize * 0.08);

    if (assetType === "plant") {
      const plantIcon = this.getPlantIconForRegion(region);
      if (plantIcon) {
        ctx.save();
        ctx.globalAlpha = 0.98;
        ctx.drawImage(plantIcon, x - half, y - half, iconSize, iconSize);
        ctx.restore();
        return;
      }
    }

    if (assetType === "substation") {
      const substationIcon = this.iconSet.infrastructure?.substation || null;
      if (substationIcon) {
        ctx.save();
        ctx.globalAlpha = 0.98;
        ctx.drawImage(substationIcon, x - half, y - half, iconSize, iconSize);
        ctx.restore();
        return;
      }
    }

    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = "rgba(11, 24, 37, 0.94)";
    ctx.beginPath();
    ctx.arc(0, 0, half, 0, Math.PI * 2);
    ctx.fill();

    if (assetType === "plant") {
      ctx.fillStyle = "#f4d58a";
      ctx.beginPath();
      ctx.moveTo(-iconSize * 0.18, -iconSize * 0.34);
      ctx.lineTo(iconSize * 0.06, -iconSize * 0.34);
      ctx.lineTo(-iconSize * 0.02, -iconSize * 0.08);
      ctx.lineTo(iconSize * 0.2, -iconSize * 0.08);
      ctx.lineTo(-iconSize * 0.06, iconSize * 0.34);
      ctx.lineTo(iconSize * 0, iconSize * 0.06);
      ctx.lineTo(-iconSize * 0.2, iconSize * 0.06);
      ctx.closePath();
      ctx.fill();
    } else if (assetType === "substation") {
      ctx.strokeStyle = "#aaeccf";
      ctx.lineWidth = glyphStroke;
      const box = iconSize * 0.42;
      ctx.strokeRect(-box / 2, -box / 2, box, box);

      ctx.beginPath();
      ctx.moveTo(0, -box * 0.92);
      ctx.lineTo(0, box * 0.92);
      ctx.moveTo(-box * 0.92, 0);
      ctx.lineTo(box * 0.92, 0);
      ctx.stroke();
    } else {
      const bodyW = iconSize * 0.56;
      const bodyH = iconSize * 0.34;
      const capW = iconSize * 0.08;

      ctx.fillStyle = "#bfd0ff";
      ctx.fillRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH);
      ctx.fillRect(bodyW / 2, -bodyH * 0.22, capW, bodyH * 0.44);

      ctx.fillStyle = "rgba(17, 28, 43, 0.94)";
      ctx.fillRect(-bodyW * 0.42, -bodyH * 0.12, bodyW * 0.2, bodyH * 0.24);
      ctx.fillRect(-bodyW * 0.15, -bodyH * 0.12, bodyW * 0.2, bodyH * 0.24);
      ctx.fillRect(bodyW * 0.12, -bodyH * 0.12, bodyW * 0.2, bodyH * 0.24);
    }

    ctx.restore();
  }

  drawRegionAssets(ctx, point, iconSize, region) {
    const assetTypes = this.getRegionAssetTypes(region);
    if (!assetTypes.length) return;

    const offsets = this.getAssetIconOffsets(
      assetTypes.length,
      iconSize,
      this.isTownEntity(region)
    );
    assetTypes.forEach((assetType, index) => {
      const offset = offsets[index] || { x: 0, y: 0 };
      const iconX = point.x + offset.x;
      const iconY = point.y + offset.y;
      this.drawAssetIcon(ctx, assetType, iconX, iconY, iconSize, region);
      const pendingDemolition = this.findPendingDemolition(region.id, assetType);
      this.drawDemolitionProgressRing(ctx, iconX, iconY, iconSize, pendingDemolition);
    });
  }

  drawPriorityOverlay(ctx, point, iconSize, region) {
    if (this.normalizePriority(region?.priority) !== PRIORITY_ELEVATED) return;
    const overlay = this.iconSet.overlay?.priorityElevated || null;
    if (overlay) {
      const size = Math.max(16, iconSize * 0.8);
      ctx.save();
      ctx.globalAlpha = 0.98;
      ctx.drawImage(
        overlay,
        point.x - size / 2,
        point.y - size / 2,
        size,
        size
      );
      ctx.restore();
      return;
    }

    // Fallback if overlay icon is unavailable.
    ctx.save();
    ctx.strokeStyle = "rgba(126, 212, 255, 0.95)";
    ctx.lineWidth = Math.max(1.2, iconSize * 0.08);
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(point.x, point.y, iconSize * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawRegions(ctx) {
    const selectedId = this.selectedRegionId;
    const iconSize = this.getMapObjectIconScreenSize();
    const iconRadius = iconSize / 2;
    const zoom = this.getCameraZoom();

    for (const region of this.state.regions) {
      const point = this.worldToScreen(region.x, region.y);
      const isSelected = selectedId === region.id;
      if (isSelected) {
        this.drawSelectionHalo(ctx, point.x, point.y, iconRadius);
      }

      if (this.isTownEntity(region)) {
        this.drawTownCircleIcon(ctx, point.x, point.y, iconSize, region);
      } else {
        this.drawInfrastructurePointIcon(ctx, point.x, point.y, iconSize);
      }

      this.drawRegionAssets(ctx, point, iconSize, region);
      this.drawPriorityOverlay(ctx, point, iconSize, region);

      if ((region.assets.substation || 0) > 0 && zoom >= 0.9) {
        const coverageRadius =
          (this.config.substationRadius || SUBSTATION_RADIUS_BY_PROFILE.standard) * zoom;
        ctx.strokeStyle = region.coveredBySubstation
          ? "rgba(173, 236, 200, 0.33)"
          : "rgba(241, 188, 128, 0.26)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(point.x, point.y, coverageRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  getBuildPreviewIcon() {
    if (this.buildAssetType === "plant") {
      const plantType = this.normalizePlantType(this.buildPlantType);
      return (
        this.iconSet.resource[plantType] ||
        this.iconSet.resource.wind ||
        this.iconSet.resource.sun ||
        this.iconSet.resource.natural_gas ||
        null
      );
    }
    if (this.buildAssetType === "substation") {
      return this.iconSet.infrastructure.substation || null;
    }
    return null;
  }

  drawLineToolPreview(ctx) {
    if (this.tool !== TOOL_LINE) return;
    if (!this.lineBuildStartRegionId) return;
    if (!this.mouse.inside) return;
    if (this.camera.dragActive || this.pointerDown.dragging) return;

    const startRegion = this.findRegion(this.lineBuildStartRegionId);
    if (!startRegion) return;

    const start = this.worldToScreen(startRegion.x, startRegion.y);
    const end = { x: this.mouse.x, y: this.mouse.y };
    const zoom = this.getCameraZoom();
    const endWorld = this.screenToWorld(end.x, end.y);
    const previewEndpointTerrain = this.inferLocalBiomeAtPoint(endWorld.x, endWorld.y).terrain;
    const previewEndpoint = {
      x: endWorld.x,
      y: endWorld.y,
      terrain: previewEndpointTerrain,
    };
    const previewCost = this.estimateLineBuildCost(startRegion, previewEndpoint);
    const previewDistance = this.calculateLineLength(startRegion, previewEndpoint);
    const outOfRange = previewDistance > this.getMaxLineRange();

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(118, 205, 255, 0.42)";
    ctx.lineWidth = clamp(1.8 + zoom * 0.3, 1.8, 3.2);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    const label = `Cost ${Math.max(0, Math.round(previewCost))}`;
    ctx.font = '600 12px "IBM Plex Mono", monospace';
    const textWidth = Math.ceil(ctx.measureText(label).width);
    const padX = 8;
    const boxWidth = textWidth + padX * 2;
    const boxHeight = 20;
    const x = clamp(end.x + 12, 6, Math.max(6, this.canvas.clientWidth - boxWidth - 6));
    const y = clamp(end.y - boxHeight - 10, 6, Math.max(6, this.canvas.clientHeight - boxHeight - 6));

    ctx.fillStyle = outOfRange ? "rgba(243, 130, 122, 0.24)" : "rgba(112, 188, 232, 0.24)";
    ctx.strokeStyle = outOfRange ? "rgba(255, 175, 168, 0.62)" : "rgba(156, 223, 255, 0.62)";
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.strokeRect(x, y, boxWidth, boxHeight);
    ctx.fillStyle = outOfRange ? "#ffe4df" : "#d8f2ff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + padX, y + boxHeight / 2 + 0.5);
    ctx.restore();
  }

  estimateBuildPreviewCost(worldPoint) {
    if (this.buildAssetType !== "plant") return null;
    if (!worldPoint) return null;

    const rule = ASSET_RULES.plant;
    if (!rule) return null;

    const region = this.findRegionAt(worldPoint.x, worldPoint.y);
    if (region && this.isTownEntity(region)) return null;

    const terrain = region?.terrain || this.inferLocalBiomeAtPoint(worldPoint.x, worldPoint.y).terrain;
    const terrainFactor = TERRAIN_COST_MULTIPLIERS[terrain] || 1;
    const globalCostFactor = this.getModifierValue("build_cost", 1);
    const rawCost = rule.cost * terrainFactor * this.config.infraCostMultiplier * globalCostFactor;
    return Math.ceil(rawCost);
  }

  drawPlantBuildCostPreview(ctx, cost, iconSize) {
    if (!Number.isFinite(cost)) return;

    const label = `Cost ${Math.max(0, Math.round(cost))}`;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    ctx.save();
    ctx.font = '600 12px "IBM Plex Mono", monospace';
    const textWidth = Math.ceil(ctx.measureText(label).width);
    const boxHeight = 20;
    const padX = 8;
    const boxWidth = textWidth + padX * 2;
    const anchorX = this.mouse.x - boxWidth / 2;
    const anchorY = this.mouse.y - iconSize / 2 - boxHeight - 8;
    const x = clamp(anchorX, 6, Math.max(6, width - boxWidth - 6));
    const y = clamp(anchorY, 6, Math.max(6, height - boxHeight - 6));

    ctx.fillStyle = "rgba(112, 188, 232, 0.24)";
    ctx.strokeStyle = "rgba(156, 223, 255, 0.62)";
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.strokeRect(x, y, boxWidth, boxHeight);

    ctx.fillStyle = "#d8f2ff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + padX, y + boxHeight / 2 + 0.5);
    ctx.restore();
  }

  drawBuildCursorPreview(ctx) {
    if (this.tool !== TOOL_BUILD) return;
    if (!this.mouse.inside) return;
    if (this.camera.dragActive || this.pointerDown.dragging) return;

    const zoom = this.getCameraZoom();
    const world = this.screenToWorld(this.mouse.x, this.mouse.y);
    if (world.x < 0 || world.x > BASE_MAP.width || world.y < 0 || world.y > BASE_MAP.height) {
      return;
    }

    if (this.buildAssetType === "substation") {
      const radiusWorld = this.config.substationRadius || SUBSTATION_RADIUS_BY_PROFILE.standard;
      ctx.save();
      ctx.strokeStyle = "rgba(242, 246, 214, 0.72)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.arc(this.mouse.x, this.mouse.y, radiusWorld * zoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    const previewCost = this.estimateBuildPreviewCost(world);
    const iconSize = this.getMapObjectIconScreenSize();
    const icon = this.getBuildPreviewIcon();
    if (icon) {
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.drawImage(
        icon,
        this.mouse.x - iconSize / 2,
        this.mouse.y - iconSize / 2,
        iconSize,
        iconSize
      );
      ctx.restore();
      this.drawPlantBuildCostPreview(ctx, previewCost, iconSize);
      return;
    }

    const fallbackRegion = {
      assets: {
        plant: this.buildAssetType === "plant" ? 1 : 0,
        substation: this.buildAssetType === "substation" ? 1 : 0,
        storage: this.buildAssetType === "storage" ? 1 : 0,
      },
      plantType: this.normalizePlantType(this.buildPlantType),
      resourceProfile: this.createEmptyResourceProfile(),
    };
    ctx.save();
    ctx.globalAlpha = 0.42;
    this.drawAssetIcon(
      ctx,
      this.buildAssetType,
      this.mouse.x,
      this.mouse.y,
      iconSize,
      fallbackRegion
    );
    ctx.restore();
    this.drawPlantBuildCostPreview(ctx, previewCost, iconSize);
  }

  drawRerouteRadiusPreview(ctx) {
    if (this.tool !== TOOL_REROUTE) return;
    if (!this.mouse.inside) return;
    if (this.camera.dragActive || this.pointerDown.dragging) return;

    const zoom = this.getCameraZoom();
    const center = { x: this.mouse.x, y: this.mouse.y };
    const radiusWorld = this.getRerouteRadiusWorld();

    ctx.save();
    ctx.fillStyle = "rgba(118, 205, 255, 0.14)";
    ctx.strokeStyle = "rgba(118, 205, 255, 0.78)";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusWorld * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawOverlay(ctx, width, height) {
    this.drawLineToolPreview(ctx);
    this.drawBuildCursorPreview(ctx);
    this.drawRerouteRadiusPreview(ctx);

    if (this.paused) {
      const pauseBoxWidth = 256;
      const pauseBoxHeight = 56;
      const pauseBoxX = (width - pauseBoxWidth) / 2;
      const pauseBoxY = (height - pauseBoxHeight) / 2;
      ctx.fillStyle = "rgba(8, 18, 26, 0.74)";
      ctx.fillRect(pauseBoxX, pauseBoxY, pauseBoxWidth, pauseBoxHeight);
      ctx.strokeStyle = "rgba(242, 246, 214, 0.42)";
      ctx.lineWidth = 1.3;
      ctx.strokeRect(pauseBoxX, pauseBoxY, pauseBoxWidth, pauseBoxHeight);
      ctx.fillStyle = "#f4f7d8";
      ctx.font = '600 22px "Rajdhani", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Simulation Paused", width / 2, pauseBoxY + pauseBoxHeight / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  }

  pushHudUpdate() {
    const selected = this.getSelectedRegion();
    const objective = this.buildObjectiveStatus();

    this.callbacks.onHud({
      runLabel: this.config.label,
      budget: this.state.budget,
      devMode: this.isDevModeEnabled(),
      reliability: this.state.reliability,
      unmetDemand: this.state.totalUnmet,
      servedDemand: this.state.totalServed,
      powerSupply: this.state.totalGeneration,
      powerDemand: this.state.totalDemand,
      storedPowerMWh: this.calculateStoredPowerMWh(),
      timer: this.state.runtimeSeconds,
      season: this.state.seasonLabel,
      populationActive: this.config.populationEnabled,
      lawsuits: this.state.lawsuits,
      score: this.state.score,
      paused: this.paused,
      tutorialCompleted: this.config.mode === "tutorial" && !!this.state.tutorial?.completed,
      tool: this.tool,
      buildAssetType: this.buildAssetType,
      buildPlantType: this.buildPlantType,
      lineSelectionStartRegionId: this.lineBuildStartRegionId,
      lineCostPreview: this.lineCostPreview,
      resourceLayerVisible: this.resourceRevealHeld,
      townEmergenceMode: this.config.townEmergenceMode,
      townsEmerged: this.state.townsEmerged || 0,
      substationRadius: this.config.substationRadius || 0,
      nextTownEmergenceIn: Math.max(
        0,
        (this.state.nextTownEmergenceAt || this.state.runtimeSeconds) - this.state.runtimeSeconds
      ),
      objective,
      alerts: this.state.alerts,
      incidents: this.state.incidents,
      selectedEntityPopup: this.buildSelectedRegionPopup(selected),
      selectedTown: selected && this.isTownEntity(selected) ? selected : null,
      selectedRegion: selected,
      selectedEntity: selected,
    });
  }

  buildObjectiveStatus() {
    if (this.config.mode === "tutorial") {
      this.state.tutorial = this.createTutorialProgressState(this.state.tutorial);
      const currentStep = this.getCurrentTutorialStep();
      const completedSteps = this.state.tutorial.completedSteps || 0;
      const totalSteps = this.state.tutorial.totalSteps || TUTORIAL_STEP_DEFINITIONS.length;
      const progress = totalSteps > 0 ? clamp(completedSteps / totalSteps, 0, 1) : 1;

      if (!currentStep) {
        return {
          title: "Tutorial",
          text: "All tutorial steps complete.",
          progress: 1,
          detail: `Progress ${totalSteps}/${totalSteps}`,
        };
      }

      return {
        title: `Tutorial: ${currentStep.title}`,
        text: currentStep.instruction,
        progress,
        detail: `Progress ${completedSteps}/${totalSteps}`,
      };
    }

    if (this.config.mode === "campaign" && this.config.mission) {
      const mission = this.config.mission;
      const requiredStableTowns =
        mission.objective.requiredStableTowns ?? mission.objective.requiredUnlocked ?? 0;
      const servedTowns = this.state.regions.filter(
        (region) =>
          this.isTownEntity(region) &&
          region.coveredBySubstation &&
          (region.utilization || 0) >= 0.7
      ).length;
      const progress = clamp(this.state.runtimeSeconds / mission.objective.targetDurationSec, 0, 1);
      return {
        title: mission.codename,
        text: mission.objective.description,
        progress,
        detail: `Towns stable ${servedTowns}/${requiredStableTowns} | Reliability ${this.state.reliability.toFixed(1)}%`,
      };
    }

    if (this.config.mode === "custom") {
      const target = this.config.runTargetSec;
      const progress = target > 0 ? clamp(this.state.runtimeSeconds / target, 0, 1) : 0;
      return {
        title: "Custom Objective",
        text: `Survive until ${formatTime(target)} with stable reliability.`,
        progress,
        detail: `Reliability ${this.state.reliability.toFixed(1)}% | Budget ${formatCompactMoney(this.state.budget)}`,
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
      buildPlantType: this.buildPlantType,
      selectedRegionId: this.selectedRegionId,
      lineBuildStartRegionId: this.lineBuildStartRegionId,
      lineCostPreview: this.lineCostPreview,
      paused: this.paused,
    };
  }

  hydrateRuntimeState(snapshotPayload) {
    if (!snapshotPayload) return;
    this.config = deepClone(snapshotPayload.runConfig || this.config);
    this.applyRunConfigDefaults();
    this.state = this.rehydrateSnapshot(snapshotPayload.gameState || this.state);
    this.enforceInfrastructureOccupancyRules();
    this.pruneEmptyInfrastructureNodes();
    this.ensureRegionResourceProfiles();
    if (this.resourceZones.length) {
      this.applyResourceCoverageToRegions();
    }
    this.updateTownCoverage();
    this.camera = {
      ...this.camera,
      ...(snapshotPayload.camera || {}),
      dragActive: false,
    };
    const legacyZoomIndex = Number(this.camera.zoomIndex);
    const legacyZoom = Number.isFinite(legacyZoomIndex)
      ? LEGACY_ZOOM_LEVELS[Math.round(clamp(legacyZoomIndex, 0, LEGACY_ZOOM_LEVELS.length - 1))]
      : NaN;
    const hydratedZoom = Number(this.camera.zoom);
    if (Number.isFinite(hydratedZoom) && hydratedZoom > 0) {
      this.camera.zoom = clamp(
        hydratedZoom,
        MIN_CAMERA_ZOOM,
        MAX_CAMERA_ZOOM
      );
    } else {
      this.camera.zoom = clamp(
        Number.isFinite(legacyZoom) && legacyZoom > 0 ? legacyZoom : DEFAULT_CAMERA_ZOOM,
        MIN_CAMERA_ZOOM,
        MAX_CAMERA_ZOOM
      );
    }
    const hydratedZoomTarget = Number(this.camera.zoomTarget);
    this.camera.zoomTarget = clamp(
      Number.isFinite(hydratedZoomTarget) && hydratedZoomTarget > 0
        ? hydratedZoomTarget
        : this.camera.zoom,
      MIN_CAMERA_ZOOM,
      MAX_CAMERA_ZOOM
    );
    delete this.camera.zoomIndex;
    this.clampCameraToMap();
    this.tool = snapshotPayload.tool ?? TOOL_PAN;
    this.buildAssetType = snapshotPayload.buildAssetType || "plant";
    this.buildPlantType = this.normalizePlantType(snapshotPayload.buildPlantType);
    this.selectedRegionId = snapshotPayload.selectedRegionId || null;
    this.lineBuildStartRegionId = snapshotPayload.lineBuildStartRegionId || null;
    this.lineCostPreview = snapshotPayload.lineCostPreview || null;
    if (this.selectedRegionId && !this.findRegion(this.selectedRegionId)) {
      this.selectedRegionId = null;
    }
    if (this.lineBuildStartRegionId && !this.findRegion(this.lineBuildStartRegionId)) {
      this.clearLineSelection();
    }
    this.paused = !!snapshotPayload.paused;
    this.resourceRevealHeld = false;
    this.applyDevModeState();
    this.pushHudUpdate();
  }

  renderGameToText() {
    const townSnapshots = this.state.regions
      .filter((town) => this.isTownEntity(town))
      .map((town) => ({
      id: town.id,
      name: town.name,
      x: Number(town.x.toFixed(1)),
      y: Number(town.y.toFixed(1)),
      priority: this.normalizePriority(town.priority),
      climate: town.climate,
      terrain: town.terrain,
      population: Number(town.population.toFixed(2)),
      demand: Number(town.demand.toFixed(2)),
      served: Number(town.served.toFixed(2)),
      unmet: Number(town.unmet.toFixed(2)),
      utilization: Number(town.utilization.toFixed(3)),
      service: {
        coveredBySubstation: !!town.coveredBySubstation,
        coverageSourceId: town.coverageSourceId || null,
        coverageDistance: Number((town.coverageDistance || 0).toFixed(2)),
        stableSeconds: Number((town.stableServiceSeconds || 0).toFixed(2)),
        outageSeconds: Number((town.outageSeconds || 0).toFixed(2)),
      },
      resourceProfile: {
        wind: Number((town.resourceProfile?.wind || 0).toFixed(3)),
        sun: Number((town.resourceProfile?.sun || 0).toFixed(3)),
        naturalGas: Number((town.resourceProfile?.natural_gas || 0).toFixed(3)),
      },
      assets: { ...town.assets },
      storageChargeMWh: Number(this.normalizeRegionStorageCharge(town).toFixed(2)),
      storageCapacityMWh: Number(this.getRegionStorageCapacityMWh(town).toFixed(2)),
      storageChargingMw: Number((town.storageChargingMw || 0).toFixed(2)),
      plantType: town.plantType || DEFAULT_PLANT_TYPE,
      }));

    const nodeSnapshots = this.state.regions
      .filter((entity) => !this.isTownEntity(entity))
      .map((node) => ({
        id: node.id,
        name: node.name,
        x: Number(node.x.toFixed(1)),
        y: Number(node.y.toFixed(1)),
        priority: this.normalizePriority(node.priority),
        terrain: node.terrain,
        climate: node.climate,
        assets: { ...node.assets },
        storageChargeMWh: Number(this.normalizeRegionStorageCharge(node).toFixed(2)),
        storageCapacityMWh: Number(this.getRegionStorageCapacityMWh(node).toFixed(2)),
        storageChargingMw: Number((node.storageChargingMw || 0).toFixed(2)),
        plantType: node.plantType || DEFAULT_PLANT_TYPE,
      }));

    const payload = {
      mode: this.config.mode,
      runLabel: this.config.label,
      devMode: this.isDevModeEnabled(),
      coordinateSystem: {
        origin: "top-left of map world",
        xAxis: "positive right",
        yAxis: "positive down",
        mapSize: { width: BASE_MAP.width, height: BASE_MAP.height },
        camera: {
          x: Number(this.camera.x.toFixed(2)),
          y: Number(this.camera.y.toFixed(2)),
          zoom: Number(this.getCameraZoom().toFixed(3)),
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
      storedPowerMWh: Number(this.calculateStoredPowerMWh().toFixed(2)),
      storageChargingMw: Number((this.state.storageChargingMw || 0).toFixed(2)),
      selectedTool: this.tool,
      selectedBuildAsset: this.buildAssetType,
      selectedBuildPlantType: this.buildPlantType,
      selectedEntityId: this.selectedRegionId,
      selectedTownId:
        this.selectedRegionId && this.isTownEntity(this.findRegion(this.selectedRegionId))
          ? this.selectedRegionId
          : null,
      lineSelectionStartEntityId: this.lineBuildStartRegionId,
      lineSelectionStartTownId:
        this.lineBuildStartRegionId && this.isTownEntity(this.findRegion(this.lineBuildStartRegionId))
          ? this.lineBuildStartRegionId
          : null,
      lineCostPreview: this.lineCostPreview,
      tutorial:
        this.config.mode === "tutorial"
          ? {
              completed: !!this.state.tutorial?.completed,
              currentStep: Number(this.state.tutorial?.currentStep || 0),
              completedSteps: Number(this.state.tutorial?.completedSteps || 0),
              totalSteps: Number(
                this.state.tutorial?.totalSteps || TUTORIAL_STEP_DEFINITIONS.length
              ),
              currentStepId: this.getCurrentTutorialStep()?.id || null,
              currentStepTitle: this.getCurrentTutorialStep()?.title || null,
            }
          : null,
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
      pendingDemolitions: (this.state.pendingDemolitions || []).map((item) => ({
        id: item.id,
        regionId: item.regionId,
        regionName: item.regionName,
        assetType: item.assetType,
        assetLabel: item.assetLabel,
        refund: Number(item.refund || 0),
        remainingSeconds: Number(
          Math.max(0, Number(item.completesAt || 0) - this.state.runtimeSeconds).toFixed(2)
        ),
        durationSeconds: Number(
          Math.max(0, Number(item.completesAt || 0) - Number(item.startedAt || 0)).toFixed(2)
        ),
      })),
      terrainMap: {
        id: this.config.terrainMapId || DEFAULT_TERRAIN_MAP_ID,
        label: this.config.terrainMapLabel || "National Core Terrain",
        image: this.config.terrainMapImageUrl || DEFAULT_TERRAIN_MAP_IMAGE_URL,
        metadata:
          this.config.terrainMapMetadataUrl == null
            ? null
            : this.config.terrainMapMetadataUrl || DEFAULT_TERRAIN_MAP_METADATA_URL,
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
          infrastructure: {
            substation: !!this.iconSet.infrastructure.substation,
          },
          powerline: {
            localHorizontal: !!this.iconSet.powerline.localHorizontal,
            localVertical: !!this.iconSet.powerline.localVertical,
            longHorizontal: !!this.iconSet.powerline.longHorizontal,
            longVertical: !!this.iconSet.powerline.longVertical,
          },
          overlay: {
            priorityElevated: !!this.iconSet.overlay.priorityElevated,
          },
        },
        resourceZoneCounts: { ...this.resourceZoneSummary },
      },
      towns: townSnapshots,
      infrastructurePoints: nodeSnapshots,
      infrastructureNodes: nodeSnapshots,
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
          flowFrom: link.flowFrom || link.a,
          flowTo: link.flowTo || link.b,
          used: Number(link.used.toFixed(2)),
          safeCapacity: Number(link.safeCapacity.toFixed(2)),
          stress: Number(link.stress.toFixed(3)),
          overload: link.overload,
        })),
      incidents: this.state.incidents.map((incident) => ({
        title: incident.title,
        level: incident.level,
        type: incident.type,
        townId: incident.regionId || null,
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
