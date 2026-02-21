# Runtime Source Layout

- `main.js`: app bootstrap and runtime map preload.
- `game.js`: game runtime + app shell classes.
- `game/core.js`: shared game constants, config builders, and utility helpers.
- `data.js`: authored gameplay constants and runtime map preload adapter.
- `styles.css`: CSS entrypoint that imports split style modules from `styles/`.
- `styles/`: segmented stylesheets (`base`, `setup`, `run`, `end`, `responsive`).
