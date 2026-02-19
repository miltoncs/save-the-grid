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
  Generates mission terrain set under `/assets/maps/terrain/mission-terrain-maps/`.

## Notes

- These scripts are deterministic from their current parameters and mission IDs.
- Regeneration may overwrite previously generated PNG outputs in `/assets/maps/terrain/`.
