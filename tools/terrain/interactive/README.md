# Interactive Terrain Lab

Fullscreen browser app for tuning topology-based map generation.

## Controls

- `Re-generate`: creates a new random-seed terrain map.
- `Mode Toggle` (bottom): switches between `Terrain` and `Resources`.
- `Terrain` mode: full topology + river tuning controls (existing workflow).
- `Resources` mode: barebones zone authoring controls for setup iteration.
- `Algorithm`: switch between `Topology` and `Midpoint`.
- `Smoothness`: controls how rough vs smooth the terrain appears.
- `Continent Scale`: controls only low-frequency topology layers (continent mask + macro noise). Higher values create more fragmented large-scale landmasses.
- `Sea Level`: controls waterline percentile (higher = more water).
- `Mountaintops Level`: controls the height percentile where white mountaintops begin.
- `Rivers`: shows the current number of active river sources (map starts with 6 random sources).
- `Reset Rivers`: restores default river settings and redraws a new river pass on the same terrain.
- `Remove All Rivers`: clears all river sources from the current map.
- `Resource Type`: selects the zone class (`Wind`, `Sun`, `Natural Gas`) in resources mode.
- `Vertex Snap`: controls how close a click must be to reuse an existing draft vertex and close a polygon.
- `Zone Strength`: controls resource-zone overlay intensity in resources mode.
- `Close Draft Polygon`: commits the draft polygon as a resource zone.
- `Undo Draft Vertex`: removes the most recent draft vertex.
- `Clear Draft`: clears all uncommitted draft vertices.
- `Undo Last Zone`: removes the most recently placed resource zone.
- `Clear Zones`: removes all placed resource zones.
- `Minimize / Maximize`: collapses or re-expands the floating control panel.
- `Map Pan`: left-drag the map to pan around.
- `Map Zoom`: mouse wheel / trackpad scroll zooms in and out around cursor position.
- `Map WASD`: hold `W/A/S/D` to pan with keyboard.
- `Map Click`: left click any land area to add a new river source at that point; only the new river is animated. Water clicks are ignored.
- `Map Right Hold`: hold right click to preview deletion radius with a transparent red circle.
- `Map Right Click`: right click near any river start/source to remove that river from the network (without replaying river animation).
- `Map Click` in resources mode: left click land to place draft polygon vertices.
- `Map Vertex Snap` in resources mode: clicking near an existing draft vertex reuses it and closes the polygon.
- `Map Right Click` in resources mode: remove the zone under cursor (fallback: nearest zone vertex in range).

## Run

From repo root:

```bash
npm run serve
```

Open:

- `http://127.0.0.1:5173/tools/terrain/interactive/`
