import {
  algorithmButtons,
  algorithmValue,
  canvas,
  clearZonesBtn,
  continentScaleSlider,
  continentScaleValue,
  floatingControls,
  exportBundleBtn,
  exportDisplayNameInput,
  exportMapIdInput,
  exportStatusValue,
  modeButtons,
  mountaintopSlider,
  mountaintopValue,
  panelSubtitle,
  panelTitle,
  panelToggleBtn,
  regenerateBtn,
  removeAllRiversBtn,
  riverReliefToggle,
  riverReliefValue,
  shadowEffectToggle,
  shadowEffectValue,
  shadowLengthRow,
  shadowLengthSlider,
  shadowLengthValue,
  peakLighteningRow,
  peakLighteningSlider,
  peakLighteningValue,
  prominenceThresholdRow,
  prominenceThresholdSlider,
  prominenceThresholdValue,
  shadowStrengthRow,
  shadowStrengthSlider,
  shadowStrengthValue,
  resourceControlsGroup,
  resourceDraftCountValue,
  resourceSnapValue,
  resourceStrengthSlider,
  resourceStrengthValue,
  resourceTypeSelect,
  resourceTypeValue,
  resourceZonesCountValue,
  resetRiversBtn,
  riversCountValue,
  seaLevelSlider,
  seaLevelValue,
  smoothnessSlider,
  smoothnessValue,
  statsValue,
  terrainControlsGroup,
  undoZoneBtn,
  seedValue,
  shorelineReliefToggle,
  shorelineReliefValue,
  ctx,
  visualEffectsControlsGroup,
} from "./lib/dom.js";
import {
  clamp,
  createMulberry32,
  fractalNoise,
  lerp,
  quantileFromArray,
  randomSeed,
  smoothstep01,
} from "./lib/math.js";
import { getResourceStyle, resourceTypeLabel } from "./lib/resource-zones.js";

const COLORS = {
  water: [68, 134, 195],
  river: [68, 134, 195],
  coastWater: [108, 173, 224],
  coastLand: [156, 170, 112],
  plains: [132, 190, 116],
  mountain: [204, 175, 136],
  mountaintop: [224, 226, 222],
};

const RIVER_DEFAULT_COUNT = Math.max(0, Math.round(Number(riversCountValue.textContent) || 6));
const RIVER_WIDTH_PX = 3;
const RIVER_ANIMATION_MS = 950;
const SOURCE_REMOVE_RADIUS_PX = 18;
const RESOURCE_REMOVE_RADIUS_PX = 14;
const RESOURCE_VERTEX_RENDER_RADIUS = 4;
const RESOURCE_VERTEX_SNAP_PX = 10;
const DELETE_PREVIEW_FILL = "rgba(255, 58, 58, 0.2)";
const DELETE_PREVIEW_STROKE = "rgba(255, 86, 86, 0.9)";
const DELETE_PREVIEW_STROKE_WIDTH = 2;
const VIEW_MIN_ZOOM = 0.25;
const VIEW_MAX_ZOOM = 5;
const VIEW_ZOOM_STEP = 1.14;
const VIEW_DRAG_THRESHOLD_PX = 6;
const VIEW_KEYPAN_SPEED_PX_PER_SEC = 700;
const VIEW_OVERPAN_SCREENS = 2;
const NEW_MAP_RESOURCE_ZONE_FRACTION = 0.05;
const NEW_MAP_RESOURCE_ZONE_STRENGTH = 70;
const NEW_MAP_RESOURCE_ZONE_TYPES = ["wind", "sun", "gas"];
const EXPORT_IMAGE_BASE_PATH = "/assets/maps/terrain";
const SHADOW_STRENGTH_MAX = Number(shadowStrengthSlider?.max || 200);
const SHADOW_DEFAULT_STRENGTH = Number(shadowStrengthSlider?.value || 22);
const SHADOW_DEFAULT_LENGTH = Number(shadowLengthSlider?.value || 120);
const SHADOW_DEFAULT_PEAK_LIGHTENING = Number(peakLighteningSlider?.value || 35);
const SHADOW_DEFAULT_PROMINENCE_THRESHOLD = Number(prominenceThresholdSlider?.value || 8);
const SHADOW_LIGHT_DIRECTION = Object.freeze((() => {
  const rawX = -0.72;
  const rawY = -0.72;
  const rawZ = 0.9;
  const invLen = 1 / Math.sqrt((rawX * rawX) + (rawY * rawY) + (rawZ * rawZ));
  return { x: rawX * invLen, y: rawY * invLen, z: rawZ * invLen };
})());
const SHADOW_CAST_DIRECTION = Object.freeze((() => {
  const rawX = 1;
  const rawY = 1;
  const invLen = 1 / Math.sqrt((rawX * rawX) + (rawY * rawY));
  return { x: rawX * invLen, y: rawY * invLen };
})());
const SHADOW_NORMAL_SCALE = 3.2;
const SHADOW_DIRECTIONAL_MAX = 0.2;
const SHADOW_CAST_MAX = 0.24;
const SHADOW_PEAK_MAX = 0.18;
const SHADOW_PROMINENCE_BLUR_PASSES = 4;
const SHADOW_MAX_CASTERS = 2400;
const TERRAIN_CLASS = Object.freeze({
  SEA: 0,
  PLAINS: 1,
  MOUNTAIN: 2,
  SNOWCAP: 3,
});
const SNOWCAP_BORDER_BLEND_RATIO = 0.5;
const SNOWCAP_BORDER_DITHER_FRACTION = 0.5;

const state = {
  seed: randomSeed(),
  riverSeed: randomSeed(),
  editorMode: "terrain",
  algorithm: "topology",
  riverCount: RIVER_DEFAULT_COUNT,
  controlsCollapsed: false,
  visualEffects: {
    shorelineRelief: true,
    riverRelief: true,
    shadowEffect: false,
    shadowStrength: clamp(SHADOW_DEFAULT_STRENGTH, 0, SHADOW_STRENGTH_MAX),
    shadowLength: clamp(SHADOW_DEFAULT_LENGTH, 20, 260),
    peakLightening: clamp(SHADOW_DEFAULT_PEAK_LIGHTENING, 0, 100),
    prominenceThreshold: clamp(SHADOW_DEFAULT_PROMINENCE_THRESHOLD, 1, 35),
  },
  resourceZones: [],
  resourceDraftVertices: [],
  manualRiverSources: [],
  suppressedRiverSources: [],
  renderToken: 0,
  animationFrameId: 0,
  currentOutput: null,
  lastRaster: null,
  deletePreview: {
    active: false,
    clientX: 0,
    clientY: 0,
  },
  view: {
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    pointerDown: false,
    isPanning: false,
    pointerStartX: 0,
    pointerStartY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    keyPan: {
      up: false,
      down: false,
      left: false,
      right: false,
      frameId: 0,
      lastTs: 0,
    },
  },
};

let resizeTimer = 0;
let sliderTimer = 0;

function clearPendingSliderRegenerate() {
  if (!sliderTimer) return;
  window.clearTimeout(sliderTimer);
  sliderTimer = 0;
}

function normalizeMapId(rawValue) {
  const normalized = String(rawValue || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `terrain-map-${state.seed}`;
}

function mapIdToDisplayName(mapId) {
  const words = String(mapId || "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  if (!words.length) return `Terrain Map ${state.seed}`;
  return words.join(" ");
}

function mapResourceTypeToSpec(resourceType) {
  if (resourceType === "gas") return "natural_gas";
  if (resourceType === "sun") return "sun";
  return "wind";
}

function normalizedVerticesToPixelPolygon(vertices, width, height) {
  return vertices.map((vertex) => ({
    x: clamp(Math.round(vertex.nx * Math.max(1, width - 1)), 0, width - 1),
    y: clamp(Math.round(vertex.ny * Math.max(1, height - 1)), 0, height - 1),
  }));
}

function buildExportResourceZones(width, height) {
  const typeCounters = {
    wind: 0,
    sun: 0,
    natural_gas: 0,
  };
  const zones = [];

  for (let i = 0; i < state.resourceZones.length; i += 1) {
    const zone = state.resourceZones[i];
    if (!zone.vertices || zone.vertices.length < 3) continue;

    const resource = mapResourceTypeToSpec(zone.type);
    typeCounters[resource] += 1;
    const zoneOrdinal = typeCounters[resource];
    const idResource = resource.replace(/_/g, "-");

    zones.push({
      id: `rz-${idResource}-${zoneOrdinal}`,
      resource,
      polygon: normalizedVerticesToPixelPolygon(zone.vertices, width, height),
    });
  }

  return zones;
}

function buildExportDocuments(mapId, displayName, output) {
  const metadataFileName = `${mapId}.metadata.json`;
  const imageFileName = `${mapId}.png`;
  const imageUrl = `${EXPORT_IMAGE_BASE_PATH}/${imageFileName}`;
  const resourceZones = buildExportResourceZones(output.width, output.height);

  const metadata = {
    map_id: mapId,
    display_name: displayName,
    image: {
      file: imageUrl,
      width: output.width,
      height: output.height,
    },
    terrain_generation: {
      algorithm: state.algorithm,
      seed: state.seed,
      river_seed: state.riverSeed,
    },
    towns: [],
    coordinate_system: {
      origin: "top-left",
      x_axis: "right",
      y_axis: "down",
      units: "pixels",
    },
    resource_zones: resourceZones,
  };

  return {
    metadata,
    fileNames: {
      metadata: metadataFileName,
      image: imageFileName,
    },
  };
}

function triggerDownload(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function setExportStatus(message, isError = false) {
  if (!exportStatusValue) return;
  exportStatusValue.textContent = message;
  exportStatusValue.classList.toggle("is-error", isError);
}

function initializeExportFields() {
  if (!exportMapIdInput || !exportDisplayNameInput) return;
  if (!exportMapIdInput.value.trim()) {
    exportMapIdInput.value = normalizeMapId("");
  }
  if (!exportDisplayNameInput.value.trim()) {
    exportDisplayNameInput.value = mapIdToDisplayName(exportMapIdInput.value.trim());
  }
}

function getExportContext() {
  if (!state.currentOutput || !state.lastRaster) {
    throw new Error("No map rendered yet");
  }

  const mapId = normalizeMapId(exportMapIdInput?.value);
  const displayNameInput = String(exportDisplayNameInput?.value || "").trim();
  const displayName = displayNameInput || mapIdToDisplayName(mapId);

  if (exportMapIdInput) exportMapIdInput.value = mapId;
  if (exportDisplayNameInput && !displayNameInput) {
    exportDisplayNameInput.value = displayName;
  }

  const { metadata, fileNames } = buildExportDocuments(
    mapId,
    displayName,
    state.currentOutput
  );

  return {
    metadata,
    fileNames,
  };
}

async function exportCurrentMapPng(fileName) {
  if (!state.lastRaster) {
    throw new Error("No map raster available");
  }

  const pngBlob = await new Promise((resolve, reject) => {
    state.lastRaster.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not serialize map PNG"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });

  triggerDownload(pngBlob, fileName);
}

async function exportMetadataJsonFile(fileName) {
  const { metadata, fileNames } = getExportContext();
  const targetName = fileName || fileNames.metadata;
  triggerDownload(
    new Blob([`${JSON.stringify(metadata, null, 2)}\n`], { type: "application/json" }),
    targetName
  );
}

async function exportBundle() {
  const { fileNames } = getExportContext();
  setExportStatus("Exporting...");
  await exportMetadataJsonFile(fileNames.metadata);
  await exportCurrentMapPng(fileNames.image);
  setExportStatus(`Exported ${fileNames.image} + ${fileNames.metadata}`);
}

function blurHeightField(source, width, height, passes) {
  let field = source;

  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(field.length);

    for (let y = 0; y < height; y += 1) {
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(height - 1, y + 1);

      for (let x = 0; x < width; x += 1) {
        const x0 = Math.max(0, x - 1);
        const x1 = Math.min(width - 1, x + 1);

        let sum = 0;
        let count = 0;
        for (let yy = y0; yy <= y1; yy += 1) {
          const row = yy * width;
          for (let xx = x0; xx <= x1; xx += 1) {
            sum += field[row + xx];
            count += 1;
          }
        }

        next[(y * width) + x] = sum / count;
      }
    }

    field = next;
  }

  return field;
}

function blurHeightFieldMasked(source, includeMask, width, height, passes) {
  let field = new Float32Array(source);

  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(field.length);

    for (let y = 0; y < height; y += 1) {
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(height - 1, y + 1);

      for (let x = 0; x < width; x += 1) {
        const idx = (y * width) + x;
        if (includeMask[idx] === 0) {
          next[idx] = field[idx];
          continue;
        }

        const x0 = Math.max(0, x - 1);
        const x1 = Math.min(width - 1, x + 1);
        let sum = 0;
        let count = 0;

        for (let yy = y0; yy <= y1; yy += 1) {
          const row = yy * width;
          for (let xx = x0; xx <= x1; xx += 1) {
            const nIdx = row + xx;
            if (includeMask[nIdx] === 0) continue;
            sum += field[nIdx];
            count += 1;
          }
        }

        next[idx] = count > 0 ? (sum / count) : field[idx];
      }
    }

    field = next;
  }

  return field;
}

function normalizeHeightField(source) {
  if (!source || source.length === 0) {
    return new Float32Array(0);
  }

  let minValue = Infinity;
  let maxValue = -Infinity;
  for (let i = 0; i < source.length; i += 1) {
    const value = source[i];
    if (value < minValue) minValue = value;
    if (value > maxValue) maxValue = value;
  }

  const range = maxValue - minValue;
  if (!Number.isFinite(range) || range < 1e-9) {
    const flat = new Float32Array(source.length);
    flat.fill(0.5);
    return flat;
  }

  const invRange = 1 / range;
  const normalized = new Float32Array(source.length);
  for (let i = 0; i < source.length; i += 1) {
    normalized[i] = (source[i] - minValue) * invRange;
  }

  return normalized;
}

function hash01FromUint(input) {
  let x = (input >>> 0);
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x / 4294967295;
}

function computePolygonAreaPx(points) {
  if (!points || points.length < 3) return 0;
  let twiceArea = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[j];
    const b = points[i];
    twiceArea += (a.x * b.y) - (b.x * a.y);
  }
  return Math.abs(twiceArea) * 0.5;
}

function buildSeededResourcePolygonVertices(
  rand,
  width,
  height,
  centerX,
  centerY,
  targetAreaPx
) {
  const vertexCount = 8 + Math.floor(rand() * 4);
  const angleOffset = rand() * Math.PI * 2;
  const baseRadius = Math.sqrt(targetAreaPx / Math.PI);
  const angleJitterMax = (Math.PI * 2 / vertexCount) * 0.34;
  const points = [];

  for (let i = 0; i < vertexCount; i += 1) {
    const baseAngle = angleOffset + ((i / vertexCount) * Math.PI * 2);
    const angle = baseAngle + (((rand() * 2) - 1) * angleJitterMax);
    const radius = baseRadius * lerp(0.78, 1.2, rand());
    points.push({
      x: centerX + (Math.cos(angle) * radius),
      y: centerY + (Math.sin(angle) * radius),
    });
  }

  const area = computePolygonAreaPx(points);
  if (area > 0) {
    const areaScale = clamp(Math.sqrt(targetAreaPx / area), 0.72, 1.42);
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      p.x = centerX + ((p.x - centerX) * areaScale);
      p.y = centerY + ((p.y - centerY) * areaScale);
    }
  }

  const edgePadding = 2;
  return points.map((point) => ({
    nx: clamp(
      clamp(point.x, edgePadding, (width - 1) - edgePadding) / Math.max(1, width - 1),
      0,
      1
    ),
    ny: clamp(
      clamp(point.y, edgePadding, (height - 1) - edgePadding) / Math.max(1, height - 1),
      0,
      1
    ),
  }));
}

function generateSeededResourceZones(width, height, seed) {
  const rand = createMulberry32((seed ^ 0x6a09e667) >>> 0);
  const targetAreaPx = Math.max(1, width * height * NEW_MAP_RESOURCE_ZONE_FRACTION);
  const targetRadius = Math.sqrt(targetAreaPx / Math.PI);
  const minCenterMargin = Math.max(12, targetRadius * 1.25);
  const placedCenters = [];

  return NEW_MAP_RESOURCE_ZONE_TYPES.map((type) => {
    let chosenCenter = null;
    let bestFallbackCenter = null;
    let bestFallbackDistance = -Infinity;

    for (let attempt = 0; attempt < 160; attempt += 1) {
      const xMin = minCenterMargin;
      const xMax = (width - 1) - minCenterMargin;
      const yMin = minCenterMargin;
      const yMax = (height - 1) - minCenterMargin;

      const cx = xMax > xMin ? lerp(xMin, xMax, rand()) : lerp(0, width - 1, rand());
      const cy = yMax > yMin ? lerp(yMin, yMax, rand()) : lerp(0, height - 1, rand());

      let nearestDistance = Infinity;
      for (let i = 0; i < placedCenters.length; i += 1) {
        const prev = placedCenters[i];
        const dx = prev.x - cx;
        const dy = prev.y - cy;
        nearestDistance = Math.min(nearestDistance, Math.sqrt((dx * dx) + (dy * dy)));
      }

      if (placedCenters.length === 0 || nearestDistance >= (targetRadius * 1.35) || attempt > 120) {
        chosenCenter = { x: cx, y: cy };
        break;
      }

      if (nearestDistance > bestFallbackDistance) {
        bestFallbackDistance = nearestDistance;
        bestFallbackCenter = { x: cx, y: cy };
      }
    }

    if (!chosenCenter) {
      chosenCenter = bestFallbackCenter || {
        x: lerp(0, width - 1, rand()),
        y: lerp(0, height - 1, rand()),
      };
    }

    placedCenters.push(chosenCenter);

    return {
      type,
      strength: NEW_MAP_RESOURCE_ZONE_STRENGTH,
      vertices: buildSeededResourcePolygonVertices(
        rand,
        width,
        height,
        chosenCenter.x,
        chosenCenter.y,
        targetAreaPx
      ),
    };
  });
}

function buildHeightFieldTopology(width, height, seed, smoothness, continentScalePercent = 100) {
  const smoothnessNorm = clamp(smoothness / 100, 0, 1);
  const continentScale = clamp(continentScalePercent / 100, 0.5, 2);
  const heights = new Float32Array(width * height);

  const warpStrength = lerp(0.12, 0.035, smoothnessNorm);
  const macroFreq = lerp(3.8, 2.1, smoothnessNorm);
  const detailFreq = lerp(9.8, 4.4, smoothnessNorm);
  const ridgeFreq = lerp(12.4, 6.2, smoothnessNorm);
  const detailWeight = lerp(0.15, 0.06, smoothnessNorm);
  const ridgeWeight = lerp(0.16, 0.09, smoothnessNorm);

  for (let y = 0; y < height; y += 1) {
    const ny = y / Math.max(1, height - 1);

    for (let x = 0; x < width; x += 1) {
      const nx = x / Math.max(1, width - 1);

      const warpX =
        warpStrength * fractalNoise((nx * 2.1) + 5.17, (ny * 2.1) - 3.47, seed ^ 0x0f0f0f0f, 4);
      const warpY =
        warpStrength * fractalNoise((nx * 2.2) - 8.91, (ny * 2.0) + 6.13, seed ^ 0xabcdef01, 4);

      const wx = nx + warpX;
      const wy = ny + warpY;

      const lowWx = ((wx - 0.52) * continentScale) + 0.52;
      const lowWy = ((wy - 0.53) * continentScale) + 0.53;

      const dx = (lowWx - 0.52) / 0.8;
      const dy = (lowWy - 0.53) / 0.66;
      const radial = Math.sqrt((dx * dx) + (dy * dy));

      let continent = 1 - radial;
      continent += 0.19 * Math.sin((lowWx * 4.6) + (lowWy * 2.3));
      continent += 0.14 * Math.sin((lowWx * 2.1) - (lowWy * 3.9));
      continent += 0.11 * fractalNoise(lowWx * 1.8, lowWy * 1.8, seed ^ 0x001f1f1f, 3);
      continent = clamp(continent, -1, 1);

      const macro = fractalNoise(
        lowWx * macroFreq,
        lowWy * macroFreq,
        seed ^ 0x001a2b3c,
        5
      );
      const detail = fractalNoise(wx * detailFreq, wy * detailFreq, seed ^ 0x004d5e6f, 4);
      const ridge = 1 - Math.abs(fractalNoise(wx * ridgeFreq, wy * ridgeFreq, seed ^ 0x00778899, 3));

      let value = 0.52;
      value += continent * 0.33;
      value += macro * 0.24;
      value += detail * detailWeight;
      value += (ridge - 0.5) * ridgeWeight;

      heights[(y * width) + x] = value;
    }
  }

  const blurPasses = Math.round(lerp(0, 4, smoothnessNorm));
  const filteredHeights = blurPasses > 0
    ? blurHeightField(heights, width, height, blurPasses)
    : heights;
  return normalizeHeightField(filteredHeights);
}

function buildHeightFieldMidpoint(width, height, seed, smoothness, continentScalePercent = 100) {
  const smoothnessNorm = clamp(smoothness / 100, 0, 1);
  const continentScale = clamp(continentScalePercent / 100, 0.5, 2);
  const maxDim = Math.max(width, height);
  let side = 1;
  while (side < maxDim - 1) {
    side *= 2;
  }
  side += 1;

  const grid = new Float32Array(side * side);
  const rand = createMulberry32(seed);
  const index = (x, y) => (y * side) + x;
  const randomSigned = () => (rand() * 2) - 1;

  grid[index(0, 0)] = rand();
  grid[index(side - 1, 0)] = rand();
  grid[index(0, side - 1)] = rand();
  grid[index(side - 1, side - 1)] = rand();

  let step = side - 1;
  let amplitude = lerp(0.95, 0.48, smoothnessNorm);
  const roughness = lerp(0.78, 0.5, smoothnessNorm);

  while (step > 1) {
    const half = step / 2;

    // Diamond step.
    for (let y = half; y < side - 1; y += step) {
      for (let x = half; x < side - 1; x += step) {
        const a = grid[index(x - half, y - half)];
        const b = grid[index(x + half, y - half)];
        const c = grid[index(x - half, y + half)];
        const d = grid[index(x + half, y + half)];
        const avg = (a + b + c + d) * 0.25;
        grid[index(x, y)] = avg + (randomSigned() * amplitude);
      }
    }

    // Square step.
    for (let y = 0; y < side; y += half) {
      for (let x = (y + half) % step; x < side; x += step) {
        let sum = 0;
        let count = 0;

        if (x - half >= 0) {
          sum += grid[index(x - half, y)];
          count += 1;
        }
        if (x + half < side) {
          sum += grid[index(x + half, y)];
          count += 1;
        }
        if (y - half >= 0) {
          sum += grid[index(x, y - half)];
          count += 1;
        }
        if (y + half < side) {
          sum += grid[index(x, y + half)];
          count += 1;
        }

        const avg = count > 0 ? sum / count : 0.5;
        grid[index(x, y)] = avg + (randomSigned() * amplitude);
      }
    }

    step = half;
    amplitude *= roughness;
  }

  // Bilinear sample to requested raster size.
  const heights = new Float32Array(width * height);
  const maxSrc = side - 1;
  for (let y = 0; y < height; y += 1) {
    const v = (y / Math.max(1, height - 1)) * maxSrc;
    const y0 = Math.floor(v);
    const y1 = Math.min(maxSrc, y0 + 1);
    const ty = v - y0;

    for (let x = 0; x < width; x += 1) {
      const u = (x / Math.max(1, width - 1)) * maxSrc;
      const x0 = Math.floor(u);
      const x1 = Math.min(maxSrc, x0 + 1);
      const tx = u - x0;

      const p00 = grid[index(x0, y0)];
      const p10 = grid[index(x1, y0)];
      const p01 = grid[index(x0, y1)];
      const p11 = grid[index(x1, y1)];
      const i0 = lerp(p00, p10, tx);
      const i1 = lerp(p01, p11, tx);
      heights[(y * width) + x] = lerp(i0, i1, ty);
    }
  }

  // Apply low-frequency continent shaping so Continent Scale also affects midpoint generation.
  const macroFreq = lerp(3.6, 2.0, smoothnessNorm);
  for (let y = 0; y < height; y += 1) {
    const ny = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const nx = x / Math.max(1, width - 1);
      const idx = (y * width) + x;

      const lowNx = ((nx - 0.52) * continentScale) + 0.52;
      const lowNy = ((ny - 0.53) * continentScale) + 0.53;

      const dx = (lowNx - 0.52) / 0.82;
      const dy = (lowNy - 0.53) / 0.68;
      const radial = Math.sqrt((dx * dx) + (dy * dy));

      let continent = 1 - radial;
      continent += 0.17 * Math.sin((lowNx * 4.2) + (lowNy * 2.4));
      continent += 0.12 * Math.sin((lowNx * 2.3) - (lowNy * 3.4));
      continent += 0.1 * fractalNoise(lowNx * 1.7, lowNy * 1.7, seed ^ 0x13579bdf, 3);
      continent = clamp(continent, -1, 1);

      const macro = fractalNoise(lowNx * macroFreq, lowNy * macroFreq, seed ^ 0x2468ace0, 4);

      let value = heights[idx];
      value += continent * 0.22;
      value += macro * 0.14;
      heights[idx] = value;
    }
  }

  const blurPasses = Math.round(lerp(0, 5, smoothnessNorm));
  const filteredHeights = blurPasses > 0
    ? blurHeightField(heights, width, height, blurPasses)
    : heights;
  return normalizeHeightField(filteredHeights);
}

function buildHeightField(width, height, seed, smoothness, algorithm, continentScalePercent = 100) {
  if (algorithm === "midpoint") {
    return buildHeightFieldMidpoint(width, height, seed, smoothness, continentScalePercent);
  }
  return buildHeightFieldTopology(width, height, seed, smoothness, continentScalePercent);
}

function buildSlopeField(heights, width, height) {
  const slopes = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width) + x;

      const left = heights[x > 0 ? idx - 1 : idx];
      const right = heights[x < width - 1 ? idx + 1 : idx];
      const up = heights[y > 0 ? idx - width : idx];
      const down = heights[y < height - 1 ? idx + width : idx];

      const gx = right - left;
      const gy = down - up;
      slopes[idx] = Math.sqrt((gx * gx) + (gy * gy)) * 0.5;
    }
  }

  return slopes;
}

function findNeighborFlowTargets(
  heights,
  width,
  height,
  x,
  y,
  currentHeight,
  visitStamp,
  branchId
) {
  let lowerCount = 0;
  let lowestIdx = -1;
  let lowestHeight = Infinity;
  let lowestAnyIdx = -1;
  let lowestAnyHeight = Infinity;

  const y0 = Math.max(0, y - 1);
  const y1 = Math.min(height - 1, y + 1);
  const x0 = Math.max(0, x - 1);
  const x1 = Math.min(width - 1, x + 1);

  for (let yy = y0; yy <= y1; yy += 1) {
    const row = yy * width;
    for (let xx = x0; xx <= x1; xx += 1) {
      if (xx === x && yy === y) continue;

      const idx = row + xx;
      const neighborHeight = heights[idx];
      if (visitStamp && visitStamp[idx] === branchId) continue;

      if (neighborHeight < lowestAnyHeight) {
        lowestAnyHeight = neighborHeight;
        lowestAnyIdx = idx;
      }

      if (neighborHeight >= currentHeight - 1e-6) continue;

      lowerCount += 1;
      if (neighborHeight < lowestHeight) {
        lowestHeight = neighborHeight;
        lowestIdx = idx;
      }
    }
  }

  return {
    lowerCount,
    lowestIdx,
    lowestAnyIdx,
  };
}

function hasNearbySource(sourceMask, width, height, x, y, minDistance) {
  const radius = Math.max(1, Math.round(minDistance));
  const radiusSq = radius * radius;
  const y0 = Math.max(0, y - radius);
  const y1 = Math.min(height - 1, y + radius);
  const x0 = Math.max(0, x - radius);
  const x1 = Math.min(width - 1, x + radius);

  for (let yy = y0; yy <= y1; yy += 1) {
    const row = yy * width;
    const dy = yy - y;
    for (let xx = x0; xx <= x1; xx += 1) {
      const dx = xx - x;
      if ((dx * dx) + (dy * dy) > radiusSq) continue;
      if (sourceMask[row + xx]) return true;
    }
  }

  return false;
}

function stampCircle(mask, width, height, cx, cy, radius, arrivalStepField, stepValue) {
  const y0 = Math.max(0, cy - radius);
  const y1 = Math.min(height - 1, cy + radius);
  const x0 = Math.max(0, cx - radius);
  const x1 = Math.min(width - 1, cx + radius);
  const radiusSq = radius * radius;

  for (let y = y0; y <= y1; y += 1) {
    const dy = y - cy;
    const row = y * width;
    for (let x = x0; x <= x1; x += 1) {
      const dx = x - cx;
      if ((dx * dx) + (dy * dy) <= radiusSq) {
        const idx = row + x;
        mask[idx] = 1;
        if (arrivalStepField && stepValue > 0) {
          const current = arrivalStepField[idx];
          if (current === 0 || stepValue < current) {
            arrivalStepField[idx] = stepValue;
          }
        }
      }
    }
  }
}

function buildRiverMask(
  heights,
  width,
  height,
  seaLevel,
  riverCount,
  riverSeed,
  manualSourceIndices = [],
  blockedSourceIndices = [],
  animateNewestSourceOnly = false
) {
  const targetAutoSources = Math.max(0, Math.round(riverCount));
  const riverMask = new Uint8Array(width * height);
  const riverArrivalStep = new Uint32Array(width * height);
  const newRiverMask = new Uint8Array(width * height);
  const newRiverArrivalStep = new Uint32Array(width * height);
  const mouthMask = new Uint8Array(width * height);

  if (targetAutoSources === 0 && manualSourceIndices.length === 0) {
    return {
      riverMask,
      riverArrivalStep,
      newRiverMask,
      newRiverArrivalStep,
      maxArrivalStep: 1,
      newRiverMaxArrivalStep: 1,
      hasNewRiverAnimation: false,
      sourceCells: [],
      mouthCells: [],
      sourceCount: 0,
      riverPixels: 0,
    };
  }

  const seedSalt =
    (riverSeed ^
      0x52f18e33) >>> 0;
  const rand = createMulberry32(seedSalt);

  const sourceMask = new Uint8Array(width * height);
  const blockedSourceMask = new Uint8Array(width * height);
  const spineMask = new Uint8Array(width * height);
  const orderedSpineCells = [];
  const orderedSpineOwners = [];
  const autoSources = [];

  const blockedRadius = Math.max(4, SOURCE_REMOVE_RADIUS_PX);
  for (let i = 0; i < blockedSourceIndices.length; i += 1) {
    const idx = blockedSourceIndices[i];
    if (!Number.isInteger(idx) || idx < 0 || idx >= heights.length) continue;
    const x = idx % width;
    const y = Math.floor(idx / width);
    stampCircle(blockedSourceMask, width, height, x, y, blockedRadius, null, 0);
  }

  const minSourceSpacing = Math.max(8, Math.round(Math.min(width, height) * 0.04));
  const maxSourceAttempts = Math.max(300, targetAutoSources * 240);
  const sourceMinRise = 0.04;
  let autoSourcesAdded = 0;

  for (let attempt = 0; attempt < maxSourceAttempts && autoSourcesAdded < targetAutoSources; attempt += 1) {
    const x = Math.floor(rand() * width);
    const y = Math.floor(rand() * height);
    const idx = (y * width) + x;
    const h = heights[idx];
    const minRise = attempt < Math.floor(maxSourceAttempts * 0.7) ? sourceMinRise : 0;

    if (blockedSourceMask[idx]) continue;
    if (h <= seaLevel + minRise) continue;
    if (hasNearbySource(sourceMask, width, height, x, y, minSourceSpacing)) continue;

    const neighbors = findNeighborFlowTargets(heights, width, height, x, y, h);
    if (neighbors.lowerCount === 0 || neighbors.lowestIdx < 0) continue;

    autoSources.push(idx);
    sourceMask[idx] = 1;
    autoSourcesAdded += 1;
  }

  const validManualSources = [];
  const manualSeen = new Set();
  for (let i = 0; i < manualSourceIndices.length; i += 1) {
    const idx = manualSourceIndices[i];
    if (!Number.isInteger(idx) || idx < 0 || idx >= heights.length) continue;
    if (blockedSourceMask[idx]) continue;
    if (heights[idx] <= seaLevel || manualSeen.has(idx)) continue;
    manualSeen.add(idx);
    validManualSources.push(idx);
  }

  const sources = autoSources.slice();
  const sourceSet = new Set(sources);
  for (let i = 0; i < validManualSources.length; i += 1) {
    const idx = validManualSources[i];
    if (sourceSet.has(idx)) continue;
    sourceSet.add(idx);
    sources.push(idx);
  }

  if (sources.length === 0) {
    return {
      riverMask,
      riverArrivalStep,
      newRiverMask,
      newRiverArrivalStep,
      maxArrivalStep: 1,
      newRiverMaxArrivalStep: 1,
      hasNewRiverAnimation: false,
      sourceCells: [],
      mouthCells: [],
      sourceCount: 0,
      riverPixels: 0,
    };
  }

  let newestSourceId = -1;
  if (animateNewestSourceOnly && validManualSources.length > 0) {
    const newestManualSource = validManualSources[validManualSources.length - 1];
    newestSourceId = sources.indexOf(newestManualSource);
  }

  const stack = sources.map((idx, sourceId) => ({ idx, sourceId }));
  const maxStepsPerBranch = Math.max(140, Math.round((width + height) * 3.2));
  const visitStamp = new Uint32Array(width * height);
  let branchId = 1;

  while (stack.length > 0) {
    const branch = stack.pop();
    const sourceId = branch.sourceId;
    let current = branch.idx;
    let steps = 0;
    branchId += 1;

    while (steps < maxStepsPerBranch) {
      const h = heights[current];
      if (h <= seaLevel) break;

      if (!spineMask[current]) {
        spineMask[current] = 1;
        orderedSpineCells.push(current);
        orderedSpineOwners.push(sourceId);
      }

      visitStamp[current] = branchId;

      const x = current % width;
      const y = Math.floor(current / width);
      const neighbors = findNeighborFlowTargets(
        heights,
        width,
        height,
        x,
        y,
        h,
        visitStamp,
        branchId
      );

      let primaryIdx = neighbors.lowestIdx;
      if (primaryIdx < 0) {
        primaryIdx = neighbors.lowestAnyIdx;
      }

      if (primaryIdx < 0) {
        mouthMask[current] = 1;
        break;
      }

      if (heights[primaryIdx] <= seaLevel) {
        mouthMask[current] = 1;
        break;
      }

      if (spineMask[primaryIdx]) {
        break;
      }

      current = primaryIdx;
      steps += 1;
    }
  }

  const riverRadius = Math.max(1, Math.floor(RIVER_WIDTH_PX / 2));
  let newRiverStep = 0;
  for (let i = 0; i < orderedSpineCells.length; i += 1) {
    const idx = orderedSpineCells[i];
    const x = idx % width;
    const y = Math.floor(idx / width);
    stampCircle(riverMask, width, height, x, y, riverRadius, riverArrivalStep, i + 1);

    if (orderedSpineOwners[i] === newestSourceId) {
      newRiverStep += 1;
      stampCircle(newRiverMask, width, height, x, y, riverRadius, newRiverArrivalStep, newRiverStep);
    }
  }

  let riverPixels = 0;
  for (let i = 0; i < riverMask.length; i += 1) {
    if (riverMask[i] && heights[i] > seaLevel) {
      riverPixels += 1;
    }
  }

  const mouthCells = [];
  for (let i = 0; i < mouthMask.length; i += 1) {
    if (mouthMask[i]) {
      mouthCells.push(i);
    }
  }

  return {
    riverMask,
    riverArrivalStep,
    newRiverMask,
    newRiverArrivalStep,
    maxArrivalStep: Math.max(1, orderedSpineCells.length),
    newRiverMaxArrivalStep: Math.max(1, newRiverStep),
    hasNewRiverAnimation: newestSourceId >= 0 && newRiverStep > 0,
    sourceCells: sources,
    mouthCells,
    sourceCount: sources.length,
    riverPixels,
  };
}

function isProminentLocalMaximum(prominenceField, width, height, x, y, idx) {
  const center = prominenceField[idx];
  const x0 = Math.max(0, x - 1);
  const x1 = Math.min(width - 1, x + 1);
  const y0 = Math.max(0, y - 1);
  const y1 = Math.min(height - 1, y + 1);
  for (let yy = y0; yy <= y1; yy += 1) {
    const row = yy * width;
    for (let xx = x0; xx <= x1; xx += 1) {
      if (xx === x && yy === y) continue;
      if (prominenceField[row + xx] > center + 1e-5) {
        return false;
      }
    }
  }
  return true;
}

function applyProminenceCastShadows(
  nudges,
  heights,
  terrainMask,
  riverMask,
  width,
  height,
  casters,
  shadowLengthPx,
  strengthNorm
) {
  if (!casters.length || strengthNorm <= 0) return;

  const maxSteps = Math.max(1, Math.round(shadowLengthPx));
  const lengthNorm = clamp((shadowLengthPx - 20) / 240, 0, 1);
  const dropPerStep = lerp(0.0105, 0.0015, lengthNorm);
  const maxDarkNudge = SHADOW_CAST_MAX * strengthNorm;

  for (let i = 0; i < casters.length; i += 1) {
    const caster = casters[i];
    const casterHeight = heights[caster.idx] + (caster.prominenceWeight * 0.22);
    const castStrength = (
      0.25 +
      (caster.prominenceWeight * 0.5) +
      ((caster.ridgeWeight || 0) * 0.25)
    ) * strengthNorm;
    let fx = caster.x + 0.5;
    let fy = caster.y + 0.5;

    for (let step = 1; step <= maxSteps; step += 1) {
      fx += SHADOW_CAST_DIRECTION.x;
      fy += SHADOW_CAST_DIRECTION.y;
      const tx = fx | 0;
      const ty = fy | 0;
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) break;

      const targetIdx = (ty * width) + tx;
      if (terrainMask[targetIdx] === 0 || riverMask[targetIdx] === 1) continue;

      const rayHeight = casterHeight - (step * dropPerStep);
      const targetHeight = heights[targetIdx];
      if (targetHeight > rayHeight + 0.0025) break;

      const depth = rayHeight - targetHeight;
      if (depth <= 0) continue;

      const distFade = 1 - (step / (maxSteps + 1));
      const darkNudge = clamp(
        depth * (2.4 + (caster.prominenceWeight * 1.6)) * distFade * castStrength,
        0,
        maxDarkNudge
      );
      nudges[targetIdx] = clamp(nudges[targetIdx] - darkNudge, -maxDarkNudge, 1);
    }
  }
}

function buildShadowNudgeField(
  heights,
  slopes,
  terrainMask,
  riverMask,
  width,
  height,
  {
    strengthPercent,
    shadowLengthPx,
    peakLighteningPercent,
    prominenceThresholdPercent,
  }
) {
  const maxStrengthNorm = Math.max(1, SHADOW_STRENGTH_MAX / 100);
  const strengthNorm = clamp((Number(strengthPercent) || 0) / 100, 0, maxStrengthNorm);
  if (strengthNorm <= 0) {
    return null;
  }

  const prominenceThreshold = clamp((Number(prominenceThresholdPercent) || 0) / 100, 0.01, 0.5);
  const peakLightNorm = clamp((Number(peakLighteningPercent) || 0) / 100, 0, 1);
  const shadingMask = new Uint8Array(width * height);
  for (let idx = 0; idx < shadingMask.length; idx += 1) {
    if (terrainMask[idx] === 1 && riverMask[idx] === 0) {
      shadingMask[idx] = 1;
    }
  }
  const localBase = blurHeightFieldMasked(
    heights,
    shadingMask,
    width,
    height,
    SHADOW_PROMINENCE_BLUR_PASSES
  );
  const nudges = new Float32Array(width * height);
  const prominenceRatioField = new Float32Array(width * height);
  const peakCandidates = [];

  let landCount = 0;
  let slopeSum = 0;
  let slopeSqSum = 0;
  for (let idx = 0; idx < slopes.length; idx += 1) {
    if (shadingMask[idx] === 0) continue;
    const slope = slopes[idx];
    slopeSum += slope;
    slopeSqSum += slope * slope;
    landCount += 1;
  }

  const meanSlope = landCount > 0 ? slopeSum / landCount : 0;
  const variance = landCount > 0 ? Math.max(0, (slopeSqSum / landCount) - (meanSlope * meanSlope)) : 0;
  const slopeStd = Math.sqrt(variance);
  const slopeDeadzone = Math.max(0.0025, (meanSlope * 0.9) + (slopeStd * 0.22));
  const slopeRange = Math.max(0.0075, (meanSlope * 2.25) + (slopeStd * 1.3));

  const directionalCap = SHADOW_DIRECTIONAL_MAX * strengthNorm;
  const peakCap = SHADOW_PEAK_MAX * strengthNorm;
  const flatDot = SHADOW_LIGHT_DIRECTION.z;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width) + x;
      if (shadingMask[idx] === 0) continue;

      const left = heights[x > 0 ? idx - 1 : idx];
      const right = heights[x < width - 1 ? idx + 1 : idx];
      const up = heights[y > 0 ? idx - width : idx];
      const down = heights[y < height - 1 ? idx + width : idx];
      const gx = right - left;
      const gy = down - up;
      const slopeMag = Math.sqrt((gx * gx) + (gy * gy));

      const slopeWeight = smoothstep01((slopeMag - slopeDeadzone) / slopeRange);
      if (slopeWeight > 0) {
        let nx = -gx * SHADOW_NORMAL_SCALE;
        let ny = -gy * SHADOW_NORMAL_SCALE;
        let nz = 1;
        const nLen = Math.sqrt((nx * nx) + (ny * ny) + (nz * nz));
        if (nLen > 1e-6) {
          const invNLen = 1 / nLen;
          nx *= invNLen;
          ny *= invNLen;
          nz *= invNLen;
        }

        const ndotl = clamp(
          (nx * SHADOW_LIGHT_DIRECTION.x) +
          (ny * SHADOW_LIGHT_DIRECTION.y) +
          (nz * SHADOW_LIGHT_DIRECTION.z),
          -1,
          1
        );
        const directional = ndotl - flatDot;
        const directionalNudge = clamp(
          directional * slopeWeight * (strengthNorm * 1.6),
          -directionalCap,
          directionalCap
        );
        nudges[idx] += directionalNudge;
      }

      const localHeight = Math.max(0.05, localBase[idx]);
      const prominenceRatio = Math.max(0, (heights[idx] - localBase[idx]) / localHeight);
      prominenceRatioField[idx] = prominenceRatio;
      if (prominenceRatio <= prominenceThreshold) continue;

      const prominenceWeight = smoothstep01(
        (prominenceRatio - prominenceThreshold) / Math.max(1e-5, 1 - prominenceThreshold)
      );
      const ridgeWeight = smoothstep01(
        (slopeMag - slopeDeadzone) / Math.max(1e-5, slopeRange)
      );
      if (ridgeWeight > 0) {
        const peakNudge = clamp(
          prominenceWeight * ridgeWeight * peakLightNorm * strengthNorm * 0.9,
          0,
          peakCap
        );
        nudges[idx] += peakNudge;
      }

      peakCandidates.push({
        idx,
        x,
        y,
        prominenceRatio,
        prominenceWeight,
        ridgeWeight,
      });
    }
  }

  if (peakCandidates.length > 0) {
    const casters = [];
    for (let i = 0; i < peakCandidates.length; i += 1) {
      const candidate = peakCandidates[i];
      if (!isProminentLocalMaximum(
        prominenceRatioField,
        width,
        height,
        candidate.x,
        candidate.y,
        candidate.idx
      )) {
        continue;
      }
      if (candidate.ridgeWeight <= 0.08) continue;
      casters.push(candidate);
    }

    casters.sort((a, b) => b.prominenceRatio - a.prominenceRatio);
    if (casters.length > SHADOW_MAX_CASTERS) {
      casters.length = SHADOW_MAX_CASTERS;
    }

    applyProminenceCastShadows(
      nudges,
      heights,
      terrainMask,
      riverMask,
      width,
      height,
      casters,
      clamp(Number(shadowLengthPx) || 0, 20, 260),
      strengthNorm
    );
  }

  // Keep overall illumination stable: preserve local contrast without globally brightening the map.
  let nudgeSum = 0;
  let nudgeCount = 0;
  for (let idx = 0; idx < nudges.length; idx += 1) {
    if (shadingMask[idx] === 0) continue;
    if (Math.abs(nudges[idx]) < 1e-4) continue;
    nudgeSum += nudges[idx];
    nudgeCount += 1;
  }
  const nudgeMean = nudgeCount > 0 ? (nudgeSum / nudgeCount) : 0;
  if (nudgeMean > 0.003) {
    for (let idx = 0; idx < nudges.length; idx += 1) {
      if (shadingMask[idx] === 0) continue;
      if (Math.abs(nudges[idx]) < 1e-4) continue;
      nudges[idx] -= nudgeMean;
    }
  }

  const maxAbsNudge = Math.max(SHADOW_CAST_MAX, SHADOW_PEAK_MAX, SHADOW_DIRECTIONAL_MAX) * strengthNorm;
  for (let idx = 0; idx < nudges.length; idx += 1) {
    nudges[idx] = clamp(nudges[idx], -maxAbsNudge, maxAbsNudge);
  }
  return nudges;
}

function shadeChannelWithNudge(channel, nudge) {
  if (nudge >= 0) {
    return clamp(channel + ((255 - channel) * nudge), 0, 255);
  }
  return clamp(channel * (1 + nudge), 0, 255);
}

function applyShadowNudgeToPixel(pixelArray, pixelOffset, nudge) {
  if (!nudge) return;
  pixelArray[pixelOffset] = shadeChannelWithNudge(pixelArray[pixelOffset], nudge);
  pixelArray[pixelOffset + 1] = shadeChannelWithNudge(pixelArray[pixelOffset + 1], nudge);
  pixelArray[pixelOffset + 2] = shadeChannelWithNudge(pixelArray[pixelOffset + 2], nudge);
}

function composeTerrainFrame(output, progress, targetPixels) {
  const clampedProgress = clamp(progress, 0, 1);
  targetPixels.set(output.basePixels);

  const riverCutoff = Math.max(0, Math.floor(output.animationMaxArrivalStep * clampedProgress));
  const riverArrivalStep = output.animationArrivalStep;
  const riverShade = output.riverShade;

  for (let idx = 0; idx < riverArrivalStep.length; idx += 1) {
    const step = riverArrivalStep[idx];
    if (step === 0 || step > riverCutoff) continue;

    const shade = riverShade[idx];
    if (shade <= 0) continue;

    const riverBaseColor =
      output.riverTintMask && output.riverTintMask[idx] ? COLORS.coastWater : COLORS.river;
    const pixel = idx * 4;
    targetPixels[pixel] = clamp(riverBaseColor[0] * shade, 0, 255);
    targetPixels[pixel + 1] = clamp(riverBaseColor[1] * shade, 0, 255);
    targetPixels[pixel + 2] = clamp(riverBaseColor[2] * shade, 0, 255);
  }
}

function rasterIndexToNormalized(idx, width, height) {
  const x = idx % width;
  const y = Math.floor(idx / width);
  return {
    nx: x / Math.max(1, width - 1),
    ny: y / Math.max(1, height - 1),
  };
}

function normalizedToRasterIndex(source, width, height) {
  const x = clamp(Math.round(source.nx * Math.max(1, width - 1)), 0, width - 1);
  const y = clamp(Math.round(source.ny * Math.max(1, height - 1)), 0, height - 1);
  return (y * width) + x;
}

function buildSourceIndicesFromNormalizedList(sources, width, height) {
  if (!sources.length) return [];

  const unique = new Set();
  const output = [];
  for (let i = 0; i < sources.length; i += 1) {
    const src = sources[i];
    const idx = normalizedToRasterIndex(src, width, height);
    if (unique.has(idx)) continue;
    unique.add(idx);
    output.push(idx);
  }
  return output;
}

function hasSourceNear(sources, nx, ny, width, height, epsilonPx = 3) {
  const epsilon = epsilonPx / Math.max(width, height);
  const epsilonSq = epsilon * epsilon;

  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i];
    const dx = source.nx - nx;
    const dy = source.ny - ny;
    if ((dx * dx) + (dy * dy) <= epsilonSq) {
      return true;
    }
  }
  return false;
}

function removeSourcesNear(sources, nx, ny, width, height, epsilonPx) {
  const epsilon = epsilonPx / Math.max(width, height);
  const epsilonSq = epsilon * epsilon;
  return sources.filter((source) => {
    const dx = source.nx - nx;
    const dy = source.ny - ny;
    return (dx * dx) + (dy * dy) > epsilonSq;
  });
}

function getViewTransform(viewWidth, viewHeight) {
  const zoom = clamp(state.view.zoom, VIEW_MIN_ZOOM, VIEW_MAX_ZOOM);
  const drawWidth = viewWidth * zoom;
  const drawHeight = viewHeight * zoom;
  const x = ((viewWidth - drawWidth) * 0.5) + state.view.offsetX;
  const y = ((viewHeight - drawHeight) * 0.5) + state.view.offsetY;
  return { x, y, drawWidth, drawHeight };
}

function clampViewOffset(viewWidth = window.innerWidth, viewHeight = window.innerHeight) {
  const zoom = clamp(state.view.zoom, VIEW_MIN_ZOOM, VIEW_MAX_ZOOM);
  const basePanX = Math.abs(viewWidth * (zoom - 1)) * 0.5;
  const basePanY = Math.abs(viewHeight * (zoom - 1)) * 0.5;
  const extraPanX = viewWidth * VIEW_OVERPAN_SCREENS;
  const extraPanY = viewHeight * VIEW_OVERPAN_SCREENS;
  const maxOffsetX = basePanX + extraPanX;
  const maxOffsetY = basePanY + extraPanY;
  state.view.offsetX = clamp(state.view.offsetX, -maxOffsetX, maxOffsetX);
  state.view.offsetY = clamp(state.view.offsetY, -maxOffsetY, maxOffsetY);
}

function screenToRasterPosition(clientX, clientY, output) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const transform = getViewTransform(rect.width, rect.height);
  const relX = (px - transform.x) / transform.drawWidth;
  const relY = (py - transform.y) / transform.drawHeight;
  if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;

  const x = clamp(Math.floor(relX * output.width), 0, output.width - 1);
  const y = clamp(Math.floor(relY * output.height), 0, output.height - 1);
  const idx = (y * output.width) + x;
  return { x, y, idx };
}

function pickRasterSize(viewWidth, viewHeight) {
  const maxPixels = 520000;
  const current = viewWidth * viewHeight;
  const scale = Math.min(1, Math.sqrt(maxPixels / Math.max(1, current)));
  return {
    width: Math.max(360, Math.round(viewWidth * scale)),
    height: Math.max(220, Math.round(viewHeight * scale)),
  };
}

function updateLabels() {
  smoothnessValue.textContent = `${smoothnessSlider.value}`;
  continentScaleValue.textContent = `${continentScaleSlider.value}%`;
  seaLevelValue.textContent = `${seaLevelSlider.value}%`;
  mountaintopValue.textContent = `${mountaintopSlider.value}%`;
  const visibleRiverCount = state.currentOutput ? state.currentOutput.river.sourceCount : state.riverCount;
  riversCountValue.textContent = `${visibleRiverCount}`;
  algorithmValue.textContent = state.algorithm === "midpoint" ? "Midpoint" : "Topology";
  resourceTypeValue.textContent = resourceTypeLabel(resourceTypeSelect.value);
  resourceSnapValue.textContent = `${RESOURCE_VERTEX_SNAP_PX} px`;
  resourceStrengthValue.textContent = `${resourceStrengthSlider.value}%`;
  resourceDraftCountValue.textContent = `${state.resourceDraftVertices.length}`;
  resourceZonesCountValue.textContent = `${state.resourceZones.length}`;
  shorelineReliefValue.textContent = state.visualEffects.shorelineRelief ? "On" : "Off";
  shorelineReliefToggle.checked = state.visualEffects.shorelineRelief;
  riverReliefValue.textContent = state.visualEffects.riverRelief ? "On" : "Off";
  riverReliefToggle.checked = state.visualEffects.riverRelief;
  const shadowStrength = clamp(Math.round(state.visualEffects.shadowStrength), 0, SHADOW_STRENGTH_MAX);
  const shadowLength = clamp(Math.round(state.visualEffects.shadowLength), 20, 260);
  const peakLightening = clamp(Math.round(state.visualEffects.peakLightening), 0, 100);
  const prominenceThreshold = clamp(Math.round(state.visualEffects.prominenceThreshold), 1, 35);
  const shadowEnabled = state.visualEffects.shadowEffect;
  shadowEffectValue.textContent = shadowEnabled ? "On" : "Off";
  shadowEffectToggle.checked = shadowEnabled;
  shadowStrengthValue.textContent = `${shadowStrength}%`;
  shadowLengthValue.textContent = `${shadowLength} px`;
  peakLighteningValue.textContent = `${peakLightening}%`;
  prominenceThresholdValue.textContent = `${prominenceThreshold}%`;
  if (Number(shadowStrengthSlider.value) !== shadowStrength) {
    shadowStrengthSlider.value = String(shadowStrength);
  }
  if (Number(shadowLengthSlider.value) !== shadowLength) {
    shadowLengthSlider.value = String(shadowLength);
  }
  if (Number(peakLighteningSlider.value) !== peakLightening) {
    peakLighteningSlider.value = String(peakLightening);
  }
  if (Number(prominenceThresholdSlider.value) !== prominenceThreshold) {
    prominenceThresholdSlider.value = String(prominenceThreshold);
  }
  shadowStrengthSlider.disabled = !shadowEnabled;
  shadowLengthSlider.disabled = !shadowEnabled;
  peakLighteningSlider.disabled = !shadowEnabled;
  prominenceThresholdSlider.disabled = !shadowEnabled;
  shadowStrengthRow.classList.toggle("is-disabled", !shadowEnabled);
  shadowLengthRow.classList.toggle("is-disabled", !shadowEnabled);
  peakLighteningRow.classList.toggle("is-disabled", !shadowEnabled);
  prominenceThresholdRow.classList.toggle("is-disabled", !shadowEnabled);
  seedValue.textContent = `Seed T${state.seed} | R${state.riverSeed}`;
}

function applyControlsPanelState() {
  if (!floatingControls || !panelToggleBtn) return;
  floatingControls.classList.toggle("is-collapsed", state.controlsCollapsed);
  panelToggleBtn.textContent = state.controlsCollapsed ? "+" : "-";
  panelToggleBtn.setAttribute(
    "aria-label",
    state.controlsCollapsed ? "Maximize controls" : "Minimize controls"
  );
  panelToggleBtn.title = state.controlsCollapsed ? "Maximize controls" : "Minimize controls";
  panelToggleBtn.setAttribute("aria-expanded", state.controlsCollapsed ? "false" : "true");
}

function applyEditorModeState() {
  const isTerrain = state.editorMode === "terrain";
  const isResources = state.editorMode === "resources";
  const isVisualEffects = state.editorMode === "visual-effects";

  terrainControlsGroup.classList.toggle("is-hidden", !isTerrain);
  resourceControlsGroup.classList.toggle("is-hidden", !isResources);
  visualEffectsControlsGroup.classList.toggle("is-hidden", !isVisualEffects);

  if (isTerrain) {
    panelTitle.textContent = "Terrain Lab";
    panelSubtitle.textContent = "Interactive topology preview";
    floatingControls.setAttribute("aria-label", "Terrain controls");
  } else if (isResources) {
    panelTitle.textContent = "Resource Lab";
    panelSubtitle.textContent = "Barebones resource zone setup";
    floatingControls.setAttribute("aria-label", "Resource controls");
  } else {
    panelTitle.textContent = "Visual Effects";
    panelSubtitle.textContent = "Map styling controls";
    floatingControls.setAttribute("aria-label", "Visual effects controls");
  }

  modeButtons.forEach((button) => {
    const mode = button.getAttribute("data-mode");
    button.classList.toggle("is-active", mode === state.editorMode);
    button.setAttribute("aria-pressed", mode === state.editorMode ? "true" : "false");
  });
  if (!isTerrain) {
    state.deletePreview.active = false;
  }
}

function updateResourceStats() {
  const counts = {
    wind: 0,
    sun: 0,
    gas: 0,
  };
  for (let i = 0; i < state.resourceZones.length; i += 1) {
    const zone = state.resourceZones[i];
    if (counts[zone.type] !== undefined) {
      counts[zone.type] += 1;
    }
  }

  statsValue.textContent =
    `Zones ${state.resourceZones.length} | Draft ${state.resourceDraftVertices.length} | Wind ${counts.wind} | Sun ${counts.sun} | Gas ${counts.gas}`;
}

function updateStats(stats) {
  if (state.editorMode === "resources") {
    updateResourceStats();
    return;
  }
  const landPct = Math.round(stats.landFraction * 100);
  const mountainPct = Math.round(stats.mountainFraction * 100);
  const snowPct = Math.round(stats.mountaintopFraction * 100);
  const riverPct = Math.round(stats.riverFraction * 100);
  const snowcapsTargetPct = Number(mountaintopSlider.value);
  const algoShort = state.algorithm === "midpoint" ? "M" : "T";
  const baseStats =
    `Land ${landPct}% | Mountain ${mountainPct}% | Snow ${snowPct}% (target ${snowcapsTargetPct}%) | Rivers ${riverPct}% (${stats.riverSourceCount}) | ${algoShort}`;
  if (state.editorMode === "visual-effects") {
    const shorelineState = state.visualEffects.shorelineRelief ? "Coast On" : "Coast Off";
    const riverState = state.visualEffects.riverRelief ? "River Tint On" : "River Tint Off";
    const shadowState = state.visualEffects.shadowEffect
      ? `Shadow ${Math.round(state.visualEffects.shadowStrength)}% L${Math.round(state.visualEffects.shadowLength)} P${Math.round(state.visualEffects.peakLightening)} T${Math.round(state.visualEffects.prominenceThreshold)}`
      : "Shadow Off";
    statsValue.textContent = `${baseStats} | ${shorelineState} | ${riverState} | ${shadowState}`;
    return;
  }
  statsValue.textContent = baseStats;
}

function setStatus(text) {
  statsValue.textContent = text;
}

function buildTerrainImage(
  width,
  height,
  seed,
  riverSeed,
  smoothness,
  continentScalePercent,
  seaLevelPercent,
  snowcapsPercent,
  algorithm,
  riverCount,
  shorelineReliefEnabled,
  riverReliefEnabled,
  shadowEffectEnabled,
  shadowStrengthPercent,
  shadowLengthPx,
  peakLighteningPercent,
  prominenceThresholdPercent,
  animateNewestRiverOnly = false
) {
  const smoothnessNorm = clamp(smoothness / 100, 0, 1);
  const seaQuantile = clamp(seaLevelPercent / 100, 0.05, 0.95);
  // Snowcaps slider is inverted from legacy mountaintop threshold:
  // higher snowcaps % should produce more white terrain.
  const snowcapsFraction = clamp(snowcapsPercent / 100, 0.01, 0.25);
  const mountaintopQuantile = clamp(1 - snowcapsFraction, 0.75, 0.99);

  const heights = buildHeightField(
    width,
    height,
    seed,
    smoothness,
    algorithm,
    continentScalePercent
  );
  const slopes = buildSlopeField(heights, width, height);

  const seaLevel = quantileFromArray(heights, seaQuantile);
  const mountaintopLevel = quantileFromArray(heights, mountaintopQuantile);
  const manualSourceIndices = buildSourceIndicesFromNormalizedList(state.manualRiverSources, width, height);
  const blockedSourceIndices = buildSourceIndicesFromNormalizedList(state.suppressedRiverSources, width, height);
  const riverOutput = buildRiverMask(
    heights,
    width,
    height,
    seaLevel,
    riverCount,
    riverSeed,
    manualSourceIndices,
    blockedSourceIndices,
    animateNewestRiverOnly
  );

  let landCount = 0;
  for (let i = 0; i < heights.length; i += 1) {
    if (heights[i] >= seaLevel) landCount += 1;
  }

  const landSlopes = new Float32Array(Math.max(landCount, 1));
  let cursor = 0;
  for (let i = 0; i < heights.length; i += 1) {
    if (heights[i] >= seaLevel) {
      landSlopes[cursor] = slopes[i];
      cursor += 1;
    }
  }

  const slopeQuantile = lerp(0.9, 0.82, smoothnessNorm);
  const mountainSlopeLevel = quantileFromArray(landSlopes.subarray(0, cursor), slopeQuantile);

  const baseImageData = new ImageData(width, height);
  const basePixels = baseImageData.data;
  const riverShade = new Float32Array(width * height);
  const riverTintMask = new Uint8Array(width * height);
  const terrainMask = new Uint8Array(width * height); // 0 = sea, 1 = land
  const terrainClass = new Uint8Array(width * height); // See TERRAIN_CLASS enum.

  let waterCount = 0;
  let plainsCount = 0;
  let mountainCount = 0;
  let mountaintopCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width) + x;
      const h = heights[idx];

      let r;
      let g;
      let b;

      if (h < seaLevel) {
        [r, g, b] = COLORS.water;
        waterCount += 1;
        terrainMask[idx] = 0;
        terrainClass[idx] = TERRAIN_CLASS.SEA;
      } else {
        terrainMask[idx] = 1;
        let baseColor;
        if (h >= mountaintopLevel) {
          baseColor = COLORS.mountaintop;
          mountaintopCount += 1;
          terrainClass[idx] = TERRAIN_CLASS.SNOWCAP;
        } else if (slopes[idx] >= mountainSlopeLevel) {
          baseColor = COLORS.mountain;
          mountainCount += 1;
          terrainClass[idx] = TERRAIN_CLASS.MOUNTAIN;
        } else {
          baseColor = COLORS.plains;
          plainsCount += 1;
          terrainClass[idx] = TERRAIN_CLASS.PLAINS;
        }

        r = baseColor[0];
        g = baseColor[1];
        b = baseColor[2];
      }

      if (riverOutput.riverMask[idx] && h > seaLevel) {
        riverShade[idx] = 1;
      }

      const p = idx * 4;
      basePixels[p] = r;
      basePixels[p + 1] = g;
      basePixels[p + 2] = b;
      basePixels[p + 3] = 255;
    }
  }

  // Dither snowcap borders so transition into surrounding terrain is less abrupt.
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width) + x;
      if (terrainClass[idx] !== TERRAIN_CLASS.SNOWCAP) continue;

      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(width - 1, x + 1);
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let neighborCount = 0;

      for (let yy = y0; yy <= y1; yy += 1) {
        const row = yy * width;
        for (let xx = x0; xx <= x1; xx += 1) {
          if (xx === x && yy === y) continue;
          const nIdx = row + xx;
          const nClass = terrainClass[nIdx];
          let neighborColor = null;
          if (nClass === TERRAIN_CLASS.PLAINS) {
            neighborColor = COLORS.plains;
          } else if (nClass === TERRAIN_CLASS.MOUNTAIN) {
            neighborColor = COLORS.mountain;
          }
          if (!neighborColor) continue;

          sumR += neighborColor[0];
          sumG += neighborColor[1];
          sumB += neighborColor[2];
          neighborCount += 1;
        }
      }

      if (neighborCount === 0) continue;

      const noise = hash01FromUint(((seed * 1103515245) ^ idx ^ 0x9e3779b9) >>> 0);
      if (noise >= SNOWCAP_BORDER_DITHER_FRACTION) continue;

      const avgR = sumR / neighborCount;
      const avgG = sumG / neighborCount;
      const avgB = sumB / neighborCount;
      const blend = SNOWCAP_BORDER_BLEND_RATIO;
      const p = idx * 4;
      basePixels[p] = Math.round((basePixels[p] * (1 - blend)) + (avgR * blend));
      basePixels[p + 1] = Math.round((basePixels[p + 1] * (1 - blend)) + (avgG * blend));
      basePixels[p + 2] = Math.round((basePixels[p + 2] * (1 - blend)) + (avgB * blend));
    }
  }

  if (shorelineReliefEnabled || riverReliefEnabled) {
    // Relief tint pass: recolor immediate boundaries between land and enabled water types.
    const isWaterLike = (idx) => {
      const isSea = terrainMask[idx] === 0;
      const isRiver = riverOutput.riverMask[idx] === 1;
      return (shorelineReliefEnabled && isSea) || (riverReliefEnabled && isRiver);
    };

    const isLandLike = (idx) => terrainMask[idx] === 1 && !isWaterLike(idx);

    for (let y = 0; y < height; y += 1) {
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(height - 1, y + 1);
      for (let x = 0; x < width; x += 1) {
        const idx = (y * width) + x;
        const waterLike = isWaterLike(idx);
        const landLike = isLandLike(idx);
        if (!waterLike && !landLike) continue;

        let bordersOpposite = false;
        const x0 = Math.max(0, x - 1);
        const x1 = Math.min(width - 1, x + 1);

        for (let yy = y0; yy <= y1 && !bordersOpposite; yy += 1) {
          const row = yy * width;
          for (let xx = x0; xx <= x1; xx += 1) {
            if (xx === x && yy === y) continue;
            const nIdx = row + xx;
            if (landLike && isWaterLike(nIdx)) {
              bordersOpposite = true;
              break;
            }
            if (waterLike && isLandLike(nIdx)) {
              bordersOpposite = true;
              break;
            }
          }
        }

        if (!bordersOpposite) continue;

        const p = idx * 4;
        if (landLike) {
          basePixels[p] = COLORS.coastLand[0];
          basePixels[p + 1] = COLORS.coastLand[1];
          basePixels[p + 2] = COLORS.coastLand[2];
        } else {
          basePixels[p] = COLORS.coastWater[0];
          basePixels[p + 1] = COLORS.coastWater[1];
          basePixels[p + 2] = COLORS.coastWater[2];
          if (riverOutput.riverMask[idx] === 1) {
            riverTintMask[idx] = 1;
          }
        }
      }
    }
  }

  const shadowNudges = shadowEffectEnabled
    ? buildShadowNudgeField(
      heights,
      slopes,
      terrainMask,
      riverOutput.riverMask,
      width,
      height,
      {
        strengthPercent: shadowStrengthPercent,
        shadowLengthPx,
        peakLighteningPercent,
        prominenceThresholdPercent,
      }
    )
    : null;

  if (shadowNudges) {
    for (let idx = 0; idx < shadowNudges.length; idx += 1) {
      // Do not shade any water body pixels (sea/lakes or rivers).
      if (terrainMask[idx] === 0 || riverOutput.riverMask[idx] === 1) continue;
      const pixelOffset = idx * 4;
      applyShadowNudgeToPixel(basePixels, pixelOffset, shadowNudges[idx]);
    }
  }

  let animationArrivalStep = riverOutput.riverArrivalStep;
  let animationMaxArrivalStep = riverOutput.maxArrivalStep;

  if (animateNewestRiverOnly && riverOutput.hasNewRiverAnimation) {
    animationArrivalStep = riverOutput.newRiverArrivalStep;
    animationMaxArrivalStep = riverOutput.newRiverMaxArrivalStep;

    // Keep existing rivers visible while only the newest click-created river is animated.
    for (let idx = 0; idx < riverOutput.riverMask.length; idx += 1) {
      if (!riverOutput.riverMask[idx] || riverOutput.newRiverMask[idx]) continue;
      const shade = riverShade[idx];
      if (shade <= 0) continue;

      const riverBaseColor = riverTintMask[idx] ? COLORS.coastWater : COLORS.river;
      const p = idx * 4;
      basePixels[p] = clamp(riverBaseColor[0] * shade, 0, 255);
      basePixels[p + 1] = clamp(riverBaseColor[1] * shade, 0, 255);
      basePixels[p + 2] = clamp(riverBaseColor[2] * shade, 0, 255);
    }
  }

  return {
    width,
    height,
    heights,
    seaLevel,
    basePixels: new Uint8ClampedArray(basePixels),
    river: riverOutput,
    riverShade,
    riverTintMask,
    shadowNudges,
    animationArrivalStep,
    animationMaxArrivalStep,
    stats: {
      landFraction: (plainsCount + mountainCount + mountaintopCount) / (width * height),
      waterFraction: waterCount / (width * height),
      mountainFraction: mountainCount / (width * height),
      mountaintopFraction: mountaintopCount / (width * height),
      riverFraction: riverOutput.riverPixels / (width * height),
      riverSourceCount: riverOutput.sourceCount,
    },
  };
}

function resizeCanvas() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  clampViewOffset(width, height);

  if (state.lastRaster) {
    drawRasterToViewport(state.lastRaster);
  }
}

function cancelActiveAnimation() {
  if (state.animationFrameId) {
    window.cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = 0;
  }
}

function drawRasterToViewport(raster) {
  clampViewOffset(window.innerWidth, window.innerHeight);
  const transform = getViewTransform(window.innerWidth, window.innerHeight);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.drawImage(raster, transform.x, transform.y, transform.drawWidth, transform.drawHeight);
  drawResourceZones(transform);
  drawDeletePreview();
}

function getDeletePreviewRadiusOnScreen() {
  const output = state.currentOutput;
  if (!output) return SOURCE_REMOVE_RADIUS_PX;

  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return SOURCE_REMOVE_RADIUS_PX;

  const transform = getViewTransform(rect.width, rect.height);
  const pixelsPerRasterPixel = transform.drawWidth / Math.max(1, output.width);
  return Math.max(2, SOURCE_REMOVE_RADIUS_PX * pixelsPerRasterPixel);
}

function drawDeletePreview() {
  if (state.editorMode !== "terrain") return;
  if (!state.deletePreview.active) return;

  const rect = canvas.getBoundingClientRect();
  const x = state.deletePreview.clientX - rect.left;
  const y = state.deletePreview.clientY - rect.top;
  const radius = getDeletePreviewRadiusOnScreen();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = DELETE_PREVIEW_FILL;
  ctx.fill();
  ctx.lineWidth = DELETE_PREVIEW_STROKE_WIDTH;
  ctx.strokeStyle = DELETE_PREVIEW_STROKE;
  ctx.stroke();
  ctx.restore();
}

function drawResourceZones(transform) {
  if (state.editorMode !== "resources") return;
  if (!state.currentOutput) return;
  const output = state.currentOutput;
  const rasterPxToScreen = transform.drawWidth / Math.max(1, output.width);

  const toScreen = (vertex) => ({
    x: transform.x + (vertex.nx * transform.drawWidth),
    y: transform.y + (vertex.ny * transform.drawHeight),
  });

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (let i = 0; i < state.resourceZones.length; i += 1) {
    const zone = state.resourceZones[i];
    if (!zone.vertices || zone.vertices.length < 3) continue;

    const style = getResourceStyle(zone.type);
    const strengthAlpha = clamp(zone.strength / 100, 0.2, 1);
    const first = toScreen(zone.vertices[0]);

    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let j = 1; j < zone.vertices.length; j += 1) {
      const point = toScreen(zone.vertices[j]);
      ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();

    ctx.globalAlpha = strengthAlpha;
    ctx.fillStyle = style.fill;
    ctx.fill();

    ctx.globalAlpha = clamp(0.7 + (strengthAlpha * 0.3), 0.7, 1);
    ctx.lineWidth = 2;
    ctx.strokeStyle = style.stroke;
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = style.stroke;
    for (let j = 0; j < zone.vertices.length; j += 1) {
      const point = toScreen(zone.vertices[j]);
      ctx.beginPath();
      ctx.arc(point.x, point.y, RESOURCE_VERTEX_RENDER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (state.resourceDraftVertices.length > 0) {
    const draftPoints = state.resourceDraftVertices.map(toScreen);

    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "rgba(203, 237, 255, 0.95)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(draftPoints[0].x, draftPoints[0].y);
    for (let i = 1; i < draftPoints.length; i += 1) {
      ctx.lineTo(draftPoints[i].x, draftPoints[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(203, 237, 255, 0.96)";
    for (let i = 0; i < draftPoints.length; i += 1) {
      const point = draftPoints[i];
      ctx.beginPath();
      ctx.arc(point.x, point.y, RESOURCE_VERTEX_RENDER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    if (draftPoints.length >= 3) {
      const first = draftPoints[0];
      ctx.beginPath();
      ctx.arc(first.x, first.y, Math.max(2, RESOURCE_VERTEX_SNAP_PX * rasterPxToScreen), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(174, 239, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function animateTerrainOutput(output, renderToken) {
  cancelActiveAnimation();

  const raster = document.createElement("canvas");
  raster.width = output.width;
  raster.height = output.height;
  const rasterCtx = raster.getContext("2d");

  const framePixels = new Uint8ClampedArray(output.basePixels.length);
  const frameImage = new ImageData(framePixels, output.width, output.height);
  const hasAnimatedRiver = output.river.riverPixels > 0 && output.animationMaxArrivalStep > 0;
  const duration = hasAnimatedRiver ? RIVER_ANIMATION_MS : 0;
  const startAt = performance.now();

  const drawStep = (timestamp) => {
    if (renderToken !== state.renderToken) return;

    const t = duration > 0 ? clamp((timestamp - startAt) / duration, 0, 1) : 1;
    composeTerrainFrame(output, smoothstep01(t), framePixels);

    rasterCtx.putImageData(frameImage, 0, 0);
    state.lastRaster = raster;
    drawRasterToViewport(raster);

    if (t < 1) {
      state.animationFrameId = window.requestAnimationFrame(drawStep);
      return;
    }

    state.animationFrameId = 0;
    updateStats(output.stats);
  };

  state.animationFrameId = window.requestAnimationFrame(drawStep);
}

function drawTerrainOutputImmediate(output) {
  cancelActiveAnimation();
  const raster = document.createElement("canvas");
  raster.width = output.width;
  raster.height = output.height;
  const rasterCtx = raster.getContext("2d");

  const framePixels = new Uint8ClampedArray(output.basePixels.length);
  composeTerrainFrame(output, 1, framePixels);
  const frameImage = new ImageData(framePixels, output.width, output.height);

  rasterCtx.putImageData(frameImage, 0, 0);
  state.lastRaster = raster;
  drawRasterToViewport(raster);
  updateStats(output.stats);
}

async function renderTerrain({
  newSeed = false,
  resetRivers = false,
  animateNewestRiverOnly = false,
  skipRiverAnimation = false,
} = {}) {
  clearPendingSliderRegenerate();
  const renderToken = ++state.renderToken;
  cancelActiveAnimation();

  if (newSeed) {
    state.seed = randomSeed();
    state.riverSeed = randomSeed();
    state.manualRiverSources = [];
    state.suppressedRiverSources = [];
    state.resourceZones = [];
    state.resourceDraftVertices = [];
  } else if (resetRivers) {
    state.riverSeed = randomSeed();
    state.manualRiverSources = [];
    state.suppressedRiverSources = [];
  }
  updateLabels();

  setStatus("Generating terrain...");
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const { width: rasterWidth, height: rasterHeight } = pickRasterSize(
    window.innerWidth,
    window.innerHeight
  );
  const seedResourceZones = newSeed || (!state.currentOutput && state.resourceZones.length === 0);
  if (seedResourceZones) {
    state.resourceZones = generateSeededResourceZones(rasterWidth, rasterHeight, state.seed);
    state.resourceDraftVertices = [];
  }

  const smoothness = Number(smoothnessSlider.value);
  const continentScale = Number(continentScaleSlider.value);
  const seaLevel = Number(seaLevelSlider.value);
  const snowcapsLevel = Number(mountaintopSlider.value);
  const effectiveRiverCount = Math.max(0, state.riverCount - state.suppressedRiverSources.length);

  const output = buildTerrainImage(
    rasterWidth,
    rasterHeight,
    state.seed,
    state.riverSeed,
    smoothness,
    continentScale,
    seaLevel,
    snowcapsLevel,
    state.algorithm,
    effectiveRiverCount,
    state.visualEffects.shorelineRelief,
    state.visualEffects.riverRelief,
    state.visualEffects.shadowEffect,
    state.visualEffects.shadowStrength,
    state.visualEffects.shadowLength,
    state.visualEffects.peakLightening,
    state.visualEffects.prominenceThreshold,
    animateNewestRiverOnly
  );

  if (renderToken !== state.renderToken) {
    return;
  }

  state.currentOutput = output;
  updateLabels();

  if (skipRiverAnimation) {
    drawTerrainOutputImmediate(output);
    return;
  }

  if (output.river.sourceCount <= 0) {
    setStatus("No rivers to trace");
  } else if (animateNewestRiverOnly && output.river.hasNewRiverAnimation) {
    setStatus("Tracing new river...");
  } else {
    setStatus("Tracing rivers...");
  }
  animateTerrainOutput(output, renderToken);
}

function scheduleRegenerate(delayMs = 140) {
  clearPendingSliderRegenerate();
  sliderTimer = window.setTimeout(() => {
    sliderTimer = 0;
    renderTerrain({ newSeed: false });
  }, delayMs);
}

function resetRivers() {
  state.riverCount = RIVER_DEFAULT_COUNT;
  updateLabels();
  renderTerrain({ resetRivers: true });
}

function removeAllRivers() {
  state.riverCount = 0;
  state.manualRiverSources = [];
  state.suppressedRiverSources = [];
  updateLabels();
  renderTerrain({ newSeed: false, skipRiverAnimation: true });
}

function findNearestVertexIndex(vertices, nx, ny, width, height, radiusPx) {
  if (!vertices.length) return -1;
  const thresholdSq = radiusPx * radiusPx;
  let nearestIdx = -1;
  let nearestDistanceSq = Infinity;

  for (let i = 0; i < vertices.length; i += 1) {
    const vertex = vertices[i];
    const vx = vertex.nx * Math.max(1, width - 1);
    const vy = vertex.ny * Math.max(1, height - 1);
    const px = nx * Math.max(1, width - 1);
    const py = ny * Math.max(1, height - 1);
    const dx = vx - px;
    const dy = vy - py;
    const distanceSq = (dx * dx) + (dy * dy);
    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq;
      nearestIdx = i;
    }
  }

  if (nearestDistanceSq <= thresholdSq) {
    return nearestIdx;
  }
  return -1;
}

function commitResourceDraftPolygon(closeAtVertexIdx = 0) {
  const draft = state.resourceDraftVertices;
  if (draft.length < 3) return false;
  const closeIdx = clamp(closeAtVertexIdx, 0, draft.length - 1);
  const polygonVertices = closeIdx === 0
    ? draft.slice()
    : draft.slice(closeIdx).concat(draft.slice(0, closeIdx));
  if (polygonVertices.length < 3) return false;

  state.resourceZones.push({
    type: resourceTypeSelect.value,
    strength: Number(resourceStrengthSlider.value),
    vertices: polygonVertices,
  });
  state.resourceDraftVertices = [];
  updateLabels();
  updateResourceStats();
  if (state.lastRaster) {
    drawRasterToViewport(state.lastRaster);
  }
  return true;
}

function addResourceZoneFromClick(clientX, clientY) {
  const output = state.currentOutput;
  if (!output) return;

  const rasterPos = screenToRasterPosition(clientX, clientY, output);
  if (!rasterPos) return;

  const normalized = rasterIndexToNormalized(rasterPos.idx, output.width, output.height);
  const closeVertexIdx = findNearestVertexIndex(
    state.resourceDraftVertices,
    normalized.nx,
    normalized.ny,
    output.width,
    output.height,
    RESOURCE_VERTEX_SNAP_PX
  );

  if (closeVertexIdx >= 0) {
    // Reuse nearby existing vertex and close the polygon.
    if (state.resourceDraftVertices.length >= 3) {
      commitResourceDraftPolygon(closeVertexIdx);
    }
    return;
  }

  const last = state.resourceDraftVertices[state.resourceDraftVertices.length - 1];
  if (last) {
    const lastNearIdx = findNearestVertexIndex(
      [last],
      normalized.nx,
      normalized.ny,
      output.width,
      output.height,
      2
    );
    if (lastNearIdx >= 0) return;
  }

  state.resourceDraftVertices.push(normalized);
  updateLabels();
  updateResourceStats();
  if (state.lastRaster) {
    drawRasterToViewport(state.lastRaster);
  }
}

function pointInPolygon(nx, ny, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const xi = vertices[i].nx;
    const yi = vertices[i].ny;
    const xj = vertices[j].nx;
    const yj = vertices[j].ny;
    const intersect =
      ((yi > ny) !== (yj > ny)) &&
      (nx < ((xj - xi) * (ny - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function removeResourceZoneNearClick(clientX, clientY) {
  const output = state.currentOutput;
  if (!output || state.resourceZones.length === 0) return;

  const rasterPos = screenToRasterPosition(clientX, clientY, output);
  if (!rasterPos) return;
  const normalized = rasterIndexToNormalized(rasterPos.idx, output.width, output.height);

  // Prefer removing a zone that contains the click point.
  for (let i = state.resourceZones.length - 1; i >= 0; i -= 1) {
    const zone = state.resourceZones[i];
    if (!zone.vertices || zone.vertices.length < 3) continue;
    if (pointInPolygon(normalized.nx, normalized.ny, zone.vertices)) {
      state.resourceZones.splice(i, 1);
      updateLabels();
      updateResourceStats();
      if (state.lastRaster) {
        drawRasterToViewport(state.lastRaster);
      }
      return;
    }
  }

  // Fallback: nearest vertex within deletion radius.
  let nearestZoneIdx = -1;
  let nearestDistanceSq = Infinity;
  for (let i = 0; i < state.resourceZones.length; i += 1) {
    const zone = state.resourceZones[i];
    if (!zone.vertices || zone.vertices.length < 3) continue;
    for (let j = 0; j < zone.vertices.length; j += 1) {
      const vertex = zone.vertices[j];
      const vx = vertex.nx * Math.max(1, output.width - 1);
      const vy = vertex.ny * Math.max(1, output.height - 1);
      const dx = vx - rasterPos.x;
      const dy = vy - rasterPos.y;
      const distanceSq = (dx * dx) + (dy * dy);
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearestZoneIdx = i;
      }
    }
  }

  if (nearestZoneIdx < 0) return;
  if (nearestDistanceSq > (RESOURCE_REMOVE_RADIUS_PX * RESOURCE_REMOVE_RADIUS_PX)) return;

  state.resourceZones.splice(nearestZoneIdx, 1);
  updateLabels();
  updateResourceStats();
  if (state.lastRaster) {
    drawRasterToViewport(state.lastRaster);
  }
}

function clearAllResourceZones() {
  if (state.resourceZones.length === 0) return;
  state.resourceZones = [];
  updateLabels();
  updateResourceStats();
  if (state.lastRaster) {
    drawRasterToViewport(state.lastRaster);
  }
}

function undoLastResourceZone() {
  if (state.resourceZones.length === 0) return;
  state.resourceZones.pop();
  updateLabels();
  updateResourceStats();
  if (state.lastRaster) {
    drawRasterToViewport(state.lastRaster);
  }
}

function addRiverSourceFromClick(clientX, clientY) {
  const output = state.currentOutput;
  if (!output) return;

  const rasterPos = screenToRasterPosition(clientX, clientY, output);
  if (!rasterPos) return;

  const idx = rasterPos.idx;
  if (output.heights[idx] <= output.seaLevel) {
    return;
  }

  const normalized = rasterIndexToNormalized(idx, output.width, output.height);
  if (hasSourceNear(state.manualRiverSources, normalized.nx, normalized.ny, output.width, output.height)) {
    return;
  }

  state.suppressedRiverSources = removeSourcesNear(
    state.suppressedRiverSources,
    normalized.nx,
    normalized.ny,
    output.width,
    output.height,
    SOURCE_REMOVE_RADIUS_PX
  );

  state.manualRiverSources.push(normalized);

  renderTerrain({ newSeed: false, animateNewestRiverOnly: true });
}

function removeRiverSourcesByIndex(output, sourceIndices) {
  if (!output || !sourceIndices.length) return;

  const uniqueSourceIndices = Array.from(new Set(sourceIndices));
  if (!uniqueSourceIndices.length) return;

  for (let i = 0; i < uniqueSourceIndices.length; i += 1) {
    const normalized = rasterIndexToNormalized(uniqueSourceIndices[i], output.width, output.height);

    const removedManualSource = hasSourceNear(
      state.manualRiverSources,
      normalized.nx,
      normalized.ny,
      output.width,
      output.height,
      SOURCE_REMOVE_RADIUS_PX
    );
    state.manualRiverSources = removeSourcesNear(
      state.manualRiverSources,
      normalized.nx,
      normalized.ny,
      output.width,
      output.height,
      SOURCE_REMOVE_RADIUS_PX
    );

    if (!removedManualSource) {
      if (
        !hasSourceNear(
          state.suppressedRiverSources,
          normalized.nx,
          normalized.ny,
          output.width,
          output.height,
          SOURCE_REMOVE_RADIUS_PX
        )
      ) {
        state.suppressedRiverSources.push(normalized);
      }
    }
  }

  renderTerrain({ newSeed: false, skipRiverAnimation: true });
}

function removeRiverSourcesNearClick(clientX, clientY) {
  const output = state.currentOutput;
  if (!output || !output.river || !output.river.sourceCells.length) return;

  const rasterPos = screenToRasterPosition(clientX, clientY, output);
  if (!rasterPos) return;

  const radiusSq = SOURCE_REMOVE_RADIUS_PX * SOURCE_REMOVE_RADIUS_PX;
  const removedSources = [];
  for (let i = 0; i < output.river.sourceCells.length; i += 1) {
    const sourceIdx = output.river.sourceCells[i];
    const sx = sourceIdx % output.width;
    const sy = Math.floor(sourceIdx / output.width);
    const dx = sx - rasterPos.x;
    const dy = sy - rasterPos.y;
    if ((dx * dx) + (dy * dy) <= radiusSq) {
      removedSources.push(sourceIdx);
    }
  }

  removeRiverSourcesByIndex(output, removedSources);
}

function beginDeletePreview(clientX, clientY) {
  state.deletePreview.active = true;
  state.deletePreview.clientX = clientX;
  state.deletePreview.clientY = clientY;

  if (state.lastRaster) {
    drawRasterToViewport(state.lastRaster);
  }
}

function updateDeletePreview(clientX, clientY) {
  if (!state.deletePreview.active) return;
  state.deletePreview.clientX = clientX;
  state.deletePreview.clientY = clientY;

  if (state.lastRaster) {
    drawRasterToViewport(state.lastRaster);
  }
}

function endDeletePreview({ deleteRiver = false, clientX = 0, clientY = 0 } = {}) {
  if (!state.deletePreview.active) return;
  const endX = clientX || state.deletePreview.clientX;
  const endY = clientY || state.deletePreview.clientY;
  state.deletePreview.active = false;

  if (deleteRiver) {
    removeRiverSourcesNearClick(endX, endY);
    if (state.lastRaster) {
      drawRasterToViewport(state.lastRaster);
    }
    return;
  }

  if (state.lastRaster) {
    drawRasterToViewport(state.lastRaster);
  }
}

function zoomAtClientPoint(clientX, clientY, zoomFactor) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const oldZoom = state.view.zoom;
  const nextZoom = clamp(oldZoom * zoomFactor, VIEW_MIN_ZOOM, VIEW_MAX_ZOOM);
  if (Math.abs(nextZoom - oldZoom) < 1e-6) return;

  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const oldTransform = getViewTransform(rect.width, rect.height);
  const relX = (px - oldTransform.x) / oldTransform.drawWidth;
  const relY = (py - oldTransform.y) / oldTransform.drawHeight;
  const focusX = clamp(relX, 0, 1);
  const focusY = clamp(relY, 0, 1);

  state.view.zoom = nextZoom;

  const newDrawWidth = rect.width * nextZoom;
  const newDrawHeight = rect.height * nextZoom;
  const newBaseX = (rect.width - newDrawWidth) * 0.5;
  const newBaseY = (rect.height - newDrawHeight) * 0.5;

  state.view.offsetX = px - (focusX * newDrawWidth) - newBaseX;
  state.view.offsetY = py - (focusY * newDrawHeight) - newBaseY;
  clampViewOffset(rect.width, rect.height);

  if (state.lastRaster) {
    drawRasterToViewport(state.lastRaster);
  }
}

function beginPan(clientX, clientY) {
  state.view.pointerDown = true;
  state.view.isPanning = false;
  state.view.pointerStartX = clientX;
  state.view.pointerStartY = clientY;
  state.view.startOffsetX = state.view.offsetX;
  state.view.startOffsetY = state.view.offsetY;
}

function updatePan(clientX, clientY) {
  if (!state.view.pointerDown) return;

  const dx = clientX - state.view.pointerStartX;
  const dy = clientY - state.view.pointerStartY;

  if (!state.view.isPanning) {
    const distanceSq = (dx * dx) + (dy * dy);
    if (distanceSq < VIEW_DRAG_THRESHOLD_PX * VIEW_DRAG_THRESHOLD_PX) {
      return;
    }
    state.view.isPanning = true;
    canvas.style.cursor = "grabbing";
  }

  state.view.offsetX = state.view.startOffsetX + dx;
  state.view.offsetY = state.view.startOffsetY + dy;
  clampViewOffset();

  if (state.lastRaster) {
    drawRasterToViewport(state.lastRaster);
  }
}

function endPan(event) {
  if (!state.view.pointerDown) return;

  const wasPanning = state.view.isPanning;
  state.view.pointerDown = false;
  state.view.isPanning = false;
  canvas.style.cursor = "";

  if (!wasPanning && event.button === 0) {
    if (state.editorMode === "resources") {
      addResourceZoneFromClick(event.clientX, event.clientY);
      return;
    }
    if (state.editorMode === "terrain") {
      addRiverSourceFromClick(event.clientX, event.clientY);
    }
  }
}

function hasActiveKeyPan() {
  const keyPan = state.view.keyPan;
  return keyPan.up || keyPan.down || keyPan.left || keyPan.right;
}

function drawAfterCameraChange() {
  if (state.lastRaster) {
    drawRasterToViewport(state.lastRaster);
  }
}

function stepKeyPan(ts) {
  const keyPan = state.view.keyPan;
  if (!hasActiveKeyPan()) {
    keyPan.frameId = 0;
    keyPan.lastTs = 0;
    return;
  }

  if (!keyPan.lastTs) {
    keyPan.lastTs = ts;
  }

  const dt = clamp((ts - keyPan.lastTs) / 1000, 0, 0.05);
  keyPan.lastTs = ts;

  let dx = 0;
  let dy = 0;
  if (keyPan.left) dx += 1;
  if (keyPan.right) dx -= 1;
  if (keyPan.up) dy += 1;
  if (keyPan.down) dy -= 1;

  const magnitude = Math.hypot(dx, dy);
  if (magnitude > 0) {
    dx /= magnitude;
    dy /= magnitude;
    const step = VIEW_KEYPAN_SPEED_PX_PER_SEC * dt;
    state.view.offsetX += dx * step;
    state.view.offsetY += dy * step;
    clampViewOffset();
    drawAfterCameraChange();
  }

  keyPan.frameId = window.requestAnimationFrame(stepKeyPan);
}

function ensureKeyPanLoop() {
  const keyPan = state.view.keyPan;
  if (keyPan.frameId || !hasActiveKeyPan()) return;
  keyPan.lastTs = 0;
  keyPan.frameId = window.requestAnimationFrame(stepKeyPan);
}

function stopKeyPanLoop() {
  const keyPan = state.view.keyPan;
  if (keyPan.frameId) {
    window.cancelAnimationFrame(keyPan.frameId);
    keyPan.frameId = 0;
  }
  keyPan.lastTs = 0;
}

function clearKeyPanState() {
  const keyPan = state.view.keyPan;
  keyPan.up = false;
  keyPan.down = false;
  keyPan.left = false;
  keyPan.right = false;
  stopKeyPanLoop();
}

function handleKeyPanChange(code, isDown) {
  const keyPan = state.view.keyPan;
  let changed = false;
  if (code === "KeyW" && keyPan.up !== isDown) {
    keyPan.up = isDown;
    changed = true;
  } else if (code === "KeyS" && keyPan.down !== isDown) {
    keyPan.down = isDown;
    changed = true;
  } else if (code === "KeyA" && keyPan.left !== isDown) {
    keyPan.left = isDown;
    changed = true;
  } else if (code === "KeyD" && keyPan.right !== isDown) {
    keyPan.right = isDown;
    changed = true;
  }

  if (!changed) return false;
  if (hasActiveKeyPan()) {
    ensureKeyPanLoop();
  } else {
    stopKeyPanLoop();
  }
  return true;
}

regenerateBtn.addEventListener("click", () => {
  renderTerrain({ newSeed: true });
});

if (exportMapIdInput && exportDisplayNameInput) {
  exportMapIdInput.addEventListener("input", () => {
    setExportStatus("Ready");
  });

  exportMapIdInput.addEventListener("blur", () => {
    const normalized = normalizeMapId(exportMapIdInput.value);
    exportMapIdInput.value = normalized;
    if (!exportDisplayNameInput.value.trim()) {
      exportDisplayNameInput.value = mapIdToDisplayName(normalized);
    }
  });

  exportDisplayNameInput.addEventListener("input", () => {
    if (!exportDisplayNameInput.value.trim()) {
      setExportStatus("Ready");
      return;
    }
    setExportStatus("Ready");
  });
}

if (exportBundleBtn) {
  exportBundleBtn.addEventListener("click", async () => {
    try {
      await exportBundle();
    } catch (error) {
      setExportStatus(`Export failed: ${error.message}`, true);
    }
  });
}

panelToggleBtn.addEventListener("click", () => {
  state.controlsCollapsed = !state.controlsCollapsed;
  applyControlsPanelState();
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextMode = button.getAttribute("data-mode");
    if (!nextMode || nextMode === state.editorMode) return;
    state.editorMode = nextMode;
    applyEditorModeState();
    updateLabels();
    if (state.editorMode === "resources") {
      updateResourceStats();
    } else if (state.currentOutput) {
      updateStats(state.currentOutput.stats);
    }
    if (state.lastRaster) {
      drawRasterToViewport(state.lastRaster);
    }
  });
});

algorithmButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const next = button.getAttribute("data-algo");
    if (!next || next === state.algorithm) return;
    state.algorithm = next;
    algorithmButtons.forEach((candidate) => {
      candidate.classList.toggle("is-active", candidate.getAttribute("data-algo") === state.algorithm);
    });
    updateLabels();
    renderTerrain({ newSeed: false });
  });
});

smoothnessSlider.addEventListener("input", () => {
  updateLabels();
  scheduleRegenerate();
});

continentScaleSlider.addEventListener("input", () => {
  updateLabels();
  scheduleRegenerate();
});

seaLevelSlider.addEventListener("input", () => {
  updateLabels();
  scheduleRegenerate();
});

mountaintopSlider.addEventListener("input", () => {
  updateLabels();
  scheduleRegenerate();
});

resetRiversBtn.addEventListener("click", () => {
  resetRivers();
});

removeAllRiversBtn.addEventListener("click", () => {
  removeAllRivers();
});

resourceTypeSelect.addEventListener("input", () => {
  updateLabels();
});

resourceStrengthSlider.addEventListener("input", () => {
  updateLabels();
  if (state.lastRaster && state.editorMode === "resources") {
    drawRasterToViewport(state.lastRaster);
  }
});

shorelineReliefToggle.addEventListener("input", () => {
  state.visualEffects.shorelineRelief = shorelineReliefToggle.checked;
  updateLabels();
  renderTerrain({ newSeed: false, skipRiverAnimation: true });
});

riverReliefToggle.addEventListener("input", () => {
  state.visualEffects.riverRelief = riverReliefToggle.checked;
  updateLabels();
  renderTerrain({ newSeed: false, skipRiverAnimation: true });
});

shadowEffectToggle.addEventListener("input", () => {
  state.visualEffects.shadowEffect = shadowEffectToggle.checked;
  updateLabels();
  renderTerrain({ newSeed: false, skipRiverAnimation: true });
});

shadowStrengthSlider.addEventListener("input", () => {
  state.visualEffects.shadowStrength = clamp(
    Number(shadowStrengthSlider.value) || 0,
    0,
    SHADOW_STRENGTH_MAX
  );
  updateLabels();
  if (!state.visualEffects.shadowEffect) return;
  renderTerrain({ newSeed: false, skipRiverAnimation: true });
});

shadowLengthSlider.addEventListener("input", () => {
  state.visualEffects.shadowLength = clamp(Number(shadowLengthSlider.value) || 0, 20, 260);
  updateLabels();
  if (!state.visualEffects.shadowEffect) return;
  renderTerrain({ newSeed: false, skipRiverAnimation: true });
});

peakLighteningSlider.addEventListener("input", () => {
  state.visualEffects.peakLightening = clamp(Number(peakLighteningSlider.value) || 0, 0, 100);
  updateLabels();
  if (!state.visualEffects.shadowEffect) return;
  renderTerrain({ newSeed: false, skipRiverAnimation: true });
});

prominenceThresholdSlider.addEventListener("input", () => {
  state.visualEffects.prominenceThreshold = clamp(Number(prominenceThresholdSlider.value) || 0, 1, 35);
  updateLabels();
  if (!state.visualEffects.shadowEffect) return;
  renderTerrain({ newSeed: false, skipRiverAnimation: true });
});

undoZoneBtn.addEventListener("click", () => {
  undoLastResourceZone();
});

clearZonesBtn.addEventListener("click", () => {
  clearAllResourceZones();
});

canvas.addEventListener("mousedown", (event) => {
  if (event.button === 2) {
    event.preventDefault();
    if (state.editorMode === "terrain") {
      beginDeletePreview(event.clientX, event.clientY);
    } else if (state.editorMode === "resources") {
      removeResourceZoneNearClick(event.clientX, event.clientY);
    }
    return;
  }
  if (event.button !== 0) return;
  beginPan(event.clientX, event.clientY);
});

canvas.addEventListener("mousemove", (event) => {
  updatePan(event.clientX, event.clientY);
  if (state.editorMode === "terrain") {
    if (state.deletePreview.active && (event.buttons & 2) === 0) {
      endDeletePreview();
      return;
    }
    updateDeletePreview(event.clientX, event.clientY);
    return;
  }
  endDeletePreview();
});

canvas.addEventListener("mouseup", (event) => {
  if (event.button === 2) {
    if (state.editorMode === "terrain") {
      event.preventDefault();
      endDeletePreview({ deleteRiver: true, clientX: event.clientX, clientY: event.clientY });
    }
    return;
  }
  endPan(event);
});

canvas.addEventListener("mouseleave", (event) => {
  endDeletePreview();
  endPan(event);
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? VIEW_ZOOM_STEP : 1 / VIEW_ZOOM_STEP;
    zoomAtClientPoint(event.clientX, event.clientY, zoomFactor);
  },
  { passive: false }
);

window.addEventListener("resize", () => {
  resizeCanvas();
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => renderTerrain({ newSeed: false }), 180);
});

window.addEventListener("mouseup", (event) => {
  if (event.button !== 2) return;
  endDeletePreview();
});

window.addEventListener("blur", () => {
  endDeletePreview();
  clearKeyPanState();
});

window.addEventListener("keydown", (event) => {
  if (!event.metaKey && !event.ctrlKey && !event.altKey) {
    const handledPan = handleKeyPanChange(event.code, true);
    if (handledPan) {
      event.preventDefault();
      return;
    }
  }
  if (event.code === "KeyR") {
    event.preventDefault();
    renderTerrain({ newSeed: true });
  }
});

window.addEventListener("keyup", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const handledPan = handleKeyPanChange(event.code, false);
  if (handledPan) {
    event.preventDefault();
  }
});

resizeCanvas();
updateLabels();
applyControlsPanelState();
applyEditorModeState();
initializeExportFields();
setExportStatus("Ready");
renderTerrain({ newSeed: false });
