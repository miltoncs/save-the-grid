# Local Powerline Tile Pattern

Flat, minimal, seamless SVG tile for short-range/local distribution lines between substations and nearby towns.

## Files

- `local-powerline-tile.svg`: repeatable tile (`96 x 48`) with:
  - three parallel conductors,
  - one center utility pole,
  - crossarm + insulators.
- `local-powerline-tile-vertical.svg`: repeatable vertical tile (`48 x 96`) for north/south segments while keeping the pole/crossarm upright.

## Tessellation intent

- The three conductor lines run edge-to-edge at identical Y coordinates, so horizontal tiling is seamless.
- Repeat this tile along a route segment and rotate the segment to match path direction.
- For vertical segments that should keep the pole upright, use `local-powerline-tile-vertical.svg` with `repeat-y`.

## Suggested usage

- CSS strip:
  - `background-image: url('./local-powerline-tile.svg');`
  - `background-repeat: repeat-x;`
  - `background-size: 96px 48px;`
- CSS vertical strip:
  - `background-image: url('./local-powerline-tile-vertical.svg');`
  - `background-repeat: repeat-y;`
  - `background-size: 48px 96px;`
- Canvas:
  - create image pattern from `local-powerline-tile.svg` and fill a clipped corridor/path.
