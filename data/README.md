# Runtime Data

This directory contains structured runtime metadata/content files consumed by the game.

## Layout

- `maps/index.json`: map catalog and default map ID.
- `maps/*.map.json`: one authored gameplay map file per map.
- `maps/terrain/`: terrain metadata linked from map documents.

## Rule

Use this directory for JSON/data contracts.
Keep binary assets in `/assets` and generation tools in `/tools`.
