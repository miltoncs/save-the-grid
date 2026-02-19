# Frontend and UX Design

Status: Draft v0.1  
Last updated: 2026-02-19

Reference: See `INSPIRATION.md` for the map-first UI inspiration baseline.

## 1. UX Direction

The interface should feel like a national grid command center: operational, urgent, and readable at a glance. The game should feel browser-native and instantly playable (quick-start style similar to popular web games), while preserving long-term mastery.

Design goals:

1. Keep decision-critical information visible without hunting.
2. Keep controls and mechanics simple enough to learn in minutes.
3. Deliver depth through emergent conditions and map pressure, not layered systems.
4. Deliver story flavor through short, ambient surfaces.
5. Preserve real-time flow with optional player-controlled pause in singleplayer.
6. Keep real-time strategy pacing clear: frequent small decisions on a map-first screen.

## 2. Frontend Surface Map

Primary user-facing surfaces:

1. Splash screen.
2. Main menu.
3. Run setup.
4. Campaign mission selection.
5. Custom game setup.
6. In-run HUD and overlays.
7. End-of-run summary.

## 3. Splash Screen

### Purpose

- Establish tone quickly.
- Confirm game identity.
- Transition rapidly to the menu.

### Behavior

1. 1-3 second animated grid pulse and country silhouette.
2. Studio and game title lockup appears.
3. `Press any key` skips remaining animation instantly.
4. If loading exceeds a threshold, show a small status line (`Initializing grid simulation...`).

### Constraints

- No unskippable long logo sequence.
- No user settings required on this screen.

## 4. Main Menu

### Core Navigation

1. Continue Run (only visible when a valid suspended run exists).
2. New Run.
3. Campaign Missions.
4. Custom Game.
5. Cosmetics.
6. Records.
7. Settings.
8. Exit.

### Layout Concept

- Left: primary vertical action list.
- Center: animated background map with live energy pulse visuals.
- Right: rotating national bulletin with short lore snippets and patch notes.
- Footer: profile badge and local best score.

### Menu UX Rules

- First selectable option defaults to `New Run` for first-time users.
- Selection changes should preview the mode in one short sentence.
- All submenus must return to main menu in one action.

## 5. Campaign Missions Screen

### Screen Structure

- Top: campaign arc tabs (`Founding`, `Expansion`, `Transition`).
- Center: mission cards in a horizontal progression line.
- Right: mission briefing panel with objectives and constraints.
- Bottom: next-level unlock status and medals earned.

### Mission Card Contents

1. Mission codename.
2. Short premise text.
3. Difficulty indicator.
4. Completion medal state (none, bronze, silver, gold).
5. Best score and best reliability.
6. Population growth status tag (`Static Population` or `Growth Active`).
7. Seasonal/local-climate condition status tag (`Neutral`, `Winter Pressure`, `Summer Pressure`, `Mixed`).
8. Map scale tag (`Small`, `Medium`, `Large`) and routing complexity tag (`Simple`, `Moderate`, `Intense`).

### UX Rules

- Missions are quick to parse; no long narrative blocks.
- Story text is optional to expand, never forced before starting.

## 6. Custom Game Setup Screen

### Intent

Let players tune scenario pressure for practice or challenge runs while preserving roguelike feel.

### Option Categories

1. Handcrafted map selection.
2. Starting budget.
3. Demand growth rate.
4. Event intensity.
5. Seasonal profile.
6. Local climate intensity.
7. Infrastructure costs.
8. Failure strictness thresholds.
9. Run target duration band.

### Scoring and Integrity Rules

- Preset profiles (`Standard`, `Hard`, `Brutal`) are leaderboard-eligible.
- Modified settings create `Custom` runs with separate score tables.
- Tooltip text states when a setting invalidates standard leaderboard eligibility.

## 7. In-Run HUD (Real-Time with Pause Option)

### Information Architecture

- Top bar: budget, reliability, unmet demand, run timer, population trend (when enabled), active season/condition.
- Left tool rail: build, demolish, reroute categories.
- Right event rail: active incidents, mission objectives, short briefings.
- Bottom context panel: selected asset stats, `Line` path cost/capacity preview, substation coverage radius impact, and action confirmations.
- Center: 2D overhead map as dominant interactive surface.

### Interaction Pattern

1. Select tool.
2. Hover map to preview impact (cost, capacity, risk).
3. Place plants/substations or draw manual `Line` paths based on current demand and terrain.
4. Commit action with one click/tap.
5. Receive immediate visual and metric feedback.

### Layer Visibility Controls

1. Base board, civilization points, and power-grid points are visible by default.
2. Natural resource zones are hidden by default to reduce map noise.
3. Hold `R` to reveal resource zones while planning builds.
4. Releasing `R` hides resource zones immediately.

### Alert Tiers

1. Advisory (blue): informational shifts.
2. Warning (amber): rising risk.
3. Critical (red): immediate service threat.

Alerts must be non-blocking and expire cleanly.

Population-related warnings should use the same alert system once the mechanic is enabled.
Seasonal/local-climate demand warnings should use the same alert system once the mechanic is enabled.
Underserved-town lawsuit warnings should use the same alert system without exposing hidden trust as a direct meter.
Line-overload and substation-coverage-gap warnings should use the same alert system in all map sizes.

### Pause Behavior (Singleplayer)

1. `Space` toggles pause and resume.
2. Pause freezes demand, incidents, and scoring timers.
3. Player can inspect map state and queued priorities while paused.
4. Story UI never auto-pauses the game.

## 8. Storytelling UI Pattern

Story delivery channels:

1. News ticker (ambient, single-line updates).
2. Cabinet ping cards (short prompts in right rail).
3. Map callouts (brief flavor text attached to town clusters or infrastructure hotspots).

Rules:

- No forced dialogue trees.
- Mechanical consequence always shown next to narrative text.
- Story copy length target: one to two lines.

Onboarding rule:

- Tutorial and early levels hide population-growth UI elements until the mechanic is introduced.
- Tutorial and early levels hide seasonal/local-climate condition UI elements until the mechanic is introduced.

## 9. Input and Control Mapping (Draft)

1. Left click/tap: select/place.
2. Right click or key modifier: demolish mode quick toggle.
3. Number keys: quick-select major build categories.
4. Mouse wheel or key: zoom map.
5. Middle mouse drag or edge pan: camera movement.
6. `Tab`: cycle critical alerts.
7. `Space`: toggle pause and resume (singleplayer only).
8. Hold `R`: reveal natural resource zones on the map.
9. `Esc`: close open panel.

## 10. Visual Style Guidelines

1. Graphics are flat 2D and intentionally non-photoreal.
2. Use few gradients and avoid rendering styles that imply realism.
3. Map palette is limited and functional:
   - Land, water, and biome differentiation use a small set of clear colors, similar to Google Maps default-view simplicity.
4. UI decoration must not compete with operational map signals.
5. Pixel-inspired map-edge treatment is allowed when it improves identity without harming readability.

## 11. Readability and Accessibility

1. Color plus icon shape for all alert states (no color-only signals).
2. Adjustable UI scale presets.
3. Optional high-contrast mode.
4. Font sizes must remain legible at 1366x768 baseline.
5. Reduced motion toggle for non-essential animations.

## 12. End-of-Run Screen

### Required Content

1. Final score and leaderboard placement.
2. Reliability performance summary.
3. Key failure or success timeline moments.
4. Next-level unlock status (campaign levels).
5. `Retry`, `New Run`, and `Return to Menu` actions.

### Narrative Closure

One short headline summarizes the country outcome for the run (for example: `Grid Stabilized Through Harsh Winter`).
