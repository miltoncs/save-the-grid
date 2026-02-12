# Chief of Energy: Grid of Nations

Status: Draft v0.1  
Last updated: 2026-02-12

## 1. High Concept

The player is the Chief of Energy for a fictional country. In real time, they build, demolish, and reroute grid infrastructure to power a rapidly growing civilization. Each run is a high-pressure systems puzzle with emergent failures and shifting demand.

## 2. Design Pillars

1. Real-time grid management under pressure.
2. Clear systems with shallow simulation depth.
3. Fast replayability via roguelike run structure.
4. Strong role fantasy through unobtrusive narrative framing.
5. Skill expression through planning and crisis response, not spreadsheet complexity.

## 3. Locked Product Decisions

1. Singleplayer only for initial release.
2. Roguelike runs with reset gameplay state each run.
3. Meta progression is cosmetic-only (no permanent power increase).
4. Strict real-time once a run starts.
5. Storytelling is present but lightweight and non-intrusive.
6. Simulation depth should remain relatively shallow for readability and pace.
7. Gameplay map perspective is 2D overhead only.
8. Initial product includes three play surfaces: Standard Run, Campaign Missions, and Custom Game.
9. Campaign rewards remain cosmetic-only.

## 4. Player Fantasy and Role

You are not an engineer placing wires in a sandbox. You are a national decision-maker balancing public demand, budget constraints, and reliability targets while your country modernizes in front of you.

## 5. Core Gameplay Loop

1. Demand increases across regions.
2. Build infrastructure to add capacity and coverage.
3. Route energy through transmission paths to meet demand.
4. Demolish or replace aging or inefficient assets.
5. Absorb random pressures (weather, fuel shocks, policy changes).
6. Stabilize the grid and push score before collapse conditions are reached.

## 6. Run Structure (Roguelike)

### Run Start

- Player begins with a starter grid, budget, and small baseline generation.
- Initial objectives are simple to teach controls and priorities.

### Mid-Run Escalation

- Demand growth accelerates.
- Event frequency increases.
- Grid complexity rises with bottlenecks and overloaded routes.

### End State

- Run ends when collapse conditions trigger (for example, sustained blackout, budget failure, or trust collapse).
- Final score is calculated and submitted to local leaderboard.
- Cosmetic rewards may unlock based on milestones.

## 7. Real-Time Rules

- No pause button during active play.
- No tactical slow-motion.
- No modal story interruptions that halt simulation.
- UI and events must be readable while the simulation keeps running.

## 8. Core Systems

### 8.1 Map and Regions

- Country map represented as a 2D overhead layered region/network view.
- Regions have population, demand profile, and growth pressure.

### 8.2 Infrastructure

- Generation assets: a small starter set of plant types.
- Grid assets: substations, transmission links, storage.
- Actions: build, demolish, reroute priorities.

### 8.3 Demand and Supply

- Demand updates continuously in coarse ticks.
- Supply is simplified to capacity and availability values.
- Routing is based on connectivity and line capacity.

### 8.4 Failure and Pressure

- Overload when routed power exceeds line/substation limits.
- Brownout/blackout when demand is unmet beyond thresholds.
- Cascading issues are possible but intentionally simple and legible.

### 8.5 Economy and Public Response

- Budget changes from infrastructure costs and operating burden.
- Public trust reflects service reliability and event outcomes.
- These values are intentionally high-level, not a deep market simulation.

## 9. Storytelling Approach (Unobtrusive)

- Short cabinet briefings and news-ticker style updates.
- Flavor text tied to mechanical events and region changes.
- No long cutscenes, dialogue trees, or heavy narrative branching in v1.
- Story delivery should enhance context without interrupting control flow.

## 10. Simulation Depth Boundaries

To keep the game shallow and fast:

- Include:
  - Plant output, demand growth, reliability pressure, basic operating costs.
  - Event-driven modifiers (for example heat wave demand spikes).
- Exclude for v1:
  - Detailed fuel supply chains.
  - Unit-level labor simulation.
  - Deep policy/legal simulation trees.
  - High-fidelity electrical engineering models.

## 11. Win/Lose and Scoring

### Primary Failure Conditions

- Reliability collapse (sustained unmet demand).
- Fiscal collapse (budget floor crossed for too long).
- Public trust collapse (major service instability over time).

### Score Drivers

- Total demand served over run lifetime.
- Reliability consistency.
- Efficient capital use.
- Crisis recovery performance.

## 12. Progression Model

- Runs grant score and cosmetic unlock progress.
- Cosmetics can include map skins, UI themes, and insignia/badge variants.
- No gameplay-affecting unlocks between runs.

## 13. MVP Scope (Design Target)

1. One 2D overhead country map.
2. 6-8 regions with distinct demand behavior.
3. A compact asset set (generation + grid + storage).
4. Real-time build/demolish/reroute controls.
5. Lightweight event pool with short narrative text.
6. Main menu, splash screen, and run setup flows.
7. Campaign mission starter set.
8. Custom game options with separate score classification.
9. End-of-run scoring and local high score table.

## 14. Singleplayer-First, Multiplayer-Aware

The game launches as singleplayer. Design choices should avoid blocking future multiplayer variants, but multiplayer is explicitly out of MVP delivery scope.

See `MULTIPLAYER_NOTES.md` for forward-looking design constraints.

## 15. Design Deep Dives

- `FRONTEND_AND_UX.md`: Splash screen, main menu, campaign/custom flow UX, and in-run HUD.
- `MISSION_AND_MODE_DESIGN.md`: Mode definitions, campaign mission structure, and custom game policy.
- `MAP_DESIGN_2D.md`: 2D overhead map interaction, region design, and routing readability rules.

## 16. Open Design Questions

1. Target run length (for example 15, 20, or 30 minutes).
2. Exact initial asset roster for launch.
3. Launch campaign size (8, 10, or 12 missions).
4. Region identity model (single fixed map vs rotating map pool).
5. Event interaction model (passive events only vs fast binary choices in real time).
