# Interactive Terrain Lab

Fullscreen browser app for tuning topology-based map generation.

## Controls

- `Re-generate`: creates a new random-seed terrain map.
- `New-map Zone Seeding`: each new map auto-places one random polygon zone of each resource type (`Wind`, `Sun`, `Natural Gas`), targeting roughly `5%` coverage per zone.
- `Export Panel` (top-right): one `Export` button downloads the terrain image and metadata together using the storage contracts in `docs/implementation/MAP_STORAGE_AND_RESOURCE_ZONES.md`:
  - `<mapId>.metadata.json`
  - `<mapId>.png`
  - exported metadata declares a blank-town map with `towns: []`
  - exported metadata includes `terrain_generation.algorithm` and `terrain_generation.seed` (plus `river_seed`)
- `Mode Toggle` (bottom): switches between `Terrain`, `Resources`, and `Visual effects`.
- `Terrain` mode: full topology + river tuning controls (existing workflow).
- `Resources` mode: barebones zone authoring controls for setup iteration.
- `Visual effects` mode: map styling controls.
- `Shoreline Relief Colors` (visual effects mode): toggles shoreline relief tinting on/off (green-brown land coast and light-blue sea coast).
- `River Relief Colors` (visual effects mode): toggles river and riverbank tinting using the same coastline tint colors/logic.
- `Shadow Effect` (visual effects mode): enables directional per-pixel light/shadow nudging using surface normals + local prominence.
- `Shadow Amount` (visual effects mode): controls the strength of the shadow nudges when `Shadow Effect` is enabled.
- `Algorithm`: switch between `Topology` and `Midpoint`.
- `Smoothness`: controls how rough vs smooth the terrain appears.
- `Continent Scale`: controls low-frequency continent shaping (continent mask + macro noise) for both `Topology` and `Midpoint`. Higher values create more fragmented large-scale landmasses.
- `Sea Level`: controls waterline percentile (higher = more water).
- `Snowcaps`: controls snow coverage target percent (higher = more white mountain tops). This is inverted from the old mountaintop-threshold behavior.
- `Rivers`: shows the current number of active river sources (map starts with 6 random sources).
- `Reset Rivers`: restores default river settings and redraws a new river pass on the same terrain.
- `Remove All Rivers`: clears all river sources from the current map.
- `Resource Type`: selects the zone class (`Wind`, `Sun`, `Natural Gas`) in resources mode.
- `Vertex Snap`: fixed at `10px`; clicking near an existing draft vertex reuses it and closes the polygon.
- `Zone Strength`: controls resource-zone overlay intensity in resources mode.
- `Undo Last Zone`: removes the most recently placed resource zone.
- `Clear Zones`: removes all placed resource zones.
- `Minimize / Maximize`: collapses or re-expands the floating control panel.
- `Map Pan`: left-drag the map to pan around.
- `Map Zoom`: mouse wheel / trackpad scroll zooms in and out around cursor position.
- `Map WASD`: hold `W/A/S/D` to pan with keyboard.
- `Map Click`: left click any land area to add a new river source at that point; only the new river is animated. Water clicks are ignored.
- `Map Right Hold`: hold right click to preview deletion radius with a transparent red circle.
- `Map Right Click`: right click near any river start/source to remove that river from the network (without replaying river animation).
- `Map Click` in resources mode: left click anywhere on the map (land or water) to place draft polygon vertices.
- `Map Vertex Snap` in resources mode: click near an existing draft vertex (within 10px) to reuse it and close the polygon.
- `Map Right Click` in resources mode: remove the zone under cursor (fallback: nearest zone vertex in range).

## Run

From repo root:

```bash
npm run serve
```

Open:

- `http://127.0.0.1:5173/tools/terrain/interactive/`

## Source Modules

- `app.js`: orchestration and rendering loop.
- `lib/dom.js`: DOM element bindings.
- `lib/math.js`: pure math/noise helpers.
- `lib/resource-zones.js`: resource zone styles + labels.
