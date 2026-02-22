Original prompt: Develop the game MVP based on all provided documentation

## 2026-02-12
- Parsed all docs in `docs/design/*` and `docs/implementation/ARCHITECTURE.md`.
- Confirmed repository had documentation only; no existing runtime code.
- Planned MVP implementation as browser-native singleplayer game with:
  - Splash/main menu/setup/campaign/custom/run/end surfaces.
  - 2D overhead map with 8 regions, locked region acquisition, and line routing visuals.
  - Build/demolish/reroute command vocabulary.
  - Real-time deterministic tick loop, pause, event rail, scoring, and local records.
  - Debug hooks `window.render_game_to_text` and `window.advanceTime` for automation.

### TODO
- Implement full game MVP files.
- Run Playwright validation loop and inspect screenshots/errors.
- Record remaining follow-ups after verification.

## 2026-02-12 (Bot Player)
- Added a standalone automation bot under `bot-player/` (separate from `src/` game code).
- Implemented `bot-player/run-bot.mjs`, a Playwright-based scenario runner with declarative step actions:
  - `wait`, `waitFor`, `click`, `press`, `type`, `assertText`, `advanceTime`, `autoplay`, `screenshot`.
  - Optional-step support and target fallbacks (`data-testid`, role/name, text).
  - Console/page error capture and configurable failure behavior.
  - Screenshot artifact output for each run.
- Added starter scenarios:
  - `bot-player/scenarios/smoke-menu-to-run.json`
  - `bot-player/scenarios/smoke-controls.json`
- Added docs in `bot-player/README.md` with install/run instructions and suggested `data-testid` contract.
- Added isolated package setup in `bot-player/package.json` and `.gitignore`.
- Installed bot dependencies locally (`playwright`) and validated runner behavior with a dry run against `about:blank`.

### TODO (Next)
- Wire stable `data-testid` selectors into implemented game surfaces so scenarios can deterministically follow menu/setup/run paths.
- Run bot scenarios against the real dev server once the game UI shell is present.
- Add scenario(s) for mission selection and one deterministic command sequence tied to objective progression.
- Added first-pass MVP implementation files:
  - `index.html`
  - `src/styles.css`
  - `src/data.js`
  - `src/game.js`
  - `src/main.js`
- Implemented full flow surfaces: splash, main menu, standard setup, campaign select, custom setup, in-run HUD, records/settings, and end-of-run summary.
- Implemented simulation/gameplay loop with fixed-step tick, region demand/supply model, build/demolish/reroute, region unlocks, incidents, alerts, economy, reliability, and scoring.
- Wired persistence for records, campaign progression, settings, and suspended run snapshots.
- Exposed test hooks: `window.render_game_to_text()` and `window.advanceTime(ms)`.

### TODO (current pass)
- Run lints/syntax checks and fix issues from first pass.
- Run Playwright gameplay loop and inspect screenshots/state/errors.
- Tighten any gameplay or UI bugs surfaced by automated play.
- Tuned bot runner so optional steps default to short timeout (1500ms cap) to keep smoke runs fast when UI targets are not present yet.
- Re-ran `smoke-menu-to-run` and `smoke-controls` against `about:blank` to validate control flow, optional-step handling, and screenshot output.
- Updated bot scenarios to target current real UI selectors (`#menu-new-run`, `#start-standard-run`, `#game-canvas`, `#run-save-exit-btn`) so runs are deterministic with existing MVP implementation.
- Added a menu priming click step in scenarios to tolerate a stale splash pointer listener in current game implementation.
- Validated `smoke-menu-to-run` and `smoke-controls` end-to-end against local HTTP server (`http://127.0.0.1:4273`): both now complete and return to menu after save/exit.
- Added `#start-btn` quick-start action on main menu to support one-click automated entry into gameplay (required for deterministic Playwright loop).
- Fixed splash-to-menu listener leak: stale splash key/pointer handlers were intercepting first menu click, preventing `Quick Start` automation from entering gameplay.
- Added additional keyboard mappings for automation coverage:
  - `A` => demolish tool
  - `B` => reroute tool
  - `Enter` => cycle critical alerts
- Enforced design integrity policy: all Custom Game runs now always record as `custom` class (no leaderboard-eligibility toggle in custom setup).
- Captured full-page validation screenshots for menu/setup/custom/run surfaces under `output/fullpage/`.
- Confirmed zero console/page runtime errors during full-page navigation smoke run.

## Final Verification Summary (this pass)
- Verified deterministic gameplay entry via `#start-btn` using the `develop-web-game` Playwright client.
- Verified `window.render_game_to_text()` and `window.advanceTime(ms)` output/behavior in active run states.
- Verified core controls in automation loop:
  - Build via map click.
  - Demolish via `A` tool mapping + map click.
  - Reroute via `B` tool mapping + map click (priority cycles).
  - Pause via `Space` (state reports `paused: true`).
  - Alert cycle via `Enter` mapping.
- Verified no runtime console/page errors in automated runs.
- Verified full-page mobile/desktop-friendly surface rendering for menu/setup/custom/run flows.

### Remaining TODO / Suggestions
- Add campaign-mode targeted Playwright scenarios for mission completion and medal grading checks.
- Add custom-setup form automation paths to assert end-of-run summary + record insertion for custom class.
- Tune balance values (economy/reliability/demand) after first human playtest pass.
- Fixed startup auto-pan bug in camera controls.
  - Added explicit pointer lifecycle handling (`pointerenter`/`pointerleave`) to prevent stale `mouse.inside` state.
  - Added `edgePanReady` gating so edge-pan activates only after deliberate pointer movement/interaction on the canvas.
  - Synced pointer coordinates on `pointerdown` to avoid stale click-position state on first interaction.
- Validation:
  - `output/repro-pan-after/`: camera remained stable at run start with no intentional pointer input (`y=700` across iterations).
  - `output/repro-pan-intentional/`: intentional top-edge interaction still pans as designed (`y` reaches `0`).
  - No console/page errors in these verification runs.
- 2026-02-18: Ran `bot-player/scenarios/start-round-demo.json` with `advanceTime=10000` and captured a 10-seconds-into-round screenshot (`Timer 00:10`) at `bot-player/artifacts/2026-02-18T16-05-09-218Z-round-started.png`.
- Fixed run-screen layout growth/scrollbar bug causing viewport overflow during gameplay.
  - Added `body.run-mode { overflow: hidden; }` and screen-mode toggling in app transitions.
  - Locked run screen to viewport (`height/min-height: 100dvh`) and prevented page-level overflow.
  - Updated run layout rows to `auto minmax(0,1fr) auto` and removed map-shell fixed min-height pressure.
  - Constrained side rails to internal scrolling instead of expanding page height.
- Verification:
  - Document metrics remained stable across time in run mode (`scrollHeight == clientHeight`, `scrollY == 0`).
  - Camera remained stable at run start with no input (`camera.y == 700` across checks).

## 2026-02-18 (Floating HUD Iteration)
- Replaced in-round DOM layout from docked `header + side rails + footer` panels to a full-screen map with floating controls layered on top.
- Added a shared run-screen template method (`buildRunScreenMarkup`) used by both fresh runs and resumed runs.
- Added shared run UI wiring (`attachRunUiListeners`) for:
  - floating tool/asset controls,
  - pause/save actions,
  - map zoom in/out,
  - map recenter,
  - fullscreen toggle.
- Updated `updateRunHud` for the new floating UI nodes:
  - added run label, served-demand chip, zoom chip, and pause button label syncing.
  - kept objective, alerts, incidents, and region-context updates with compact list sizes.
- Simplified canvas overlay to only show a pause badge (removed top-left embedded canvas HUD panel).
- Reworked run-mode CSS to:
  - make map/canvas fill the full viewport,
  - position controls as floating chips/cards/dock/buttons,
  - remove dependency on old `run-layout`, `tool-rail`, `event-rail`, `context-panel` structures,
  - provide mobile responsive behavior for floating controls.

### Validation
- Syntax checks:
  - `node --check src/game.js`
  - `node --check src/main.js`
- Develop-web-game Playwright client:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 3 --pause-ms 250 --screenshot-dir output/web-game-floating`
  - Verified screenshots/state output generated with no runtime failures.
- Full-page visual check of floating HUD:
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario bot-player/scenarios/start-round-demo.json`
  - Reviewed screenshot: `bot-player/bot-player/artifacts/2026-02-18T16-23-49-089Z-round-started.png`.
- Regression smoke:
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario bot-player/scenarios/smoke-controls.json`
  - Completed all steps including save/exit back to menu with no console/page errors.
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario bot-player/scenarios/smoke-menu-to-run.json`
  - Completed end-to-end run entry/autoplay/save-exit path (19/20 due one optional splash-skip step timing out, expected fallback succeeded).

## 2026-02-18 (Floating HUD Re-Validation)
- Re-validated the implemented floating in-round HUD on latest working tree.
- Checks run:
  - `node --check src/game.js`
  - `node --check src/main.js`
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario bot-player/scenarios/start-round-demo.json`
- Latest verification screenshot:
  - `bot-player/bot-player/artifacts/2026-02-18T20-49-26-234Z-round-started.png`

## 2026-02-18 (Map + Metadata Integration)
- Replaced abstract in-round backdrop with the generated terrain map image:
  - `docs/mockups-ui-design/mockup-terrain-map.png`
- Added runtime metadata loading from:
  - `docs/mockups-ui-design/mockup-terrain-map.metadata.json`
- Implemented metadata-to-world projection:
  - Polygon points authored in image pixel coordinates are scaled into game world coordinates.
- Added resource-zone runtime model (`wind`, `sun`, `natural_gas`) and coverage estimation per region.
- Applied zone influence to simulation:
  - Plant/storage generation multipliers now incorporate region resource coverage.
  - Plant operating costs and reliability bonuses now include zone-based effects.
- Added resource-zone rendering overlays and labels directly on top of the terrain map during rounds.
- Extended in-round context + text output:
  - Region context panel now shows resource percentages (W/S/G).
  - `render_game_to_text` now includes terrain-map source info, zone counts, zone centroids, and per-region resource profiles.

### Validation
- `node --check src/game.js` (syntax ok).
- Develop-web-game client run:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 3 --pause-ms 250 --screenshot-dir output/web-game-mapzones`
  - Verified map image and zone overlays in `output/web-game-mapzones/shot-2.png`.
  - Verified `state-2.json` includes loaded terrain metadata and region resource profiles.
- Mode coverage checks (floating UI + map backdrop active in-round):
  - Campaign run screenshot: `bot-player/bot-player/artifacts/2026-02-18T21-21-28-782Z-campaign-round.png`
  - Custom run screenshot: `bot-player/bot-player/artifacts/2026-02-18T21-21-44-643Z-custom-round.png`
- Added map pan controls per request:
  - Click-and-drag panning with threshold (prevents accidental drag on normal clicks).
  - Keyboard panning via `W`, `A`, `S`, `D` (and arrow keys), with keyup + blur reset to prevent stuck movement.
- Refactored pointer click handling:
  - Left click actions (build/select/reroute) now execute on pointer-up if no drag occurred.
  - Right click quick-demolish remains supported.
- Added runtime validation:
  - Build click still works (`capital plant: 2 -> 3`).
  - Drag pan changes camera (`y: 700 -> 1050`).
  - WASD pan changes camera (`W` moved up `y: 1050 -> 761.11`, `D` moved right `x: 1100 -> 1393.68`).
  - No runtime console/page errors in checks.

## 2026-02-18 (Viewport-Aware Map Camera Clamp)
- Fixed map camera bounds to be viewport-aware so the in-round view stays anchored to the terrain map and no off-map space appears during drag/WASD/edge pan/zoom.
- Added `clampCameraToMap()` in runtime and applied it in:
  - resize,
  - drag pan,
  - wheel zoom,
  - keyboard/edge pan,
  - render pass,
  - snapshot hydration,
  - floating map controls (`+`, `-`, `Center`).
- Improved resource-zone label rendering:
  - labels now clamp inside viewport and skip when fully off-screen, preventing clipped half-label artifacts at map edges.

### Validation
- `node --check src/game.js`
- `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 3 --pause-ms 250 --screenshot-dir output/web-game-mapzones-clamped`
- `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario /tmp/campaign-round-check.json`
- `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario /tmp/custom-round-check.json`
- Verified screenshots:
  - `/Users/mstafford/Projects/local/save-the-grid/bot-player/artifacts/2026-02-18T21-31-55-114Z-campaign-round.png`
  - `/Users/mstafford/Projects/local/save-the-grid/bot-player/artifacts/2026-02-18T21-31-55-258Z-custom-round.png`
  - `/Users/mstafford/Projects/local/energies-game/output/web-game-mapzones-clamped/shot-0.png`

## 2026-02-18 (Out-of-Bounds Color Tweak)
- Updated map out-of-bounds/background fill to off-black during map draw:
  - `#0d1216` when terrain map is loaded.
- Updated map-load fallback gradient to dark off-black tones:
  - `#131a20 -> #090d11`.

### Validation
- `node --check src/game.js`
- `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario /tmp/oob-color-check.json`
- Verified screenshot:
  - `/Users/mstafford/Projects/local/save-the-grid/bot-player/artifacts/2026-02-18T21-39-05-461Z-oob-offblack.png`

## 2026-02-18 (Circular Icon Pack)
- Added a new icon-design folder: `docs/icons-circular`.
- Created a cohesive 96x96 circular SVG icon set for towns and powerplants with shared geometry/stroke pattern.
- Added town icons:
  - `town-hamlet.svg`, `town-city.svg`, `town-capital.svg`
- Added powerplant icons:
  - `plant-solar.svg`, `plant-wind.svg`, `plant-hydro.svg`, `plant-gas.svg`, `plant-nuclear.svg`, `plant-coal.svg`, `plant-geothermal.svg`
- Added support files:
  - `docs/icons-circular/README.md`
  - `docs/icons-circular/preview.html`

## 2026-02-18 (Docs Sync: Sparse Start + Town Emergence + Hold-R Resource Layer)
- Implemented latest docs commit (`16e0e62`) gameplay deltas in runtime:
  - Sparse-start run policy across modes (terrain-first feel, few seeded towns, minimal starter infrastructure).
  - Added town model per region (`townCount`, `townCap`) and demand anchoring to town saturation.
  - Added dynamic town emergence system with gating:
    - region must be unlocked,
    - terrain must be livable (`plains`/`river`; excludes mountains/coast/ocean-like zones),
    - nearby grid service must be stable,
    - onboarding-sensitive emergence mode (`off`/`low`/`normal`) by run mode and campaign mission index.
  - Updated campaign onboarding behavior:
    - earliest missions now run with emergence disabled or capped.
  - Resource zones are now hidden by default and only drawn while holding `R`.
  - Reassigned keyboard reroute shortcut from `R` to `E`/`B` to avoid control conflict.
- Updated in-run UI and telemetry:
  - Added HUD chips for resource-layer visibility and town-emergence summary.
  - Added town counters/markers in map region rendering.
  - Added town stability/outage context in region detail panel.
  - Extended `render_game_to_text()` with:
    - `townEmergence` state,
    - `terrainMap.resourceLayerVisible`,
    - per-region town/stability fields.
- Updated main menu bulletin copy to reflect sparse-start direction.

### Validation
- Syntax:
  - `node --check src/game.js`
  - `node --check src/main.js`
  - `node --check src/data.js`
- Develop-web-game loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 4 --pause-ms 300 --screenshot-dir output/web-game-docsync`
  - Verified sparse start state in `output/web-game-docsync/state-0.json` (`resourceLayerVisible=false`, seeded town distribution, playable reliability).
- Targeted Playwright assertions:
  - advanced simulation produced emergence (`advancedTownsEmerged: 1` after `advanceTime(120000)`).
  - hold-`R` toggled resource-layer visibility (`true` while held, `false` after release).
  - artifacts:
    - `output/web-game-docsync/docsync-check.json`
    - `output/web-game-docsync/hold-r-reveal.png`
- Regression smoke:
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario bot-player/scenarios/smoke-menu-to-run.json`
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario bot-player/scenarios/smoke-controls.json`
  - Both scenarios completed with no console/page errors.
- Camera regression quick-check:
  - Verified WASD and drag still move camera (x/y changed as expected).

### Remaining TODO / Suggestions
- If needed, expose `townEmergenceMode` directly in Custom Game setup for explicit player control.
- Tune emergence pacing and sparse-start asset balance per mission objective difficulty after human playtests.

## 2026-02-18 (Icon Pack Integration: docs/icons-circular)
- Integrated the new circular SVG icon set into canvas rendering.
- Added runtime icon preload cache (`ICON_SET_URLS` + `loadIconSet`) for:
  - Town icons: hamlet/city/capital.
  - Resource icons: wind/solar/gas.
- Replaced placeholder town marker dots with circular town SVGs in region rendering.
- Replaced resource-zone text label placeholders with circular resource SVGs when holding `R`.
  - Kept text fallback only if icon load fails.
- Tuned icon scaling for map readability at gameplay zoom levels.
- Extended `render_game_to_text()` terrain payload with `iconSetLoaded` flags for testing/automation visibility.

### Validation
- `node --check src/game.js`
- Develop-web-game screenshot pass:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 3 --pause-ms 250 --screenshot-dir output/web-game-icons`
- Targeted Playwright assertions:
  - default/hold/release visibility check in `output/web-game-icons/icons-check-visibility.json`.
  - screenshots:
    - `output/web-game-icons/icons-check-default.png`
    - `output/web-game-icons/icons-check-hold-r.png`
- Regression smoke:
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario bot-player/scenarios/smoke-menu-to-run.json`
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario bot-player/scenarios/smoke-controls.json`
  - both passed (`smoke-ok`).
- 2026-02-19: Re-verified bot round-start reliability by running `start-round-demo` three consecutive times against `http://127.0.0.1:4373`; all runs completed `11/11` steps and entered active in-game round state.
- Latest visual confirmation screenshot: `bot-player/artifacts/2026-02-19T16-14-11-608Z-round-started.png` (timer at `00:10`).

## 2026-02-19 (Docs Sync Completion: Town-Line Model)
- Continued and completed implementation of docs shift from fragmented-region unlock gameplay to town/line routing gameplay (`f3cf91c` + subsequent docs updates).
- Updated mission/preset data model in `src/data.js`:
  - Removed legacy region `unlockCost` fields from map records.
  - Campaign missions now use `routingComplexity` tags instead of fragmentation tags.
  - Campaign missions now define `townEmergenceMode` (`off`/`limited`/`normal`) explicitly.
  - Mission objective thresholds migrated to `requiredStableTowns` (with town-service wording updates).
- Completed runtime/UI migration in `src/game.js`:
  - Removed legacy unlock helpers and unlock-gated simulation branches.
  - Campaign mission config now reads mission-authored `townEmergenceMode`.
  - Custom Game setup now matches docs knobs:
    - `townEmergenceIntensity`
    - `substationRadiusProfile`
    - `lineMaintenanceProfile`
    - removed old `regionFragmentation` and `unlockCostProfile` controls.
  - Updated Standard/Campaign setup labels and tags to routing-complexity language.
  - Updated menu bulletin copy to substation-radius + manual-line model.
  - Added HUD binding for `Substation Radius` chip.
  - Updated incident language to local-climate / line-routing terminology.
  - `render_game_to_text` no longer emits legacy `unlocked` region flag.
- Fixed startup playability regression introduced by sparse start + manual lines:
  - Sparse runs now prebuild a minimal starter backbone from `capital` to seeded-town endpoints.
  - Prevents immediate collapse from uncovered seeded demand at `t=0`.

### Validation
- Syntax checks:
  - `node --check src/data.js`
  - `node --check src/game.js`
  - `node --check src/main.js`
- Develop-web-game Playwright loop:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173 --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --click-selector "#start-btn" --iterations 3 --pause-ms 250 --screenshot-dir output/web-game-docsync-final2`
  - Verified from `state-*.json`: startup reliability remains stable (`~100%`), unmet demand `0.0` in early seconds.
- Bot smoke scenarios:
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario bot-player/scenarios/smoke-controls.json` (19/19)
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario bot-player/scenarios/smoke-menu-to-run.json` (19/20 with expected optional splash step timeout)
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario bot-player/scenarios/start-round-demo.json` (11/11)
- Additional targeted UI checks:
  - Custom setup screenshot confirms new controls are rendered:
    - `/Users/mstafford/Projects/local/save-the-grid/bot-player/artifacts/2026-02-19T20-00-17-138Z-custom-setup.png`
  - Campaign screen screenshot confirms `routingComplexity` tags:
    - `/Users/mstafford/Projects/local/save-the-grid/bot-player/artifacts/2026-02-19T20-01-45-405Z-campaign-select.png`

### Follow-up TODO
- Optional: migrate mission objective field name usage fully (remove `requiredUnlocked` fallback after old snapshots are no longer needed).
- Optional: revisit sparse-start baseline balance now that starter backbone links exist (line maintenance/economy tuning).

## 2026-02-19 (Interactive Terrain Browser App)
- Added a standalone fullscreen browser app for interactive terrain generation:
  - `tools/terrain/interactive/index.html`
  - `tools/terrain/interactive/styles.css`
  - `tools/terrain/interactive/app.js`
  - `tools/terrain/interactive/README.md`
- App behavior:
  - full-screen map canvas,
  - floating controls,
  - `Re-generate` button,
  - `Smoothness` slider,
  - `Sea Level` slider.
- Generation model in browser follows topology map logic and classifies terrain into:
  - water (blue), plains (green), mountains (light brown), and top 5% mountaintops (white).

### Validation
- `node --check tools/terrain/interactive/app.js`
- Browser screenshots captured with Playwright:
  - `output/terrain-interactive/desktop-initial.png`
  - `output/terrain-interactive/desktop-adjusted.png`
  - `output/terrain-interactive/mobile-initial.png`

## 2026-02-19 (Town-Only Topology Runtime Update)
- Implemented the docs-aligned town-only runtime model and removed remaining corridor/hub assumptions from active gameplay.
- Updated map data to expose town-first topology:
  - Added `BASE_MAP.towns` and kept `BASE_MAP.regions` as alias for compatibility.
  - Removed all authored starter transmission corridors (`BASE_MAP.links = []`).
  - Renamed map entities away from corridor/belt wording and reduced node radii for point-node visuals.
- Updated simulation configuration/policy:
  - Standard/custom runs remain sparse-start (`capital` seeded initially).
  - Campaign runs remain non-sparse to preserve mission objective viability.
- Reworked town emergence:
  - Added synthetic emergent-town anchor generation so towns can appear directly on the map (not only from hidden authored anchors).
  - Added emergent town name generation (`town-<n>` ids + curated names).
- Reworked grid power resolution away from capital-hub dispatch:
  - Added component discovery over built manual `Line` network.
  - Powered-substation detection now checks whether a town's network component has generation.
  - Demand allocation is resolved per powered component instead of forcing all transfers through capital.
  - Link stress/usage now derives from per-component served load.
- Kept substation-radius local service model and orthogonal auto-town links.
- Updated map rendering to point-style town nodes:
  - Removed large hub-disc look.
  - Town icons now render centered on node points.
  - Added compact asset badges around town icons.
  - Added subtle hatch warning for unserved towns.
- Updated runtime payloads/UI copy:
  - `render_game_to_text` now uses town-centric keys (`selectedTownId`, `lineSelectionStartTownId`, `towns`) and drops region aliases from output.
  - Region context details now use town archetype wording.

### Validation
- Syntax checks:
  - `node --check src/data.js`
  - `node --check src/game.js`
  - `node --check src/main.js`
- Develop-web-game loop:
  - `node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" --url http://127.0.0.1:5173 --actions-file "$HOME/.codex/skills/develop-web-game/references/action_payloads.json" --click-selector "#start-btn" --iterations 4 --pause-ms 300 --screenshot-dir output/web-game-town-topology-v3`
- Bot regression scenarios:
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario bot-player/scenarios/smoke-controls.json`
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5173 --scenario bot-player/scenarios/start-round-demo.json`
- Targeted behavior checks via Playwright scripting:
  - Verified town emergence after time advance.
  - Verified manual `Line` build between capital and emerged town after substation placement.
  - Verified auto-generated orthogonal town service link when a town is covered by a powered substation in range.

### Remaining TODO / Suggestions
- Balance tuning: sparse-start reliability drops quickly if player delays expansion; tune starter generation, emergence timing, or early demand pressure.
- Optional cleanup: rename internal `region` identifiers/functions in code to `town` for full semantic consistency.

## 2026-02-19 (Town-as-point build model verification)
- Validated current `src/game.js` behavior after entity-model refactor (`town` demand entities + player-built `node` infrastructure anchors).
- Ran syntax check:
  - `node --check src/game.js`
- Ran develop-web-game Playwright client smoke checks:
  - Open-map build test with multiple clicks: `output/web-game-town-node-check/`
  - Town-click rejection + open-map build test: `output/web-game-town-block-check-fast/`
- Confirmed in `render_game_to_text` snapshots:
  - `towns` remain demand-only entities (`assets` zero by default).
  - New player infrastructure appears under `infrastructureNodes` with `node-*` ids.
  - Clicking town icons surfaces advisory alert: "Towns are demand points. Build infrastructure on open map points."
  - Open-map clicks commission plants at new infrastructure nodes.
- Visual inspection of screenshots confirms towns render as icon points and new infrastructure renders as separate point nodes.
- No runtime console/page errors emitted by Playwright client (no `errors-*.json` files in validation outputs).

### TODO / Follow-up
- Optional: rebalance initial economy/reliability now that rounds begin with no pre-built infrastructure and sparse-start demand can spike quickly.
- Optional: run full bot scenarios (`smoke-menu-to-run`, `smoke-controls`) after any additional gameplay tuning.
- Added `Mountaintops Level` slider to interactive terrain app.
  - Updated UI in `tools/terrain/interactive/index.html`.
  - Wired mountaintop height percentile in `tools/terrain/interactive/app.js`.
  - Updated control docs in `tools/terrain/interactive/README.md`.
- Validation screenshots:
  - `output/terrain-interactive/desktop-mountaintops-85.png`
  - `output/terrain-interactive/desktop-mountaintops-99.png`
- Added generation algorithm toggle to interactive terrain app.
  - New algorithm buttons: `Topology` and `Midpoint`.
  - Implemented midpoint displacement (diamond-square) heightmap path in `tools/terrain/interactive/app.js`.
  - Wired algorithm selection into map generation + stats output.
- Validation screenshots:
  - `output/terrain-interactive/desktop-topology-toggle.png`
  - `output/terrain-interactive/desktop-midpoint-toggle.png`

## 2026-02-19 (Docs Sync: Point Terminology + Infrastructure Endpoint Enforcement)
- Continued docs-sync pass after latest wording and topology updates.
- Updated runtime behavior in `src/game.js` so manual `Line` endpoints are strictly infrastructure points:
  - `canEndpointHostLine` now rejects town entities.
  - Line tool alerts now explicitly explain that towns are demand points and endpoints must be infrastructure points with plant/substation assets.
- Hardened simulation topology consistency with docs:
  - Generation calculation now excludes towns (`computeGenerationForEntity` returns 0 for town entities).
  - Powered-substation source selection now excludes towns.
  - Operating and reliability asset contributions now count infrastructure points only.
- Updated remaining user-facing wording from `Node` to `Point` in selection context copy.
- Re-validated handcrafted-map selection in Custom Game:
  - selecting `m03-fuel-shock` correctly propagates to runtime terrain map image and metadata behavior (`metadata: null`).

### Validation
- Syntax checks:
  - `node --check src/game.js`
  - `node --check src/data.js`
  - `node --check src/main.js`
- Develop-web-game loop:
  - `node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" --url http://127.0.0.1:5180 --actions-file "$HOME/.codex/skills/develop-web-game/references/action_payloads.json" --click-selector "#start-btn" --iterations 4 --pause-ms 300 --screenshot-dir output/web-game-docsync-latest2`
- Bot scenarios:
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5180 --scenario bot-player/scenarios/smoke-controls.json`
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5180 --scenario bot-player/scenarios/start-round-demo.json`
- Targeted runtime assertions:
  - verified custom-map terrain profile (`m03-fuel-shock`) via `window.render_game_to_text()`.
  - verified line-tool town click produces endpoint-rejection alert and does not set `lineSelectionStartEntityId`.

## 2026-02-19 (Terrain Lab Rivers)
- Added river generation to `tools/terrain/interactive/app.js` after height-field generation and sea-level thresholding.
- Rivers now:
  - start from random land source cells,
  - follow downhill flow to lower neighbors,
  - optionally fork to second-lower neighbors based on fork chance,
  - continue through local pits via lowest unvisited neighbor fallback,
  - stop at sea level,
  - rasterize with constant-width brush (`RIVER_WIDTH_PX = 20`).
- Wired floating controls:
  - river source counter (`- / +`),
  - river forking slider.
- Updated HUD stats line to include river coverage, source count, and fork percentage.
- Added counter control styling in `tools/terrain/interactive/styles.css`.
- Updated controls docs in `tools/terrain/interactive/README.md`.

### Validation
- `node --check tools/terrain/interactive/app.js`
- `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173/tools/terrain/interactive/ --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --iterations 3 --pause-ms 250 --screenshot-dir output/terrain-rivers`
- `npx playwright screenshot --full-page http://127.0.0.1:5173/tools/terrain/interactive/ output/terrain-rivers/fullpage-default.png`
- Custom Playwright interaction run (inline) verified that changing river count and fork chance updates branching and displayed stats.

## 2026-02-19 (Terrain Lab River Reset + Animated River Growth)
- Added `Reset Rivers` control in `tools/terrain/interactive/index.html`.
- Added button styling in `tools/terrain/interactive/styles.css`.
- Updated terrain app river behavior in `tools/terrain/interactive/app.js`:
  - Added dedicated `riverSeed` so river-only resets can regenerate river networks while preserving terrain seed.
  - `Reset Rivers` now restores river defaults (`count=6`, `fork=24%`) and reseeds river generation.
  - Reduced river width from 20px to 12px (`RIVER_WIDTH_PX = 12`).
  - Added animated river tracing pass (~950ms):
    - sources appear first,
    - river paths propagate downstream over time,
    - mouths/endpoints fade in near animation completion.
  - Added animation cancellation/replace logic so rapid slider updates do not leave stale frames.
  - Seed display now shows terrain + river seeds (`Seed T... | R...`).
- Updated docs in `tools/terrain/interactive/README.md` to include `Reset Rivers`.

### Validation
- `node --check tools/terrain/interactive/app.js`
- `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173/tools/terrain/interactive/ --actions-file /Users/mstafford/.codex/skills/develop-web-game/references/action_payloads.json --iterations 3 --pause-ms 250 --screenshot-dir output/terrain-rivers-animated`
- Playwright interaction verification (inline script):
  - captured animation snapshots at start/mid/end,
  - changed river count/fork,
  - clicked `Reset Rivers` and confirmed defaults + new river seed + rerender animation.
- Screenshots:
  - `output/terrain-rivers-animated/anim-00-start.png`
  - `output/terrain-rivers-animated/anim-01-mid.png`
  - `output/terrain-rivers-animated/anim-02-end.png`
  - `output/terrain-rivers-animated/anim-04-after-reset-early.png`
  - `output/terrain-rivers-animated/anim-05-after-reset-end.png`

## 2026-02-19 (River Visual Slimdown)
- Reduced river width again for a much thinner result:
  - `tools/terrain/interactive/app.js`: `RIVER_WIDTH_PX` changed from `12` to `4`.
  - River brush minimum radius changed from `2` to `1`.
- Removed colored source/endpoint dot overlays from animated river rendering by deleting marker blending/drawing calls in `composeTerrainFrame`.
- Validation:
  - `node --check tools/terrain/interactive/app.js`
  - screenshot: `output/terrain-rivers-animated/anim-06-narrow-no-dots.png`

## 2026-02-19 (Click-to-Add River Sources)
- Added map click interaction to `tools/terrain/interactive/app.js`:
  - Clicking on land now adds a manual river source at the clicked position.
  - Clicking on water is ignored.
- Manual river-source behavior:
  - sources are stored as normalized coordinates and converted per render,
  - persist across slider adjustments,
  - cleared on full `Re-generate` and `Reset Rivers`,
  - capped to 64 manual sources.
- River generation updated to combine:
  - auto sources from the river-count control,
  - manual click sources (additional, not replacing auto count).
- Added current raster/output tracking for click hit-testing against actual terrain height/sea-level.
- Updated docs in `tools/terrain/interactive/README.md` with map-click behavior.

### Validation
- `node --check tools/terrain/interactive/app.js`
- Playwright validation script:
  - land click increases source count (`(6/6)` -> `(7/6)`),
  - water click leaves source count unchanged.
- Screenshots:
  - `output/terrain-rivers-animated/anim-08-click-land-source.png`
  - `output/terrain-rivers-animated/anim-09-click-water-no-source.png`

## 2026-02-19 (River Click FIFO Replacement)
- Updated map-click river behavior to FIFO replacement semantics (instead of additive sources):
  - each land click replaces one existing river source,
  - replacement proceeds from the oldest/first source slot onward,
  - total source count now remains stable at configured river count.
- Implementation details in `tools/terrain/interactive/app.js`:
  - `buildRiverMask` now builds deterministic auto source list first, then applies click-source replacement queue onto source slots.
  - click-source queue is capped to current replacement capacity (`max(1, riverCount)`) so newer clicks replace older ones one-by-one.
- Water clicks still ignored.
- Updated docs line in `tools/terrain/interactive/README.md` to describe oldest-first replacement.

### Validation
- `node --check tools/terrain/interactive/app.js`
- Playwright click test:
  - before: `Rivers ... (6/6)`
  - after land click #1: `Rivers ... (6/6)`
  - after land click #2: `Rivers ... (6/6)`
  - after water click: unchanged
- Screenshot:
  - `output/terrain-rivers-animated/anim-10-click-replaces-oldest.png`

## 2026-02-19 (Terrain Lab River Click FIFO + Targeted Animation)
- Updated interactive terrain river behavior in `/Users/mstafford/Projects/local/save-the-grid/tools/terrain/interactive/app.js`:
  - Land click river insertion now behaves as FIFO replacement of sources:
    - each click removes the first/oldest active source and appends the new click source.
    - source count remains capped to configured `Rivers` count.
  - Click-triggered redraw now animates only the newly added river path.
  - Existing rivers remain visible and static during that click animation.
- Added/updated manual source queue handling and replacement mapping in `buildRiverMask(...)`.
- Added animation routing fields (`animationArrivalStep`, `animationMaxArrivalStep`) and new-river-only rendering path in `buildTerrainImage(...)` and frame composition.
- Updated map click docs in `/Users/mstafford/Projects/local/save-the-grid/tools/terrain/interactive/README.md`.

### Validation
- `node --check /Users/mstafford/Projects/local/save-the-grid/tools/terrain/interactive/app.js`
- Develop-web-game Playwright client run:
  - `node /Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5173/tools/terrain/interactive/ --click 640,360 --actions-json '{"steps":[{"buttons":[],"frames":8}]}' --iterations 4 --pause-ms 220 --screenshot-dir output/terrain-rivers-click-fifo`
- Additional Playwright verification run with sequential land clicks and full-page captures:
  - `output/terrain-rivers-click-verify/00-initial.png`
  - `output/terrain-rivers-click-verify/01-click1-early.png`
  - `output/terrain-rivers-click-verify/02-click1-mid.png`
  - `output/terrain-rivers-click-verify/03-click1-end.png`
  - `output/terrain-rivers-click-verify/04-click2-early.png`
  - `output/terrain-rivers-click-verify/05-click2-mid.png`
  - `output/terrain-rivers-click-verify/06-click2-end.png`
  - `output/terrain-rivers-click-verify/log.json`
- Verified in captures that click-triggered status shows `Tracing new river...` and that click updates keep source count at `(6/6)`.

## 2026-02-20 (Terrain Lab: Remove Forking + Right-Click River Removal)
- Removed river forking from the interactive terrain generator.
  - Deleted UI controls for river forking from `/Users/mstafford/Projects/local/save-the-grid/tools/terrain/interactive/index.html`.
  - Removed all fork-related state and generation logic from `/Users/mstafford/Projects/local/save-the-grid/tools/terrain/interactive/app.js`.
  - River tracing now follows a single downstream path (no branch splitting).
- Added right-click source removal on map:
  - Right-click near any river start/source now removes that river source.
  - Implemented via source suppression + removal of nearby manual source entries.
  - Source removal persists across normal slider redraws.
- Added source suppression handling:
  - New suppressed source state bucket and raster blocking in river-source selection.
  - Effective river generation count now accounts for removed sources so removed rivers do not auto-backfill.
- Left-click behavior remains FIFO replacement for adding sources; left-clicking near a previously removed source clears nearby suppression so that source can be reintroduced.
- Updated docs in `/Users/mstafford/Projects/local/save-the-grid/tools/terrain/interactive/README.md`:
  - Removed `River Forking` control description.
  - Added explicit `Map Right Click` behavior.

### Validation
- `node --check /Users/mstafford/Projects/local/save-the-grid/tools/terrain/interactive/app.js`
- Playwright verification run (Rivers forced to 1):
  - left click adds/keeps one source `(1/1)`
  - right click near that source removes it `(0/1)`
  - artifacts:
    - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-rivers-rightclick-remove/00-initial.png`
    - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-rivers-rightclick-remove/01-after-left-click.png`
    - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-rivers-rightclick-remove/02-after-right-click.png`
    - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-rivers-rightclick-remove/result.json`

## 2026-02-20 (Terrain Lab: Minimize/Maximize Control Panel)
- Added a minimize/maximize toggle button to the floating control panel.
- Updated panel markup:
  - added `#floating-controls` container id,
  - added header action group with new `#panel-toggle-btn`,
  - wrapped control contents in `#controls-body` for collapse handling.
- Added collapsed-state styling in `styles.css`:
  - `is-collapsed` class hides control body,
  - compact header-only panel state,
  - toggle button visual styling aligned with existing control style.
- Added app wiring in `app.js`:
  - `state.controlsCollapsed`,
  - `applyControlsPanelState()` updates class, button label, and `aria-expanded`,
  - click handler toggles between `Minimize` and `Maximize`.
- Updated docs in `tools/terrain/interactive/README.md` with the new control.

### Validation
- `node --check /Users/mstafford/Projects/local/save-the-grid/tools/terrain/interactive/app.js`
- Playwright verification:
  - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-controls-toggle/01-expanded.png`
  - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-controls-toggle/02-collapsed.png`
  - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-controls-toggle/03-reexpanded.png`
  - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-controls-toggle/result.json` (`passed: true`)

## 2026-02-20 (Terrain Lab: Uncapped River Add/Remove, No FIFO)
- Removed fixed river-cap behavior and removed FIFO replacement semantics for map clicks.
- Updated river generation model:
  - map still initializes with 6 random river sources,
  - left-click on land now adds additional river sources (no queue replacement),
  - right-click near source removes source,
  - river network can now grow beyond the initial 6 and shrink via removals.
- Updated source-composition logic in `buildRiverMask(...)`:
  - auto sources + manual sources are now merged (deduped),
  - no replacement queue logic.
- Updated right-click removal behavior:
  - manual sources are removed directly,
  - suppressed-source tracking is used only for removed auto sources,
  - removed manual sources do not reduce auto baseline count.
- Removed river increment/decrement controls from UI (now read-only live count).
- `Rivers` label now reflects current active source count from latest render.
- Updated stats formatting from `(current/target)` to `(current)`.
- Updated README controls section to match new behavior.

### Validation
- `node --check /Users/mstafford/Projects/local/save-the-grid/tools/terrain/interactive/app.js`
- Playwright behavior verification:
  - starts at `6` sources,
  - three successful left-click additions increased count `6 -> 7 -> 8 -> 9`,
  - right-click near created source reduced count `9 -> 8`,
  - artifacts:
    - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-rivers-uncapped/01-initial.png`
    - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-rivers-uncapped/02-after-add-1.png`
    - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-rivers-uncapped/03-after-add-2.png`
    - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-rivers-uncapped/04-after-add-3.png`
    - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-rivers-uncapped/05-after-right-remove.png`
    - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-rivers-uncapped/result.json`
- Console/page error check:
  - no runtime errors on page load.

## 2026-02-20 (Terrain Lab: Corner +/- Panel Toggle)
- Updated control-panel toggle button to be a compact symbol button:
  - expanded state uses `-`
  - collapsed state uses `+`
- Moved panel-toggle button to the top-right corner of the floating panel (absolute positioning).
- Updated accessibility attributes dynamically with state:
  - `aria-expanded`
  - `aria-label`
  - `title`
- Kept regenerate button in header actions and reserved spacing so it does not overlap corner toggle.

### Validation
- `node --check /Users/mstafford/Projects/local/save-the-grid/tools/terrain/interactive/app.js`
- Playwright UI verification:
  - label/state transitions `- -> + -> -`
  - panel body visibility toggles as expected
  - toggle button position verified near top-right corner (`cornerDx=9`, `cornerDy=9`)
  - artifacts:
    - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-controls-corner-toggle/01-expanded.png`
    - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-controls-corner-toggle/02-collapsed.png`
    - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-controls-corner-toggle/03-reexpanded.png`
    - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-controls-corner-toggle/result.json`

## 2026-02-20 (Terrain Lab: Remove Button + No Reanimation on Delete)
- Added a new `Remove River` button next to `Reset Rivers` in the control panel.
  - UI row uses side-by-side action buttons.
- Implemented delete-without-reanimation behavior:
  - Added immediate raster render path (`drawTerrainOutputImmediate`) that skips river trace animation.
  - `renderTerrain(...)` now accepts `skipRiverAnimation` and uses immediate draw for delete flows.
  - Right-click removal now redraws with `skipRiverAnimation: true`.
- Added button-based removal flow:
  - `removeOneRiver()` removes one current source (deterministic first source) using shared source-removal logic.
  - Shared helper `removeRiverSourcesByIndex(...)` powers both right-click and button removal.
- Updated README to document `Remove River` and non-reanimated right-click removal behavior.

### Validation
- `node --check /Users/mstafford/Projects/local/save-the-grid/tools/terrain/interactive/app.js`
- Playwright verification run:
  - `/Users/mstafford/Projects/local/save-the-grid/output/terrain-remove-no-reanimate/result.json`
  - Verified:
    - remove button exists next to reset (`riverActionsChildren: 2`),
    - remove button decrements river count (`6 -> 5`),
    - no `Tracing rivers`/`Tracing new river` status appears during delete redraws,
    - right-click delete path also avoids trace animation state.

## 2026-02-20 (Menu Cleanup)
- Removed `Exit` button from main menu in `/src/game.js` per request.
- Removed the now-dead `#menu-exit` click handler.

### Validation
- `node --check src/game.js`
- Playwright loop: `web_game_playwright_client.js` on `http://127.0.0.1:5180` (1 iteration) completed.
- Direct UI assertion: `#menu-exit` count is `0`.
- Screenshot: `/Users/mstafford/Projects/local/energies-game/output/menu-no-exit.png`.

## 2026-02-20 (Campaign Submenu)
- Added a dedicated `Campaign` submenu screen in `/src/game.js`:
  - New `renderCampaignMenu()` with:
    - `Continue Campaign` action (auto-targets recommended unlocked mission),
    - `Mission Select` action.
  - Added `getRecommendedCampaignMission()` helper for continue flow.
- Updated main menu campaign entry:
  - Button label changed from `Campaign Missions` to `Campaign`.
  - Button now routes to `renderCampaignMenu()` instead of opening mission grid directly.
- Updated mission-select navigation:
  - `Back to Menu` changed to `Back to Campaign`.
  - Back action now returns to `renderCampaignMenu()`.

### Validation
- `node --check src/game.js` passed.
- Playwright assertions verified:
  - Main-menu campaign label is `Campaign`.
  - Campaign submenu renders both `#campaign-continue` and `#campaign-mission-select`.
  - Mission screen back button label is `Back to Campaign` and returns to submenu.
- Screenshots:
  - `/Users/mstafford/Projects/local/energies-game/output/campaign-submenu.png`
  - `/Users/mstafford/Projects/local/energies-game/output/campaign-mission-select.png`
- Regression loop:
  - `web_game_playwright_client.js` run on `http://127.0.0.1:5180` completed.

## 2026-02-20 (Docs-only tutorial mode pass)
- User requested documentation-only (no game code changes for tutorial yet).
- Added `docs/design/TUTORIAL_MODE_DESIGN.md` defining tutorial goals, no-fail policy, and full guided task sequence.
- Updated mode references to include Tutorial in:
  - `docs/design/MISSION_AND_MODE_DESIGN.md`
  - `docs/design/GAME_DESIGN.md`
  - `docs/design/FRONTEND_AND_UX.md`
  - `docs/design/MAP_DESIGN_2D.md`
  - `docs/design/README.md`
  - `docs/README.md`
- Left runtime/source code untouched during this pass.

### Next (when implementation starts)
- Add `Tutorial` entry to main menu.
- Add tutorial run config and no-fail behavior.
- Add tutorial step tracker + objective panel progression.
- Add completion detection for build/line/service/resource/reroute/demolish/pause tasks.

## 2026-02-20 (Dev Mode Toggle)
- Added a small main-menu `Dev Mode` switch in `/src/game.js` + `/src/styles.css`.
  - Label: `Dev Mode: infinite money + no defeat`.
  - Stored via localStorage key `STORAGE_KEYS.devMode` (`stg_dev_mode_v1`).
- Wired dev mode into runtime config and flow:
  - `applyDevModeToRunConfig()` stamps run configs with `devMode` before fresh or resumed runs.
  - Dev-mode runs are marked non-leaderboard (`leaderboardEligible=false`, `leaderboardClass=custom`) and tagged with `[DEV]` in run label.
- Implemented dev-mode behavior in simulation:
  - Infinite budget floor (`DEV_MODE_BUDGET_FLOOR = 1_000_000_000`) maintained each tick.
  - HUD budget chip renders `INF` while dev mode is active.
  - Defeat conditions are bypassed (bankruptcy/reliability-collapse no longer end run).
  - Campaign/custom objective failures resolve as victory in dev mode to honor "no losing".
- Added dev-mode exposure in text telemetry:
  - `render_game_to_text()` now includes top-level `devMode`.

### Validation
- Syntax:
  - `node --check src/game.js`
  - `node --check src/data.js`
  - `node --check src/main.js`
- Develop-web-game loop:
  - `web_game_playwright_client.js` against `http://127.0.0.1:5180` (2 iterations) passed.
- Targeted Playwright verification:
  - Enabled `#menu-dev-mode`, started run, advanced 30s, confirmed:
    - still in run (`#game-canvas` present),
    - `render_game_to_text().devMode === true`,
    - budget floor maintained (`1000000000`),
    - HUD shows `Budget INF`.
  - Screenshots:
    - `/Users/mstafford/Projects/local/energies-game/output/dev-mode-toggle-menu.png`
    - `/Users/mstafford/Projects/local/energies-game/output/dev-mode-enabled-run.png`
- Regression smoke:
  - `node bot-player/run-bot.mjs --url http://127.0.0.1:5180 --scenario bot-player/scenarios/smoke-controls.json` passed (19/19).

## 2026-02-20 (Terrain Lab Pan + Zoom)
- Added interactive camera controls to `/tools/terrain/interactive/app.js`:
  - Mouse wheel zoom around cursor (`VIEW_MIN_ZOOM=1`, `VIEW_MAX_ZOOM=5`).
  - Left-drag panning with drag threshold to avoid accidental pan on click.
  - Click-vs-drag split so plain left click still adds a river source while drag pans.
- Updated coordinate mapping for clicks/removals (`screenToRasterPosition`) to respect current pan/zoom transform.
- Updated viewport drawing (`drawRasterToViewport`) to render with camera transform and clamped offsets.
- Kept existing behavior where deleting rivers does not replay full river animation.
- Updated docs in `/tools/terrain/interactive/README.md` with pan/zoom controls.

### Validation
- `node --check tools/terrain/interactive/app.js` passed.
- Ran develop-web-game Playwright client:
  - `web_game_playwright_client.js --url http://127.0.0.1:5173/tools/terrain/interactive/ --actions-file ... --iterations 1`
- Ran targeted Playwright assertions:
  - Zoom changes frame output.
  - Drag-pan changes frame output.
  - Pan itself does not trigger tracing animation.
  - Left-click on visible land after pan/zoom still adds a river (count increased 6 -> 7) and triggers only new-river tracing.
- Artifacts:
  - `/output/terrain-pan-zoom-check/result.json`
  - `/output/terrain-pan-zoom-check/before.png`
  - `/output/terrain-pan-zoom-check/after-zoom.png`
  - `/output/terrain-pan-zoom-check/after-pan.png`

## 2026-02-20 (Right-click hold deletion preview)
- Added right-click hold deletion radius preview in `/tools/terrain/interactive/app.js`:
  - New overlay state `state.deletePreview` tracks active hold and cursor position.
  - `drawRasterToViewport(...)` now calls `drawDeletePreview()` to render a transparent red circle overlay while held.
  - Circle radius is mapped to current zoom so it matches actual deletion radius in raster-space.
- Updated right-click input flow:
  - `mousedown` on right button starts preview.
  - `mousemove` updates preview position.
  - `mouseup` on right button ends preview and performs deletion at release point.
  - `contextmenu` is now prevent-default only (no duplicate delete trigger).
- Updated docs in `/tools/terrain/interactive/README.md` with `Map Right Hold` behavior.

### Validation
- `node --check tools/terrain/interactive/app.js` passed.
- Playwright check confirmed held-right-click changes pixel values toward red and shows overlay in screenshot:
  - `/output/terrain-right-hold-preview/holding-right.png`
  - `/output/terrain-right-hold-preview/result.json`
- Ran develop-web-game client regression loop:
  - `/Users/mstafford/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js`
- Follow-up fix: right-click delete preview now always clears on release, including no-op delete cases.
  - Root cause was `endDeletePreview(deleteRiver=true)` returning without redraw when no sources were removed.
  - Added immediate redraw from `state.lastRaster` after right-button release delete attempt.
  - Added additional safety clear paths: if right button state is no longer down during `mousemove`, on window `mouseup`, and on window `blur`.
- Zoom-out bounds update: lowered `VIEW_MIN_ZOOM` to `0.25` and made pan offset clamps symmetric for zoom above/below 1x, so users can zoom out to see beyond image bounds.
- Validation screenshot: `/output/terrain-zoomout-beyond-bounds.png`.

## 2026-02-20 (Fix: reset-rivers then delete was re-randomizing all rivers)
- Root cause: auto-river RNG seed salt depended on `targetAutoSources` (river count).
  - Deleting one river reduces target count by 1, which changed seed salt and re-randomized all auto rivers.
- Fix in `/tools/terrain/interactive/app.js`:
  - Removed `targetAutoSources` from `seedSalt`; RNG now depends only on `riverSeed` + constant.
  - This keeps river candidate sequence stable when source count changes, so deletion removes the intended source instead of regenerating the whole set.

### Validation
- `node --check tools/terrain/interactive/app.js` passed.
- Targeted Playwright flow (`Reset Rivers` -> right-click delete):
  - River source count changed `6 -> 5`.
  - Result artifact: `/output/terrain-reset-delete-regression/result.json`.

## 2026-02-20 (WASD camera pan)
- Added keyboard panning for terrain lab camera in `/tools/terrain/interactive/app.js`:
  - Hold `W/A/S/D` for continuous map pan.
  - Added key-pan state machine + animation-frame loop (`handleKeyPanChange`, `stepKeyPan`).
  - Added cleanup on window blur to avoid stuck movement.
- Updated controls docs in `/tools/terrain/interactive/README.md` with `Map WASD`.

### Validation
- `node --check tools/terrain/interactive/app.js` passed.
- Ran develop-web-game Playwright client on terrain lab URL (1 iteration).
- Ran targeted Playwright check:
  - zoom-in, hold `D`, hold `W` each changed canvas frame output.
  - result artifact: `/output/terrain-wasd-check/result.json`.

## 2026-02-20 (Continent Scale control)
- Added new `Continent Scale` slider to terrain lab UI:
  - `/tools/terrain/interactive/index.html`
  - Range `50..200`, default `100%`.
- Wired control in `/tools/terrain/interactive/app.js`:
  - Added `continentScaleSlider` + `continentScaleValue` bindings.
  - Added label updates and `input` listener with debounced regenerate.
  - Passed `continentScale` through `renderTerrain -> buildTerrainImage -> buildHeightField`.
- Topology generation change (low-frequency only):
  - Updated `buildHeightFieldTopology(...)` to apply continent scale only to low-frequency layers:
    - continent mask shaping coordinates (`lowWx`, `lowWy`)
    - continent sinusoidal terms
    - continent low-octave noise term
    - macro noise sampling
  - Left high-frequency layers unchanged:
    - detail noise
    - ridge noise
  - Midpoint algorithm remains unaffected by continent scale.
- Updated docs:
  - `/tools/terrain/interactive/README.md` with `Continent Scale` behavior.

### Validation
- `node --check tools/terrain/interactive/app.js` passed.
- Ran develop-web-game Playwright client loop against terrain lab URL.
- Targeted Playwright checks (`/output/terrain-continent-scale-check/result.json`):
  - `topologyChangedWithContinentScale: true`
  - `midpointUnchangedWithContinentScale: true`
- Visual artifacts:
  - `/output/terrain-continent-scale-check/topology-60.png`
  - `/output/terrain-continent-scale-check/topology-180.png`

## 2026-02-21 (Terrain/Resources mode split)
- Added bottom mode toggle (`Terrain` / `Resources`) to interactive terrain lab.
- Split floating controls into mode-specific sections:
  - Terrain mode keeps existing generation + river controls.
  - Resources mode now shows barebones zone authoring controls (type, radius, strength, undo, clear).
- Added resource-zone overlay rendering on top of map raster in resources mode.
- Added resource interactions:
  - Left click on land adds a zone.
  - Right click removes nearest zone.
- Preserved existing terrain interactions in terrain mode (left-click river source, right-click river source deletion preview).
- Updated `/tools/terrain/interactive/README.md` for mode toggle + resources controls.
- Validation:
  - `node --check tools/terrain/interactive/app.js` passes.
  - Playwright skill client run saved screenshot to `/output/terrain-mode-toggle-check/shot-0.png` (no console errors).
  - Custom Playwright validation confirms:
    - bottom mode toggle exists,
    - terrain controls visible by default,
    - resources controls replace terrain controls in resources mode,
    - left-click adds resource zones in resources mode,
    - right-click removes nearest resource zone.
  - Result artifacts: `/output/terrain-mode-toggle-ui-check/result.json`, `/output/terrain-mode-toggle-ui-check/full-ui.png`.
- Follow-up fix: called `applyEditorModeState()` during startup so initial mode state and ARIA state are consistently applied before first render.
- Re-ran skill Playwright client after final patch (`/output/terrain-mode-toggle-check`), no console errors observed.

## 2026-02-21 (Tutorial mode implementation + verification)
- Implemented Tutorial mode per new docs (`docs/design/TUTORIAL_MODE_DESIGN.md`) in `src/game.js`:
  - Added direct main-menu Tutorial entry that launches straight into gameplay (no setup screen).
  - Added tutorial run config (`mode: tutorial`) with low-pressure parameters, sparse start, no population growth, neutral season, emergence off, and budget headroom.
  - Added sequential 8-step guided task system with objective-card progress (`N/Total`), step-complete alerts, and next-step alerts.
  - Wired completion checks for:
    1) build plant on open point,
    2) build substation on open point,
    3) build line,
    4) active town service,
    5) hold `R` resource reveal,
    6) reroute town,
    7) demolish asset,
    8) pause + resume.
  - Added tutorial no-fail behavior:
    - disabled defeat checks (bankruptcy/reliability collapse) in tutorial,
    - disabled incident spawning in tutorial.
  - Added tutorial state to save/restore and `render_game_to_text` output for bot/testing visibility.
  - Final tutorial step now triggers immediate victory with reason: `Tutorial complete: core controls verified.`
- Added tutorial-completion persistence flag:
  - Added `STORAGE_KEYS.tutorialCompleted` in `src/data.js`.
  - On tutorial victory, write/read profile boolean and show `Tutorial (Completed)` in main menu button label.

### Validation
- Syntax checks:
  - `node --check src/game.js`
  - `node --check src/data.js`
  - `node --check src/main.js`
- Develop-web-game client run:
  - `node "$WEB_GAME_CLIENT" --url http://127.0.0.1:5173 --actions-file "$WEB_GAME_ACTIONS" --click-selector "#menu-tutorial" --iterations 3 --pause-ms 250 --screenshot-dir output/tutorial-mode-check-postflag`
- Targeted Playwright end-to-end tutorial completion check:
  - Ran scripted flow covering all 8 tutorial tasks and asserted transition to end screen + tutorial completion text.
  - Artifact: `output/tutorial-mode-check/tutorial-complete.png`
- Targeted persistence verification:
  - Completed tutorial, returned to menu, asserted tutorial button label updates to `Tutorial (Completed)`.
  - Artifact: `output/tutorial-mode-check-postflag/menu-tutorial-completed.png`

## 2026-02-21 (Resources polygons instead of circles)
- Reworked resources mode from circle stamps to polygon tracing.
- New resource tracing behavior:
  - Left click on land adds a draft polygon vertex.
  - If a click is within `Vertex Snap` distance of an existing draft vertex, that vertex is reused and the polygon closes/commits.
- Resource zones are now stored as polygon vertex arrays (`vertices`) with `type` and `strength`.
- Added draft controls:
  - `Close Draft Polygon`
  - `Undo Draft Vertex`
  - `Clear Draft`
- Replaced `Zone Radius` control with `Vertex Snap` slider.
- Rendering changes:
  - Draw committed resource polygons with fill/stroke + vertex markers.
  - Draw draft polygon with dashed stroke and draft vertices.
  - Draw a snap hint ring around the first draft vertex when draft has >= 3 points.
- Right-click delete in resources mode now removes:
  - zone containing the click (preferred), else
  - nearest zone vertex within deletion radius.
- Validation:
  - `node --check tools/terrain/interactive/app.js` passes.
  - Playwright skill client run: `/output/resource-polygon-check/shot-0.png` (no console errors).
  - Adaptive Playwright DOM validation confirms:
    - collected 3 draft vertices,
    - snap-close committed polygon,
    - right-click removed the committed polygon.
  - Artifact: `/output/resource-polygon-adaptive-check/result.json`.
- Follow-up fix: closing a draft near any existing draft vertex now reuses that vertex by rotating vertex order so the polygon remains valid.
- Additional adaptive validation confirms snap-close behavior with reused non-first vertex (`/output/resource-polygon-adaptive-check/result.json` => `closedOnSnap: true`).

## 2026-02-21 (Structure + Content Refactor)
- Moved terrain generation compatibility wrappers out of `docs/mockups-ui-design/` into `tools/terrain/compat/`.
- Removed tracked generated artifact `docs/mockups-ui-design/__pycache__/generate_terrain_map_png.cpython-314.pyc`.
- Added/updated structure docs:
  - `README.md` (new root structure guide)
  - `src/README.md` (runtime source layout)
  - `tools/terrain/compat/README.md`
  - updated `docs/README.md`, `docs/mockups-ui-design/README.md`, `tools/README.md`, `tools/terrain/README.md`, `tools/terrain/interactive/README.md`, `data/README.md`.
- Implemented canonical map JSON storage files:
  - `data/maps/index.json`
  - `data/maps/national_core.map.json`
  - `data/maps/README.md`
- Added runtime preload path from JSON maps:
  - `src/data.js` now exports `preloadRuntimeMapContent()` and hydrates mutable `BASE_MAP` from map JSON.
  - `src/main.js` now awaits map preload before booting app.
- Normalized map schema usage in gameplay code to use `BASE_MAP.towns` (removed map-level `regions` alias fallback).
- Added resource-zone fallback so gameplay can use `BASE_MAP.resourceZones` when terrain metadata is absent.
- Split oversized source files:
  - Extracted shared game constants/helpers/config builders to `src/game/core.js` and updated `src/game.js` to import from it.
  - Split CSS entry into modular files under `src/styles/`.
  - Split terrain editor helper modules into `tools/terrain/interactive/lib/{dom,math,resource-zones}.js`.
- Kept root and `bot-player` Playwright dependencies aligned at `^1.50.0` because the shared `develop-web-game` client resolves `playwright` from repo root.

### TODO (current pass)
- Run syntax and smoke checks across both game runtime and terrain interactive tool.
- Verify no regression in menu/run flow and terrain editor interactions after module extraction.
- Optionally move campaign mission source-of-truth from `src/data.js` into dedicated mission JSON files.
- Validation checks completed:
  - `node --check` passed for updated runtime files and terrain interactive modules.
  - `bot-player` smoke run (`smoke-menu-to-run`) passed after refactor.
  - Terrain interactive page smoke check passed with no console/page errors; screenshot emitted to `output/terrain-interactive-smoke.png`.
  - `develop-web-game` Playwright client run passed after reinstalling Chromium (`npx playwright install chromium`).

## 2026-02-21 (Architecture docs sync after repo re-org)
- Updated `docs/implementation/ARCHITECTURE.md` to reflect current runtime stack and module layout:
  - `src/main.js` bootstrap + map preload
  - `src/data.js` map adapter + constants
  - `src/game/core.js` shared constants/helpers/config builders
  - `src/game.js` (`GameRuntime` + `SaveTheGridApp`)
  - split CSS modules under `src/styles/`
  - moved terrain tooling under `tools/terrain/*`
- Removed stale architecture assumptions (React, PixiJS, Vite/Vitest/IndexedDB/zod, `data/missions`, `data/presets`).
- Updated `docs/implementation/MAP_STORAGE_AND_RESOURCE_ZONES.md` to match actual map contracts and loading behavior:
  - `data/maps/index.json` + `*.map.json`
  - map-level `towns/links/resourceZones`
  - metadata-first `resource_zones` with map fallback
  - normalization-driven validation in current runtime.

## 2026-02-21 (Crisp zoomed pixels)
- Fixed blurry zoomed map rendering by switching terrain raster scaling to nearest-neighbor:
  - `drawRasterToViewport()` now sets `ctx.imageSmoothingEnabled = false`.
- Added CSS pixel-rendering hints on the terrain canvas:
  - `image-rendering: pixelated;`
  - `image-rendering: crisp-edges;`
- Validation:
  - `node --check tools/terrain/interactive/app.js` passes.
  - Playwright zoom screenshot confirms hard pixel edges when zoomed (`/output/pixel-crisp-check-zoom/zoomed.png`).

## 2026-02-21 (Coastline palette)
- Added coastline-specific coloring in terrain composition:
  - Land pixels adjacent to sea are recolored to `coastLand` (brownish green).
  - Sea pixels adjacent to land are recolored to `coastWater` (light blue).
- Coastline pass excludes river pixels so rivers keep river color.
- Added new palette entries in `COLORS`:
  - `coastLand: [156, 170, 112]`
  - `coastWater: [108, 173, 224]`
- Validation:
  - `node --check tools/terrain/interactive/app.js` passes.
  - Playwright skill screenshot with no console errors: `/output/coastline-color-check/shot-0.png`.

## 2026-02-21 (Resources mode control simplification)
- Resources mode UI updated to lock vertex snap at a fixed `10px` and remove the snap slider control.
- Removed draft-management buttons from resources panel:
  - `Close Draft Polygon`
  - `Undo Draft Vertex`
  - `Clear Draft`
- Kept polygon close behavior via click-near-existing-vertex only (snap-close path).
- Kept/verified right-click zone deletion in resources mode (`Map Right Click` removes containing zone or nearest-zone fallback).
- Updated terrain interactive docs to reflect fixed snap and removed draft buttons.

### Validation
- Syntax:
  - `node --check tools/terrain/interactive/app.js`
  - `node --check tools/terrain/interactive/lib/dom.js`
- Skill client run:
  - `output/resources-controls-lock-check/shot-0.png`
  - `output/resources-controls-lock-check/shot-1.png`
- Targeted Playwright behavior check:
  - `output/resources-mode-controls-check/result.json`
  - `output/resources-mode-controls-check/resources-ui.png`
  - Result confirms:
    - removed controls are absent,
    - snap label is `10 px`,
    - zone creation still works,
    - right-click deletes created zone.

## 2026-02-21 (Resources zones on water)
- Updated Resources-mode polygon drafting to allow vertices and zones on water as well as land.
- Removed the water/sea-level placement guard in `addResourceZoneFromClick()`.
- Updated docs text to match new behavior (`Map Click` in resources mode now allows land or water).

### Validation
- Syntax checks passed:
  - `node --check tools/terrain/interactive/app.js`
  - `node --check tools/terrain/interactive/lib/dom.js`
- Targeted Playwright validation passed:
  - `output/resources-water-zones-check/result.json`
  - confirms water click adds draft vertex and water-only polygon commits to zone.
- Skill client run completed:
  - `output/resources-water-zones-skill-run/shot-0.png`
  - `output/resources-water-zones-skill-run/shot-1.png`

## 2026-02-21 (Terminology cleanup: grid -> powergrid)
- Per user direction, removed markdown terminology using `grid` outside `powergrid` across `docs/`.
- Replaced `grid`, `power grid`, and `power-grid` wording with `powergrid` or concrete entity language (towns, plants, substations, lines).
- Explicitly removed abstract `powergrid points` phrasing and replaced with `infrastructure icons (plants, substations, storage)`.
- Verification: no remaining markdown matches for `grid`, `power grid`, `power-grid`, or `grid points` under `docs/`.

## 2026-02-21 (Auto-seeded resource zones on new maps)
- Added seeded default resource-zone generation for new maps in terrain interactive app.
- New-map behavior now auto-creates exactly one polygon zone for each resource type:
  - `wind`
  - `sun`
  - `gas`
- Each generated zone targets roughly `5%` of total map area.
- Zone polygons are randomized per map seed and spaced to reduce heavy overlap.
- Zones are seeded on:
  - explicit new-map generation (`Re-generate`), and
  - first app render when no zones exist yet.

### Implementation details
- Added constants:
  - `NEW_MAP_RESOURCE_ZONE_FRACTION = 0.05`
  - `NEW_MAP_RESOURCE_ZONE_STRENGTH = 70`
  - `NEW_MAP_RESOURCE_ZONE_TYPES = ["wind", "sun", "gas"]`
- Added seeded polygon utilities:
  - `computePolygonAreaPx(...)`
  - `buildSeededResourcePolygonVertices(...)`
  - `generateSeededResourceZones(...)`
- Wired seeding into `renderTerrain(...)` before terrain image build when map is new.

### Validation
- Syntax checks passed:
  - `node --check tools/terrain/interactive/app.js`
  - `node --check tools/terrain/interactive/lib/dom.js`
- Targeted Playwright check:
  - `output/new-map-seeded-resource-zones-check/result.json`
  - confirms initial and regenerated maps both report: `Zones 3 | Wind 1 | Sun 1 | Gas 1`.
- Screenshot artifacts:
  - `output/new-map-seeded-resource-zones-check/resources-initial.png`
  - `output/new-map-seeded-resource-zones-check/resources-regenerate-2.png`
- Skill client run completed:
  - `output/new-map-resource-seeding-skill-run/shot-0.png`
  - `output/new-map-resource-seeding-skill-run/shot-1.png`

## 2026-02-21 (In-run HUD simplification + right-click demolish confirmation)
- Updated in-round HUD controls:
  - Removed in-HUD tool buttons (`Build`, `Demolish`, `Reroute`, `Line`) from the bottom dock.
  - Kept asset buttons (`Plant`, `Sub`, `Storage`) and added a compact controls hint (`Line: 4 | Reroute: E | Right click: Demolish`).
- Implemented right-click demolition confirmation flow:
  - Right-click on an infrastructure/town point now opens a small confirmation popover at click location.
  - Popover shows target name, inferred asset type to remove, and refund amount.
  - `Cancel` closes with no changes.
  - `Demolish` applies demolition and closes popover.
- Added robust demolition candidate resolution:
  - Uses selected asset type when available.
  - Falls back to first available asset type on target (`plant`, `substation`, `storage`) so right-click works even when selected type is absent.
- Added dismissal behavior:
  - Popover closes on outside click.
  - Popover is cleared when leaving run / ending run / runtime cleanup.

### Validation
- Syntax checks:
  - `node --check src/game.js`
  - `node --check src/main.js`
  - `node --check src/data.js`
- Develop-web-game client loop:
  - `node "$WEB_GAME_CLIENT" --url http://127.0.0.1:5173 --actions-file "$WEB_GAME_ACTIONS" --click-selector "#start-btn" --iterations 3 --pause-ms 250 --screenshot-dir output/run-ui-rightclick-confirm`
- Targeted right-click confirm behavior check (Playwright inline script):
  - Asserted no `[data-tool]` buttons in-run.
  - Built plant, right-clicked target, verified confirmation popover appears.
  - Verified cancel keeps asset count unchanged.
  - Verified confirm decreases asset count.
  - Artifact: `output/run-ui-rightclick-confirm/demolish-popover.png`.
- Tutorial regression check (Playwright inline script):
  - Completed tutorial flow using keyboard (`4`, `E`) + right-click confirmation for demolish.
  - Verified tutorial still reaches end screen.

## 2026-02-21 (Removed in-run selection context panel)
- Removed the bottom-right Selection/Region Context panel from in-round HUD.
- Kept only the ticker in the bottom-right floating area.
- Removed region-context render/update logic from `updateRunHud(...)` so no hidden panel state is maintained.

### Validation
- `node --check src/game.js`
- `node --check src/main.js`
- `node --check src/data.js`
- Playwright assertion:
  - Started a run and confirmed `#region-context` no longer exists.
  - Artifact: `output/remove-selection-panel/run-no-selection-panel.png`
