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
