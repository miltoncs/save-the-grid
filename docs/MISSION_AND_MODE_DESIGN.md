# Mission and Mode Design

Status: Draft v0.1  
Last updated: 2026-02-12

## 1. Mode Strategy

The game is singleplayer-first with three player-facing play modes:

1. `Standard Run` (core roguelike score mode).
2. `Campaign Missions` (handcrafted scenario chain).
3. `Custom Game` (parameterized scenario builder with separate scoring class).

All modes honor strict real-time gameplay once a run starts.

## 2. Standard Run (Primary Mode)

### Purpose

- Fast replayable loop.
- Baseline leaderboard competition.
- Main source of skill expression.

### Key Rules

1. Fresh economy and grid state per run.
2. Escalating demand and event pressure.
3. Run ends on collapse conditions.
4. Rewards: score + cosmetic progression only.

## 3. Campaign Missions

### Role in Product

Campaign missions provide curated scenarios and light national storytelling without introducing permanent power progression.

### Campaign Structure (Initial Draft)

- 3 arcs with 4 missions each (12 total).
- Arc themes:
  1. Founding the Grid.
  2. Industrial Expansion.
  3. Transition and Resilience.

### Mission Format

Each mission defines:

1. Fixed map seed or handcrafted layout.
2. Starting infrastructure and budget.
3. 2-3 explicit objectives.
4. 1-2 constraint modifiers.
5. Optional secondary objective for higher medal tier.

### Objective Types

1. Serve a demand threshold by a time mark.
2. Maintain reliability above a target.
3. Survive an event sequence.
4. Limit budget overspend.
5. Reach electrification coverage in target regions.

### Constraint Examples

1. Limited generation type availability.
2. Higher line construction costs.
3. Increased weather event frequency.
4. Restricted demolition refunds.

### Mission Completion and Rewards

- Medal grades: bronze, silver, gold.
- Rewards: cosmetics, mission badges, profile titles.
- No gameplay power unlocks.

## 4. Campaign Story Delivery

Story is mission-framed and concise:

1. One short pre-brief line before mission start.
2. In-run ambient updates tied to objective shifts.
3. One line of outcome text in post-mission summary.

No branching dialogue trees are required for v1.

## 5. Custom Game

### Purpose

- Training and experimentation mode.
- Community challenge seed sharing.
- Difficulty tailoring without affecting core balance.

### Customizable Parameters (Draft)

1. Seed.
2. Region count/layout variant.
3. Starting budget.
4. Base demand and growth.
5. Event intensity.
6. Infrastructure price multiplier.
7. Reliability failure tolerance.
8. Trust decay sensitivity.
9. Run duration target band.

### Integrity Policy

- Standard presets remain leaderboard-eligible.
- Any modified parameter marks run class as `Custom`.
- Custom runs write to separate records table.

## 6. Difficulty Model Across Modes

Difficulty should scale through a small set of readable knobs:

1. Demand ramp speed.
2. Incident frequency.
3. Economic pressure.
4. Failure threshold strictness.

Avoid hidden multipliers that reduce player trust in outcomes.

## 7. Suggested Launch Mission Set (Example)

1. `Cold Start`: bootstrap power to capital and one rural region.
2. `Rolling Summer`: survive heat-wave demand spikes.
3. `Fuel Shock`: maintain service with cost surge penalties.
4. `Coastal Storm`: recover from repeated line disruptions.
5. `Industrial Push`: support heavy growth in one corridor.
6. `Dry Season`: low hydro availability constraint.
7. `Night Surge`: manage steep evening demand profile.
8. `Election Quarter`: keep trust above threshold under mixed events.
9. `Grid Retrofit`: replace inefficient plants with strict budget cap.
10. `Cross-Country Link`: establish stable long-haul transmission path.
11. `Green Mandate`: meet demand with limited fossil capacity.
12. `National Peak`: final endurance scenario.

## 8. Open Questions

1. Exact mission count target for v1 (8, 10, or 12).
2. Whether mission unlocks are linear or choice-based by arc.
3. Whether campaign medals should aggregate into seasonal cosmetic rewards.
