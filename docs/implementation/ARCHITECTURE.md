# Save the powergrid Architecture

Status: Draft v0.3
Last updated: 2026-02-25

## 1. Purpose and Scope

This document describes the current implementation architecture for Save the powergrid after the repository re-organization.

It translates design intent from:

- `../design/GAME_DESIGN.md`
- `../design/FRONTEND_AND_UX.md`
- `../design/MAP_DESIGN_2D.md`
- `../design/MISSION_AND_MODE_DESIGN.md`
- `../design/TUTORIAL_MODE_DESIGN.md`
- `../design/MULTIPLAYER_NOTES.md`

Scope:

1. Current browser runtime module boundaries.
2. Current content loading and storage contracts.
3. Current testing and delivery workflow.
4. Near-term extension points.

## 2. Architecture Goals

1. Fast browser startup and low-friction onboarding.
2. Fixed-step simulation behavior for predictable updates.
3. Clear separation between app shell flow, simulation, and rendering.
4. Data-driven map loading for authored map iteration.
5. Local-only persistence for MVP state.
6. Practical testability via Playwright and deterministic debug hooks.

## 3. Technology Stack (Current)

### Runtime and language

- JavaScript ES modules.
- Browser-native execution (no runtime framework dependency).

### Rendering and UI

- Canvas 2D for map and in-run visuals.
- Vanilla JS DOM rendering for splash/menu/setup/run/end screens.
- Split CSS modules imported through `src/styles.css`.

### Content and persistence

- JSON map packs under `data/maps/`.
- In-memory runtime state for active simulation.
- `localStorage` for records, settings, suspended runs, campaign progression, dev mode, and tutorial completion.

### Tooling and validation

- Local static server: `python3 -m http.server 5173`.
- Playwright smoke automation via:
  - `bot-player/`
  - `develop-web-game` client workflow.

## 4. Runtime Module Architecture

### 4.1 Boot sequence

1. `src/main.js` resolves `#app`.
2. `src/main.js` calls `preloadRuntimeMapContent()` from `src/data.js`.
3. `SaveTheGridApp` is imported via `src/game.js` (barrel) and instantiated.

### 4.2 Source modules

- `src/main.js`
  - bootstrap entrypoint.
  - preloads runtime map JSON before app start.

- `src/data.content.js`
  - authored constants and presets (standard/custom/campaign, alerts, storage keys).

- `src/data.loader.js`
  - runtime map preload adapter (`/data/maps/index.json` + selected `*.map.json`).
  - map-document normalization into `BASE_MAP`.

- `src/data.js`
  - barrel export for content + loader entrypoint.

- `src/game/core.js`
  - shared constants and utility helpers.
  - run-config builders for standard/campaign/custom/tutorial.
  - normalization helpers and storage helpers.

- `src/game/runtime.js`
  - `GameRuntime`: authoritative in-run simulation + canvas rendering + input handling.

- `src/game/app.js`
  - `SaveTheGridApp`: app-shell screens, flow transitions, HUD binding, run lifecycle.

- `src/game.js`
  - compatibility barrel export for runtime/app entry classes.

- `src/styles.css` + `src/styles/*.css`
  - segmented presentation layers (`base`, `setup`, `run`, `end`, `responsive`).

### 4.3 Runtime layers

- App shell layer (`SaveTheGridApp`):
  - splash/menu/setup/campaign/custom/run/end surfaces.
  - persistence reads/writes and run start/end orchestration.

- Simulation layer (`GameRuntime`):
  - fixed-tick rules, economy, demand, routing, incidents, objectives.
  - tutorial-step progression and dev-mode behavior.

- Presentation layer:
  - canvas map rendering (terrain, towns, infrastructure points, lines, overlays).
  - DOM HUD/panels updated via runtime callback payloads.

- Persistence layer:
  - localStorage-backed records/settings/progression/suspension flags.

## 5. Repository Structure (Current)

```txt
src/
  main.js
  data.js
  data.content.js
  data.loader.js
  game.js
  game/
    app.js
    core.js
    runtime.js
  styles.css
  styles/
    base.css
    setup.css
    run.css
    end.css
    responsive.css

assets/
  icons/
  maps/

data/
  missions/
    campaign-missions.index.json
  maps/
    index.json
    *.map.json
    terrain/

tools/
  previews/
  terrain/
    generate_terrain_map_png.py
    generate_mission_terrain_maps.py
    compat/
      generate_terrain_map_png.py
      generate_mission_terrain_maps.py
    interactive/
      index.html
      app.js
      lib/

docs/
  design/
  implementation/
  mockups-ui-design/

bot-player/
  run-bot.mjs
  scenarios/
```

## 6. Simulation Architecture

### 6.1 Timing model

- Fixed simulation tick: `TICK_SECONDS = 0.1` (10 Hz).
- Render/update loop: `requestAnimationFrame`.
- Pause halts simulation updates while keeping UI interactive.

### 6.2 Tick pipeline (current)

Per simulation tick:

1. Season update.
2. Incident expiry/spawn.
3. Demand update.
4. Substation coverage resolution.
5. powergrid flow resolution across player-built lines.
6. Service stability and town emergence updates.
7. Economy/reliability updates.
8. Score and objective/end-condition evaluation.
9. HUD payload emission.

### 6.3 Mode rules

- `tutorial`
  - guided step progression.
  - no-loss flow; win on completed tutorial steps.

- `standard`
  - score-focused run with collapse conditions.

- `campaign`
  - mission objective pass/fail and unlock progression.

- `custom`
  - parameterized run class stored separately from standard/campaign.

### 6.4 Determinism note

- Update cadence is fixed-step.
- Randomness currently uses `Math.random()` (not seeded per run yet).
- Save snapshots preserve runtime state for resume, but strict replay determinism is not yet implemented.

## 7. Data and Content Architecture

### 7.1 Runtime content sources

- `data/maps/index.json`
  - map catalog + `defaultMapId`.

- `data/maps/*.map.json`
  - authored map documents (`world`, `terrainMap`, `towns`, optional `links`, optional `resourceZones`).

- `data/maps/terrain/*.metadata.json`
  - terrain metadata with optional `resourceZones` polygons (legacy `resource_zones` accepted).

### 7.2 Loading path

1. `preloadRuntimeMapContent()` loads `index.json`.
2. Selected map file is fetched and normalized.
3. `BASE_MAP` is hydrated before app boot.
4. Runtime then loads terrain image and metadata.
5. Resource zones are resolved from metadata (`resourceZones`) with legacy fallback support.

### 7.3 Validation status

- Validation currently relies on explicit normalization/sanity checks in `src/data.js`.
- No schema library is currently wired in runtime.

## 8. Persistence Architecture

### 8.1 Stored entities (localStorage)

- Records (`standard`, `campaign`, `custom`).
- User settings.
- Suspended run snapshot.
- Campaign progression and mission best medals.
- Dev mode flag.
- Tutorial completion flag.

### 8.2 Snapshot contents

Suspended run snapshots include:

1. Run config.
2. Runtime game state.
3. Camera/tool/selection state.
4. Pause and line-selection context.

### 8.3 Integrity behavior

- Storage reads are defensive and fall back to defaults when parsing fails.
- Invalid suspended snapshots return users to menu with a toast.

## 9. Testing Strategy (Current)

### 9.1 Browser smoke tests

Primary automation is Playwright-based:

- `bot-player` scripted scenarios.
- `develop-web-game` client loop for step/choreography-based validation.

### 9.2 Runtime debug hooks

The runtime exposes:

- `window.render_game_to_text()`
- `window.advanceTime(ms)`

These are used by automation for state assertions and deterministic stepping.

### 9.3 Current gap

- No committed unit-test harness is currently wired in package scripts.
- Regression confidence currently depends on browser automation plus manual checks.

## 10. Build and Release (Current)

1. Serve statically with `npm run serve`.
2. Browser loads ESM modules directly.
3. No bundler/compile step required for MVP runtime.

## 11. Multiplayer Readiness Constraints (Singleplayer-first)

Preserved constraints for future expansion:

1. Keep command intent boundaries explicit in runtime handlers.
2. Keep state snapshot serialization stable.
3. Keep mode config packetized and explicit.
4. Avoid frame-rate-coupled simulation behavior.

## 12. Open Implementation Decisions

1. Introduce seeded RNG for reproducible run replay.
2. Decide whether to add schema validation library for map/content contracts.
3. Define lightweight CI gates for Playwright smoke scenarios.
4. Decide whether to further split `src/game/runtime.js` by simulation/render/input concerns.
