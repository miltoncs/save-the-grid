# Map Content Packs

Runtime map content is authored as JSON files.

## Files

- `index.json`: catalog of available maps and default map ID.
- `*.map.json`: one map document per map.
- `terrain/`: terrain metadata payloads referenced by map documents.
  - includes `mission-terrain-maps.index.json` (generation manifest metadata for mission terrain images).

## Runtime Contract Used By Current MVP

A map document should include:

- `mapId`, `displayName`
- `world.width`, `world.height`
- `terrainMap.imageUrl`, `terrainMap.metadataUrl`
- `towns[]` with location/demand metadata
- `links[]` (optional)

Resource zones should be authored in terrain metadata under `resourceZones[]` to avoid duplicate geometry definitions.
Map-level `resourceZones[]` is treated as backward-compatible fallback only.
