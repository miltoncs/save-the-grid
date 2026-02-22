# Map Storage and Resource Zone Spec

Status: Draft v0.2
Last updated: 2026-02-21

## 1. Decision Summary

Current map/content storage model:

1. Map catalog is stored in `data/maps/index.json`.
2. Each map is stored in a single file: `data/maps/<mapId>.map.json`.
3. Runtime gameplay map data is loaded from map JSON into `BASE_MAP` during app boot.
4. Resource zones may come from either:
   - terrain metadata (`data/maps/terrain/*.metadata.json`), or
   - map document `resourceZones[]` fallback.
5. Resource simulation remains shallow and placement-oriented.

## 2. File Layout

```txt
data/
  maps/
    index.json
    national_core.map.json
    terrain/
      mockup-terrain-map.metadata.json
```

## 3. Catalog Contract (`index.json`)

`index.json` provides map discovery and default map selection.

Current shape:

```json
{
  "contentVersion": 1,
  "defaultMapId": "national-core",
  "maps": [
    {
      "id": "national-core",
      "file": "national_core.map.json",
      "displayName": "National powergrid Core",
      "sizeClass": "large",
      "routingComplexity": "moderate"
    }
  ]
}
```

## 4. Map Document Contract (`*.map.json`)

Current runtime-required fields:

```ts
type MapDocument = {
  contentVersion: number;
  mapId: string;
  displayName: string;
  world: {
    width: number;
    height: number;
    coordinateSystem: "origin_top_left_y_down";
  };
  terrainMap?: {
    imageUrl?: string;
    metadataUrl?: string | null;
  };
  towns: TownRecord[];
  links?: LinkRecord[];
  resourceZones?: ResourceZoneRecord[];
};
```

### 4.1 Town record

```ts
type TownRecord = {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  districtType: string;
  terrain: string;
  climate: string;
  baseDemand: number;
  population: number;
  growthRate: number;
  starterAssets: {
    plant: number;
    substation: number;
    storage: number;
  };
  strategicValue?: string;
};
```

### 4.2 Link record (optional)

```ts
type LinkRecord = {
  id?: string;
  a: string;
  b: string;
  tier?: string;
  capacity?: number;
  buildCost?: number;
};
```

### 4.3 Resource zone record (map fallback)

```ts
type ResourceZoneRecord = {
  id: string;
  resource: "wind" | "sun" | "natural_gas";
  polygon: Array<{ x: number; y: number }>;
};
```

## 5. Terrain Metadata Resource Zones

When terrain metadata is present and includes `resource_zones`, runtime prefers metadata zones over map-file zones.

Expected metadata zone shape:

```ts
type TerrainMetadataResourceZone = {
  id?: string;
  resource: "wind" | "sun" | "natural_gas";
  polygon: Array<{ x: number; y: number }>;
};
```

Runtime behavior:

1. Metadata polygon coordinates are scaled to map world dimensions.
2. Invalid polygons (`< 3` points) are ignored.
3. Unsupported resource types are ignored.
4. If no valid metadata zones exist, map-file `resourceZones[]` is used.

## 6. Runtime Loading Pipeline

### 6.1 Boot preload (`src/data.js`)

1. Fetch `data/maps/index.json`.
2. Resolve selected map file from `defaultMapId` (or requested map ID).
3. Fetch selected `*.map.json`.
4. Normalize fields and hydrate `BASE_MAP`.
5. Fallback safely to built-in defaults on fetch/parse failure.

### 6.2 In-run map init (`src/game.js`)

1. Load terrain image URL from run config / map profile.
2. Load terrain metadata JSON when `metadataUrl` is set.
3. Build `resourceZones` from metadata or map fallback.
4. Compute region resource coverage weights via polygon overlap sampling.

## 7. Resource Zone Gameplay Semantics

Current semantics are intentionally shallow:

1. Zones do not require extraction or transport networks.
2. Zone influence is sampled by overlap around towns/infrastructure points.
3. Influences feed runtime `resourceProfile` weights (`wind`, `sun`, `natural_gas`).
4. Profiles modify generation, operating economics, and reliability behaviors.

## 8. Validation Rules (Current)

Validation is code-based normalization (no external schema library currently):

1. Map must include at least one town.
2. Numeric world/town fields are coerced and clamped to safe defaults.
3. Resource zones require valid resource type + polygon with at least 3 points.
4. Invalid link/zone records are dropped.

## 9. Example Minimal Map Snippet

```json
{
  "contentVersion": 1,
  "mapId": "national-core",
  "displayName": "National powergrid Core",
  "world": {
    "width": 2200,
    "height": 1400,
    "coordinateSystem": "origin_top_left_y_down"
  },
  "terrainMap": {
    "imageUrl": "/assets/maps/terrain/mockup-terrain-map.png",
    "metadataUrl": "/data/maps/terrain/mockup-terrain-map.metadata.json"
  },
  "towns": [
    {
      "id": "capital",
      "name": "Capital Metro",
      "x": 1040,
      "y": 640,
      "radius": 64,
      "districtType": "Urban Core",
      "terrain": "plains",
      "climate": "temperate",
      "baseDemand": 95,
      "population": 120,
      "growthRate": 0.6,
      "starterAssets": { "plant": 2, "substation": 2, "storage": 1 }
    }
  ],
  "resourceZones": [
    {
      "id": "rz-wind-northwest",
      "resource": "wind",
      "polygon": [
        { "x": 170, "y": 220 },
        { "x": 520, "y": 170 },
        { "x": 760, "y": 280 }
      ]
    }
  ]
}
```

## 10. Versioning and Migration

1. Increment `contentVersion` for breaking map format changes.
2. Keep normalization backward-compatible where possible.
3. Add explicit migration scripts when field meaning changes.

## 11. Related Docs

- `ARCHITECTURE.md` for module boundaries and runtime flow.
- `../../data/maps/README.md` for concise map-pack authoring guidance.
