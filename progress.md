Original prompt: Develop the game MVP based on all provided documentation

## Current Progress Log (Active)

This file now tracks current/near-term work only.

Historical detailed logs were archived to:

- `docs/implementation/archive/progress-legacy-2026-02.md`

## 2026-02-25

### Structure + Architecture cleanup

- Split runtime/app entry modules:
  - `src/game/runtime.js`
  - `src/game/app.js`
  - `src/game.js` now acts as a barrel export.
- Split authored content from loader logic:
  - `src/data.content.js`
  - `src/data.loader.js`
  - `src/data.js` now re-exports both.
- Split bot runner internals:
  - `bot-player/lib/cli.mjs`
  - `bot-player/lib/scenario.mjs`
  - `bot-player/lib/actions.mjs`
  - `bot-player/lib/tutorial-beat.mjs`
- Split terrain interactive export subsystem:
  - `tools/terrain/interactive/lib/exporter.js`

### Data contract cleanup

- Canonicalized metadata resource-zone key to `resourceZones`.
- Added backward-compatible runtime read for legacy `resource_zones`.
- Moved tutorial terrain metadata to:
  - `data/maps/terrain/tutorial-core.metadata.json`
- Set tutorial metadata image path to:
  - `/assets/maps/tutorial/terrain-map-4143667724.png`
- Removed duplicate `resourceZones` from:
  - `data/maps/national_core.map.json`

### Tooling path cleanup

- Moved mission terrain generation manifest from runtime assets to data:
  - `data/maps/terrain/mission-terrain-maps.index.json`
- Added canonical mission id source for generation scripts:
  - `data/missions/campaign-missions.index.json`
- Updated mission terrain generator to read mission IDs from data index.

### Asset/tool boundary cleanup

- Moved asset preview pages out of runtime `assets/` to tooling:
  - `tools/previews/icons-circular-preview.html`
  - `tools/previews/powerlines-preview.html`

### Docs cleanup

- Updated architecture/map-storage/docs/readmes to reflect new structure.
- Removed stale missing-file entries in `docs/mockups-ui-design/README.md`.
- Updated bot docs to remove machine-specific absolute paths.
