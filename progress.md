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
