# Multiplayer Notes (Future Mode)

Status: Parking lot for future design updates  
Last updated: 2026-02-12

## 1. Intent

Ship singleplayer first while preserving a clean path to future multiplayer modes.

## 2. Not in MVP

- No live PvP in initial release.
- No contract bidding interface in v1.
- No matchmaking, lobbies, or authoritative server gameplay in v1.

## 3. Candidate Future Multiplayer Fantasy

Multiple energy companies compete to win and keep regional supply contracts. Performance, reliability, and pricing determine who controls each contract over time.

## 4. Design Guardrails to Preserve During Singleplayer Development

1. Keep simulation rules deterministic where possible.
2. Keep economy and scoring formulas explicit and auditable.
3. Track player actions as clear intent commands (build, demolish, reroute).
4. Keep event randomness seedable.
5. Avoid singleplayer-only hidden advantages that would be impossible to compare fairly.

These guardrails reduce rewrite risk when multiplayer design is prioritized.

## 5. Early Multiplayer Mode Candidates (Post-MVP)

1. Asynchronous contract challenge:
   - Same handcrafted map + same scenario settings, compare final score and reliability.
2. Weekly competitive scenario:
   - Shared constraints, leaderboard-driven competition.
3. Live contract bidding (full multiplayer):
   - Real-time auctions plus grid performance competition.

## 6. Risks to Watch Now

1. Simulation drift from frame-rate-dependent updates.
2. UI flows that assume one local player and cannot generalize.
3. Scoring tied to opaque local state.
4. Event systems that are too narrative-heavy to synchronize in competitive contexts.

## 7. Update Policy

Whenever a design decision is made in singleplayer implementation, append a short note here describing whether it helps, hurts, or is neutral for multiplayer readiness.

## 8. Compatibility Log

2026-02-12:

1. Added campaign missions as fixed-scenario singleplayer content. Impact: neutral-to-positive for asynchronous multiplayer because authored map IDs and objective packets can be reused as competitive scenarios.
2. Added custom game parameter screen with separate score class. Impact: positive because ruleset declarations can later become lobby presets.
3. Locked 2D overhead map and shared interaction vocabulary across modes. Impact: positive because it avoids per-mode control fragmentation in future multiplayer UI.
4. Added seasonal/regional demand modifiers with onboarding gating. Impact: positive if season state and climate tags are included in scenario packets for fair score comparability.
