# Frontend and UX Design

Status: Draft v0.1  
Last updated: 2026-02-12

## 1. UX Direction

The interface should feel like a national grid command center: operational, urgent, and readable at a glance. The tone is serious but not grim, with restrained style and clear hierarchy.

Design goals:

1. Keep decision-critical information visible without hunting.
2. Preserve strict real-time flow (no blocking modal walls).
3. Deliver story flavor through short, ambient surfaces.
4. Keep controls learnable in under five minutes.

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

1. 2-4 second animated grid pulse and country silhouette.
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
- Footer: profile badge, unlocked cosmetics count, and local best score.

### Menu UX Rules

- First selectable option defaults to `New Run` for first-time users.
- Selection changes should preview the mode in one short sentence.
- All submenus must return to main menu in one action.

## 5. Campaign Missions Screen

### Screen Structure

- Top: campaign arc tabs (`Founding`, `Expansion`, `Transition`).
- Center: mission cards in a horizontal progression line.
- Right: mission briefing panel with objectives and constraints.
- Bottom: reward preview (cosmetics only) and medals earned.

### Mission Card Contents

1. Mission codename.
2. Short premise text.
3. Difficulty indicator.
4. Completion medal state (none, bronze, silver, gold).
5. Best score and best reliability.

### UX Rules

- Missions are quick to parse; no long narrative blocks.
- Story text is optional to expand, never forced before starting.

## 6. Custom Game Setup Screen

### Intent

Let players tune scenario pressure for practice or challenge runs while preserving roguelike feel.

### Option Categories

1. Map seed and region layout variant.
2. Starting budget.
3. Demand growth rate.
4. Event intensity.
5. Infrastructure costs.
6. Failure strictness thresholds.
7. Run target duration band.

### Scoring and Integrity Rules

- Preset profiles (`Standard`, `Hard`, `Brutal`) are leaderboard-eligible.
- Modified settings create `Custom` runs with separate score tables.
- Tooltip text states when a setting invalidates standard leaderboard eligibility.

## 7. In-Run HUD (Strict Real-Time)

### Information Architecture

- Top bar: budget, reliability, public trust, unmet demand, run timer.
- Left tool rail: build, demolish, reroute, upgrade categories.
- Right event rail: active incidents, mission objectives, short briefings.
- Bottom context panel: selected asset stats and action confirmations.
- Center: 2D overhead map as dominant interactive surface.

### Interaction Pattern

1. Select tool.
2. Hover map to preview impact (cost, capacity, risk).
3. Commit action with one click/tap.
4. Receive immediate visual and metric feedback.

### Alert Tiers

1. Advisory (blue): informational shifts.
2. Warning (amber): rising risk.
3. Critical (red): immediate service threat.

Alerts must be non-blocking and expire cleanly.

## 8. Storytelling UI Pattern

Story delivery channels:

1. News ticker (ambient, single-line updates).
2. Cabinet ping cards (short prompts in right rail).
3. Region callouts (brief flavor text attached to map hotspots).

Rules:

- No pauses or forced dialogue trees.
- Mechanical consequence always shown next to narrative text.
- Story copy length target: one to two lines.

## 9. Input and Control Mapping (Draft)

1. Left click/tap: select/place.
2. Right click or key modifier: demolish mode quick toggle.
3. Number keys: quick-select major build categories.
4. Mouse wheel or key: zoom map.
5. Middle mouse drag or edge pan: camera movement.
6. `Tab`: cycle critical alerts.
7. `Esc`: close open panel (never pause simulation).

## 10. Readability and Accessibility

1. Color plus icon shape for all alert states (no color-only signals).
2. Adjustable UI scale presets.
3. Optional high-contrast mode.
4. Font sizes must remain legible at 1366x768 baseline.
5. Reduced motion toggle for non-essential animations.

## 11. End-of-Run Screen

### Required Content

1. Final score and leaderboard placement.
2. Reliability performance summary.
3. Key failure or success timeline moments.
4. Cosmetic unlock progress or rewards.
5. `Retry`, `New Run`, and `Return to Menu` actions.

### Narrative Closure

One short headline summarizes the country outcome for the run (for example: `Grid Stabilized Through Harsh Winter`).
