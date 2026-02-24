import * as GameCore from "./game/core.js";

const {
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
const PLANT_TYPE_VALUES = new Set(["wind", "sun", "natural_gas"]);
const DEFAULT_PLANT_TYPE = "wind";

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

    this.zoomLevels = [0.55, 0.72, 0.9, 1.1, 1.32, 1.64, 1.98, 2.32, 2.64, 3.08, 3.52, 3.96, 4.4, 4.84, 5.28];
    const defaultZoomLevel = 2.64;
    const defaultZoomIndex = this.zoomLevels.findIndex(
      (zoomLevel) => Math.abs(zoomLevel - defaultZoomLevel) < 1e-6
    );
    this.camera = {
      x: BASE_MAP.width / 2,
      y: BASE_MAP.height / 2,
      zoomIndex: defaultZoomIndex >= 0 ? defaultZoomIndex : this.zoomLevels.length - 1,
      dragActive: false,
      dragStartX: 0,
      dragStartY: 0,
      dragCamX: BASE_MAP.width / 2,
      dragCamY: BASE_MAP.height / 2,
    };

    this.tool = TOOL_PAN;
    this.buildAssetType = "plant";
    this.buildPlantType = DEFAULT_PLANT_TYPE;
    this.selectedRegionId = null;
    this.lineBuildStartRegionId = null;
    this.lineCostPreview = null;
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
      infrastructure: {
        substation: null,
      },
      powerline: {
        localHorizontal: null,
        localVertical: null,
        longHorizontal: null,
        longVertical: null,
      },
    };

    this.state = this.snapshot ? this.rehydrateSnapshot(this.snapshot) : this.createFreshState();
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
    this.config.substationRadius =
      Number(this.config.substationRadius) ||
      SUBSTATION_RADIUS_BY_PROFILE[this.config.substationRadiusProfile];
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
      this.config.townEmergenceMode = "off";
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
      this.finishRun("victory", "Tutorial complete: core controls verified.");
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
    }

    let zones = [];
    if (metadata && Array.isArray(metadata.resource_zones)) {
      const sourceWidth = Number(metadata?.image?.width) || image?.naturalWidth || BASE_MAP.width;
      const sourceHeight = Number(metadata?.image?.height) || image?.naturalHeight || BASE_MAP.height;
      const scaleX = BASE_MAP.width / Math.max(1, sourceWidth);
      const scaleY = BASE_MAP.height / Math.max(1, sourceHeight);

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
        priority: "normal",
        townCount,
        townCap: 1,
        nominalBaseDemand: region.baseDemand,
        stableServiceSeconds: townCount > 0 ? 8 : 0,
        outageSeconds: 0,
        coveredBySubstation: false,
        coverageSourceId: null,
        coverageDistance: 0,
        assets,
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
      nextLineId: 1,
      nextTownId: 1,
      nextNodeId: 1,
      nextTownEmergenceAt: randomRange(44, 70),
      nextEventAt: randomRange(20, 34),
      nextNewsAt: 7,
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
      region.baseDemand = region.entityType === "town" ? Number(region.baseDemand || 0) : 0;
      region.population = region.entityType === "town" ? Number(region.population || 0) : 0;
      region.growthRate = region.entityType === "town" ? Number(region.growthRate || 0) : 0;
      if (!region.assets) {
        region.assets = { plant: 0, substation: 0, storage: 0 };
      }
      region.assets.plant = Math.max(0, Number(region.assets.plant || 0));
      region.assets.substation = Math.max(0, Number(region.assets.substation || 0));
      region.assets.storage = Math.max(0, Number(region.assets.storage || 0));
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
    if (!safe.nextNewsAt) safe.nextNewsAt = safe.runtimeSeconds + 7;
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
      this.buildPlantType = DEFAULT_PLANT_TYPE;
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

    if (event.code === "Digit4" || event.code === "KeyL") {
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
      if (!this.resourceRevealHeld) {
        this.resourceRevealHeld = true;
        this.recordTutorialAction("resource_reveal");
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
      this.clearLineSelection();
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
      radius: 22,
      districtType: localBiome.districtType,
      terrain: localBiome.terrain,
      climate: localBiome.climate,
      baseDemand: 0,
      population: 0,
      growthRate: 0,
      starterAssets: { plant: 0, substation: 0, storage: 0 },
      strategicValue: "Player-placed infrastructure anchor",
      priority: "normal",
      townCount: 0,
      townCap: 0,
      nominalBaseDemand: 0,
      stableServiceSeconds: 0,
      outageSeconds: 0,
      coveredBySubstation: false,
      coverageSourceId: null,
      coverageDistance: 0,
      assets: { plant: 0, substation: 0, storage: 0 },
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
    return Math.ceil(rawCost);
  }

  canEndpointHostLine(region) {
    if (!region) return false;
    if (this.isTownEntity(region)) return false;
    return (region.assets.plant || 0) > 0 || (region.assets.substation || 0) > 0;
  }

  clearLineSelection() {
    this.lineBuildStartRegionId = null;
    this.lineCostPreview = null;
  }

  handleLineTool(region) {
    if (!this.lineBuildStartRegionId) {
      if (!this.canEndpointHostLine(region)) {
        const text = this.isTownEntity(region)
          ? "Towns are demand points. Build a plant/substation on an infrastructure point first."
          : "Line endpoint must have a plant or substation before connecting.";
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
        ? "Line endpoints must be infrastructure points with a plant or substation."
        : "Line endpoints require plant/substation infrastructure at both points.";
      this.pushAlert(
        text,
        "warning",
        5
      );
      return;
    }

    const existing = this.findLineBetween(startRegion.id, region.id);
    const buildCost = this.estimateLineBuildCost(startRegion, region);
    this.lineCostPreview = {
      from: startRegion.id,
      to: region.id,
      cost: buildCost,
      capacity: this.estimateLineCapacity(this.calculateLineLength(startRegion, region)),
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

    if (!this.isDevModeEnabled() && this.state.budget < buildCost) {
      this.pushAlert(`Insufficient budget for Line (${buildCost}).`, "warning", 5);
      return;
    }

    let line = existing;
    if (!line) {
      const length = this.calculateLineLength(startRegion, region);
      line = {
        id: `line-${this.state.nextLineId++}`,
        a: startRegion.id,
        b: region.id,
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
      if (!nearbyNode) {
        this.state.regions.push(target);
        if (this.resourceZones.length) {
          this.applyResourceCoverageToRegions();
        }
      }
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

    target.assets[this.buildAssetType] += 1;
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

    const { assetType, rule, refund } = candidate;
    region.assets[assetType] = Math.max(0, Number(region.assets[assetType] || 0) - 1);
    if (assetType === "plant" && region.assets.plant <= 0) {
      region.plantType = DEFAULT_PLANT_TYPE;
    }
    this.state.budget += refund;
    region.cooldownUntil = this.state.runtimeSeconds + 4.5;
    this.logTimeline(`Demolished ${rule.label} in ${region.name} (+${refund} budget refund).`);
    this.pushAlert(`${rule.label} demolished in ${region.name}.`, "warning", 4);
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
        return {
          assetType,
          rule,
          refund: Math.floor(rule.cost * rule.refundRatio),
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

  handleReroute(region) {
    const currentIndex = PRIORITY_ORDER.indexOf(region.priority);
    region.priority = PRIORITY_ORDER[(currentIndex + 1) % PRIORITY_ORDER.length];
    this.logTimeline(`${region.name} routing priority set to ${region.priority.toUpperCase()}.`);
    this.pushAlert(`${region.name} rerouted to ${region.priority} priority.`, "advisory", 4);
    this.recordTutorialAction("reroute", { isTown: this.isTownEntity(region) });
  }

  handlePrimaryClick() {
    this.callbacks.onDismissDemolishConfirm?.();
    if (this.tool === TOOL_PAN) {
      return;
    }
    const worldPoint = this.screenToWorld(this.mouse.x, this.mouse.y);
    const region = this.findRegionAt(worldPoint.x, worldPoint.y);

    if (this.tool === TOOL_BUILD) {
      const target = this.handleBuild(region, worldPoint);
      this.selectedRegionId = target ? target.id : region ? region.id : null;
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
    } else if (this.tool === TOOL_REROUTE) {
      this.handleReroute(region);
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
      this.selectedRegionId = null;
      this.pushHudUpdate();
      return;
    }

    const demolishCandidate = this.getDemolishCandidate(region, this.buildAssetType);
    if (!demolishCandidate) {
      this.pushAlert(`No removable assets available at ${region.name}.`, "advisory", 4);
      this.selectedRegionId = region.id;
      this.pushHudUpdate();
      return;
    }

    this.selectedRegionId = region.id;
    this.callbacks.onRequestDemolishConfirm?.({
      regionId: region.id,
      regionName: region.name,
      assetType: demolishCandidate.assetType,
      assetLabel: demolishCandidate.rule.label,
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
    this.updateTownCoverage();
    this.resolveGrid();
    this.evaluateTutorialPassiveProgress();
    this.updateTownServiceStability(dt);
    this.updateTownEmergence();
    this.updateEconomyAndReliability(dt);
    this.updateScoring(dt);
    this.applyDevModeState();
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
    const storageBoostMultiplier = clamp(1 + resource.wind * 0.05 + resource.sun * 0.08, 1, 1.2);
    return (
      entity.assets.plant * ASSET_RULES.plant.generation * plantBoostMultiplier +
      entity.assets.storage * ASSET_RULES.storage.generation * storageBoostMultiplier
    );
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
      };
    }
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

  generateEmergentTownAnchor(sponsoringTowns) {
    if (!sponsoringTowns.length) return null;

    const mapPadding = 110;
    const minTownSpacing = 170;
    for (let attempt = 0; attempt < 36; attempt += 1) {
      const sponsor = pickRandom(sponsoringTowns);
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
      priority: "normal",
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
      .map((anchor) => {
        const nearestStableTownDistance = sponsoringTowns.reduce((nearest, sponsor) => {
          const distance = Math.hypot(anchor.x - sponsor.x, anchor.y - sponsor.y);
          return Math.min(nearest, distance);
        }, Infinity);
        if (!Number.isFinite(nearestStableTownDistance)) return null;
        return {
          anchor,
          score:
            clamp(2.4 - nearestStableTownDistance / 520, 0.2, 2.4) +
            Math.random(),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    const syntheticAnchor = this.generateEmergentTownAnchor(sponsoringTowns);
    if (syntheticAnchor && this.isRegionLivableForTown(syntheticAnchor)) {
      const nearestStableTownDistance = sponsoringTowns.reduce((nearest, sponsor) => {
        const distance = Math.hypot(syntheticAnchor.x - sponsor.x, syntheticAnchor.y - sponsor.y);
        return Math.min(nearest, distance);
      }, Infinity);
      anchorCandidates.push({
        anchor: syntheticAnchor,
        score: clamp(2.2 - nearestStableTownDistance / 560, 0.25, 2.2) + Math.random() * 0.7,
      });
      anchorCandidates.sort((a, b) => b.score - a.score);
    }

    if (!anchorCandidates.length) return;

    const selected = anchorCandidates[0];
    const town = this.createEmergentTownFromAnchor(selected.anchor);
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

  resolveGrid() {
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

    for (const town of towns) {
      const componentId = componentByTown.get(town.id) || town.id;
      const generation = this.computeGenerationForEntity(town);
      generationByComponent.set(componentId, (generationByComponent.get(componentId) || 0) + generation);
      town.served = 0;
      town.unmet = town.demand;

      if (town.coveredBySubstation && town.coverageSourceId) {
        const sourceComponent = componentByTown.get(town.coverageSourceId) || town.coverageSourceId;
        if (!coveredByComponent.has(sourceComponent)) {
          coveredByComponent.set(sourceComponent, []);
        }
        coveredByComponent.get(sourceComponent).push(town);
      }
    }

    const prioritySort = { high: 0, normal: 1, low: 2 };
    for (const [componentId, coveredTowns] of coveredByComponent.entries()) {
      let pool = generationByComponent.get(componentId) || 0;
      if (pool <= 0.0001) continue;

      coveredTowns.sort((a, b) => {
        const p = prioritySort[a.priority] - prioritySort[b.priority];
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

    const componentServed = new Map();
    const componentLineCount = new Map();
    for (const town of towns) {
      if (!town.coveredBySubstation || !town.coverageSourceId) continue;
      const componentId = componentByTown.get(town.coverageSourceId) || town.coverageSourceId;
      componentServed.set(componentId, (componentServed.get(componentId) || 0) + town.served);
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

    this.state.totalDemand = towns.reduce((acc, town) => acc + town.demand, 0);
    this.state.totalServed = towns.reduce((acc, town) => acc + town.served, 0);
    this.state.totalUnmet = towns.reduce((acc, town) => acc + town.unmet, 0);
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

    const unmetRatio =
      this.state.totalDemand > 0 ? this.state.totalUnmet / this.state.totalDemand : 0;
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

    const zoom = this.zoomLevels[this.camera.zoomIndex] || 1;
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
    const zoom = this.zoomLevels[this.camera.zoomIndex] || 1;
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

      const zoom = this.zoomLevels[this.camera.zoomIndex] || 1;
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

    const vignette = ctx.createLinearGradient(0, 0, width, height);
    vignette.addColorStop(0, "rgba(4, 15, 24, 0.16)");
    vignette.addColorStop(1, "rgba(4, 15, 24, 0.3)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  drawLinks(ctx) {
    const zoom = this.zoomLevels[this.camera.zoomIndex] || 1;
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

      const t = (this.renderPulse * 0.5) % 1;
      const pulseX = lerp(sa.x, sb.x, t);
      const pulseY = lerp(sa.y, sb.y, t);
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
      horizontalTileWidth: 128 * tileScale,
      horizontalTileHeight: 64 * tileScale,
      verticalTileWidth: 64 * tileScale,
      verticalTileHeight: 128 * tileScale,
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

  drawLongDistancePowerline(ctx, from, to, zoom, stressColor) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.6) return;

    const metrics = this.getLongDistancePowerlineRenderMetrics(zoom);
    const useVerticalTemplate = Math.abs(dy) > Math.abs(dx) * 1.15;
    const tile = useVerticalTemplate
      ? this.iconSet.powerline.longVertical
      : this.iconSet.powerline.longHorizontal;
    if (!tile) {
      this.drawLongDistancePowerlineFallback(ctx, from, to, zoom, stressColor);
      return;
    }

    const angle = Math.atan2(dy, dx);
    const halfThickness = metrics.corridorThickness / 2;

    ctx.save();
    ctx.translate(from.x, from.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.rect(0, -halfThickness, length, metrics.corridorThickness);
    ctx.clip();
    ctx.globalAlpha = 0.96;

    if (useVerticalTemplate) {
      ctx.save();
      ctx.rotate(-Math.PI / 2);
      for (
        let y = 0;
        y < length + metrics.verticalTileHeight;
        y += metrics.verticalTileHeight
      ) {
        ctx.drawImage(
          tile,
          -metrics.verticalTileWidth / 2,
          y,
          metrics.verticalTileWidth,
          metrics.verticalTileHeight
        );
      }
      ctx.restore();
    } else {
      for (
        let x = 0;
        x < length + metrics.horizontalTileWidth;
        x += metrics.horizontalTileWidth
      ) {
        ctx.drawImage(
          tile,
          x,
          -metrics.horizontalTileHeight / 2,
          metrics.horizontalTileWidth,
          metrics.horizontalTileHeight
        );
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = stressColor;
    ctx.fillRect(0, -halfThickness, length, metrics.corridorThickness);
    ctx.restore();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = stressColor;
    ctx.globalAlpha = 0.44;
    ctx.lineWidth = clamp(0.9 * zoom, 0.8, 2.2);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  drawTownServiceLinks(ctx) {
    const zoom = this.zoomLevels[this.camera.zoomIndex];
    if (zoom <= 0.62) return;

    for (const town of this.state.regions) {
      if (!this.isTownEntity(town)) continue;
      if (!town.coveredBySubstation || !town.coverageSourceId) continue;
      const source = this.findRegion(town.coverageSourceId);
      if (!source) continue;
      if (source.id === town.id) continue;

      const from = this.worldToScreen(source.x, source.y);
      const to = this.worldToScreen(town.x, town.y);
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
    return MAP_OBJECT_ICON_WORLD_SIZE * (this.zoomLevels[this.camera.zoomIndex] || 1);
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
      this.drawAssetIcon(ctx, assetType, point.x + offset.x, point.y + offset.y, iconSize, region);
    });
  }

  drawRegions(ctx) {
    const selectedId = this.selectedRegionId;
    const iconSize = this.getMapObjectIconScreenSize();
    const iconRadius = iconSize / 2;
    const zoom = this.zoomLevels[this.camera.zoomIndex] || 1;

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

      if ((region.assets.substation || 0) > 0 && zoom >= 0.9) {
        const coverageRadius = (this.config.substationRadius || 300) * zoom;
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
      devMode: this.isDevModeEnabled(),
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
    this.camera.zoomIndex = clamp(
      Number(this.camera.zoomIndex) || 0,
      0,
      this.zoomLevels.length - 1
    );
    this.clampCameraToMap();
    this.tool = snapshotPayload.tool ?? TOOL_PAN;
    this.buildAssetType = snapshotPayload.buildAssetType || "plant";
    this.buildPlantType = this.normalizePlantType(snapshotPayload.buildPlantType);
    this.selectedRegionId = snapshotPayload.selectedRegionId || null;
    this.lineBuildStartRegionId = snapshotPayload.lineBuildStartRegionId || null;
    this.lineCostPreview = snapshotPayload.lineCostPreview || null;
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
      priority: town.priority,
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
      plantType: town.plantType || DEFAULT_PLANT_TYPE,
      }));

    const nodeSnapshots = this.state.regions
      .filter((entity) => !this.isTownEntity(entity))
      .map((node) => ({
        id: node.id,
        name: node.name,
        x: Number(node.x.toFixed(1)),
        y: Number(node.y.toFixed(1)),
        terrain: node.terrain,
        climate: node.climate,
        assets: { ...node.assets },
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
    this.devMode = !!readJsonStorage(STORAGE_KEYS.devMode, false);
    this.tutorialCompleted = !!readJsonStorage(STORAGE_KEYS.tutorialCompleted, false);

    this.selectedStandardPresetId = STANDARD_PRESETS[0].id;
    this.customConfig = {
      ...deepClone(CUSTOM_PRESETS[0]),
      mapSelectionId: DEFAULT_TERRAIN_MAP_ID,
    };

    this.splashTimeout = 0;
    this.boundSkipSplash = () => this.renderMainMenu();
    this.splashListenersActive = false;
    this.demolishConfirmDismissHandler = null;

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
    this.clearDemolishConfirm();
    if (!this.runtime) return;
    this.runtime.stop();
    this.runtime = null;
  }

  clearDemolishConfirm() {
    if (this.demolishConfirmDismissHandler) {
      window.removeEventListener("pointerdown", this.demolishConfirmDismissHandler, true);
      this.demolishConfirmDismissHandler = null;
    }
    this.root.querySelector("#demolish-confirm-popover")?.remove();
  }

  showDemolishConfirm(payload) {
    this.clearDemolishConfirm();
    if (!payload || !this.runtime) return;
    const layer = this.root.querySelector(".floating-ui-layer");
    if (!layer) return;

    const layerRect = layer.getBoundingClientRect();
    const x = clamp(Number(payload.x || 0), 20, Math.max(20, layerRect.width - 20));
    const y = clamp(Number(payload.y || 0), 20, Math.max(20, layerRect.height - 20));
    const placeBelow = y < 100;

    const popover = document.createElement("div");
    popover.id = "demolish-confirm-popover";
    popover.className = `floating-group demolish-confirm${placeBelow ? " demolish-confirm-below" : ""}`;
    popover.style.left = `${x}px`;
    popover.style.top = `${y}px`;
    popover.innerHTML = `
      <p>Demolish ${payload.assetLabel} at ${payload.regionName}?</p>
      <p class="demolish-confirm-refund">Refund +${Math.round(payload.refund || 0)} budget</p>
      <div class="demolish-confirm-actions">
        <button class="demolish-confirm-btn demolish-confirm-cancel" type="button">Cancel</button>
        <button class="demolish-confirm-btn demolish-confirm-accept" type="button">Demolish</button>
      </div>
    `;
    layer.appendChild(popover);

    popover.querySelector(".demolish-confirm-cancel")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.clearDemolishConfirm();
    });

    popover.querySelector(".demolish-confirm-accept")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const demolished = this.runtime?.confirmDemolish(payload.regionId, payload.assetType);
      if (!demolished) {
        this.pushToast("Demolition request expired for that location.");
      }
      this.clearDemolishConfirm();
    });

    this.demolishConfirmDismissHandler = (event) => {
      const targetNode = event.target;
      if (targetNode instanceof Node && popover.contains(targetNode)) {
        return;
      }
      this.clearDemolishConfirm();
    };
    window.addEventListener("pointerdown", this.demolishConfirmDismissHandler, true);
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
    const tutorialLabel = this.tutorialCompleted ? "Tutorial (Completed)" : "Tutorial";

    this.root.innerHTML = `
      <section class="screen menu-screen">
        <div class="menu-layout">
          <aside class="menu-column">
            <h2>Command Console</h2>
            <p class="menu-copy">Direct national power strategy through build, demolish, reroute, and line-routing decisions.</p>
            <div class="menu-actions">
              ${hasContinue ? '<button class="action-btn" id="menu-continue">Continue Run</button>' : ""}
              <button class="action-btn action-btn-primary" id="menu-tutorial">${tutorialLabel}</button>
              <button class="action-btn action-btn-primary" id="start-btn">Quick Start</button>
              <button class="action-btn action-btn-primary" id="menu-new-run">New Run</button>
              <button class="action-btn" id="menu-campaign">Campaign Missions</button>
              <button class="action-btn" id="menu-custom">Custom Game</button>
              <button class="action-btn" id="menu-cosmetics" disabled>Cosmetics (Soon)</button>
              <button class="action-btn" id="menu-records">Records</button>
              <button class="action-btn" id="menu-settings">Settings</button>
            </div>
            <label class="menu-dev-toggle" for="menu-dev-mode">
              <input type="checkbox" id="menu-dev-mode" ${this.devMode ? "checked" : ""}>
              <span>Dev Mode: infinite money + no defeat</span>
            </label>
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
              <li>Substations cover towns by radius; manual Lines handle long routes.</li>
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
    this.root.querySelector("#menu-tutorial")?.addEventListener("click", () => {
      const config = buildRunConfigForTutorial();
      this.startRun(config);
    });
    this.root.querySelector("#menu-new-run")?.addEventListener("click", () => this.renderStandardSetup());
    this.root.querySelector("#menu-campaign")?.addEventListener("click", () => this.renderCampaignSelect());
    this.root.querySelector("#menu-custom")?.addEventListener("click", () => this.renderCustomSetup());
    this.root.querySelector("#menu-records")?.addEventListener("click", () => this.renderRecordsScreen());
    this.root.querySelector("#menu-settings")?.addEventListener("click", () => this.renderSettingsScreen());
    this.root.querySelector("#menu-dev-mode")?.addEventListener("change", (event) => {
      const enabled = !!event.currentTarget?.checked;
      this.devMode = enabled;
      writeJsonStorage(STORAGE_KEYS.devMode, enabled);
      this.pushToast(
        enabled
          ? "Dev Mode enabled: infinite budget and defeat disabled."
          : "Dev Mode disabled."
      );
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

  applyDevModeToRunConfig(runConfig) {
    const next = deepClone(runConfig || {});
    const devMode = !!this.devMode;
    next.devMode = devMode;
    if (devMode) {
      next.leaderboardEligible = false;
      next.leaderboardClass = "custom";
      if (next.label && !String(next.label).includes("[DEV]")) {
        next.label = `${next.label} [DEV]`;
      }
    } else if (next.label) {
      next.label = String(next.label).replace(/\s*\[DEV\]$/, "");
    }
    return next;
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
          <p>Budget ${preset.budget} | Routing ${preset.routingComplexity}</p>
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
            <span>${mission.routingComplexity || "Moderate"}</span>
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
      return `<option value="${preset.id}" ${preset.id === this.customConfig.presetId ? "selected" : ""}>${preset.label}</option>`;
    }).join("");
    const mapSelectionOptions = getMapSelectionOptions()
      .map(
        (mapOption) =>
          `<option value="${mapOption.id}" ${
            String(this.customConfig.mapSelectionId || DEFAULT_TERRAIN_MAP_ID) === mapOption.id
              ? "selected"
              : ""
          }>${mapOption.label}</option>`
      )
      .join("");

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
            Handcrafted Map
            <select name="mapSelectionId">${mapSelectionOptions}</select>
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
            Local Climate Intensity
            <select name="climateIntensity">
              ${CUSTOM_OPTIONS.climateIntensity.map((value) => `<option value="${value}" ${this.customConfig.climateIntensity === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
          <label>
            Town Emergence Intensity
            <select name="townEmergenceIntensity">
              ${CUSTOM_OPTIONS.townEmergenceIntensity.map((value) => `<option value="${value}" ${this.customConfig.townEmergenceIntensity === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
          <label>
            Substation Radius Profile
            <select name="substationRadiusProfile">
              ${CUSTOM_OPTIONS.substationRadiusProfile.map((value) => `<option value="${value}" ${this.customConfig.substationRadiusProfile === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
          <label>
            Line Maintenance Profile
            <select name="lineMaintenanceProfile">
              ${CUSTOM_OPTIONS.lineMaintenanceProfile.map((value) => `<option value="${value}" ${this.customConfig.lineMaintenanceProfile === value ? "selected" : ""}>${value}</option>`).join("")}
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
        const retainedMapSelectionId = String(
          this.customConfig.mapSelectionId || DEFAULT_TERRAIN_MAP_ID
        );
        this.customConfig = {
          ...deepClone(preset),
          mapSelectionId: retainedMapSelectionId,
        };
        this.renderCustomSetup();
      }
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      this.customConfig = {
        presetId: formData.get("presetId"),
        mapSelectionId: formData.get("mapSelectionId") || DEFAULT_TERRAIN_MAP_ID,
        budget: Number(formData.get("budget")),
        demandGrowthMultiplier: Number(formData.get("demandGrowthMultiplier")),
        eventIntensity: formData.get("eventIntensity"),
        seasonalProfile: formData.get("seasonalProfile"),
        populationMode: formData.get("populationMode"),
        climateIntensity: formData.get("climateIntensity"),
        townEmergenceIntensity: formData.get("townEmergenceIntensity"),
        substationRadiusProfile: formData.get("substationRadiusProfile"),
        lineMaintenanceProfile: formData.get("lineMaintenanceProfile"),
        infraCostMultiplier: Number(formData.get("infraCostMultiplier")),
        failureStrictness: formData.get("failureStrictness"),
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

          <div class="floating-group floating-bottom-left">
            <section class="floating-card hud-summary-panel" id="hud-metrics">
              <div class="hud-summary-row">
                <span class="hud-metric-item">Budget <strong id="hud-budget">0</strong></span>
                <span class="hud-metric-item">Supply <strong id="hud-served">0</strong></span>
                <span class="hud-metric-item">Unmet <strong id="hud-unmet">0</strong></span>
                <span class="hud-metric-item">Reliability <strong id="hud-reliability">0%</strong></span>
                <span class="hud-metric-item">Score <strong id="hud-score">0</strong></span>
                <span class="hud-metric-item">Season <strong id="hud-season">neutral</strong></span>
                <span class="hud-metric-item">Lawsuits <strong id="hud-lawsuits">0</strong></span>
              </div>
              <div class="hud-summary-row">
                <span class="hud-metric-item">Zoom <strong id="hud-zoom">1.00x</strong></span>
                <span class="hud-metric-item">Pan <strong>Drag / WASD</strong></span>
                <span class="hud-metric-item">Resources <strong id="hud-resource-visibility">Hidden (hold R)</strong></span>
                <span class="hud-metric-item">Towns <strong id="hud-town-emergence">0 emerged</strong></span>
              </div>
              <div class="hud-summary-row">
                <span class="hud-metric-item">Substation Radius <strong id="hud-substation-radius">0</strong></span>
              </div>
            </section>
          </div>

          <div class="floating-group floating-bottom-center">
            <div class="floating-dock">
              <button
                class="asset-btn floating-dock-btn asset-icon-btn"
                data-asset="plant"
                data-plant-type="wind"
                data-testid="asset-plant"
                aria-label="Build wind plant (1)"
                title="Build wind plant (1)"
              >
                <img
                  class="asset-icon-image"
                  src="/assets/icons/circular/plant-wind.svg"
                  alt=""
                  aria-hidden="true"
                />
              </button>
              <button
                class="asset-btn floating-dock-btn asset-icon-btn"
                data-asset="plant"
                data-plant-type="sun"
                data-testid="asset-plant-solar"
                aria-label="Build solar plant"
                title="Build solar plant"
              >
                <img
                  class="asset-icon-image"
                  src="/assets/icons/circular/plant-solar.svg"
                  alt=""
                  aria-hidden="true"
                />
              </button>
              <button
                class="asset-btn floating-dock-btn asset-icon-btn"
                data-asset="plant"
                data-plant-type="natural_gas"
                data-testid="asset-plant-gas"
                aria-label="Build natural gas plant"
                title="Build natural gas plant"
              >
                <img
                  class="asset-icon-image"
                  src="/assets/icons/circular/plant-gas.svg"
                  alt=""
                  aria-hidden="true"
                />
              </button>
              <button
                class="asset-btn floating-dock-btn asset-icon-btn"
                data-asset="substation"
                data-testid="asset-substation"
                aria-label="Build substation (2)"
                title="Build substation (2)"
              >
                <img
                  class="asset-icon-image"
                  src="/assets/icons/circular/substation.svg"
                  alt=""
                  aria-hidden="true"
                />
              </button>
              <button
                class="asset-btn floating-dock-btn asset-icon-btn"
                data-asset="storage"
                data-testid="asset-storage"
                aria-label="Build storage (3)"
                title="Build storage (3)"
              >
                <span class="asset-icon-glyph asset-icon-glyph-storage" aria-hidden="true"></span>
              </button>
            </div>
          </div>

          <div class="floating-group floating-map-controls">
            <button class="floating-map-btn" id="run-zoom-in-btn" aria-label="Zoom in">+</button>
            <button class="floating-map-btn" id="run-zoom-out-btn" aria-label="Zoom out">-</button>
            <button class="floating-map-btn" id="run-center-btn" aria-label="Center map">Center</button>
            <button class="floating-map-btn" id="run-fullscreen-btn" aria-label="Toggle fullscreen">Full</button>
          </div>

          <div class="floating-group floating-bottom-right">
            <div class="ticker floating-ticker" id="news-ticker">${newsTickerText}</div>
          </div>
        </div>
      </section>
    `;
  }

  attachRunUiListeners() {
    this.root.querySelectorAll("[data-asset]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!this.runtime) return;
        this.runtime.tool = TOOL_BUILD;
        const selectedAsset = button.getAttribute("data-asset");
        this.runtime.buildAssetType = selectedAsset;
        if (selectedAsset === "plant") {
          const selectedPlantType = button.getAttribute("data-plant-type");
          if (selectedPlantType) {
            this.runtime.buildPlantType = this.runtime.normalizePlantType(selectedPlantType);
          }
        }
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
    const effectiveRunConfig = this.applyDevModeToRunConfig(runConfig);

    this.runtime = new GameRuntime({
      canvas,
      runConfig: effectiveRunConfig,
      settings: this.settings,
      callbacks: {
        onHud: (payload) => this.updateRunHud(payload),
        onRunEnd: (summary) => this.handleRunEnd(summary),
        onHighlightAlert: (alertId) => this.highlightAlert(alertId),
        onRequestDemolishConfirm: (payload) => this.showDemolishConfirm(payload),
        onDismissDemolishConfirm: () => this.clearDemolishConfirm(),
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
    const effectiveRunConfig = this.applyDevModeToRunConfig(snapshot.runConfig);
    const snapshotForRuntime = {
      ...snapshot,
      runConfig: effectiveRunConfig,
    };

    this.runtime = new GameRuntime({
      canvas,
      runConfig: effectiveRunConfig,
      snapshot: snapshot.gameState,
      settings: this.settings,
      callbacks: {
        onHud: (payload) => this.updateRunHud(payload),
        onRunEnd: (summary) => this.handleRunEnd(summary),
        onHighlightAlert: (alertId) => this.highlightAlert(alertId),
        onRequestDemolishConfirm: (payload) => this.showDemolishConfirm(payload),
        onDismissDemolishConfirm: () => this.clearDemolishConfirm(),
        onNews: (text) => {
          const ticker = this.root.querySelector("#news-ticker");
          if (ticker) ticker.textContent = text;
        },
      },
    });

    this.runtime.hydrateRuntimeState(snapshotForRuntime);
    this.runtime.start();
    this.attachRunUiListeners();
    this.suspendedRun = snapshotForRuntime;
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
    const substationRadiusNode = $("#hud-substation-radius");
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
    budgetNode.textContent = payload.devMode ? "INF" : Math.round(payload.budget).toString();
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
    if (substationRadiusNode) {
      substationRadiusNode.textContent = `${Math.round(payload.substationRadius || 0)}u`;
    }
    if (pauseNode) pauseNode.textContent = payload.paused ? "Resume" : "Pause";

    const assetButtons = this.root.querySelectorAll(".asset-btn");
    assetButtons.forEach((button) => {
      const assetType = button.getAttribute("data-asset");
      const plantType = button.getAttribute("data-plant-type");
      let isActive = payload.tool === TOOL_BUILD && assetType === payload.buildAssetType;
      if (isActive && assetType === "plant" && plantType) {
        isActive = plantType === payload.buildPlantType;
      }
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
  }

  highlightAlert(alertId) {
    this.root.querySelectorAll("#alert-list li").forEach((item) => {
      const active = item.getAttribute("data-alert-id") === alertId;
      item.classList.toggle("highlight", active);
    });
  }

  handleRunEnd(summary) {
    this.clearDemolishConfirm();
    this.runtime = null;

    this.suspendedRun = null;
    writeJsonStorage(STORAGE_KEYS.suspendedRun, null);

    if (summary.config.mode === "tutorial" && summary.result === "victory") {
      this.tutorialCompleted = true;
      writeJsonStorage(STORAGE_KEYS.tutorialCompleted, true);
    }

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
