# Interactive Terrain Lab

Fullscreen browser app for tuning topology-based map generation.

## Controls

- `Re-generate`: creates a new random-seed terrain map.
- `Algorithm`: switch between `Topology` and `Midpoint`.
- `Smoothness`: controls how rough vs smooth the terrain appears.
- `Sea Level`: controls waterline percentile (higher = more water).
- `Mountaintops Level`: controls the height percentile where white mountaintops begin.
- `Rivers`: sets the number of randomly seeded river sources on land.
- `River Forking`: controls the chance that a river splits into a second downstream branch when multiple lower neighbors exist.
- `Reset Rivers`: restores default river settings and redraws a new river pass on the same terrain.

## Run

From repo root:

```bash
npm run serve
```

Open:

- `http://127.0.0.1:5173/tools/terrain/interactive/`
