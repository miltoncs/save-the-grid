#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from submodules.topology_mapgen import TerrainConfig, generate_terrain, save_png


DEFAULT_OUT = ROOT / "assets/maps/terrain/mockup-terrain-map.png"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a topology-driven terrain PNG for gameplay maps."
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Output PNG path")
    parser.add_argument("--seed", type=int, default=1337, help="Deterministic generator seed")
    parser.add_argument("--width", type=int, default=1800, help="Map width in pixels")
    parser.add_argument("--height", type=int, default=1080, help="Map height in pixels")
    parser.add_argument(
        "--target-land-fraction",
        type=float,
        default=0.42,
        help="Target percentage of pixels above sea level (0..1)",
    )
    parser.add_argument(
        "--stats-json",
        type=Path,
        default=None,
        help="Optional output path for generation stats JSON",
    )
    return parser.parse_args()


def resolve_path(path: Path) -> Path:
    return path if path.is_absolute() else (ROOT / path)


def display_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def main() -> None:
    args = parse_args()

    config = TerrainConfig(
        width=args.width,
        height=args.height,
        seed=args.seed,
        target_land_fraction=args.target_land_fraction,
    )

    result = generate_terrain(config)

    out_path = resolve_path(args.out)
    save_png(out_path, result.width, result.height, result.pixels)

    print(f"wrote {display_path(out_path)}")
    print(
        "terrain stats: "
        f"land={result.stats.actual_land_fraction:.3f}, "
        f"water={result.stats.water_fraction:.3f}, "
        f"sea_level={result.stats.sea_level:.4f}, "
        f"mountaintops={result.stats.mountaintop_fraction:.3f}"
    )

    if args.stats_json is not None:
        stats_path = resolve_path(args.stats_json)
        stats_path.parent.mkdir(parents=True, exist_ok=True)
        stats_payload = {
            "generator": "submodules/topology_mapgen",
            "config": {
                "width": config.width,
                "height": config.height,
                "seed": config.seed,
                "target_land_fraction": config.target_land_fraction,
                "mountaintop_percentile": config.mountaintop_percentile,
                "mountain_slope_percentile": config.mountain_slope_percentile,
            },
            "stats": result.stats_dict(),
            "png": display_path(out_path),
        }
        stats_path.write_text(json.dumps(stats_payload, indent=2), encoding="utf-8")
        print(f"wrote {display_path(stats_path)}")


if __name__ == "__main__":
    main()
