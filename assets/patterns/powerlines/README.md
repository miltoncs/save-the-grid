# Powerline Tile Patterns

Flat, minimal, seamless SVG tiles for:
- short-range/local distribution lines between substations and nearby towns, and
- long-distance transmission lines between power plants and substations.

## Files

- `local-powerline-tile.svg`: repeatable tile (`96 x 48`) with:
  - three parallel conductors,
  - one center utility pole,
  - crossarm + insulators.
- `local-powerline-tile-vertical.svg`: repeatable vertical tile (`48 x 96`) for north/south segments while keeping the pole/crossarm upright.
- `long-distance-powerline-tile.svg`: repeatable tile (`128 x 64`) with:
  - shield wire + three transmission conductors,
  - center lattice tower silhouette,
  - broader crossarm and insulator anchors.
- `long-distance-powerline-tile-vertical.svg`: repeatable vertical tile (`64 x 128`) for north/south transmission corridors while keeping the tower upright.

## Tessellation intent

- The three conductor lines run edge-to-edge at identical Y coordinates, so horizontal tiling is seamless.
- Long-distance tile conductors and shield wire also run edge-to-edge at identical coordinates for seamless tiling.
- Repeat this tile along a route segment and rotate the segment to match path direction.
- For vertical segments that should keep the pole upright, use `local-powerline-tile-vertical.svg` with `repeat-y`.
- For vertical transmission segments, use `long-distance-powerline-tile-vertical.svg` with `repeat-y`.

## Suggested usage

- CSS strip:
  - `background-image: url('./local-powerline-tile.svg');`
  - `background-repeat: repeat-x;`
  - `background-size: 96px 48px;`
- CSS vertical strip:
  - `background-image: url('./local-powerline-tile-vertical.svg');`
  - `background-repeat: repeat-y;`
  - `background-size: 48px 96px;`
- CSS transmission strip:
  - `background-image: url('./long-distance-powerline-tile.svg');`
  - `background-repeat: repeat-x;`
  - `background-size: 128px 64px;`
- CSS vertical transmission strip:
  - `background-image: url('./long-distance-powerline-tile-vertical.svg');`
  - `background-repeat: repeat-y;`
  - `background-size: 64px 128px;`
- Canvas:
  - create image pattern from local or long-distance tile and fill a clipped corridor/path.
