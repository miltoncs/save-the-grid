# Mission and Mode Design

Status: Draft v0.1  
Last updated: 2026-02-20

## 1. Mode Strategy

The game is singleplayer-first with four player-facing play modes:

1. `Tutorial` (guided onboarding, no fail state).
2. `Standard Run` (core roguelike score mode).
3. `Campaign Missions` (handcrafted scenario chain).
4. `Custom Game` (parameterized scenario builder with separate scoring class).

All modes run in real time by default, with optional player-controlled pause in singleplayer.

## 2. Tutorial Mode (Onboarding)

Tutorial mode is a linear, task-based onboarding run that teaches core mechanics in live play.

Key rules:

1. Accessed directly from Main Menu.
2. No lose condition is active.
3. Player wins by completing all tutorial tasks.
4. Tutorial tasks cover the full base interaction set:
   - build,
   - line routing,
   - substation-to-town service,
   - resource layer reveal,
   - reroute,
   - demolish,
   - pause/resume.
5. Tutorial design details are defined in `TUTORIAL_MODE_DESIGN.md`.

## 3. Standard Run (Primary Mode)

### Purpose

- Fast replayable loop.
- Baseline leaderboard competition.
- Main source of skill expression.

### Key Rules

1. Fresh economy and grid state per run.
2. Most runs begin from a sparse state (terrain-first map, few towns, minimal/no prebuilt grid).
3. Escalating demand and event pressure.
4. Run ends on collapse conditions.
5. Standard Run completion has no material reward; outcome is score and records.

## 4. Campaign Missions

### Role in Product

Campaign missions provide curated scenarios and light national storytelling without introducing permanent power progression.

### Campaign Structure (Initial Draft)

- 3 arcs with 4 missions each (12 total).
- Arc themes:
  1. Founding the Grid.
  2. Industrial Expansion.
  3. Transition and Resilience.
- Map scaling by arc:
  1. Founding: small maps for fast readability and control learning.
  2. Expansion: medium maps with separated town clusters and longer line-planning demands.
  3. Transition and Resilience: large maps with high demand density and severe stress scenarios.

Onboarding rule:

- First tutorial/early missions run with static population (no growth mechanic).
- Population growth is introduced in later missions once core build/reroute controls are learned.
- First tutorial/early missions can cap or disable spontaneous town emergence.
- Seasonal/local-climate demand modifiers are introduced in later missions after baseline routing mastery.
- First tutorial/early missions avoid long-distance routing overload.

### Mission Format

Each mission defines:

1. Handcrafted map layout and authored starting state.
2. Town-only topology (no region-level service hubs).
3. No pre-authored major transmission corridors; backbone routing starts from player-built `Line` actions.
4. Starting budget and optional starter infrastructure (often minimal/none in basic scenarios).
5. 2-3 explicit objectives.
6. 1-2 constraint modifiers.
7. Optional secondary objective for higher medal tier.
8. Population growth mode (`off` for onboarding, `on` for standard and advanced missions).
9. Seasonal/local-climate condition mode (`off` for onboarding, `on` for standard and advanced missions).
10. Town emergence mode (`off`, `limited`, `normal`).

### Objective Types

1. Serve a demand threshold by a time mark.
2. Maintain reliability above a target.
3. Survive an event sequence.
4. Limit budget overspend.
5. Reach electrification coverage for a target number of towns.
6. Stabilize service during population-driven demand acceleration.
7. Maintain reliability through seasonal demand spikes.
8. Build and maintain a stable long-distance `Line` backbone.

### Constraint Examples

1. Limited generation type availability.
2. Higher `Line` construction costs.
3. Increased weather event frequency.
4. Restricted demolition refunds.
5. Strong winter/summer demand surges.
6. Reduced substation radius forcing denser station planning.

### Mission Completion and Rewards

- Medal grades: bronze, silver, gold (performance classification only).
- Completing a mission unlocks the next mission.
- No money carryover or material reward is granted on completion.

## 5. Campaign Story Delivery

Story is mission-framed and concise:

1. One short pre-brief line before mission start.
2. In-run ambient updates tied to objective shifts.
3. One line of outcome text in post-mission summary.

No branching dialogue trees are required for v1.

### 5.1 In-Level Capital Rule

- All build, maintenance, and penalty costs are funded only by money earned within the current mission.
- On mission completion, budget resets for the next mission.

## 6. Custom Game

### Purpose

- Training and experimentation mode.
- Community challenge map+settings sharing.
- Difficulty tailoring without affecting core balance.

### Customizable Parameters (Draft)

1. Handcrafted map selection.
2. Starting budget.
3. Base demand and growth.
4. Event intensity.
5. Seasonal profile.
6. Local-climate intensity.
7. Infrastructure price multiplier.
8. Reliability failure tolerance.
9. Underserved-town lawsuit sensitivity.
10. Run duration target band.
11. Population growth strength (`off`, `normal`, `high`).
12. Town emergence intensity (`off`, `limited`, `normal`, `high`).
13. Substation radius profile (`wide`, `standard`, `tight`).
14. `Line` maintenance profile (`low`, `standard`, `high`).

### Integrity Policy

- Standard presets remain leaderboard-eligible.
- Any modified parameter marks run class as `Custom`.
- Custom runs write to separate records table.

## 7. Difficulty Model Across Modes

Difficulty should scale through a small set of readable knobs:

1. Demand ramp speed.
2. Population growth pressure.
3. Seasonal/local-climate demand pressure.
4. Incident frequency.
5. Economic pressure.
6. Failure threshold strictness.
7. Routing pressure (distance + terrain cost + line congestion).
8. Coverage pressure (substation radius and town emergence rate).

Avoid hidden multipliers that reduce player confidence in outcomes.

## 8. Suggested Launch Mission Set (Example)

1. `Cold Start`: bootstrap power to a starter town cluster on a small map.
2. `Rolling Summer`: survive heat-wave demand spikes.
3. `Fuel Shock`: maintain service with cost surge penalties.
4. `Coastal Storm`: recover from repeated line disruptions.
5. `Industrial Push`: support heavy growth in a factory-dense town belt.
6. `Dry Season`: low hydro availability constraint.
7. `Night Surge`: manage steep evening demand profile.
8. `Election Quarter`: keep underserved-town lawsuit exposure low under mixed events.
9. `Grid Retrofit`: replace inefficient plants with strict budget cap on a medium map.
10. `Cross-Country Link`: establish stable long-haul `Line` paths between distant supply and demand clusters.
11. `Green Mandate`: meet demand with limited fossil capacity across a large map.
12. `National Peak`: final full-map management scenario with high town density and peak seasonal stress.

## 9. Open Questions

1. Exact mission count target for v1 (8, 10, or 12).
2. Whether mission unlocks are linear or choice-based by arc.
3. How mission-completion and next-level-unlock messaging should be presented in UI.
