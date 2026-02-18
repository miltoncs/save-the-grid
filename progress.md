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
