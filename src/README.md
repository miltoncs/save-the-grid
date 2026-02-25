# Runtime Source Layout

- `main.js`: app bootstrap and runtime map preload.
- `game.js`: game runtime + app shell classes.
- `game/runtime.js`: in-run simulation, rendering, and input runtime.
- `game/app.js`: app-shell screens and flow orchestration.
- `game/core.js`: shared game constants, config builders, and utility helpers.
- `data.content.js`: authored gameplay constants/content.
- `data.loader.js`: runtime map preload and map document normalization.
- `data.js`: barrel exports for content + loader entrypoint.
- `styles.css`: CSS entrypoint that imports split style modules from `styles/`.
- `styles/`: segmented stylesheets (`base`, `setup`, `run`, `end`, `responsive`).
