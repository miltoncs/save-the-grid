# Save the Grid Architecture

Status: Draft v0.1  
Last updated: 2026-02-12

## 1. Purpose and Scope

This document defines the technical architecture for implementing Save the Grid as a browser-native, singleplayer-first web game.

It translates design intent from:

- `../design/GAME_DESIGN.md`
- `../design/FRONTEND_AND_UX.md`
- `../design/MAP_DESIGN_2D.md`
- `../design/MISSION_AND_MODE_DESIGN.md`
- `../design/MULTIPLAYER_NOTES.md`

This document covers MVP implementation structure and near-term extension points. It does not define final balance values.

## 2. Architecture Goals

1. Fast browser startup and low-friction onboarding.
2. Deterministic, fixed-step simulation for reliable behavior and future multiplayer readiness.
3. Clear separation between simulation state, rendering, and UI workflow.
4. Data-driven authored maps/missions for rapid content iteration.
5. Local-only persistence for saves, settings, and records in MVP.
6. Testability through headless simulation and browser integration automation.

## 3. Technology Stack (MVP)

### Runtime and language

- TypeScript (`strict`) across client code.
- Browser-only runtime for MVP.

### Rendering and UI

- PixiJS for map/canvas rendering and visual overlays.
- React for app shell screens and HUD chrome.
- CSS variables + modular styles for theming and accessibility modes.

### State and validation

- Simulation state in pure TypeScript domain modules (no UI framework dependency).
- Zustand for UI/workflow state and app session orchestration.
- Zod for validating authored content packs (maps, missions, scenarios, presets).

### Persistence and tooling

- IndexedDB (via Dexie) for save slots, records, and progression.
- localStorage for lightweight settings and last-used options.
- Vite for dev/build pipeline.
- Vitest for unit/simulation tests.
- Playwright for end-to-end and visual-state validation.

## 4. Runtime Architecture

The application is split into four runtime layers:

- App Shell Layer:
  Owns route/surface transitions: splash, menu, setup, in-run, end-of-run.
  Handles localization, settings, and top-level async initialization.
- Domain Simulation Layer:
  Owns authoritative run state and rules.
  Executes deterministic fixed-step updates.
  Emits derived metrics/events for HUD and alerts.
- Presentation Layer:
  Canvas renderer draws map, infrastructure, demand overlays, flow pulses, and alerts.
  React HUD renders controls, panels, and story/event rails.
- Persistence Layer:
  Saves/restores run snapshots and campaign progression.
  Stores records with run-class partitioning (`standard`, `campaign`, `custom`).

## 5. Proposed Repository Structure

```txt
docs/
  design/
  implementation/
src/
  app/
    bootstrap.ts
    router.ts
    surfaces/
      SplashScreen.tsx
      MainMenu.tsx
      RunSetup.tsx
      CampaignSelect.tsx
      CustomSetup.tsx
      InRunScreen.tsx
      EndRunSummary.tsx
  game/
    engine/
      GameSession.ts
      FixedStepClock.ts
      RNG.ts
    domain/
      economy/
      demand/
      grid/
      incidents/
      objectives/
      scoring/
      progression/
    map/
      topology/
      camera/
      placement/
      routing/
    state/
      GameState.ts
      selectors.ts
      commands.ts
    content/
      schemas/
      loaders/
      packs/
    adapters/
      render/
      ui/
      persistence/
  ui/
    hud/
    controls/
    alerts/
    story/
    accessibility/
  data/
    maps/
    missions/
    presets/
  persistence/
    db.ts
    saveRepo.ts
    recordsRepo.ts
    settingsRepo.ts
  test/
    unit/
    integration/
    e2e/
```

## 6. Simulation Model

### 6.1 Update Loop

- Fixed simulation tick: `10 Hz` (`100ms`) for game rules.
- Render interpolation/frame draw: browser animation frame (`~60 Hz` target).
- Pause halts simulation ticks and score timers, but keeps UI responsive.

### 6.2 Determinism Rules

1. Rule updates must use tick delta from fixed clock, never frame delta.
2. Random events use seeded RNG captured in save snapshots.
3. All player actions are normalized into intent commands (`build`, `demolish`, `reroute`, `unlock_region`, `pause_toggle`).
4. Simulation outputs are pure functions of prior state + command queue + seed.

### 6.3 System Order per Tick

1. Apply queued player commands.
2. Recompute network connectivity/capacity.
3. Update demand (base + growth + season/climate + event modifiers).
4. Resolve supply allocation and unmet demand.
5. Apply economy deltas (costs, penalties, operating burden, lawsuits).
6. Evaluate incidents and alert state transitions.
7. Update mission objective trackers and failure/victory checks.
8. Emit immutable frame snapshot for renderer/HUD consumers.

## 7. Core Domain Boundaries

### Grid and routing domain

- Models nodes, links, capacities, stress tiers, and district service coverage.
- Exposes read models for rendering line thickness, pulse intensity, and overload color state.

### Demand domain

- Computes district demand from baseline, population pressure, seasonal profile, climate tags, and event modifiers.
- Supports onboarding toggles for disabling growth and seasonal pressure.

### Economy domain

- Tracks budget, build/demolish costs, operating burden, penalties, and region unlock expenses.
- Enforces level-local economy reset rules across runs/missions.

### Incident/story domain

- Produces mechanical incidents and short narrative payloads.
- Delivers non-blocking UI events compatible with real-time flow.

### Objective/scoring domain

- Tracks mission objectives, run collapse triggers, and scoring drivers.
- Supports separated score classes for standard vs custom configurations.

## 8. Data and Content Contracts

### 8.1 Content Sources

All authored gameplay content is data-driven:

- `data/maps/*.json`
- `data/missions/*.json`
- `data/presets/*.json`

### 8.2 Schema Validation

Each content type is validated at load time with zod schemas:

- `MapSchema`
- `MissionSchema`
- `ScenarioPresetSchema`

Load failures are surfaced with actionable diagnostics and blocked before play starts.

### 8.3 Versioning

Content and saves include explicit versions:

- `contentVersion`
- `saveVersion`

Migration handlers are required for any breaking schema change.

## 9. UI Architecture

### 9.1 Surface Ownership

- React controls all non-canvas surfaces and overlay chrome.
- PixiJS owns the interactive map viewport and simulation visuals.

### 9.2 HUD Data Access

- HUD reads only derived selectors from snapshot state.
- UI must not mutate simulation state directly.
- UI actions dispatch command intents to `GameSession`.

### 9.3 Input Pipeline

1. Input adapters normalize mouse/touch/keyboard gestures.
2. Context-aware command builder maps gestures to domain commands.
3. Command queue is consumed at next simulation tick.

## 10. Persistence Architecture (Local MVP)

### 10.1 Stored Entities

- Save slots: suspended run state snapshots.
- Records: completed run summaries by run class.
- Campaign progression: mission unlocks and medal grades.
- Settings: controls, accessibility, graphics quality, reduced motion, UI scale.

### 10.2 Storage Split

- IndexedDB: structured state (saves/records/progression).
- localStorage: small key-value settings and last-selected setup options.

### 10.3 Integrity

- Save snapshots include checksum/hash for corruption detection.
- Writes use transactional boundaries where possible.
- Failed load falls back gracefully to menu with user-facing message.

## 11. Testing Strategy

### 11.1 Unit and simulation tests (Vitest)

- Deterministic tick behavior.
- Routing/capacity resolution.
- Demand multiplier correctness.
- Economy penalties and failure triggers.
- Objective and scoring calculations.

### 11.2 Integration tests

- Content pack load and schema validation.
- Save/load round-trip for active runs.
- Command pipeline from UI intent to state mutation.

### 11.3 End-to-end tests (Playwright)

- Surface flow: splash -> menu -> setup -> run -> end summary.
- Core controls: build, demolish, reroute, pause/resume.
- Records/progression updates after run completion.
- Console error budget: zero unhandled runtime errors.

### 11.4 Debug/Test Hooks

Expose deterministic debug helpers in non-production builds:

- `window.render_game_to_text()`
- `window.advanceTime(ms)`

These are used for automated state assertions and visual parity checks.

## 12. Build and Release

### 12.1 Environments

- `dev`: Vite hot reload + source maps.
- `test`: deterministic seeds and fixture packs.
- `prod`: optimized static bundle.

### 12.2 CI gates

1. `lint`
2. `typecheck`
3. `unit` (Vitest)
4. `e2e` (Playwright smoke set)
5. Build artifact generation

### 12.3 Distribution

- Static web deployment target (for example Cloudflare Pages or Netlify).
- No server dependency required for MVP gameplay.

## 13. Multiplayer Readiness Constraints (Preserved in MVP)

In support of `../design/MULTIPLAYER_NOTES.md`:

1. Keep command-based intent stream as the only mutation entrypoint.
2. Keep RNG seedable and serializable.
3. Keep scoring formulas explicit and data-driven.
4. Avoid frame-rate-dependent simulation outcomes.
5. Keep scenario packets fully declared (map ID + modifiers + unlock costs + objective set).

## 14. Open Implementation Decisions

1. Confirm fixed tick rate (`10 Hz` vs `20 Hz`) after first playability pass.
2. Define maximum practical node/link counts for low-end browser targets.
3. Choose save snapshot cadence and compaction policy.
4. Choose map content authoring format (`json` only vs `json` + editor-export pipeline).
5. Define minimal telemetry/event logging strategy for balancing.
