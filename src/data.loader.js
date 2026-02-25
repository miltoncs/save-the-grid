import { BASE_MAP } from "./data.content.js";

const MAP_INDEX_URL = "/data/maps/index.json";
const MAP_FILES_BASE_URL = "/data/maps";

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toPointRecord(rawPoint) {
  if (!rawPoint || typeof rawPoint !== "object") return null;
  const x = toFiniteNumber(rawPoint.x, NaN);
  const y = toFiniteNumber(rawPoint.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function normalizeTownRecord(rawTown, fallbackTown, index) {
  const fallback = fallbackTown || {};
  const starter = rawTown?.starterAssets || {};
  return {
    id: String(rawTown?.id || fallback.id || `town-${index + 1}`),
    name: String(rawTown?.name || fallback.name || `Town ${index + 1}`),
    x: toFiniteNumber(rawTown?.x, fallback.x || 0),
    y: toFiniteNumber(rawTown?.y, fallback.y || 0),
    radius: Math.max(20, toFiniteNumber(rawTown?.radius, fallback.radius || 56)),
    districtType: String(rawTown?.districtType || fallback.districtType || "Rural Cluster"),
    terrain: String(rawTown?.terrain || fallback.terrain || "plains"),
    climate: String(rawTown?.climate || fallback.climate || "temperate"),
    baseDemand: Math.max(0, toFiniteNumber(rawTown?.baseDemand, fallback.baseDemand || 40)),
    population: Math.max(0, toFiniteNumber(rawTown?.population, fallback.population || 20)),
    growthRate: Math.max(0, toFiniteNumber(rawTown?.growthRate, fallback.growthRate || 0.3)),
    starterAssets: {
      plant: Math.max(0, toFiniteNumber(starter.plant, fallback.starterAssets?.plant || 0)),
      substation: Math.max(
        0,
        toFiniteNumber(starter.substation, fallback.starterAssets?.substation || 0),
      ),
      storage: Math.max(0, toFiniteNumber(starter.storage, fallback.starterAssets?.storage || 0)),
    },
    strategicValue: String(rawTown?.strategicValue || fallback.strategicValue || ""),
  };
}

function normalizeResourceZoneRecord(rawZone, index) {
  const zone = rawZone && typeof rawZone === "object" ? rawZone : null;
  const polygon = Array.isArray(zone?.polygon)
    ? zone.polygon.map((point) => toPointRecord(point)).filter(Boolean)
    : [];
  if (polygon.length < 3) return null;
  const resource = String(zone.resource || "");
  if (resource !== "wind" && resource !== "sun" && resource !== "natural_gas") return null;
  return {
    id: String(zone.id || `resource-zone-${index + 1}`),
    resource,
    polygon,
  };
}

function applyMapDocumentToBaseMap(mapDocument) {
  const safeMap = mapDocument && typeof mapDocument === "object" ? mapDocument : null;
  if (!safeMap) return false;
  const world = safeMap.world && typeof safeMap.world === "object" ? safeMap.world : {};
  const sourceTowns = Array.isArray(safeMap.towns) ? safeMap.towns : [];
  if (!sourceTowns.length) return false;

  const townFallbacks = Array.isArray(BASE_MAP.towns) && BASE_MAP.towns.length
    ? BASE_MAP.towns
    : [];
  const normalizedTowns = sourceTowns.map((town, index) =>
    normalizeTownRecord(
      town,
      townFallbacks.length ? townFallbacks[index % townFallbacks.length] : null,
      index,
    ),
  );

  BASE_MAP.id = String(safeMap.mapId || BASE_MAP.id || "national-core");
  BASE_MAP.name = String(safeMap.displayName || BASE_MAP.name || "National Grid Core");
  BASE_MAP.width = Math.max(600, toFiniteNumber(world.width, BASE_MAP.width));
  BASE_MAP.height = Math.max(400, toFiniteNumber(world.height, BASE_MAP.height));
  BASE_MAP.towns = normalizedTowns;
  BASE_MAP.links = Array.isArray(safeMap.links)
    ? safeMap.links
        .map((link, index) => {
          if (!link || typeof link !== "object") return null;
          const a = String(link.a || "");
          const b = String(link.b || "");
          if (!a || !b) return null;
          return {
            id: String(link.id || `link-${index + 1}`),
            a,
            b,
            tier: String(link.tier || "regional"),
            capacity: Math.max(0, toFiniteNumber(link.capacity, 0)),
            buildCost: Math.max(0, toFiniteNumber(link.buildCost, 0)),
          };
        })
        .filter(Boolean)
    : [];
  BASE_MAP.resourceZones = Array.isArray(safeMap.resourceZones)
    ? safeMap.resourceZones
        .map((zone, index) => normalizeResourceZoneRecord(zone, index))
        .filter(Boolean)
    : [];

  const terrainMap = safeMap.terrainMap && typeof safeMap.terrainMap === "object" ? safeMap.terrainMap : {};
  if (terrainMap.imageUrl) {
    BASE_MAP.terrainMapImageUrl = String(terrainMap.imageUrl);
  }
  if (terrainMap.metadataUrl) {
    BASE_MAP.terrainMapMetadataUrl = String(terrainMap.metadataUrl);
  }

  return true;
}

async function fetchJsonDocument(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function resolveMapUrl(indexDocument, requestedMapId = "") {
  const index = indexDocument && typeof indexDocument === "object" ? indexDocument : null;
  if (!index || !Array.isArray(index.maps)) {
    return `${MAP_FILES_BASE_URL}/national_core.map.json`;
  }
  const preferredId = String(requestedMapId || index.defaultMapId || "").trim();
  const match =
    index.maps.find((entry) => entry && entry.id === preferredId) ||
    index.maps.find((entry) => entry && typeof entry.file === "string");
  if (!match || !match.file) {
    return `${MAP_FILES_BASE_URL}/national_core.map.json`;
  }
  return `${MAP_FILES_BASE_URL}/${String(match.file)}`;
}

export async function preloadRuntimeMapContent(requestedMapId = "") {
  const indexDocument = await fetchJsonDocument(MAP_INDEX_URL);
  const mapUrl = resolveMapUrl(indexDocument, requestedMapId || BASE_MAP.id);
  const mapDocument = await fetchJsonDocument(mapUrl);
  if (!mapDocument) return false;
  return applyMapDocumentToBaseMap(mapDocument);
}
