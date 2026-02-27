import * as GameCore from "./core.js";
import { GameRuntime } from "./runtime.js";

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

const DEMOLITION_DURATION_SECONDS = 20;

function normalizeSignedValue(value, epsilon = 0.05) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.abs(numeric) < epsilon ? 0 : numeric;
}

function formatMw(value) {
  return `${normalizeSignedValue(value).toFixed(1)} MW`;
}

function formatSignedMw(value) {
  const normalized = normalizeSignedValue(value);
  const sign = normalized > 0 ? "+" : "";
  return `${sign}${normalized.toFixed(1)} MW`;
}

function formatSignedNumber(value) {
  const normalized = normalizeSignedValue(value);
  const sign = normalized > 0 ? "+" : "";
  return `${sign}${normalized.toFixed(1)}`;
}

function formatMwh(value) {
  return `${normalizeSignedValue(value).toFixed(1)} MWh`;
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
    const estimatedRefund = Math.max(0, Math.round(Number(payload.refund || 0)));
    const confirmDetail =
      typeof payload.confirmDetail === "string" && payload.confirmDetail.trim()
        ? payload.confirmDetail.trim()
        : `Completes in ${DEMOLITION_DURATION_SECONDS}s. Estimated refund: ${formatCompactMoney(
            estimatedRefund
          )}.`;

    const popover = document.createElement("div");
    popover.id = "demolish-confirm-popover";
    popover.className = `floating-group demolish-confirm${placeBelow ? " demolish-confirm-below" : ""}`;
    popover.style.left = `${x}px`;
    popover.style.top = `${y}px`;
    popover.innerHTML = `
      <p>Demolish ${payload.assetLabel}?</p>
      <p class="demolish-confirm-refund">
        ${confirmDetail}
      </p>
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
      const demolished = payload.lineId
        ? this.runtime?.confirmDemolishLine(payload.lineId)
        : this.runtime?.confirmDemolish(payload.regionId, payload.assetType);
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
          <p>Budget ${formatCompactMoney(preset.budget)} | Routing ${preset.routingComplexity}</p>
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
    const plantCost = Math.ceil(ASSET_RULES.plant?.cost ?? 0);
    const substationCost = Math.ceil(ASSET_RULES.substation?.cost ?? 0);
    const storageCost = Math.ceil(ASSET_RULES.storage?.cost ?? 0);
    const lineCostPer100px = Math.ceil((LINE_BASE_BUILD_COST_PER_WORLD_UNIT ?? 0) * 100);

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
            <button
              class="ghost-btn floating-btn floating-icon-btn"
              id="run-controls-btn"
              data-testid="run-controls-btn"
              aria-label="Show controls panel"
              aria-controls="run-controls-overlay"
              aria-expanded="false"
            >
              ?
            </button>
            <button class="ghost-btn floating-btn" id="run-pause-btn" aria-label="Pause simulation">❚❚</button>
            <button class="ghost-btn floating-btn" id="run-save-exit-btn">Save &amp; Exit</button>
          </div>

          <div
            class="floating-group floating-controls-overlay"
            id="run-controls-overlay"
            data-testid="run-controls-overlay"
            hidden
          >
            <section class="floating-controls-panel" role="dialog" aria-modal="true" aria-labelledby="run-controls-title">
              <header class="floating-controls-header">
                <h3 id="run-controls-title">Control Reference</h3>
                <button class="ghost-btn floating-btn floating-controls-close" id="run-controls-close-btn" aria-label="Close controls panel">
                  Close
                </button>
              </header>

              <p class="floating-controls-intro">
                Full command list for camera, build tools, and run operations.
              </p>

              <div class="controls-panel-grid">
                <section class="controls-panel-section">
                  <h4>Mouse</h4>
                  <ul class="controls-panel-list">
                    <li><kbd>Wheel</kbd><span>Zoom in and out (centered on cursor).</span></li>
                    <li><kbd>LMB</kbd><span>Select and apply the active tool.</span></li>
                    <li><kbd>LMB Drag</kbd><span>Pan the map.</span></li>
                    <li><kbd>RMB</kbd><span>Quick demolition interaction at cursor.</span></li>
                    <li><kbd>MMB</kbd><span>Pan the map.</span></li>
                    <li><kbd>Alt + LMB</kbd><span>Pan the map.</span></li>
                  </ul>
                </section>

                <section class="controls-panel-section">
                  <h4>Navigation + View</h4>
                  <ul class="controls-panel-list">
                    <li><kbd>W A S D</kbd><span>Pan camera.</span></li>
                    <li><kbd>Arrow Keys</kbd><span>Pan camera.</span></li>
                    <li><kbd>Space</kbd><span>Pause or resume simulation.</span></li>
                    <li><kbd>F</kbd><span>Toggle fullscreen.</span></li>
                    <li><kbd>Tab</kbd><span>Cycle highlighted critical alert.</span></li>
                    <li><kbd>Enter</kbd><span>Cycle highlighted critical alert.</span></li>
                  </ul>
                </section>

                <section class="controls-panel-section">
                  <h4>Build + Tools</h4>
                  <ul class="controls-panel-list">
                    <li><kbd>1</kbd><span>Select wind powerplant; press again to cycle plant types.</span></li>
                    <li><kbd>2</kbd><span>Select solar powerplant build tool.</span></li>
                    <li><kbd>3</kbd><span>Select gas powerplant build tool.</span></li>
                    <li><kbd>4</kbd><span>Select substation build tool.</span></li>
                    <li><kbd>5</kbd><span>Select storage build tool.</span></li>
                    <li><kbd>6 / L</kbd><span>Select long-range powerline tool.</span></li>
                    <li><kbd>E / B</kbd><span>Select reroute tool.</span></li>
                    <li><kbd>X</kbd><span>Select demolish tool.</span></li>
                    <li><kbd>R</kbd><span>Toggle resource layer.</span></li>
                    <li><kbd>Esc</kbd><span>Return to pan mode and clear selection.</span></li>
                  </ul>
                </section>
              </div>
            </section>
          </div>

          <section class="floating-group floating-objective floating-card">
            <h3 id="objective-title">Objective</h3>
            <p id="objective-text"></p>
            <div class="objective-progress"><span id="objective-progress-fill"></span></div>
            <p id="objective-detail" class="objective-detail"></p>
          </section>

          <section class="floating-group floating-selected-entity-popup floating-card" id="selected-entity-popup" hidden>
            <h3 id="selected-entity-popup-title">Location</h3>
            <p id="selected-entity-popup-kind"></p>
            <dl id="selected-entity-popup-metrics" class="selected-entity-popup-metrics"></dl>
          </section>

          <section class="floating-group floating-ops-panel floating-card">
            <h3>Operations Feed</h3>

            <div class="ops-panel-block">
              <h4>Alert Rail</h4>
              <ul id="alert-list" class="alert-list"></ul>
            </div>

            <div class="ops-panel-block">
              <h4>Incident Rail</h4>
              <ul id="incident-list" class="incident-list"></ul>
            </div>

            <div class="ops-panel-block">
              <h4>News</h4>
              <div class="ticker floating-ticker" id="news-ticker">${newsTickerText}</div>
            </div>
          </section>

          <div class="floating-group floating-bottom-left">
            <section class="floating-card hud-summary-panel" id="hud-metrics">
              <div class="hud-metric-card"><span class="hud-metric-label">Money</span><strong id="hud-budget">0</strong></div>
              <div class="hud-metric-card"><span class="hud-metric-label">Power Supply</span><strong id="hud-power-supply">0 MW</strong></div>
              <div class="hud-metric-card"><span class="hud-metric-label">Power Demand</span><strong id="hud-power-demand">0 MW</strong></div>
              <div class="hud-metric-card"><span class="hud-metric-label">Stored Power</span><strong id="hud-stored-power">0 MWh</strong></div>
              <div class="hud-metric-card"><span class="hud-metric-label">Reliability</span><strong id="hud-reliability">0%</strong></div>
              <div class="hud-metric-card"><span class="hud-metric-label">Score</span><strong id="hud-score">0</strong></div>
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
              >
                <img
                  class="asset-icon-image"
                  src="/assets/icons/circular/plant-wind.svg"
                  alt=""
                  aria-hidden="true"
                />
                <span class="dock-shortcut-chip" aria-hidden="true">1</span>
                <span class="dock-tooltip" aria-hidden="true">
                  <span class="dock-tooltip-title">Wind Plant</span>
                  <span class="dock-tooltip-price">Price ${plantCost}</span>
                </span>
              </button>
              <button
                class="asset-btn floating-dock-btn asset-icon-btn"
                data-asset="plant"
                data-plant-type="sun"
                data-testid="asset-plant-solar"
                aria-label="Build solar plant (2)"
              >
                <img
                  class="asset-icon-image"
                  src="/assets/icons/circular/plant-solar.svg"
                  alt=""
                  aria-hidden="true"
                />
                <span class="dock-shortcut-chip" aria-hidden="true">2</span>
                <span class="dock-tooltip" aria-hidden="true">
                  <span class="dock-tooltip-title">Solar Plant</span>
                  <span class="dock-tooltip-price">Price ${plantCost}</span>
                </span>
              </button>
              <button
                class="asset-btn floating-dock-btn asset-icon-btn"
                data-asset="plant"
                data-plant-type="natural_gas"
                data-testid="asset-plant-gas"
                aria-label="Build natural gas plant (3)"
              >
                <img
                  class="asset-icon-image"
                  src="/assets/icons/circular/plant-gas.svg"
                  alt=""
                  aria-hidden="true"
                />
                <span class="dock-shortcut-chip" aria-hidden="true">3</span>
                <span class="dock-tooltip" aria-hidden="true">
                  <span class="dock-tooltip-title">Gas Plant</span>
                  <span class="dock-tooltip-price">Price ${plantCost}</span>
                </span>
              </button>
              <button
                class="asset-btn floating-dock-btn asset-icon-btn"
                data-asset="substation"
                data-testid="asset-substation"
                aria-label="Build substation (4)"
              >
                <img
                  class="asset-icon-image"
                  src="/assets/icons/circular/substation.svg"
                  alt=""
                  aria-hidden="true"
                />
                <span class="dock-shortcut-chip" aria-hidden="true">4</span>
                <span class="dock-tooltip" aria-hidden="true">
                  <span class="dock-tooltip-title">Substation</span>
                  <span class="dock-tooltip-price">Price ${substationCost}</span>
                </span>
              </button>
              <button
                class="asset-btn floating-dock-btn asset-icon-btn"
                data-asset="storage"
                data-testid="asset-storage"
                aria-label="Build storage (5)"
              >
                <span class="asset-icon-glyph asset-icon-glyph-storage" aria-hidden="true"></span>
                <span class="dock-shortcut-chip" aria-hidden="true">5</span>
                <span class="dock-tooltip" aria-hidden="true">
                  <span class="dock-tooltip-title">Storage</span>
                  <span class="dock-tooltip-price">Price ${storageCost}</span>
                </span>
              </button>
              <button
                class="tool-btn floating-dock-btn asset-icon-btn"
                data-tool="line"
                data-testid="tool-powerlines"
                aria-label="Powerlines tool (6 / L)"
              >
                <img
                  class="asset-icon-image"
                  src="/assets/icons/circular/line-long-range.svg"
                  alt=""
                  aria-hidden="true"
                />
                <span class="dock-shortcut-chip" aria-hidden="true">6</span>
                <span class="dock-tooltip" aria-hidden="true">
                  <span class="dock-tooltip-title">Long-Range Powerline</span>
                  <span class="dock-tooltip-price">Price ${lineCostPer100px} / 100px (+10 / blue|white px)</span>
                </span>
              </button>
              <button
                class="tool-btn floating-dock-btn asset-icon-btn"
                data-tool="reroute"
                data-testid="tool-reroute"
                aria-label="Reroute tool (E)"
                title="Reroute tool (E)"
              >
                <img
                  class="asset-icon-image"
                  src="/assets/icons/circular/line-reroute.svg"
                  alt=""
                  aria-hidden="true"
                />
              </button>
              <button
                class="action-btn floating-dock-btn asset-icon-btn"
                id="run-clear-priority-btn"
                data-testid="action-clear-priority"
                aria-label="Clear all priority modifiers"
                title="Clear all priority modifiers"
              >
                <span class="asset-icon-glyph asset-icon-glyph-priority-clear" aria-hidden="true"></span>
                <span class="dock-tooltip" aria-hidden="true">
                  <span class="dock-tooltip-title">Clear Priority</span>
                  <span class="dock-tooltip-price">Reset all to nominal</span>
                </span>
              </button>
            </div>
          </div>

        </div>
      </section>
    `;
  }

  attachRunUiListeners() {
    const controlsButton = this.root.querySelector("#run-controls-btn");
    const controlsOverlay = this.root.querySelector("#run-controls-overlay");
    const controlsCloseButton = this.root.querySelector("#run-controls-close-btn");

    const setControlsOverlayOpen = (open) => {
      if (!controlsButton || !controlsOverlay) return;
      const isOpen = !!open;
      controlsOverlay.hidden = !isOpen;
      controlsButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
      controlsButton.setAttribute(
        "aria-label",
        isOpen ? "Hide controls panel" : "Show controls panel"
      );
    };

    setControlsOverlayOpen(false);

    controlsButton?.addEventListener("click", (event) => {
      event.preventDefault();
      setControlsOverlayOpen(controlsOverlay?.hidden);
    });

    controlsCloseButton?.addEventListener("click", (event) => {
      event.preventDefault();
      setControlsOverlayOpen(false);
    });

    controlsOverlay?.addEventListener("click", (event) => {
      if (event.target === controlsOverlay) {
        setControlsOverlayOpen(false);
      }
    });

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

    this.root.querySelectorAll("[data-tool]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!this.runtime) return;
        const selectedTool = button.getAttribute("data-tool");
        if (selectedTool === "line") {
          this.runtime.tool = TOOL_LINE;
        } else if (selectedTool === "reroute") {
          this.runtime.tool = TOOL_REROUTE;
        } else {
          return;
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

    this.root.querySelector("#run-clear-priority-btn")?.addEventListener("click", () => {
      if (!this.runtime) return;
      this.runtime.clearAllPriorityModifiers();
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
    const powerSupplyNode = $("#hud-power-supply");
    const reliabilityNode = $("#hud-reliability");
    const powerDemandNode = $("#hud-power-demand");
    const storedPowerNode = $("#hud-stored-power");
    const timerNode = $("#hud-timer");
    const scoreNode = $("#hud-score");
    const pauseNode = $("#run-pause-btn");
    const selectedPopupNode = $("#selected-entity-popup");
    const selectedPopupTitleNode = $("#selected-entity-popup-title");
    const selectedPopupKindNode = $("#selected-entity-popup-kind");
    const selectedPopupMetricsNode = $("#selected-entity-popup-metrics");

    if (
      !budgetNode ||
      !powerSupplyNode ||
      !reliabilityNode ||
      !powerDemandNode ||
      !storedPowerNode ||
      !timerNode ||
      !scoreNode
    ) {
      return;
    }

    if (runLabelNode) runLabelNode.textContent = payload.runLabel;
    budgetNode.textContent = payload.devMode ? "INF" : formatCompactMoney(payload.budget);
    const supplyDemandDelta = normalizeSignedValue(payload.powerSupply - payload.powerDemand);
    const supplyDemandClass =
      supplyDemandDelta > 0
        ? "is-positive"
        : supplyDemandDelta < 0
          ? "is-negative"
          : "";
    powerSupplyNode.innerHTML = `<span class="hud-metric-diff ${supplyDemandClass}">(${formatSignedNumber(
      supplyDemandDelta
    )})</span><span class="hud-metric-value">${payload.powerSupply.toFixed(1)} MW</span>`;
    reliabilityNode.textContent = `${payload.reliability.toFixed(1)}%`;
    powerDemandNode.textContent = `${payload.powerDemand.toFixed(1)} MW`;
    storedPowerNode.textContent = `${(payload.storedPowerMWh || 0).toFixed(1)} MWh`;
    timerNode.textContent = formatTime(payload.timer);
    scoreNode.textContent = Math.round(payload.score).toString();
    if (pauseNode) {
      const isPaused = !!payload.paused;
      pauseNode.textContent = isPaused ? "▶" : "❚❚";
      pauseNode.setAttribute("aria-label", isPaused ? "Resume simulation" : "Pause simulation");
    }

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

    const toolButtons = this.root.querySelectorAll(".tool-btn");
    toolButtons.forEach((button) => {
      const tool = button.getAttribute("data-tool");
      const isActive =
        (tool === "line" && payload.tool === TOOL_LINE) ||
        (tool === "reroute" && payload.tool === TOOL_REROUTE);
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

    if (
      selectedPopupNode &&
      selectedPopupTitleNode &&
      selectedPopupKindNode &&
      selectedPopupMetricsNode
    ) {
      const popup = payload.selectedEntityPopup;
      if (!popup) {
        selectedPopupNode.hidden = true;
      } else {
        selectedPopupNode.hidden = false;
        selectedPopupTitleNode.textContent = popup.name || "Location";
        selectedPopupKindNode.textContent = popup.kindLabel || "Structure";

        const popupWidth = 280;
        const popupHeight = 230;
        const targetX = clamp(Number(popup.anchorX || 0) + 26, 12, window.innerWidth - popupWidth - 12);
        const targetY = clamp(
          Number(popup.anchorY || 0) - popupHeight * 0.5,
          12,
          window.innerHeight - popupHeight - 12
        );
        selectedPopupNode.style.left = `${targetX}px`;
        selectedPopupNode.style.top = `${targetY}px`;

        const rows = [];
        const demandDiffClass = popup.powerInDiffMw > 0 ? "is-positive" : popup.powerInDiffMw < 0 ? "is-negative" : "";
        const supplyDiffClass = popup.powerOutDiffMw > 0 ? "is-positive" : popup.powerOutDiffMw < 0 ? "is-negative" : "";

        if (popup.showDemand) {
          if (!popup.isPowerplant) {
            rows.push(
              `<div class="selected-entity-popup-row"><dt>Total Demand</dt><dd>${formatMw(
                popup.totalDemandMw
              )}</dd></div>`
            );
          }
          rows.push(
            `<div class="selected-entity-popup-row"><dt>Power In</dt><dd>${formatMw(
              popup.powerInMw
            )} <span class="selected-entity-popup-diff ${demandDiffClass}">(${formatSignedMw(
              popup.powerInDiffMw
            )})</span></dd></div>`
          );
        }

        if (popup.showSupply) {
          rows.push(
            `<div class="selected-entity-popup-row"><dt>Total Supply</dt><dd>${formatMw(
              popup.totalSupplyMw
            )}</dd></div>`
          );
          rows.push(
            `<div class="selected-entity-popup-row"><dt>Power Out</dt><dd>${formatMw(
              popup.powerOutMw
            )} <span class="selected-entity-popup-diff ${supplyDiffClass}">(${formatSignedMw(
              popup.powerOutDiffMw
            )})</span></dd></div>`
          );
        }

        if (popup.showStored) {
          const capacityText = popup.storedCapacityMWh > 0 ? ` / ${formatMwh(popup.storedCapacityMWh)}` : "";
          rows.push(
            `<div class="selected-entity-popup-row"><dt>Power Stored</dt><dd>${formatMwh(
              popup.powerStoredMWh
            )}${capacityText}</dd></div>`
          );
        }

        if (!rows.length) {
          rows.push(
            '<div class="selected-entity-popup-empty">No active demand, supply, or storage at this location.</div>'
          );
        }
        selectedPopupMetricsNode.innerHTML = rows.join("");
      }
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
          <article><h3>Budget</h3><p>${formatCompactMoney(summary.budget)}</p></article>
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
