# Energy Directory: Grid of Nations

Status: Draft v0.1  
Last updated: 2026-02-20

## 1. High Concept

The player is the Energy Directory for a fictional country. In real time, they build, demolish, and reroute grid infrastructure to power a rapidly growing civilization. The game is designed as a browser-native web game: quick to pick up in seconds, but difficult to master over many runs.

## 2. Design Pillars

1. Web-game onboarding: click and play quickly, with minimal friction.
2. Easy to learn, hard to master (in the spirit of `openfront.io`, `agar.io`, and `slither.io` onboarding/match flow).
3. Simple action vocabulary: build, demolish, reroute.
4. Shallow, readable simulation with emergent pressure.
5. Strong role fantasy through unobtrusive narrative framing.
6. Flat 2D visual language optimized for clarity.

## 3. Locked Product Decisions

1. Singleplayer only for initial release.
2. Roguelike runs with reset gameplay state each run.
3. Each level starts with a fresh economy state (no money carryover between levels).
4. Real-time simulation with optional pause in singleplayer.
5. Storytelling is present but lightweight and non-intrusive.
6. Simulation depth should remain relatively shallow for readability and pace.
7. Gameplay map perspective is 2D overhead only.
8. Initial product includes four play surfaces: Tutorial, Standard Run, Campaign Missions, and Custom Game.
9. Completing a level unlocks the next level; there are no material completion rewards.
10. V1 maps are handcrafted (procedural generation deferred).
11. Visual style is flat 2D with limited color palettes and minimal gradients.
12. Population growth is a core difficulty mechanic, introduced only after tutorial/early onboarding levels.
13. Seasonal and local-climate demand conditions are core difficulty mechanics, introduced only after tutorial/early onboarding levels.
14. Early levels use small, easy-to-read maps; later levels use larger maps with longer routing distances and denser town networks.
15. There are no map-area unlock systems; the full map is available from run start.
16. There are no region-level service hubs, district ownership layers, or corridor-purchase mechanics.
17. Basic levels start mostly empty: mostly terrain, a few towns, and little to no prebuilt power-grid infrastructure.
18. As conditions improve, new towns can emerge on livable powered terrain during a run.
19. Large player-built power routing is handled by a single tool named `Line`.
20. Substations power all towns within radius and automatically generate short orthogonal town-connection lines.

## 4. Player Fantasy and Role

You are not an engineer placing wires in a sandbox. You are a national decision-maker balancing public demand, budget constraints, and reliability targets while your country modernizes in front of you.

## 5. Core Gameplay Loop

1. Start from a mostly terrain-first map with a few seeded towns.
2. Build power plants and substations to create supply and local coverage.
3. Build manual `Lines` to connect plants and substations across distance (`plant->plant`, `plant->substation`, `substation->substation`, `substation->plant`).
4. Stabilize service quality so additional towns can emerge.
5. Demolish or replace aging or inefficient assets.
6. Absorb random pressures (weather, fuel shocks, policy changes).
7. Stabilize the grid and push score before collapse conditions are reached.

### 5.1 Strategic Core

The primary strategic question is always the same: what to build, when to build it, and where to place it given current map constraints and emergent grid conditions. The design should avoid layered subsystems that distract from this core decision loop.

## 6. Run Structure (Roguelike)

### Run Start

- Player begins with level-local budget, mostly visible terrain, and a few seeded towns.
- Basic levels include little to no prebuilt power-grid infrastructure.
- Initial objectives are simple to teach controls and priorities.
- Level budget is self-contained for that level and does not carry over on completion.
- Early onboarding runs/missions can disable population growth to avoid overload.
- Early onboarding runs/missions can disable seasonal/local-climate demand modifiers to avoid overload.
- Early onboarding maps should be small and fully visible without camera complexity.

### Mid-Run Escalation

- Demand growth accelerates.
- Population growth pressure comes online (outside onboarding missions).
- Seasonal and local-climate demand pressure comes online (outside onboarding missions).
- Event frequency increases.
- Grid complexity rises with longer `Line` routes, overloaded links, and substation coverage constraints.
- New towns emerge in livable, stably powered areas and add fresh demand pressure.
- Later content introduces larger maps that force longer-distance routing and tighter reliability planning.

### End State

- Run ends when collapse conditions trigger (for example, sustained blackout or bankruptcy).
- Final score is calculated and submitted to local leaderboard.
- Campaign progression unlocks the next level when completion criteria are met.

## 7. Real-Time Rules

- Simulation runs in real time by default.
- Singleplayer pause is allowed.
- No tactical slow-motion.
- No modal story interruptions that halt simulation.
- UI and events must be readable while the simulation keeps running.

## 8. Core Systems

### 8.1 Map and Spatial Layout

- Country map represented as a 2D overhead layered board/network view.
- Layer model includes: base game board (land/water/land type), civilization town points, power-grid points, player-built `Line` network, and resource-zone overlays.
- There are no authored region service hubs; towns are placed directly on the board as first-class entities.
- There are no pre-authored major transmission corridors in gameplay.
- Maps are handcrafted in v1 to ensure balanced and readable scenarios.
- Towns are the primary demand entities and carry growth pressure.
- Early missions use small maps with low town count and high at-a-glance readability.
- Later missions use larger maps with more separated town clusters and longer routing distances.

### 8.1.1 Connectivity Model

- There are no locked map areas or area-purchase systems.
- Strategic challenge comes from distance, terrain costs, line congestion, and demand spikes.
- The player can route anywhere on valid terrain from run start.

### 8.2 Infrastructure

- Generation assets: a small starter set of plant types.
- Grid assets: substations, `Lines`, storage.
- `Line` connections can be built between:
  - power plant to power plant,
  - power plant to substation,
  - substation to substation,
  - substation to power plant.
- Substations provide circular service radius for nearby towns.
- When a town is in range of a powered substation, a short orthogonal service line is auto-generated between them.
- Actions: build, demolish, reroute priorities, and `Line` routing.

### 8.3 Demand and Supply

- Demand updates continuously in coarse ticks.
- Supply is simplified to capacity and availability values.
- Backbone routing is based on manual `Line` connectivity and line capacity.
- Town service is based on powered-substation coverage radius.
- Auto-generated orthogonal town service lines represent local distribution links and are not manually routed.

### 8.3.1 Population Growth as Difficulty Driver

- Towns track population as a lightweight value that influences demand growth.
- When population grows, baseline demand and peak stress both increase.
- Growth rates are tuned to be readable and strategically meaningful, not simulation-heavy.
- Population growth is disabled in tutorial/early onboarding missions and enabled in later content.

### 8.3.2 Seasonal and Local-Climate Demand Conditions

- Map areas carry simple climate tags (for example cold, temperate, warm) that modify town demand by season.
- Seasonal demand effects are intentionally high-level and transparent to the player.
- Example demand effects:
  - Cold areas in winter draw more power (heating pressure).
  - Warm areas in summer draw more power (cooling pressure).
- Seasonal/local-climate modifiers are applied as readable demand multipliers, not deep weather simulation.
- Seasonal/local-climate modifiers are disabled in tutorial/early onboarding missions and enabled in later content.

### 8.3.3 Town Emergence Conditions

- Towns can emerge mid-run to create readable expansion pressure.
- Emergence requires livable terrain (not mountains or ocean) and stable nearby powered coverage.
- Emergence is shallow and legible: no deep demographic simulation, only clear demand additions.
- Tutorial/onboarding missions can run low-emergence or emergence-off presets to reduce early overload.

### 8.4 Failure and Pressure

- Overload when routed power exceeds manual line/substation limits.
- Brownout/blackout when town demand is unmet beyond thresholds.
- Cascading issues are possible but intentionally simple and legible.

### 8.5 Economy and Hidden Service Pressure

- Budget changes from infrastructure costs, operating burden, and penalties.
- Level completion does not carry money into the next level.
- Trust is a hidden system attribute, not a visible resource the player directly manages.
- If towns remain underserved, hidden trust pressure accumulates and can trigger lawsuits against the Power Department.
- Lawsuits apply monetary penalties and increase bankruptcy risk.
- These values are intentionally high-level, not a deep market simulation.

## 9. Storytelling Approach (Unobtrusive)

- Short cabinet briefings and news-ticker style updates.
- Flavor text tied to mechanical events, town growth, and grid incidents.
- No long cutscenes, dialogue trees, or heavy narrative branching in v1.
- Story delivery should enhance context without interrupting control flow.

## 10. Simulation Depth Boundaries

To keep the game shallow and fast:

- Include:
  - Plant output, demand growth, reliability pressure, basic operating costs.
  - Substation coverage radius and auto-generated orthogonal town links.
  - Manual `Line` routing between plants and substations.
  - Population growth pressure as a simple demand multiplier once onboarding is complete.
  - Seasonal and local-climate demand modifiers as simple, visible multipliers once onboarding is complete.
  - Event-driven modifiers (for example heat wave demand spikes).
- Exclude for v1:
  - Layered mechanics that dilute the build/when/where strategic core.
  - Detailed weather physics or climate micro-simulation.
  - Detailed fuel supply chains.
  - Unit-level labor simulation.
  - Deep policy/legal simulation trees.
  - High-fidelity electrical engineering models.

## 11. Win/Lose and Scoring

### Primary Failure Conditions

- Reliability collapse (sustained unmet demand).
- Bankruptcy (the grid is in deficit and available cash has reached zero).

### Primary Victory Conditions

- Standard Run: survive and maximize score before collapse.
- Campaign/Operation maps: achieve full-map management by reliably serving required town-demand targets and mission objectives.

### Score Drivers

- Total demand served over run lifetime.
- Reliability consistency.
- Efficient capital use.
- Crisis recovery performance.
- Effective town expansion support.

## 12. Progression Model

- Levels are unlocked sequentially through completion.
- Completing a level unlocks the next level and does not grant material carryover.
- Campaign progression does not provide between-level economic advantages.

## 13. MVP Scope (Design Target)

1. One 2D overhead country map.
2. A town set with distinct demand behavior and growth potential.
3. A compact asset set (generation + substations + `Lines` + storage), with simple readable mechanics.
4. Real-time build/demolish/reroute controls.
5. Lightweight event pool with short narrative text.
6. Main menu, splash screen, and run setup flows.
7. Campaign mission starter set on handcrafted maps.
8. Custom game options with separate score classification.
9. End-of-run scoring and local high score table.

## 14. Singleplayer-First, Multiplayer-Aware

The game launches as singleplayer. Design choices should avoid blocking future multiplayer variants, but multiplayer is explicitly out of MVP delivery scope.

See `MULTIPLAYER_NOTES.md` for forward-looking design constraints.

## 15. Design Deep Dives

- `FRONTEND_AND_UX.md`: Splash screen, main menu, campaign/custom flow UX, and in-run HUD.
- `MISSION_AND_MODE_DESIGN.md`: Mode definitions, campaign mission structure, and custom game policy.
- `MAP_DESIGN_2D.md`: 2D overhead map interaction, town/substation coverage model, and line-routing readability rules.

## 16. Open Design Questions

1. Target run length (for example 15, 20, or 30 minutes).
2. Exact initial asset roster for launch.
3. Launch campaign size (8, 10, or 12 missions).
4. Number of handcrafted maps at launch (1, 2, or 3).
5. Event interaction model (passive events only vs fast binary choices in real time).
6. Population growth curve tuning after onboarding (gentle, moderate, or steep).
7. Seasonal demand model shape (fixed season per run vs season shifts during long runs).
8. Substation coverage-radius tuning by mission tier.
9. `Line` cost and maintenance scaling for long-distance routing.
