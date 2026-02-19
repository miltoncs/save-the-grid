# Map Storage and Resource Zone Spec

Status: Draft v0.1  
Last updated: 2026-02-19

## 1. Decision Summary

This project will store maps as authored JSON content packs, with one primary file per map.

Decision:

1. Store each map in `data/maps/<mapId>.map.json`.
2. Keep gameplay-critical map data in that single JSON file for deterministic loading.
3. Store resource zones inside the map file under `resourceZones[]`.
4. Treat resource zones as static authored map features (not procedurally generated in MVP).
5. Keep resource effects shallow and explicit (multipliers + optional reserve), avoiding deep extraction simulation.
6. Represent demand directly through town seeds/spawn anchors (no region service-hub layer).
7. Do not encode pre-authored major transmission corridors; long-distance `Line` topology is player-built at runtime.

This matches design constraints in:

- `../design/MAP_DESIGN_2D.md` (handcrafted maps, layered 2D model).
- `../design/GAME_DESIGN.md` (shallow simulation boundaries).
- `../design/MULTIPLAYER_NOTES.md` (explicit, auditable rules and scenario packets).

## 2. File Layout

```txt
data/
  maps/
    index.json
    national_core.map.json
    expansion_north.map.json
    resilience_peak.map.json
```

### 2.1 `index.json`

`index.json` provides fast map discovery in menus and validation checks.

Example:

```json
{
  "contentVersion": 1,
  "maps": [
    {
      "id": "national_core",
      "file": "national_core.map.json",
      "displayName": "National Core",
      "sizeClass": "small",
      "routingComplexity": "simple"
    }
  ]
}
```

## 3. Map Document Contract

Each `*.map.json` file contains geometry, gameplay metadata, authored entities, and resource zones.

```ts
type MapDocument = {
  contentVersion: number;
  mapId: string;
  displayName: string;
  biomePalette: "temperate" | "arid" | "mixed";
  world: {
    width: number;
    height: number;
    coordinateSystem: "origin_top_left_y_down";
  };
  camera: {
    zoomLevels: number[];
    boundsPadding: number;
  };
  townSeeds: TownSeedRecord[];
  townSpawnAnchors: TownSpawnAnchorRecord[];
  nodeSlots: NodeSlotRecord[];
  starterInfrastructure: StarterInfrastructureRecord[];
  terrainZones: TerrainZoneRecord[];
  climateZones: ClimateZoneRecord[];
  resourceZones: ResourceZoneRecord[];
  authoredEvents?: AuthoredEventRecord[];
};
```

## 4. Geometry Model

MVP map geometry supports two shapes:

1. Polygon
2. Circle

```ts
type GeometryShape =
  | { kind: "polygon"; points: [number, number][] }
  | { kind: "circle"; center: [number, number]; radius: number };
```

Rules:

1. All coordinates are in world units.
2. Origin is top-left, x grows right, y grows down.
3. Polygon points must be clockwise and non-self-intersecting.
4. Shapes must stay within `world.width` and `world.height`.

## 5. Resource Zone Storage Model

`resourceZones[]` is the authoritative source for map-based resource effects.

```ts
type ResourceZoneRecord = {
  id: string;
  resourceType:
    | "coal"
    | "gas"
    | "hydro"
    | "solar"
    | "wind"
    | "geothermal"
    | "uranium"
    | "biomass";
  geometry: GeometryShape;
  compatibility: {
    allowedPlantTags: string[];
    minCoverageRatio: number;
  };
  modifiers: {
    buildCostMultiplier: number;
    outputMultiplier: number;
    operatingCostMultiplier: number;
    reliabilityDelta: number;
    incidentRiskDelta?: Partial<Record<string, number>>;
  };
  supplyModel: {
    kind: "renewable" | "depletable";
    maxOutputBonusMW: number;
    reserveMWh?: number;
    regenerationPerTickMWh?: number;
  };
  ui: {
    label: string;
    colorHex: string;
    priority: "low" | "normal" | "high";
  };
};
```

### 5.1 Gameplay Semantics

1. A build slot gets zone effects when placement overlap is `>= minCoverageRatio`.
2. Multiple overlapping zones stack additively per modifier type, then clamp using game-level limits.
3. `supplyModel.kind = renewable` means no depletion pressure in MVP.
4. `supplyModel.kind = depletable` reduces `reserveMWh` when linked plant output draws zone bonus.
5. If `reserveMWh` reaches zero, zone bonus output becomes zero until regenerated (if configured) or mission end.

### 5.2 Scope Boundary

To preserve shallow simulation:

1. No extraction logistics network.
2. No transport chain between resource site and plant.
3. No per-worker or per-fuel market micro-simulation.
4. Resource zones only influence placement economics, output profile, and reliability/incident modifiers.

## 6. Runtime Loading and Querying

At map load time:

1. Validate map JSON with `MapSchema` and `ResourceZoneSchema`.
2. Build a spatial index for `terrainZones`, `townSeeds`, and `resourceZones`.
3. Precompute slot-to-zone influence map for all `nodeSlots`.
4. Store resolved results in immutable runtime map state.

At command execution (`build`):

1. Resolve selected `nodeSlot`.
2. Check compatible overlapping `resourceZones`.
3. Apply zone multipliers to placement preview and committed asset stats.
4. Persist zone-linked state in run snapshot for deterministic save/load.

## 7. Validation Rules

`ResourceZoneSchema` should enforce:

1. `id` uniqueness within map.
2. `minCoverageRatio` in range `[0, 1]`.
3. Multipliers greater than `0`.
4. `reliabilityDelta` in bounded range (recommended `[-1, 1]`).
5. `reserveMWh` required only for `depletable` zones.
6. No invalid geometry (self-intersection, zero-area polygons, out-of-bounds points).

## 8. Example Map Snippet

```json
{
  "contentVersion": 1,
  "mapId": "national_core",
  "displayName": "National Core",
  "world": { "width": 2400, "height": 1400, "coordinateSystem": "origin_top_left_y_down" },
  "townSeeds": [
    {
      "id": "town_alpha",
      "name": "Alpha",
      "position": [460, 520],
      "baseDemandMW": 18,
      "population": 12000,
      "climateTag": "temperate"
    }
  ],
  "resourceZones": [
    {
      "id": "rz_west_hydro_basin",
      "resourceType": "hydro",
      "geometry": {
        "kind": "polygon",
        "points": [[280, 420], [520, 390], [580, 620], [300, 650]]
      },
      "compatibility": {
        "allowedPlantTags": ["hydro", "storage_pumped"],
        "minCoverageRatio": 0.35
      },
      "modifiers": {
        "buildCostMultiplier": 0.9,
        "outputMultiplier": 1.25,
        "operatingCostMultiplier": 0.95,
        "reliabilityDelta": 0.08,
        "incidentRiskDelta": { "drought": 0.15 }
      },
      "supplyModel": {
        "kind": "renewable",
        "maxOutputBonusMW": 120
      },
      "ui": {
        "label": "West Basin",
        "colorHex": "#4CA7D9",
        "priority": "normal"
      }
    }
  ]
}
```

## 9. Versioning and Migration

1. Increment `contentVersion` for map schema changes.
2. Add deterministic migration scripts for version bumps that affect gameplay values.
3. Never silently reinterpret existing resource zone fields.
4. Keep old map fixtures in tests to verify migration behavior.

## 10. Related Implementation Docs

- `ARCHITECTURE.md` for runtime and module boundaries.
- `README.md` for implementation doc index.
