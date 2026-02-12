# Bot Player (Standalone)

This folder contains a lightweight Playwright bot runner used to smoke test game flows while the main game is under development.

The bot is intentionally simple. It does not optimize strategy or compete for high scores. It only:

- Selects UI elements.
- Presses control keys.
- Clicks map/canvas areas.
- Runs short scripted action sequences.

## Why it is separate

The bot lives in `bot-player/` with its own dependency and scripts so game implementation files remain isolated in `src/`.

## Install

```bash
cd /Users/mstafford/Projects/local/save-the-grid/bot-player
npm install
npx playwright install chromium
```

## Run

Start the game dev server in another terminal, then run a scenario:

```bash
cd /Users/mstafford/Projects/local/save-the-grid/bot-player
npm run bot:smoke
```

Or run directly:

```bash
node ./run-bot.mjs --url http://localhost:5173 --scenario ./scenarios/smoke-controls.json --headed
```

Screenshots are saved to:

`/Users/mstafford/Projects/local/save-the-grid/bot-player/artifacts`

Current starter scenarios:

- `smoke-menu-to-run.json`: menu -> standard run -> short autoplay -> save & exit.
- `smoke-controls.json`: quick control-path sweep (tools/assets/pause) -> save & exit.

## Scenario format

Scenarios are JSON files with ordered `steps`. Supported actions:

- `wait`: pause for `ms`.
- `waitFor`: wait for a target to appear.
- `click`: click first matching target.
- `press`: keyboard press (`Space`, `1`, `Escape`, etc.).
- `type`: type into input controls.
- `assertText`: simple text checks.
- `advanceTime`: calls `window.advanceTime(ms)` when available.
- `autoplay`: repeated low-skill interactions for quick playability checks.
- `screenshot`: explicit capture.

Targets can use:

- `selector` (preferred).
- `role` + `name`.
- `text`.

Example step:

```json
{
  "action": "click",
  "targets": [
    { "selector": "[data-testid='menu-new-run']" },
    { "role": "button", "name": "New Run" },
    { "text": "New Run" }
  ]
}
```

## Recommended selector contract

For stable automation, add `data-testid` values in the game UI:

- `menu-new-run`
- `menu-campaign`
- `setup-start`
- `mission-start`
- `in-run-screen`
- `tool-build`
- `tool-demolish`
- `tool-reroute`
- `action-confirm`
- `event-dismiss`
- `alert-next`

The bot will still try text/role fallbacks, but `data-testid` values are the most reliable.
