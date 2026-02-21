# Save the Grid

Browser-native strategy game prototype focused on real-time power-grid operations.

## Project Layout

- `src/`: gameplay runtime, UI flow, and styles (`src/README.md`).
- `assets/`: runtime-served static files (icons, terrain images).
- `data/`: runtime JSON/content contracts (maps, metadata).
- `tools/`: generation tools and interactive authoring utilities.
- `docs/`: design, implementation, and visual mockup documentation only.
- `bot-player/`: Playwright bot runner and smoke scenarios.

## Run

```bash
npm run serve
```

Then open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Structure Rules

- Do not place executable scripts under `docs/`.
- Keep authored runtime content in `data/`.
- Keep runtime-consumed binaries in `assets/`.
- Keep generation and migration scripts in `tools/`.
