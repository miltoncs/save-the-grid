# Visual Mockups and UI Design

This folder is intentionally implementation-free.

It contains simple SVG mockups so we can discuss visual direction quickly without touching gameplay code or architecture.

## Mockups

- `mockup-gameplay-round-floating-ui.svg`: Full-screen in-round HUD concept with map edge-to-edge and floating controls only.

Earlier mockup variants were removed during repository cleanup; re-add them as separate files when needed.

## Runtime-Coupled Artifacts (Moved Out of `docs/`)

- Terrain PNG used by runtime:
  - `../../assets/maps/terrain/mockup-terrain-map.png`
- Terrain metadata used by runtime:
  - `../../data/maps/terrain/mockup-terrain-map.metadata.json`
- Mission terrain PNG set:
  - `../../assets/maps/terrain/mission-terrain-maps/`
- Terrain generation scripts:
  - `../../tools/terrain/`
  - optional legacy wrappers:
    - `../../tools/terrain/compat/generate_terrain_map_png.py`
    - `../../tools/terrain/compat/generate_mission_terrain_maps.py`

## Current Visual Direction

- Tone: utility control room with clean neon accents.
- Palette: deep slate background, cyan/teal action colors, amber warning highlights.
- Layout: clear panel hierarchy with a large map-first center area.

## Iteration Notes

- Keep changes fast and visual-first.
- Prefer simple shapes and typography over detailed illustration.
- Add new concepts as extra SVG files instead of replacing old ones.
- For gameplay screen iteration, modify map and UI in their separate layer files first, then validate the combined file.
- Keep this folder free of runtime source assets and generator scripts.
