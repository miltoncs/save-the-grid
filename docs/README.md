# Save the Grid Documentation

This directory is organized into three documentation tracks:

- `design/`: game design and design philosophy.
- `implementation/`: engineering and delivery documentation.
- `mockups-ui-design/`: visual mockups and screen composition explorations.

## Quick Index

- `design/README.md`: Design doc index, scope, and ownership.
- `implementation/README.md`: Implementation doc index and technical doc conventions.
- `mockups-ui-design/README.md`: SVG-only visual mockups for look-and-feel iteration.

## Documentation Boundary

Use this rule when adding or updating docs:

- `design/` answers: what the player experience should be and why.
- `implementation/` answers: how systems are built, integrated, tested, and shipped.
- `mockups-ui-design/` answers: how key screens can look before implementation decisions.

If a document mixes both, split it into one design doc and one implementation doc that cross-link each other.

Current gameplay direction highlights:

- Early levels use small maps that keep needs and infrastructure easy to observe.
- Basic level starts are intentionally sparse: mostly terrain, few towns, little/no prebuilt grid.
- Later maps are larger and fragmented into regions unlocked with current-level budget.
- Campaign victory emphasizes full-map management on advanced maps.
- Completing a level unlocks the next level; no money or material reward carries over.
