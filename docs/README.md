# Save the powergrid Documentation

This directory is documentation-only and is organized into three tracks:

- `design/`: game design and design philosophy.
- `implementation/`: engineering and delivery documentation.
- `mockups-ui-design/`: visual mockups and screen composition references.

## Quick Index

- `design/README.md`: Design doc index, scope, and ownership.
- `implementation/README.md`: Implementation doc index and technical doc conventions.
- `mockups-ui-design/README.md`: Visual mockup artifacts and composition guidance.

## Project Structure (Outside `docs/`)

- `src/`: gameplay runtime and UI code.
- `assets/`: runtime static assets (icons, terrain images, etc.).
- `data/`: runtime metadata/content files.
- `tools/`: utility/generation scripts.
- `bot-player/`: Playwright bot runner and scenarios.

## Documentation Boundary

Use this rule when adding or updating docs:

- `design/` answers: what the player experience should be and why.
- `implementation/` answers: how systems are built, integrated, tested, and shipped.
- `mockups-ui-design/` answers: how key screens can look before implementation decisions.

Do not store runtime assets or generation scripts under `docs/`.
Keep executable tools under `tools/` and game-consumed files under `assets/` or `data/`.
Legacy wrapper scripts now live in `tools/terrain/compat/` rather than under `docs/`.

If a document mixes both, split it into one design doc and one implementation doc that cross-link each other.

Current gameplay direction highlights:

- Tutorial mode is a guided no-fail onboarding run accessed from Main Menu.
- Early levels use small maps that keep needs and infrastructure easy to observe.
- Basic level starts are intentionally sparse: mostly terrain, few towns, little/no prebuilt powergrid.
- Later maps are larger and focus on longer routing distances and denser town networks.
- There are no region-level service hubs; towns are direct map entities.
- There are no pre-authored major transmission corridors in play.
- Powerplant types are fixed to `Wind`, `Solar`, and `Natural Gas`.
- Powerplants require one full powerplant-diameter spacing from each other.
- Substations power towns by radius with auto-generated orthogonal town service links.
- Players build manual long-distance powerlines with the in-game `Line` tool.
- Campaign victory emphasizes full-map management on advanced maps through reliable town service.
- Completing a level unlocks the next level; no money or material reward carries over.
