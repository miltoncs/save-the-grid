# Mission and Mode Design

Status: Draft v0.1  
Last updated: 2026-02-12

## 1. Mode Strategy

The game is singleplayer-first with three player-facing play modes:

1. `Standard Run` (core roguelike score mode).
2. `Campaign Missions` (handcrafted scenario chain).
3. `Custom Game` (parameterized scenario builder with separate scoring class).

All modes run in real time by default, with optional player-controlled pause in singleplayer.

## 2. Standard Run (Primary Mode)

### Purpose

- Fast replayable loop.
- Baseline leaderboard competition.
- Main source of skill expression.

### Key Rules

1. Fresh economy and grid state per run.
2. Escalating demand and event pressure.
3. Run ends on collapse conditions.
4. Standard Run completion has no material reward; outcome is score and records.

## 3. Campaign Missions

### Role in Product

Campaign missions provide curated scenarios and light national storytelling without introducing permanent power progression.

### Campaign Structure (Initial Draft)

- 3 arcs with 4 missions each (12 total).
- Arc themes:
  1. Founding the Grid.
  2. Industrial Expansion.
  3. Transition and Resilience.
- Map scaling by arc:
  1. Founding: small, fully open maps for fast readability.
  2. Expansion: medium maps with selective regional lockouts.
  3. Transition and Resilience: large fragmented maps with staged region acquisition.

Onboarding rule:

- First tutorial/early missions run with static population (no growth mechanic).
- Population growth is introduced in later missions once core build/reroute controls are learned.
- Seasonal/regional demand modifiers are introduced in later missions after baseline routing mastery.
- First tutorial/early missions avoid region acquisition complexity.

### Mission Format

Each mission defines:

1. Handcrafted map layout and authored starting state.
2. Starting infrastructure and budget.
3. 2-3 explicit objectives.
4. 1-2 constraint modifiers.
5. Optional secondary objective for higher medal tier.
6. Population growth mode (`off` for onboarding, `on` for standard and advanced missions).
7. Seasonal/regional condition mode (`off` for onboarding, `on` for standard and advanced missions).
8. Region availability mode (`fully-open` for onboarding/small maps, `fragmented` for later maps).

### Objective Types

1. Serve a demand threshold by a time mark.
2. Maintain reliability above a target.
3. Survive an event sequence.
4. Limit budget overspend.
5. Reach electrification coverage in target regions.
6. Stabilize service during population-driven demand acceleration.
7. Maintain reliability through seasonal demand spikes.
8. Acquire and stabilize all required fragmented regions.

### Constraint Examples

1. Limited generation type availability.
2. Higher line construction costs.
3. Increased weather event frequency.
4. Restricted demolition refunds.
5. Regional winter/summer demand surges.
6. Region unlock costs that force expansion timing tradeoffs.

### Mission Completion and Rewards

- Medal grades: bronze, silver, gold (performance classification only).
- Completing a mission unlocks the next mission.
- No money carryover or material reward is granted on completion.

## 4. Campaign Story Delivery

Story is mission-framed and concise:

1. One short pre-brief line before mission start.
2. In-run ambient updates tied to objective shifts.
3. One line of outcome text in post-mission summary.

No branching dialogue trees are required for v1.

### 4.1 In-Level Capital Rule

- Region acquisition is funded only by money earned within the current mission.
- On mission completion, budget resets for the next mission.

## 5. Custom Game

### Purpose

- Training and experimentation mode.
- Community challenge map+settings sharing.
- Difficulty tailoring without affecting core balance.

### Customizable Parameters (Draft)

1. Handcrafted map selection.
2. Region pressure variant.
3. Starting budget.
4. Base demand and growth.
5. Event intensity.
6. Infrastructure price multiplier.
7. Reliability failure tolerance.
8. Underserved-region lawsuit sensitivity.
9. Run duration target band.
10. Population growth strength (`off`, `normal`, `high`).
11. Seasonal profile (`neutral`, `winter-peak`, `summer-peak`, `mixed`).
12. Regional climate intensity (`low`, `normal`, `high`).
13. Region fragmentation level (`none`, `moderate`, `high`).
14. Region unlock cost profile (`low`, `standard`, `high`).

### Integrity Policy

- Standard presets remain leaderboard-eligible.
- Any modified parameter marks run class as `Custom`.
- Custom runs write to separate records table.

## 6. Difficulty Model Across Modes

Difficulty should scale through a small set of readable knobs:

1. Demand ramp speed.
2. Population growth pressure.
3. Seasonal/regional demand pressure.
4. Incident frequency.
5. Economic pressure.
6. Failure threshold strictness.
7. Region acquisition pressure (fragmentation + unlock costs).

Avoid hidden multipliers that reduce player confidence in outcomes.

## 7. Suggested Launch Mission Set (Example)

1. `Cold Start`: bootstrap power to capital and one rural region on a small fully-open map.
2. `Rolling Summer`: survive heat-wave demand spikes.
3. `Fuel Shock`: maintain service with cost surge penalties.
4. `Coastal Storm`: recover from repeated line disruptions.
5. `Industrial Push`: support heavy growth in one corridor.
6. `Dry Season`: low hydro availability constraint.
7. `Night Surge`: manage steep evening demand profile.
8. `Election Quarter`: keep underserved-region lawsuit exposure low under mixed events.
9. `Grid Retrofit`: replace inefficient plants with strict budget cap on a medium fragmented map.
10. `Cross-Country Link`: establish stable long-haul transmission path while buying access to new regions.
11. `Green Mandate`: meet demand with limited fossil capacity across a large fragmented map.
12. `National Peak`: final full-map management scenario with mandatory region acquisition.

## 8. Open Questions

1. Exact mission count target for v1 (8, 10, or 12).
2. Whether mission unlocks are linear or choice-based by arc.
3. How mission-completion and next-level-unlock messaging should be presented in UI.
