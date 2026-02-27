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

### Zoom feel tuning (slower + smoother)

- Updated camera zoom to be target-based with smoothing interpolation in `src/game/runtime.js`:
  - Added `camera.zoom` (continuous value) alongside `camera.zoomIndex` (target level).
  - Added `updateZoom(dt)` with exponential easing (`ZOOM_SMOOTHING_PER_SECOND = 9.5`) so zoom transitions no longer snap.
  - Updated world/screen transforms, rendering, pan speed, icon scaling, and text-state camera output to use smoothed zoom.
- Slowed wheel zoom input handling:
  - Replaced per-event `Math.sign(deltaY)` stepping with accumulated normalized wheel deltas.
  - Added `ZOOM_WHEEL_THRESHOLD = 100` so small trackpad deltas no longer trigger an immediate zoom level jump.
- Unified button and wheel zoom behavior:
  - Added runtime `adjustZoomTarget(stepDelta)` and switched `#run-zoom-in-btn`/`#run-zoom-out-btn` in `src/game/app.js` to use it.

Validation:

- Syntax checks:
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
- Develop-web-game client run:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 3 --pause-ms 250 --screenshot-dir output/web-game-zoom-smoothing`
- Zoom-focused bot scenario:
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario /tmp/zoom-smooth-check.json`
  - Captured before/mid/after screenshots showing eased zoom transition:
    - `bot-player/artifacts/2026-02-25T21-38-51-278Z-zoom-before.png`
    - `bot-player/artifacts/2026-02-25T21-38-51-943Z-zoom-mid.png`
    - `bot-player/artifacts/2026-02-25T21-38-52-766Z-zoom-after.png`

Follow-up suggestion:

- If needed after playtesting, expose `ZOOM_WHEEL_THRESHOLD` and `ZOOM_SMOOTHING_PER_SECOND` as user-tunable settings (e.g., "Zoom speed" / "Zoom smoothness") in Settings.
- Additional safety fix:
  - Snapshot hydration now normalizes `camera.zoom` and falls back to the target zoom level when older snapshots do not include a zoom scalar.
- Re-validation after hydration fix:
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario /tmp/zoom-smooth-check.json`
  - Confirmed scenario completed (18/18) with fresh artifacts at `2026-02-25T21-40-20-100Z` through `2026-02-25T21-40-22-883Z`.

### Escape exits build mode

- Updated keyboard handling in `src/game/runtime.js` so pressing `Escape` always exits tool mode back to `pan`.
- `Escape` now also dismisses any active demolish confirmation popover via runtime callback.
- Existing behavior remains: selection is cleared and line selection state is reset.

Validation:

- `node --check src/game/runtime.js`
- `node --check src/game/app.js`
- develop-web-game smoke:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-esc-build-mode`
- Targeted Playwright assertion script:
  - verified tool state sequence from `render_game_to_text()` is `pan -> build -> pan` after `Digit1` then `Escape`.

### Substation range reduced to 1/20

- Updated global substation coverage profiles in `src/game/core.js`:
  - `wide: 370 -> 18.5`
  - `standard: 300 -> 15`
  - `tight: 245 -> 12.25`
- Updated runtime config defaulting in `src/game/runtime.js` to always derive `substationRadius` from profile, so resumed/snapshotted runs also use the new reduced ranges.
- Replaced stale render fallback `300` with `SUBSTATION_RADIUS_BY_PROFILE.standard` to keep visualization aligned with simulation.

Validation:

- Syntax checks:
  - `node --check src/game/core.js`
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
- develop-web-game smoke:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-substation-range-20x`
- Targeted Playwright assertion:
  - Started a standard run, suspended it, read `localStorage['stg_suspended_run_v1']`.
  - Confirmed `runConfig.substationRadiusProfile === 'standard'` and `runConfig.substationRadius === 15`.
  - No console/page errors.

### Resource layer toggle control

- Changed resource-layer control from hold-to-show to toggle in `src/game/runtime.js`:
  - Press `R` once to show zones.
  - Press `R` again to hide zones.
  - Removed key-up auto-hide behavior.
  - Kept tutorial step completion hook when resource layer is toggled on.
  - Added HUD update on toggle so UI/state bridge reflects visibility immediately.
- Updated in-game tutorial copy in `src/game/core.js`:
  - `"Hold R to reveal..."` -> `"Press R to toggle..."`.
- Updated design docs for control consistency:
  - `docs/design/TUTORIAL_MODE_DESIGN.md`
  - `docs/design/FRONTEND_AND_UX.md`
  - `docs/design/MAP_DESIGN_2D.md`

Validation:

- Syntax checks:
  - `node --check src/game/runtime.js`
  - `node --check src/game/core.js`
  - `node --check src/game/app.js`
- develop-web-game smoke:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-resource-toggle`
- Targeted Playwright assertion:
  - Verified `render_game_to_text().terrainMap.resourceLayerVisible` transitions:
    - initial `false`
    - after first `R` press `true`
    - after wait `true` (no keyup auto-hide)
    - after second `R` press `false`
  - No console/page errors.

### Tutorial first step: resource layer

- Reordered `TUTORIAL_STEP_DEFINITIONS` in `src/game/core.js` so the first tutorial step is now `resource_reveal` (`Press R to toggle the Resource Layer`).
- Kept all existing tutorial completion-matching logic intact; only sequence order changed.
- Updated guided-task sequence documentation in `docs/design/TUTORIAL_MODE_DESIGN.md` to match runtime behavior.

Validation:

- `node --check src/game/core.js`
- `node --check src/game/runtime.js`
- `node --check src/game/app.js`
- Targeted Playwright tutorial assertion:
  - Initial tutorial step is `resource_reveal`.
  - After pressing `R`, step advances to `build_plant` with `completedSteps: 1`.
  - No console/page errors.

### Long-range line cursor preview

- Added a live line-tool preview in `src/game/runtime.js` that draws a transparent light-blue line from the selected long-range line source point to the current cursor position.
- Preview is shown only when:
  - active tool is `Line`,
  - a source endpoint has already been selected,
  - cursor is inside canvas,
  - camera is not currently drag-panning.
- Hooked preview into overlay rendering so it updates continuously while targeting the second endpoint.

Validation:

- `node --check src/game/runtime.js`
- Targeted Playwright visual check:
  - built an infrastructure source node,
  - switched to line tool,
  - selected source,
  - moved cursor,
  - captured screenshot at `output/line-preview/line-preview.png` showing the preview line.
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-line-preview-regression`

### Build preview price label for powerplants

- Added a powerplant build-cost preview label above the transparent build icon in `src/game/runtime.js`.
- Cost preview uses the same pricing factors as real placement:
  - base plant cost,
  - terrain multiplier at cursor location,
  - active build-cost incident modifier,
  - run infrastructure-cost multiplier.
- Label is rendered only when build tool is active for `plant`, and hidden for non-plant assets.

Validation:

- `node --check src/game/runtime.js`
- Targeted Playwright visual check captured:
  - `output/build-preview-cost/build-preview-cost.png`
  - confirms `Cost <value>` appears above transparent plant icon while in build mode.
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-build-cost-regression`

### Removed floating map control buttons

- Removed the in-run floating map control button group from `src/game/app.js`:
  - `+` (`#run-zoom-in-btn`)
  - `-` (`#run-zoom-out-btn`)
  - `Center` (`#run-center-btn`)
  - `Full` (`#run-fullscreen-btn`)
- Removed corresponding click listeners from `attachRunUiListeners()`.

Validation:

- `node --check src/game/app.js`
- `node --check src/game/runtime.js`
- `node --check src/game/core.js`
- Targeted Playwright check confirmed all four selectors are absent in-run:
  - `zoomIn: false`, `zoomOut: false`, `center: false`, `full: false`
- Visual confirmation screenshot:
  - `output/no-map-buttons/no-map-buttons.png`
- No console/page errors.

### Long-range line max distance + cursor price preview

- Added a max connection distance for long-range powerlines in `src/game/runtime.js`:
  - `maxLineRange = substationRadius * 4`
  - enforced in `handleLineTool()` before new line build.
  - Existing built lines can still be removed even if they exceed the new max range.
- Added cursor-side long-range line price preview after selecting a line source:
  - while `Line` tool is active and source endpoint is selected,
  - render transparent light-blue preview line to cursor,
  - render `Cost <value>` badge next to cursor.
  - badge tint shifts warm when preview distance exceeds max range.

Validation:

- `node --check src/game/runtime.js`
- Targeted Playwright assertion:
  - created two far endpoints,
  - selected first as source,
  - verified preview cost label in screenshot: `output/line-range-and-cost/line-cost-preview.png`,
  - attempted out-of-range connection,
  - confirmed no line built (`lineCount: 0`) and alert text: `Endpoint out of range. Maximum 60 (current 200).`
  - no console/page errors.
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-line-range-regression`

### Stylized build icon tooltips with pricing

- Added stylized hover/focus tooltips for buildable dock icons in `src/game/app.js` and `src/styles/run.css`.
- Tooltip content now includes price for:
  - wind plant, solar plant, gas plant (`ASSET_RULES.plant.cost`)
  - substation (`ASSET_RULES.substation.cost`)
  - storage (`ASSET_RULES.storage.cost`)
  - long-range powerline (`LINE_BASE_BUILD_COST_PER_WORLD_UNIT * 100`, displayed as `Price <value> / 100px`)
- Removed native `title` tooltips from buildable buttons to avoid overlapping browser-default tooltips with the custom UI tooltip.

Validation:

- `node --check src/game/app.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-tooltips-regression`
- Targeted Playwright hover capture script:
  - Generated visual proofs in `output/tooltips-hover/`:
    - `tooltip-wind.png`
    - `tooltip-solar.png`
    - `tooltip-gas.png`
    - `tooltip-substation.png`
    - `tooltip-storage.png`
    - `tooltip-line.png`
- Targeted Playwright console/page error check:
  - `consoleErrorCount: 0`
  - `pageErrorCount: 0`

### Long-range powerline icon swap

- Updated the line tool button in `src/game/app.js` to use the new icon asset:
  - `/assets/icons/circular/line-long-range.svg`
- Replaced the previous CSS glyph span (`asset-icon-glyph-powerline`) with an `<img class="asset-icon-image">` for the long-range powerline button.

Validation:

- `node --check src/game/app.js`

### Allow panning beyond map edges

- Relaxed camera clamping in `src/game/runtime.js` so players can pan beyond map borders.
- Added controlled overscroll bounds based on viewport size:
  - `CAMERA_PAN_OVERSCROLL_VIEWPORTS = 0.5`
  - allows roughly half a screen of off-map panning on each side instead of hard-locking at the edge.
- Existing camera math, zoom behavior, and world/screen transforms remain unchanged.

Validation:

- `node --check src/game/runtime.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-pan-overscroll-regression`
- Targeted Playwright pan assertion:
  - dragged camera repeatedly toward the left boundary,
  - camera moved to `x: 0` while old clamp minimum would have been `x: 258.52`,
  - `crossedOldClamp: true`
  - no console/page errors (`errorCount: 0`)
- Visual proof:
  - `output/pan-beyond-edge/pan-left-beyond-edge.png`

### Zoom smoothing kept, zoom settle made faster

- Tuned zoom interpolation speed in `src/game/runtime.js`:
  - `ZOOM_SMOOTHING_PER_SECOND: 9.5 -> 12`
- Kept the same eased, target-based zoom model and wheel threshold behavior.

Validation:

- `node --check src/game/runtime.js`
- `node --check src/game/app.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-zoom-speed-tune`
- Targeted Playwright zoom probe:
  - sampled camera zoom after wheel input at short intervals:
    - `z0: 2.64`
    - `z1: 2.52`
    - `z2: 2.179`
    - `z3: 1.995`
  - confirms continued gradual/eased transition (`hasGradualChange: true`).
  - no console/page errors (`errorCount: 0`).

### Mouse-centered zoom

- Updated wheel zoom behavior in `src/game/runtime.js` so zooming anchors to the mouse position rather than viewport center.
- Added runtime zoom-focus handling:
  - stores zoom focus as screen point + world point on wheel input,
  - reapplies camera position during each smooth zoom interpolation step to keep the anchored world position under the cursor,
  - clears focus when smooth zoom settles or when manual panning input (drag/keyboard/edge-pan) takes over.
- Smoothness model and tuned speed are preserved:
  - same eased interpolation flow,
  - still uses `ZOOM_SMOOTHING_PER_SECOND = 12`.

Validation:

- `node --check src/game/runtime.js`
- `node --check src/game/app.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-mouse-centered-zoom-regression`
- Targeted Playwright anchor check:
  - sampled world position under a fixed off-center cursor point before and after wheel zoom in.
  - results:
    - `beforeZoom: 2.64`
    - `afterZoom: 3.518`
    - world point drift distance: `0.1205` world units (near-zero; expected tiny numeric drift).
  - no console/page errors (`errorCount: 0`).
- Visual capture:
  - `output/mouse-centered-zoom/mouse-centered-zoom.png`

### Pause/play icon button

- Replaced run HUD pause button text with classic icon glyphs in `src/game/app.js`:
  - running state: `❚❚` (pause)
  - paused state: `▶` (play/resume)
- Added accessible label updates so semantics remain clear:
  - running state: `aria-label="Pause simulation"`
  - paused state: `aria-label="Resume simulation"`

Validation:

- `node --check src/game/app.js`
- `node --check src/game/runtime.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-pause-icon-regression`
- Targeted Playwright toggle check:
  - before click: `text="❚❚"`, `aria="Pause simulation"`
  - after click: `text="▶"`, `aria="Resume simulation"`
  - runtime state confirmed paused (`runtimePaused: true`)
  - no console/page errors (`errorCount: 0`)
- Visual captures:
  - `output/pause-icon-toggle/pause-state-running.png`
  - `output/pause-icon-toggle/pause-state-paused.png`

### Top-right `?` controls panel overlay

- Added a new top-right controls button (`?`) in `src/game/app.js`:
  - id: `#run-controls-btn`
  - includes `aria-controls` and `aria-expanded` wiring.
- Added a centered controls overlay/modal in `src/game/app.js`:
  - id: `#run-controls-overlay`
  - title: `Control Reference`
  - includes complete command reference sections:
    - Mouse controls
    - Navigation + View controls
    - Build + Tools controls
  - close affordances:
    - explicit `Close` button
    - click outside panel on backdrop.
- Added listener wiring in `attachRunUiListeners()`:
  - open/close toggle from `?` button
  - aria-label/aria-expanded updates while toggling
  - close on backdrop click.
- Added styling for the new controls UI in `src/styles/run.css`:
  - compact top-right icon button style
  - modal backdrop + centered panel
  - two-column responsive controls grid
  - styled keycaps (`kbd`) and control rows.
- Added mobile responsive behavior in `src/styles/responsive.css`:
  - controls panel width/height constraints on small screens
  - single-column controls grid.
- Bugfix after validation:
  - hidden overlay was intercepting clicks because class `display:grid` overrode hidden state.
  - fixed by adding `.floating-controls-overlay[hidden] { display: none; }`.

Validation:

- `node --check src/game/app.js`
- `node --check src/game/runtime.js`
- `node --check src/main.js`
- develop-web-game regression loops:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-controls-overlay-regression`
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-controls-overlay-regression-postfix`
- Targeted Playwright behavior check:
  - before open: overlay hidden, button expanded `false`
  - after open: overlay visible, button expanded `true`
  - control content visibility confirmed for `Wheel`, `W A S D`, `Esc`, `Toggle fullscreen`
  - close button returns hidden state and expanded `false`
  - backdrop click returns hidden state and expanded `false`
  - no console/page errors (`errorCount: 0`)
- Visual captures:
  - `output/controls-overlay/controls-open.png`
  - `output/controls-overlay/controls-closed.png`

### Bottom palette icon sizing + spacing tune

- Updated bottom build/tool dock visuals in `src/styles/run.css`:
  - icon size increased by ~10%:
    - `.asset-icon-image, .asset-icon-glyph` `34px -> 37.4px`
  - dock spacing tightened:
    - `.floating-dock` `gap: 8px -> 6px`

Validation:

- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-dock-size-spacing-regression`
- Targeted Playwright CSS metric check:
  - `dockGap: "6px"`
  - `iconWidth: "37.3906px"`
  - `iconHeight: "37.3906px"`
  - no console/page errors (`errorCount: 0`)
- Visual capture:
  - `output/dock-size-spacing/dock-updated.png`

### Fixed range values: substation 100px, long-range line 1000px

- Updated substation coverage radius values in `src/game/core.js`:
  - `SUBSTATION_RADIUS_BY_PROFILE.wide = 100`
  - `SUBSTATION_RADIUS_BY_PROFILE.standard = 100`
  - `SUBSTATION_RADIUS_BY_PROFILE.tight = 100`
- Updated long-range powerline max distance in `src/game/runtime.js`:
  - replaced profile/multiplier-derived limit with fixed `LONG_RANGE_LINE_MAX_DISTANCE = 1000`
  - `getMaxLineRange()` now returns the fixed constant.

Validation:

- Syntax checks:
  - `node --check src/game/core.js`
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
- Constant verification:
  - `node -e \"import('./src/game/core.js').then(m => console.log(m.SUBSTATION_RADIUS_BY_PROFILE))\"`
  - confirmed output: `{ wide: 100, standard: 100, tight: 100 }`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-range-values-regression`
- Targeted Playwright range behavior test:
  - placed two plant endpoints at world positions:
    - `node-1: x=114.2, y=717.4`
    - `node-2: x=2091.5, y=717.4`
  - endpoint distance: `1977.3`
  - line tool alert: `Endpoint out of range. Maximum 1000 (current 1977).`
  - `sawMax1000: true`
  - no console/page errors (`errorCount: 0`)
- Visual capture:
  - `output/range-values/line-range-1000-alert.png`

### `1` hotkey cycles powerplant types

- Updated plant type constants in `src/game/runtime.js`:
  - introduced ordered list `PLANT_TYPE_ORDER = ["wind", "sun", "natural_gas"]`
  - `PLANT_TYPE_VALUES` now derives from that order.
- Added `getNextBuildPlantType()` helper in `src/game/runtime.js` to cycle plant types deterministically.
- Updated `onKeyDown` handling for `Digit1` in `src/game/runtime.js`:
  - first press (from non-plant context): selects Build + Plant (wind)
  - repeated presses while already on Build + Plant: cycles `wind -> sun -> natural_gas -> wind`.
- Updated controls overlay copy in `src/game/app.js` to reflect the new behavior for key `1`.

Validation:

- Syntax checks:
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
  - `node --check src/game/core.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-hotkey-plant-cycle-regression`
- Targeted Playwright key-sequence assertion:
  - `initial`: `tool=pan`, `plantType=wind`
  - after `1`: `tool=build`, `plantType=wind`, active icon `wind`
  - after `1` again: `plantType=sun`, active icon `sun`
  - after `1` again: `plantType=natural_gas`, active icon `natural_gas`
  - after `1` again: `plantType=wind`, active icon `wind`
  - no console/page errors (`errorCount: 0`)
- Visual capture:
  - `output/hotkey-plant-cycle/plant-cycle-after-4-presses.png`

### Demolition refunds: 50% building value + 50% connected long-range line value

- Updated demolition economy in `src/game/runtime.js`:
  - added tracked per-asset build values on infrastructure regions (`assetBuildCosts`) so demolition refunds use actual paid costs when available.
  - new demolition refund logic now returns:
    - `floor(50% * demolished building value)`.
    - plus `floor(50% * each connected built long-range line value)` when demolition leaves the endpoint without buildable infrastructure.
  - connected built long-range lines are now decommissioned during that endpoint teardown and their values are refunded at 50%.
  - pending demolition entries now carry `refund` (estimated) and `buildingValue` metadata for consistent completion handling.
- Updated demolition confirmation copy in `src/game/app.js`:
  - replaced "No refund on demolition" with "Estimated refund: <value>".

Validation:

- Syntax checks:
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-demolition-refund-regression`
- Targeted Playwright scenario (tutorial mode):
  - built 2 plants + 1 long-range line, then demolished one endpoint plant via confirm popover.
  - pending demolition estimated refund surfaced in UI: `Estimated refund: 105`.
  - completion alert verified: `Wind Powerplant demolished in Grid Point 1. 1 connected line removed (+105 budget).`
  - active link count dropped from `1` to `0` after demolition completion.
- Visual capture:
  - `output/demolition-refund/demolition-tutorial-post.png`

### HUD metric: Stored Power (MWh) in bottom-left panel

- Added a new HUD row in `src/game/app.js`:
  - label: `Stored Power`
  - value node: `#hud-stored-power`
  - display format: `${value.toFixed(1)} MWh`
- Runtime now computes and publishes stored battery reserve in `src/game/runtime.js`:
  - new helper: `calculateStoredPowerMWh()`
  - current formula: sum of all `assets.storage` units across regions, multiplied by per-unit reserve baseline (`ASSET_RULES.storage.generation`, currently `20`), reported in MWh.
  - value wired into HUD payload as `storedPowerMWh`.
  - value also added to `render_game_to_text` payload for testability.

Validation:

- Syntax checks:
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-stored-power-hud-regression`
- Targeted Playwright assertion:
  - before placing storage: HUD `0.0 MWh`, state `storedPowerMWh: 0`
  - after placing one storage asset: HUD `20.0 MWh`, state `storedPowerMWh: 20`
  - both HUD and state increased as expected.
- Visual capture:
  - `output/stored-power-hud/stored-power-built.png`

### Compact money notation (`k` / `M`)

- Added shared formatter in `src/game/core.js`:
  - `formatCompactMoney(value)` with rounding rules that match requested style.
  - Examples now produced by formatter: `4.3k`, `9k`, `55.2k`, `1M`, `1.1M`, `188M`.
- Wired formatter into UI in `src/game/app.js`:
  - HUD Money value (`#hud-budget`) now uses compact notation.
  - End-screen `Budget` metric now uses compact notation.
  - Standard setup preset card `Budget` labels now use compact notation.
  - Demolition confirm popover `Estimated refund` now uses compact notation.
- Wired formatter into runtime objective detail in `src/game/runtime.js`:
  - Custom objective detail now renders budget with compact notation.

Validation:

- Syntax checks:
  - `node --check src/game/core.js`
  - `node --check src/game/app.js`
  - `node --check src/game/runtime.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-money-compact-regression`
- Formatter sample assertions via node script:
  - `4300 -> 4.3k`
  - `9000 -> 9k`
  - `55200 -> 55.2k`
  - `1000000 -> 1M`
  - `1100000 -> 1.1M`
  - `188000000 -> 188M`
- Visual capture:
  - `output/money-compact/hud-money-compact.png`

### Long-range line terrain surcharge (`+10` per blue/white pixel crossed)

- Updated long-range line costing in `src/game/runtime.js`:
  - added `LINE_WATER_OR_SNOW_PIXEL_SURCHARGE = 10`.
  - terrain map pixels are now cached once on load (`cacheMapPixelsForLineCost`) and reused for cost calculations.
  - line pricing now adds:
    - base line cost (existing distance/terrain formula), plus
    - `10 * (count of blue or white terrain pixels along the line path)`.
  - surcharge is applied in both:
    - finalized long-range line builds, and
    - live cursor preview while selecting an endpoint.
- Updated long-range tool tooltip text in `src/game/app.js`:
  - now shows base price plus surcharge rule: `Price <base>/100px (+10 / blue|white px)`.
- Added path sampling helpers in `src/game/runtime.js`:
  - `worldPointToMapPixel(point)`
  - `isBlueOrWhiteMapPixelAt(x, y)`
  - `countBlueOrWhitePixelsAlongLine(a, b)` (Bresenham traversal).

Validation:

- Syntax checks:
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
  - `node --check src/game/core.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 250 --screenshot-dir output/web-game-line-terrain-surcharge`
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-line-surcharge-tooltip-sync`
- Additional terrain-color sanity check (Playwright evaluate):
  - map palette confirmed includes dominant water blue (`68,134,195`) and snow white (`255,255,255`) and both are captured by the surcharge classifier thresholds.

### Reroute tool icon swap

- Updated reroute tool dock button in `src/game/app.js` to use:
  - `/assets/icons/circular/line-reroute.svg`
- Replaced legacy CSS glyph span with the shared `asset-icon-image` `<img>` pattern used by other tool icons.

Validation:

- Syntax check:
  - `node --check src/game/app.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-reroute-icon-swap`
- Visual confirmation (full UI screenshot):
  - `output/reroute-icon-fullpage.png`

### Continuous zoom (no discrete zoom levels)

- Reworked camera zoom in `src/game/runtime.js` from index-based zoom levels to continuous target zoom:
  - removed step-based wheel threshold/index stepping path.
  - camera now tracks continuous `zoom` + `zoomTarget` values.
  - wheel input now scales zoom target continuously using exponential scaling.
  - smoothing interpolation remains active (`ZOOM_SMOOTHING_PER_SECOND`) and mouse-centered zoom focus is preserved.
- Added compatibility for older suspended snapshots that may still contain `camera.zoomIndex`:
  - legacy index is translated once using previous zoom-level table (`LEGACY_ZOOM_LEVELS`) during hydration.
- Current zoom bounds:
  - `MIN_CAMERA_ZOOM = 0.55`
  - `MAX_CAMERA_ZOOM = 8`

Validation:

- Syntax checks:
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
  - `node --check src/game/core.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-continuous-zoom-regression`
- Targeted Playwright zoom probe (wheel deltas + state sampling):
  - sampled camera zoom values: `2.64, 2.698, 2.759, 2.821, 2.784, 2.744, 2.765, 2.787`
  - all samples were unique/fractional (no snapping to former discrete level set).
- Visual capture:
  - `output/continuous-zoom-fullpage.png`

### Number shortcuts for each buildable building

- Updated keyboard mapping in `src/game/runtime.js`:
  - `1`: wind plant (pressing `1` again while already on wind still cycles plant type as before).
  - `2`: solar plant.
  - `3`: gas plant.
  - `4`: substation.
  - `5`: storage.
  - `6` or `L`: long-range powerline tool.
- Updated control reference + button labels in `src/game/app.js` to reflect new shortcuts.
- Updated tutorial step copy in `src/game/core.js`:
  - substation step now references `(4)`.
  - line step now references `(6 / L)`.

Validation:

- Syntax checks:
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
  - `node --check src/game/core.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-number-shortcuts-regression`
- Targeted Playwright key assertion:
  - `1 -> build/plant/wind`
  - `2 -> build/plant/sun`
  - `3 -> build/plant/natural_gas`
  - `4 -> build/substation`
  - `5 -> build/storage`
  - `6 -> line tool`
- Visual capture:
  - `output/number-shortcuts-fullpage.png`

### Tutorial step wording cleanup

- Reviewed and revised `TUTORIAL_STEP_DEFINITIONS` in `src/game/core.js` for clarity and consistency.
- Updated step instructions to:
  - use explicit action phrasing (`Press <key>`, `click ...`),
  - match current keybindings (`1`, `4`, `6 / L`, `E / B`, `X`, `Space`),
  - remove ambiguous phrasing such as "Build and Sub".
- Kept step IDs/order unchanged to avoid behavior changes in tutorial progression logic.

Validation:

- Syntax check:
  - `node --check src/game/core.js`

### Combined right-side feed panel (alerts + incidents + news)

- Replaced separate right-side cards and ticker with a unified bottom-right panel:
  - removed standalone `Alert Rail`, `Incident Rail`, and bottom-right ticker blocks from run markup.
  - added one `Operations Feed` panel containing:
    - `Alert Rail` list (`#alert-list`)
    - `Incident Rail` list (`#incident-list`)
    - `News` ticker (`#news-ticker`)
- Kept existing DOM IDs so runtime HUD callbacks and alert highlighting continue to work without logic changes.

Files updated:

- `src/game/app.js`
- `src/styles/run.css`
- `src/styles/responsive.css`

Validation:

- Syntax checks:
  - `node --check src/game/app.js`
  - `node --check src/game/runtime.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-ops-panel-merge-regression`
- Full UI visual confirmation:
  - `output/ops-panel-merged-fullpage.png`

### Long-range powerline towers stay upright on diagonal lines

- Updated long-range line rendering in `src/game/runtime.js` so tower geometry is always drawn upright in screen space.
- Replaced rotated tile-based long-range renderer with a procedural pass:
  - draws diagonal wire bundle along the segment direction,
  - draws upright transmission tower silhouettes at intervals along the segment.
- Result: lines can remain diagonal, while towers no longer rotate/tilt with line angle.

Validation:

- Syntax checks:
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
  - `node --check src/game/core.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-upright-tower-regression`
- Targeted Playwright scenario:
  - built 2 infrastructure points with plants, connected a diagonal long-range line, verified line commissioning alert and visual tower orientation.
  - visual capture: `output/upright-diagonal-longline-fullpage.png`

### Removed dark map vignette overlay

- Removed the dark linear gradient vignette pass at the end of `drawMapBackdrop` in `src/game/runtime.js` so the raw map colors render unshaded.

Validation:

- Syntax check:
  - `node --check src/game/runtime.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-remove-vignette-regression`
- Visual confirmation:
  - `output/web-game-remove-vignette-regression/shot-0.png`

### Centered "Simulation Paused" overlay

- Updated paused overlay positioning in `drawOverlay` (`src/game/runtime.js`) to center the pause box vertically and horizontally from viewport dimensions.
- Kept existing box size and style; only position and text vertical alignment were adjusted.

Validation:

- Syntax check:
  - `node --check src/game/runtime.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-centered-pause-box`
- Visual confirmation:
  - `output/web-game-centered-pause-box/shot-0.png`

### Building placement collision + spacing guardrails

- Enforced one-building-per-point behavior for infrastructure nodes:
  - if a node already has any asset, new builds on that same point are rejected.
- Added minimum spacing for new builds:
  - new infrastructure cannot be built within `1.5x` node radius of another occupied infrastructure point.
- Refactored node radius magic number into `INFRASTRUCTURE_NODE_RADIUS` and reused it in spacing checks.
- Added helpers in `src/game/runtime.js`:
  - `getRegionTotalAssets(region)`
  - `getInfrastructureNodeRadius(region)`
  - `findInfrastructureBuildSpacingConflict(worldX, worldY, ignoreRegionId)`
- Updated line endpoint eligibility helper to use total-asset helper for consistency.
- Deferred insertion of newly created nodes until after validation and budget checks, preventing failed builds from leaving empty orphan nodes.

Validation:

- Syntax check:
  - `node --check src/game/runtime.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-building-spacing-regression`
- Targeted Playwright checks (manual script using skill-local Playwright):
  - same-point second build rejected with warning.
  - too-close build (< 1.5x radius) rejected with warning.
  - farther build accepted as a new node.
  - visual capture: `output/building-spacing-targeted.png`

### Removed "Exit Tutorial" button from run HUD

- Removed `#run-exit-tutorial-btn` from run-screen top-right controls in `src/game/app.js`.
- Removed the corresponding click handler and HUD visibility toggle logic from `attachRunUiListeners`/`updateRunHud`.
- Updated tutorial completion alert copy in `src/game/runtime.js` to avoid referencing the removed button.

Validation:

- Syntax checks:
  - `node --check src/game/app.js`
  - `node --check src/game/runtime.js`
- Confirmed no remaining `Exit Tutorial` references in runtime/app source.
- develop-web-game smoke run:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-remove-exit-tutorial-btn`

### Long-range powerline tower density reduced to 25%

- Updated long-range renderer metrics in `src/game/runtime.js`:
  - introduced `LONG_RANGE_TOWER_COUNT_RATIO = 0.25`
  - scaled `towerSpacing` by `1 / LONG_RANGE_TOWER_COUNT_RATIO` so line depictions place roughly 25% as many towers as before.
- Wire bundle rendering and tower style remain unchanged; only tower frequency changed.

Validation:

- Syntax check:
  - `node --check src/game/runtime.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-longline-tower-density-regression`
- Targeted Playwright scenario:
  - built 2 points, commissioned one long-range line, verified line exists and visually confirmed reduced tower count.
  - visual capture: `output/longline-tower-density-25pct.png`

### Reroute radius visualization + area priority model + clear priority action

- Reworked priority model to two levels only:
  - `nominal` (default)
  - `elevated`
- Updated `PRIORITY_ORDER` in `src/game/core.js` to `["nominal", "elevated"]`.
- Added runtime priority normalization with backward compatibility for old saves:
  - legacy `low`/`normal` map to `nominal`
  - legacy `high` maps to `elevated`
- Updated new/rehydrated region defaults in `src/game/runtime.js` to use normalized priority values.
- Changed reroute behavior from single-point cycle to area effect:
  - reroute now elevates all eligible cities/infrastructure-with-assets within reroute radius.
  - reroute can be issued from any clicked map point (not only directly on a region), using the hovered region center when present.
- Added reroute radius overlay:
  - transparent blue filled + dashed-stroke circle shown while reroute tool is active.
- Added clear-priority action button to bottom palette:
  - new button `#run-clear-priority-btn` with tooltip “Clear Priority / Reset all to nominal”
  - wired to `runtime.clearAllPriorityModifiers()`
- Added node priority in `render_game_to_text` output (`infrastructureNodes[].priority`) and normalized town priority output.

Files updated:

- `src/game/core.js`
- `src/game/runtime.js`
- `src/game/app.js`
- `src/styles/run.css`

Validation:

- Syntax checks:
  - `node --check src/game/core.js`
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-reroute-radius-priority-regression`
- Targeted Playwright scenario:
  - confirmed reroute radius circle rendering (`output/reroute-radius-preview.png`)
  - confirmed area elevation alert and normalized priority states in `render_game_to_text`
  - confirmed multiple infrastructure points inside radius are all elevated in one reroute action
  - confirmed clear-priority button resets elevated priorities to nominal (`output/reroute-priority-cleared.png`)

### Bottom palette shortcut numbers shown on icons

- Added visible numeric shortcut badges directly on the bottom palette icon buttons for:
  - Wind Plant `1`
  - Solar Plant `2`
  - Gas Plant `3`
  - Substation `4`
  - Storage `5`
  - Long-Range Powerline `6`
- Kept tooltip shortcuts unchanged; this adds always-visible numeric affordance on-icon.

Files updated:

- `src/game/app.js`
- `src/styles/run.css`

Validation:

- Syntax check:
  - `node --check src/game/app.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-icon-shortcut-badges`
- Targeted full-page Playwright verification:
  - confirmed `.dock-shortcut-chip` values: `1,2,3,4,5,6`
  - visual capture: `output/icon-shortcut-badges-fullpage.png`

## 2026-02-26

### Terrain Lab: Added `4-step` generation algorithm

Implemented a new terrain algorithm option in the interactive terrain tool:

- Added algorithm selector option in UI: `4-step`.
- Added `4-step` pipeline in `tools/terrain/interactive/app.js`:
  1. Ridged multifractal base with domain warp.
  2. Thermal erosion pass.
  3. Hydraulic erosion-lite pass.
  4. River-channel carving pass.
- Wired algorithm label/status formatting so the panel and stats recognize `4-step` (`4S` short code).
- Updated terrain generation dispatch so `4-step` is selectable from the same algorithm toggle.
- Updated docs (`tools/terrain/interactive/README.md`) to include the new algorithm and pipeline description.
- Updated algorithm toggle layout (`tools/terrain/interactive/styles.css`) from 2 to 3 columns.

Validation:

- Syntax checks:
  - `node --check tools/terrain/interactive/app.js`
  - `node --check tools/terrain/interactive/lib/dom.js`
  - `node --check tools/terrain/interactive/lib/exporter.js`
- Browser verification (Playwright):
  - Confirmed `[data-algo="4-step"]` exists and can be selected.
  - Confirmed `#algorithm-value` updates to `4-step`.
  - Confirmed no console/page errors in check run.
  - Screenshot: `output/terrain-lab-4step/algorithm-4-step-ui-v2.png`

### Battery charging model: starts empty, charges at 20 MW to 20 MWh cap

Implemented battery state as explicit stored energy rather than static implied reserve:

- Added per-region `storageChargeMWh` state and normalized migration behavior.
  - New builds start at `0 MWh`.
  - Legacy snapshots without `storageChargeMWh` hydrate storage as full (`20 MWh` per unit) for backward compatibility.
- Added charging constants in runtime:
  - `STORAGE_CHARGE_DRAW_MW = 20`
  - `STORAGE_UNIT_CAPACITY_MWH = 20`
  - `IN_GAME_HOUR_REAL_SECONDS = 120` (`1 in-game hour = 2 real minutes`)
- Updated grid resolution:
  - storage no longer contributes direct generation.
  - batteries draw available grid power up to `20 MW` per unit while not full.
  - energy accrual uses `MW * dt * (1 / 120)` so a battery fills in `120s` real time.
- Updated storage accounting:
  - `calculateStoredPowerMWh()` now sums live `storageChargeMWh`.
  - storage charge is clamped on demolition/rehydration/build changes.
- Extended `render_game_to_text` payload for validation:
  - `storageChargingMw`
  - per-entity `storageChargeMWh` and `storageCapacityMWh`.

Files updated:

- `src/game/runtime.js`

Validation:

- Syntax checks:
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
  - `node --check src/game/core.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 250 --screenshot-dir output/web-game-battery-charge-regression`
- Targeted Playwright battery validation (tutorial run):
  - Built plant + storage + connecting long-range line.
  - Observed from `render_game_to_text`:
    - `t0`: `~0.05 / 20 MWh`, `storageChargingMw: 20`
    - `t60s`: `~10.08 / 20 MWh`, `storageChargingMw: 20`
    - `t130s`: `20 / 20 MWh`, `storageChargingMw: 0`
  - Screenshot: `output/battery-charge-validation.png`

### Demolition lifecycle + occupancy invariants

Implemented stricter infrastructure occupancy rules so line endpoints always map to an actual built location and demolished points are removed:

- Demolishing the final asset on an infrastructure point now removes the point entirely.
  - Connected line references are removed with the point.
  - Selection/line-build start references are cleared if they referenced removed points.
  - Alerts/timeline now include `Location cleared.` when point removal occurs.
- Added cleanup pass for orphan points:
  - empty infrastructure nodes are pruned on runtime boot and snapshot hydration.
- Added occupancy normalization for loaded saves:
  - infrastructure points are normalized to at most one asset (`plant`, `substation`, or `storage`).
  - stale extra assets are collapsed to one asset, with ledger cleanup.
- Placement collision rules now include towns:
  - build placement spacing check now treats towns and occupied infrastructure points as collision candidates, preventing city/building overlap.

Files updated:

- `src/game/runtime.js`

Validation:

- Syntax checks:
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
  - `node --check src/game/core.js`
- develop-web-game regression loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-demolition-node-lifecycle-regression`
- Targeted Playwright lifecycle check:
  - Built two infrastructure points and one line between them.
  - Demolished one endpoint asset and advanced simulation beyond demolition duration.
  - Confirmed:
    - endpoint node removed (`afterNodeExists: false`)
    - no line references to removed endpoint (`afterNodeLinks: 0`)
    - no empty infrastructure nodes remain (`anyEmptyNode: false`)
  - Screenshot: `output/demolish-endpoint-removed-with-lines.png`

### Right-click cancel for active demolitions

Implemented immediate cancellation of active demolition via right click on the same location:

- Added runtime helpers:
  - `recomputeRegionDemolitionCooldown(regionId)`
  - `cancelPendingDemolition(regionId, assetType?)`
- Updated right-click flow (`handleSecondaryClick`) so it now:
  - checks for pending demolition at clicked region first,
  - cancels it immediately if found,
  - skips demolish confirm popover in cancel path.
- Cancellation logs timeline + advisory alert and preserves the building in place.

Files updated:

- `src/game/runtime.js`

Validation:

- Syntax checks:
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
- Targeted Playwright validation:
  - Build plant.
  - Start demolition via right-click confirm.
  - Right-click same building while demolition is active.
  - Confirmed:
    - pending demolitions `1 -> 0` immediately
    - building asset remains present
    - after advancing >20s, node still exists (no delayed demolition)
    - alert emitted: `Wind Powerplant demolition canceled in Grid Point 1.`
  - Screenshot: `output/right-click-cancel-demolition-validation.png`

## 2026-02-26

### Long-range powerline flow direction follows commissioning order

Fixed long-range line pulse direction so animation always travels from the first selected endpoint to the second selected endpoint.

Changes in `src/game/runtime.js`:

- Added explicit flow direction on links:
  - `flowFrom`
  - `flowTo`
- Fresh state link normalization now initializes flow to `a -> b`.
- Snapshot hydration now validates `flowFrom/flowTo` against endpoints and repairs invalid/missing values to `a -> b`.
- Commissioning logic now always stamps direction from the live click order:
  - new link: `flowFrom = startRegion.id`, `flowTo = region.id`
  - recommissioning existing line between same endpoints updates `flowFrom/flowTo` again.
- Pulse rendering now lerps along `flowFrom -> flowTo` (with fallback to `a -> b` when needed).
- `render_game_to_text` link payload now includes `flowFrom` and `flowTo` for deterministic validation.

Validation:

- Syntax checks:
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
  - `node --check src/game/core.js`
- develop-web-game client smoke:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir /Users/mstafford/Projects/local/energies-game/output/web-game-line-flow-direction-regression`
- Targeted Playwright direction check (forward + reverse commissioning on same endpoints, with dev mode enabled to avoid budget noise):
  - First build result: `flowFrom=node-1`, `flowTo=node-2`
  - Rebuild in reverse result: `flowFrom=node-2`, `flowTo=node-1`
  - Assertion result: `pass: true`
  - Screenshot: `/Users/mstafford/Projects/local/energies-game/output/line-flow-direction-validation.png`

### Priority overlay icon: tight crop

- Updated `/assets/icons/overlays/priority-elevated.svg` to tightly wrap the glyph geometry for accurate overlay anchoring.
- Changed SVG root from fixed `width="96" height="96" viewBox="0 0 96 96"` to a tight bounds viewBox:
  - `viewBox="28.75 36.75 38.5 36.5"`
- Kept all internal paths unchanged.

### Reroute icon composition update

- Updated `/assets/icons/circular/line-reroute.svg`:
  - Bolt scaled to `115%` and shifted down-left via transform.
  - Crosshair scaled to `120%` and shifted down-left via transform.
- Kept circular frame/rings unchanged.

## 2026-02-27

### Click popup for city/structure power metrics

Feature path (`selectedEntityPopup` payload + popup rendering + dismissal on map click / `Escape`) was already present in current `HEAD` for:

- `src/game/runtime.js`
- `src/game/app.js`

Net implementation change in this turn:

- Added/updated popup visual styling in `src/styles/run.css`:
  - `.floating-selected-entity-popup`
  - `.selected-entity-popup-*` rows/diff/empty-state styles
  - removed stale `.floating-region-context` style block

Result:

- Popup now renders as a readable floating panel with the requested metric formatting and signed diffs.
- Existing runtime behavior remains:
  - city/structure click shows popup
  - empty-map click hides popup
  - `Escape` hides popup

Validation:

- JS syntax checks:
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
- develop-web-game smoke:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir /Users/mstafford/Projects/local/energies-game/output/web-game-entity-popup-regression`
- Targeted Playwright validation:
  - structure click shows popup with supply/output rows.
  - city click shows popup with demand/input rows.
  - empty map click hides popup.
  - `Escape` hides popup.
  - assertion result: `pass: true`
  - screenshot: `/Users/mstafford/Projects/local/energies-game/output/entity-popup-validation.png`

### Docs: powerplant tradeoff strategy codified

Codified explicit, situational tradeoff policy for the three powerplant types in design docs:

- `Natural Gas`: reliable output + recurring operating cost pressure.
- `Solar`: lower output + low ongoing operating burden.
- `Wind`: higher upfront capital + stronger long-run value in favorable wind conditions.
- No hidden anti-minmax debuffs; balancing must use visible levers only.
- Map/resource context and `Line` economics are explicit parts of powerplant value.

Documentation updates:

- `/docs/design/GAME_DESIGN.md`
  - Added `8.2.1 Powerplant Tradeoff Strategy`.
- `/docs/design/MAP_DESIGN_2D.md`
  - Added `4.1 Powerplant Resource and Network Tradeoffs`.
  - Expanded placement preview requirements to include expected output, recurring cost, and local modifiers.
- `/docs/design/FRONTEND_AND_UX.md`
  - Added powerplant transparency rules for placement UI.
  - Added powerplant cost/output preview requirement in bottom context panel.
- `/docs/design/MISSION_AND_MODE_DESIGN.md`
  - Added `Powerplant Balance Policy Across Modes`.
- `/docs/design/README.md` and `/docs/README.md`
  - Added summary bullets for transparent, situational powerplant tradeoffs.

Terminology consistency updates:

- Updated active implementation schema examples to use `powerplant` key naming:
  - `/docs/implementation/MAP_STORAGE_AND_RESOURCE_ZONES.md`

Validation:

- `rg --line-number --ignore-case "\\bplant\\b|\\bplants\\b"` across active docs (design + top-level docs + active implementation spec): no matches.
- Note: historical archive docs under `/docs/implementation/archive/` intentionally retain original wording.

### New warning/alert status icons

- Added circular status icons in `/assets/icons/circular/`:
  - `status-warning.svg` (yellow-accent exclamation)
  - `status-alert.svg` (red-accent exclamation)
- Both follow the existing 96x96 circular icon system and dark-core style.
- Updated `/assets/icons/circular/README.md` with a `Status Icons` section.

### Reroute center no longer snaps + elevated-priority overlay icon

Implemented two reroute UX updates:

- Reroute radius center now stays at cursor world position (no snapping to city/structure centers).
- Elevated-priority cities/structures now render overlay icon:
  - `/assets/icons/overlays/priority-elevated.svg`

Files updated:

- `src/game/runtime.js`
  - `drawRerouteRadiusPreview()` now centers directly on mouse cursor.
  - `handleReroute()` now computes radius center from click world point, even when a region was clicked.
  - Added `drawPriorityOverlay()` and integrated it into `drawRegions()` for all `priority === elevated` regions.
  - Extended text-state icon load payload with overlay readiness (`terrainMap.iconSetLoaded.overlay.priorityElevated`).
  - Added overlay slot in runtime `iconSet` initialization.
- `src/game/core.js`
  - Added overlay asset entry to `ICON_SET_URLS`:
    - `overlay.priorityElevated: "/assets/icons/overlays/priority-elevated.svg"`

Validation:

- Syntax checks:
  - `node --check src/game/runtime.js`
  - `node --check src/game/core.js`
  - `node --check src/game/app.js`
- develop-web-game smoke:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir /Users/mstafford/Projects/local/energies-game/output/web-game-reroute-overlay-regression`
- Targeted Playwright no-snap + overlay verification:
  - Scenario A (click centered at town.x-20): town elevated, test node at town.x+95 remained nominal.
  - Scenario B (click centered at town.x): same node became elevated.
  - This confirms reroute uses true click center rather than snapping to clicked region center.
  - Assertions: `pass: true`
  - Screenshots:
    - `/Users/mstafford/Projects/local/energies-game/output/reroute-no-snap-offset.png`
    - `/Users/mstafford/Projects/local/energies-game/output/reroute-no-snap-center.png`

### Power Supply panel now shows (Supply - Demand) delta

- Updated run HUD rendering in `src/game/app.js` so the `Power Supply` value includes a signed delta on the left:
  - Display format: `(<signed diff>) <supply MW>` where diff is `(powerSupply - powerDemand)`.
  - Added helper `formatSignedNumber()` for consistent signed decimal output.
- Added styling in `src/styles/run.css`:
  - `.hud-metric-diff.is-positive` renders green.
  - `.hud-metric-diff.is-negative` renders red.
  - `#hud-power-supply` now uses inline flex to align diff + supply value cleanly.

Validation:

- `node --check src/game/app.js`
- `node --check src/game/runtime.js`
- develop-web-game smoke run:
  - `node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" --url http://127.0.0.1:5173 --actions-file "$HOME/.codex/skills/develop-web-game/references/action_payloads.json" --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-power-supply-delta`

### Reroute tool now auto-returns to pan after one use

- Updated `src/game/runtime.js` in `handlePrimaryClick()` so when `TOOL_REROUTE` is applied, the active tool immediately reverts to `TOOL_PAN` after processing the reroute click.
- This makes reroute behavior one-shot, matching build-style cursor/tool fallback.

Validation:
- `node --check src/game/runtime.js`

### Town emergence: prevent city/town spawns on water pixels

- Added map pixel helpers in `src/game/runtime.js`:
  - `getMapPixelColorAt(x, y)`
  - `isWaterMapPixelAt(x, y)`
  - `isSnowMapPixelAt(x, y)`
  - `isWaterWorldPoint(point)`
- Kept existing long-range line surcharge logic intact via `isBlueOrWhiteMapPixelAt` (now composed from water+snow helpers).
- Enforced water rejection in all town emergence paths:
  - Synthetic spawn candidate generation (`generateEmergentTownAnchor`) skips water points.
  - Authored unspawned anchor candidates are filtered to exclude water points.
  - Synthetic anchor acceptance also excludes water points.
  - Final emergent-town creation (`createEmergentTownFromAnchor`) has a last-guard bailout if anchor lands on water.

Validation:
- `node --check src/game/runtime.js`
- develop-web-game smoke:
  - `node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" --url http://127.0.0.1:5173 --actions-file "$HOME/.codex/skills/develop-web-game/references/action_payloads.json" --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-town-water-spawn-guard`

### Right-click demolition for long-range powerlines (with confirmation)

- Added right-click hit-testing for built long-range lines in `src/game/runtime.js`:
  - `pointToSegmentDistance(...)`
  - `findBuiltLineAtScreen(...)`
- Extended secondary-click behavior:
  - If no structure/city is under cursor, right-click now checks for a nearby built long-range line.
  - When found, it opens the existing demolish confirmation popover via `onRequestDemolishConfirm`.
- Added line demolition runtime path:
  - `getLineDemolishLabel(line)`
  - `estimateLineDemolishRefund(line)` (uses `DEMOLITION_LINE_REFUND_RATIO`)
  - `demolishBuiltLine(line)`
  - `confirmDemolishLine(lineId)`
- Updated confirmation popover handling in `src/game/app.js`:
  - Supports optional `confirmDetail` text.
  - Routes accept action to `confirmDemolishLine(...)` when `payload.lineId` is provided; otherwise keeps existing building demolition path.

Validation:
- `node --check src/game/runtime.js`
- `node --check src/game/app.js`
- develop-web-game smoke run:
  - `node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" --url http://127.0.0.1:5173 --actions-file "$HOME/.codex/skills/develop-web-game/references/action_payloads.json" --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-line-rightclick-demolish-smoke`
- Targeted Playwright validation:
  - Built a line between two new grid points.
  - Right-clicked the line segment.
  - Confirm popover text included `Demolish Line ...`.
  - Accepting confirm produced alert: `Line removed between ...`.

### Status icons simplified (no background)

- Replaced `/assets/icons/circular/status-warning.svg` with a transparent, minimal yellow exclamation glyph.
- Replaced `/assets/icons/circular/status-alert.svg` with a transparent, minimal red exclamation glyph.
- Removed circular/core background styling from both.

### Simplified line rendering at highest zoomed-out levels

- Updated low-zoom powerline rendering in `src/game/runtime.js`:
  - Added `SIMPLIFIED_LINE_RENDER_ZOOM_THRESHOLD = 0.9`.
  - Added helper `drawThinParallelLines(...)` to render N thin parallel wires between endpoints.
- Long-range lines:
  - In `drawLongDistancePowerline(...)`, when zoom is at or below the threshold, rendering now switches to **3 thin parallel lines** and skips tower/wire-bundle detail.
- Local substation service links:
  - In `drawTownServiceLinks(...)`, when zoom is at or below the threshold, each source-to-town link now renders as **2 thin parallel lines** directly between endpoints.

Validation:
- `node --check src/game/runtime.js`
- develop-web-game smoke:
  - `node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" --url http://127.0.0.1:5173 --actions-file "$HOME/.codex/skills/develop-web-game/references/action_payloads.json" --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-zoomed-line-style-smoke`
- Targeted Playwright visual capture at minimum zoom:
  - `output/zoomed-line-style-both-types.png`

### Build preview: invalid placement tint + side-effect fix

- Existing disallowed-build preview behavior was retained (red-tinted ghost + red marker).
- Fixed preview placement validation to avoid mutating runtime node IDs while hovering:
  - Added `createInfrastructureNodePreview(...)` in `src/game/runtime.js`.
  - Updated `getBuildPlacementPreviewState(...)` to use preview-only nodes instead of `createInfrastructureNode(...)`.
- This keeps invalid/valid cursor feedback stable and prevents `nextNodeId` increments from mouse movement.

Validation:
- `node --check src/game/runtime.js`
- develop-web-game smoke captures:
  - `output/web-game/build-preview-invalid/shot-0.png`
  - `output/web-game/build-preview-smoke/shot-0.png`
  - `output/web-game/build-preview-smoke2/shot-0.png`
  - `output/web-game/build-preview-smoke3/shot-0.png`

### Long-range line range reduced

- Updated `LONG_RANGE_LINE_MAX_DISTANCE` from `1000` to `500` in `src/game/runtime.js`.
- This halves the max allowable long-range powerline build distance and updates out-of-range validation/messages automatically via `getMaxLineRange()`.

Validation:
- `node --check src/game/runtime.js`

## 2026-02-27

### Remove "National Bulletin" from main menu

- Updated `src/game/app.js` main menu template to remove the `aside.menu-bulletin` panel (including the "National Bulletin" heading and list content).
- Updated `src/styles/base.css` menu layout to two columns so the main menu no longer reserves empty space for a third bulletin column.
- Removed now-unused `.menu-bulletin` style rules.

Validation:
- `node --check src/game/app.js`
- `rg -n "National Bulletin|menu-bulletin" src -S` (no matches)

### Powerplant names now use type labels (not Grid Point)

- Updated `src/game/runtime.js` naming flow so infrastructure nodes with a built plant display by plant type:
  - Added `getPlantDisplayName(region)` and `getRegionDisplayName(region, fallback)`.
  - Plant-backed nodes now resolve to `Wind Powerplant`, `Solar Powerplant`, or `Gas Powerplant`.
- Replaced user-facing `region.name` usages with `getRegionDisplayName(...)` in plant-relevant runtime surfaces:
  - build/demolish alerts + timeline messages,
  - line labels and line commission/removal alerts,
  - demolish confirm payload `regionName`,
  - selected popup title payload,
  - `render_game_to_text` infrastructure node names.
- Updated plant label constant for gas from `Natural Gas Powerplant` to `Gas Powerplant`.

Validation:

- `node --check src/game/runtime.js`
- develop-web-game smoke run:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 2 --pause-ms 250 --screenshot-dir output/web-game-powerplant-naming`
- Targeted Playwright placement check (wind + solar + gas) confirmed text-state names:
  - `Wind Powerplant`
  - `Solar Powerplant`
  - `Gas Powerplant`

### Powerplant popup: removed demand metric row

- Updated selected-entity popup rendering so powerplant panels no longer include the demand metric row.
- Runtime now emits `isPowerplant` in `selectedEntityPopup` payloads when the selected structure has at least one plant asset.
- Popup renderer (`src/game/app.js`) now conditionally omits the `Total Demand` row when `popup.isPowerplant` is true, while keeping relevant flow/supply rows.

Validation:

- JS syntax checks:
  - `node --check src/game/runtime.js`
  - `node --check src/game/app.js`
- develop-web-game smoke:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:4173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir /Users/mstafford/.codex/worktrees/ce01/save-the-grid/output/web-game-powerplant-popup-smoke`
- Targeted popup validation (Playwright):
  - built/selected `node-1` powerplant and asserted popup text excludes demand label.
  - assertion artifact: `/Users/mstafford/.codex/worktrees/ce01/save-the-grid/output/powerplant-popup-validation/assertion.json`
  - screenshot: `/Users/mstafford/.codex/worktrees/ce01/save-the-grid/output/powerplant-popup-validation/powerplant-popup.png`

## 2026-02-27

### Remove news blurbs from menu and run HUD

- Removed menu bulletin panel content from `src/game/app.js` (`.menu-bulletin` block in `renderMainMenu`).
- Removed in-run news ticker block from the Ops panel in `src/game/app.js`.
- Simplified run markup builder signature:
  - `buildRunScreenMarkup(newsTickerText)` -> `buildRunScreenMarkup()`.
- Removed runtime news callback wiring from both run start paths in `src/game/app.js`:
  - deleted `onNews` callback usage in `startRun(...)` and `startRunFromSnapshot(...)`.
- Removed ambient news simulation from `src/game/runtime.js`:
  - deleted `nextNewsAt` state seed/hydration fallback.
  - deleted `emitNewsIfNeeded()` and its update-loop call.
- Removed now-unused shared data export:
  - deleted `NEWS_BLURBS` constant from `src/data.content.js`.
  - removed `NEWS_BLURBS` re-export/import plumbing from `src/game/core.js`, `src/game/app.js`, and `src/game/runtime.js`.
- Updated styles for removed UI blocks:
  - `src/styles/base.css`: menu grid reduced from 3 columns to 2 columns; removed `.menu-bulletin` styling.
  - `src/styles/run.css`: removed unused `.ticker` styling.

Validation:

- Syntax checks:
  - `node --check src/game/app.js`
  - `node --check src/game/runtime.js`
  - `node --check src/game/core.js`
  - `node --check src/data.content.js`
- develop-web-game smoke:
  - `node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" --url http://127.0.0.1:5173 --actions-file "$HOME/.codex/skills/develop-web-game/references/action_payloads.json" --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-remove-news-blurbs`
  - artifacts:
    - `output/web-game-remove-news-blurbs/shot-0.png`
    - `output/web-game-remove-news-blurbs/state-0.json`

### Reroute elevated-priority overlay: top-right + 15% icon area

- Updated `drawPriorityOverlay()` in `src/game/runtime.js` to place the elevated-priority overlay at the top-right corner of each structure/city icon.
- Scaled overlay by area ratio instead of width ratio:
  - Added `PRIORITY_OVERLAY_AREA_RATIO = 0.15`.
  - Overlay side length now computes as `iconSize * Math.sqrt(PRIORITY_OVERLAY_AREA_RATIO)`, which yields 15% of base icon area.
- Updated fallback badge (used only if overlay asset fails to load) to render as a small top-right marker matching the same geometry envelope.

Validation:
- `node --check src/game/runtime.js`
- `node --check src/game/app.js`
- `node --check src/game/core.js`
- develop-web-game client smoke:
  - `node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" --url http://127.0.0.1:4173 --actions-file "$HOME/.codex/skills/develop-web-game/references/action_payloads.json" --click-selector "#start-btn" --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-priority-overlay-topright-15pct`
- targeted reroute verification:
  - `node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" --url http://127.0.0.1:4173 --click-selector "#start-btn" --actions-json '{"steps":[{"buttons":["b"],"frames":2},{"buttons":["left_mouse_button"],"frames":2,"mouse_x":482,"mouse_y":202},{"buttons":[],"frames":12}]}' --iterations 1 --pause-ms 220 --screenshot-dir output/web-game-priority-overlay-targeted2`
  - Verified `output/web-game-priority-overlay-targeted2/state-0.json` reports town `priority: "elevated"` and alert text `Priority elevated for 1/1 location in reroute radius.`

### Suppress structure/city info popup while building long-range powerlines

- Updated HUD payload generation in `src/game/runtime.js`:
  - In `pushHudUpdate()`, `selectedEntityPopup` is now forced to `null` when `this.tool === TOOL_LINE`.
  - This prevents the floating structure/city info panel from appearing during long-range powerline build interactions.
- Selection state (`selectedRegionId`) remains intact for line-tool interaction flow and highlights; only the popup is suppressed.

Validation:
- `node --check src/game/runtime.js`
- develop-web-game smoke run:
  - `node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" --url http://127.0.0.1:5173 --actions-file "$HOME/.codex/skills/develop-web-game/references/action_payloads.json" --click-selector "#start-btn" --iterations 2 --pause-ms 220 --screenshot-dir output/web-game-line-popup-regression`
- Targeted Playwright assertion:
  - Clicked a city in long-range line tool mode; popup remained hidden.
  - Built an infrastructure structure, switched back to long-range line tool, clicked the structure; popup remained hidden.
  - Assertion output: `townPopupHidden: true`, `structurePopupHidden: true`, `consoleErrorCount: 0`.
  - Screenshot: `output/line-popup-assert/line-tool-no-info-panel.png`
