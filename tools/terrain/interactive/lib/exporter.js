import { clamp } from "./math.js";

const COMMIT_HASH_UNKNOWN = "unknown";
const COMMIT_HASH_PATTERN = /^[0-9a-f]{40}$/i;

export function createExportController({
  state,
  controls,
  constants,
  computePolygonAreaPx,
}) {
  const {
    exportMapIdInput,
    exportDisplayNameInput,
    exportStatusValue,
    smoothnessSlider,
    continentScaleSlider,
    seaLevelSlider,
    mountaintopSlider,
    resourceTypeSelect,
    resourceStrengthSlider,
  } = controls;

  const {
    exportImageBasePath,
    resourceVertexSnapPx,
    riverWidthPx,
  } = constants;

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

  function isValidCommitHash(value) {
    const normalized = String(value || "").trim();
    return COMMIT_HASH_PATTERN.test(normalized);
  }

  function parsePackedRefsCommitHash(packedRefsText, refPath) {
    if (!packedRefsText || !refPath) return null;
    const lines = packedRefsText.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (!line || line.startsWith("#") || line.startsWith("^")) continue;
      const split = line.split(" ");
      if (split.length < 2) continue;
      const hash = split[0].trim();
      const ref = split[split.length - 1].trim();
      if (ref !== refPath) continue;
      if (isValidCommitHash(hash)) {
        return hash.toLowerCase();
      }
    }
    return null;
  }

  async function fetchTextNoStore(urlPath) {
    const response = await fetch(urlPath, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}) for ${urlPath}`);
    }
    return (await response.text()).trim();
  }

  async function resolveGitCommitHash() {
    try {
      const headText = await fetchTextNoStore("/.git/HEAD");
      if (isValidCommitHash(headText)) {
        return headText.toLowerCase();
      }

      const refMatch = headText.match(/^ref:\s*(.+)$/i);
      if (!refMatch) {
        return COMMIT_HASH_UNKNOWN;
      }

      const refPath = refMatch[1].trim().replace(/^\/+/, "");
      if (!refPath || refPath.includes("..")) {
        return COMMIT_HASH_UNKNOWN;
      }

      try {
        const refText = await fetchTextNoStore(`/.git/${refPath}`);
        if (isValidCommitHash(refText)) {
          return refText.toLowerCase();
        }
      } catch {
        // Fallback to packed-refs lookup below.
      }

      try {
        const packedRefs = await fetchTextNoStore("/.git/packed-refs");
        const packedRefHash = parsePackedRefsCommitHash(packedRefs, refPath);
        if (packedRefHash) {
          return packedRefHash;
        }
      } catch {
        // Ignore and fall through to unknown hash.
      }
    } catch {
      // Ignore and fall through to unknown hash.
    }
    return COMMIT_HASH_UNKNOWN;
  }

  async function ensureCommitHashResolved() {
    if (isValidCommitHash(state.commitHash)) {
      return state.commitHash;
    }
    if (state.commitHashPromise) {
      return state.commitHashPromise;
    }

    state.commitHashPromise = (async () => {
      const resolved = await resolveGitCommitHash();
      state.commitHash = resolved;
      return resolved;
    })();

    try {
      return await state.commitHashPromise;
    } finally {
      state.commitHashPromise = null;
    }
  }

  function buildGenerationParametersSnapshot(output) {
    const terrainParams = {
      algorithm: state.algorithm,
      seed: state.seed,
      river_seed: state.riverSeed,
      smoothness: Number(smoothnessSlider.value),
      continent_scale_percent: Number(continentScaleSlider.value),
      sea_level_percent: Number(seaLevelSlider.value),
      snowcaps_percent: Number(mountaintopSlider.value),
      rivers_requested: state.riverCount,
      rivers_generated: output?.stats?.riverSourceCount ?? 0,
      river_width_px: riverWidthPx,
    };

    const resourceZoneParams = state.resourceZones
      .filter((zone) => Array.isArray(zone.vertices) && zone.vertices.length >= 3)
      .map((zone, index) => {
        const polygon = normalizedVerticesToPixelPolygon(zone.vertices, output.width, output.height);
        const areaPx = computePolygonAreaPx(polygon);
        return {
          index: index + 1,
          resource: mapResourceTypeToSpec(zone.type),
          strength_percent: clamp(Math.round(Number(zone.strength) || 0), 0, 100),
          vertex_count: polygon.length,
          polygon_area_px: Math.round(areaPx),
        };
      });

    const resourceParams = {
      selected_resource_type: mapResourceTypeToSpec(resourceTypeSelect.value),
      zone_strength_percent: Number(resourceStrengthSlider.value),
      vertex_snap_px: resourceVertexSnapPx,
      draft_vertex_count: state.resourceDraftVertices.length,
      zone_count: state.resourceZones.length,
      zones: resourceZoneParams,
    };

    const visualEffectsParams = {
      shoreline_relief_enabled: Boolean(state.visualEffects.shorelineRelief),
      river_relief_enabled: Boolean(state.visualEffects.riverRelief),
      shadow_effect_enabled: Boolean(state.visualEffects.shadowEffect),
      shadow_amount_percent: Number(state.visualEffects.shadowStrength),
      shadow_length_px: Number(state.visualEffects.shadowLength),
      peak_lightening_percent: Number(state.visualEffects.peakLightening),
      prominence_threshold_percent: Number(state.visualEffects.prominenceThreshold),
    };

    return {
      terrain: terrainParams,
      resources: resourceParams,
      visual_effects: visualEffectsParams,
    };
  }

  function buildExportDocuments(mapId, displayName, output) {
    const metadataFileName = `${mapId}.metadata.json`;
    const imageFileName = `${mapId}.png`;
    const imageUrl = `${exportImageBasePath}/${imageFileName}`;
    const resourceZones = buildExportResourceZones(output.width, output.height);
    const generationParameters = buildGenerationParametersSnapshot(output);
    const commitHash = isValidCommitHash(state.commitHash) ? state.commitHash : COMMIT_HASH_UNKNOWN;
    const exportedAtUtc = new Date().toISOString();

    const metadata = {
      map_id: mapId,
      display_name: displayName,
      commit_hash: commitHash,
      exported_at_utc: exportedAtUtc,
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
      generation_parameters: generationParameters,
      towns: [],
      coordinate_system: {
        origin: "top-left",
        x_axis: "right",
        y_axis: "down",
        units: "pixels",
      },
      resourceZones,
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
      state.currentOutput,
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
      targetName,
    );
  }

  async function exportBundle() {
    setExportStatus("Resolving commit hash...");
    await ensureCommitHashResolved();
    const { fileNames } = getExportContext();
    setExportStatus("Exporting...");
    await exportMetadataJsonFile(fileNames.metadata);
    await exportCurrentMapPng(fileNames.image);
    setExportStatus(`Exported ${fileNames.image} + ${fileNames.metadata}`);
  }

  return {
    exportBundle,
    initializeExportFields,
    mapIdToDisplayName,
    normalizeMapId,
    preloadCommitHash: ensureCommitHashResolved,
    setExportStatus,
  };
}
