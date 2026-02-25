# Terrain Generation Tools

Scripts in this folder generate terrain map imagery for runtime use.
Core generation logic lives in the shared submodule:

- `../../submodules/topology_mapgen/`

## Scripts

- `generate_terrain_map_png.py`:
  Generates `/assets/maps/terrain/mockup-terrain-map.png` from a topology model:
  - sea level chosen to hit target above-water percentage,
  - plains above sea level (green),
  - slope-based mountains (light brown),
  - highest 5% terrain as mountaintops (white),
  - below sea level as water (blue).
- `generate_mission_terrain_maps.py`:
  Generates mission terrain PNGs under `/assets/maps/terrain/mission-terrain-maps/` and writes the generation manifest to `/data/maps/terrain/mission-terrain-maps.index.json`.
  Mission IDs are read from `/data/missions/campaign-missions.index.json`.
- `compat/generate_terrain_map_png.py`:
  Compatibility wrapper that forwards to `generate_terrain_map_png.py`.
- `compat/generate_mission_terrain_maps.py`:
  Compatibility wrapper that forwards to `generate_mission_terrain_maps.py`.

## Notes

- These scripts are deterministic from their current parameters and mission IDs.
- Regeneration may overwrite previously generated PNG outputs in `/assets/maps/terrain/`.
