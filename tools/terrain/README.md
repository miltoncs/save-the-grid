# Terrain Generation Tools

Scripts in this folder generate terrain map imagery for runtime use.

## Scripts

- `generate_terrain_map_png.py`:
  Generates `/assets/maps/terrain/mockup-terrain-map.png`.
- `generate_mission_terrain_maps.py`:
  Generates mission terrain set under `/assets/maps/terrain/mission-terrain-maps/`.

## Notes

- These scripts are deterministic from their current parameters and mission IDs.
- Regeneration may overwrite previously generated PNG outputs in `/assets/maps/terrain/`.
