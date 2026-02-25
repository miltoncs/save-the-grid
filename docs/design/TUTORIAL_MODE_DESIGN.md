# Tutorial Mode Design

Status: Draft v0.1  
Last updated: 2026-02-20

## 1. Purpose

`Tutorial` is a guided onboarding mode that teaches the complete core interaction vocabulary before score-focused play.

Goals:

1. Keep first-time players in-game quickly with minimal reading.
2. Teach mechanics through action, not long text panels.
3. Guarantee completion by removing fail states.
4. Prepare players for `Standard Run` and early `Campaign Missions`.

## 2. Access and Entry

Entry rules:

1. `Tutorial` is selectable directly from the Main Menu.
2. Starting tutorial launches immediately into gameplay (no parameter setup screen).
3. Tutorial uses a small, readable handcrafted map with sparse initial state:
   - mostly terrain visible,
   - one or few seeded towns,
   - little to no prebuilt infrastructure.

## 3. Win / Lose Rules

Tutorial outcome rules:

1. The player cannot lose in tutorial mode.
2. Bankruptcy and reliability-collapse defeat rules are disabled for tutorial.
3. The player wins tutorial by completing all guided tasks.
4. Tutorial completion returns a normal end screen with a "tutorial complete" result state.

## 4. Guided Task Sequence

Tutorial is step-based. Only one step is "current" at a time.

Required step set (covers all core mechanics):

1. Build a `Wind`, `Solar`, or `Natural Gas` powerplant on an open map point.
2. Build a `Substation` on an open map point.
3. Build a manual `Line` between valid infrastructure endpoints.
4. Achieve active service to at least one town (covered and receiving power).
5. Reveal the Resource Layer by holding `R`.
6. Use `Reroute` on a town point at least once.
7. Use `Demolish` to remove an asset at least once.
8. Pause and resume the simulation.

Completion policy:

1. Steps complete as soon as their condition is observed.
2. Completion immediately advances to the next task.
3. Final step completion immediately triggers tutorial victory.
4. The one-powerplant-diameter spacing rule is active in tutorial and should be introduced with placement feedback text.
5. If a powerplant is selected for demolish, completion triggers only after the full 20-second decommission timer.

## 5. Guidance UX

Guidance behavior:

1. Objective card always shows:
   - current step title,
   - short instruction,
   - step progress (`N / Total`).
2. Alert rail can echo "step complete" and "next step" messages.
3. Instructions must reference live controls exactly as labeled in HUD:
   - Build / Demolish / Reroute / Line,
   - Powerplant (1), Sub (2), Storage (3),
   - `R` for resources,
   - `Space` for pause.

Tone:

1. Functional and short.
2. No lore-heavy dialog.
3. No blocking modal interruptions once gameplay starts.

## 6. Economy and Simulation Pressure in Tutorial

Tutorial pressure policy:

1. Use low-pressure configuration so tasks are easy to complete.
2. Disable or heavily reduce disruptive incidents during tutorial.
3. Provide enough budget headroom that users cannot get stuck.
4. Keep pause enabled.

## 7. Persistence and Progression

Progression policy:

1. Tutorial completion can be tracked as a simple boolean profile flag.
2. Tutorial does not grant material rewards, currency, or carryover.
3. Completing tutorial does not alter normal run balance settings.
4. Resume behavior is allowed if run suspension exists.

## 8. Scope Boundaries (v1)

In scope:

1. Single linear tutorial path.
2. Action-based completion checks.
3. Core mechanics only.

Out of scope (v1):

1. Branching tutorials.
2. Multiple difficulty variants of tutorial.
3. Voice-over or cinematic onboarding.
4. Advanced optimization lessons (resource min-maxing, late-game score routing).
