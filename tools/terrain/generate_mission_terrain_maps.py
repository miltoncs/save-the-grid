#!/usr/bin/env python3
"""Generate one unique topology map per campaign mission."""

from __future__ import annotations

import argparse
import json
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from submodules.topology_mapgen import TerrainConfig, generate_terrain, save_png

MISSION_INDEX = ROOT / "data/missions/campaign-missions.index.json"
DEFAULT_OUTPUT_DIR = ROOT / "assets/maps/terrain/mission-terrain-maps"
DEFAULT_MANIFEST_PATH = ROOT / "data/maps/terrain/mission-terrain-maps.index.json"


def parse_campaign_mission_ids(path: Path) -> list[str]:
    document = json.loads(path.read_text(encoding="utf-8"))
    ids = document.get("missionIds")
    if not isinstance(ids, list):
        raise RuntimeError(f"No missionIds array found in {path}")
    ids = [str(mid).strip() for mid in ids if str(mid).strip()]
    if not ids:
        raise RuntimeError("No mission ids found in mission index")
    return ids


def mission_seed(mission_id: str, seed_offset: int) -> int:
    return (zlib.crc32(mission_id.encode("utf-8")) + seed_offset) & 0xFFFFFFFF


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate topology maps for all campaign missions."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory where mission map PNGs are written",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST_PATH,
        help="Manifest JSON path to write mission generation stats",
    )
    parser.add_argument("--width", type=int, default=1800, help="Map width in pixels")
    parser.add_argument("--height", type=int, default=1080, help="Map height in pixels")
    parser.add_argument(
        "--target-land-fraction",
        type=float,
        default=0.42,
        help="Target percentage of pixels above sea level (0..1)",
    )
    parser.add_argument(
        "--seed-offset",
        type=int,
        default=0,
        help="Optional integer added to mission-derived seed",
    )
    parser.add_argument(
        "--mission",
        action="append",
        default=[],
        help="Generate only specified mission id(s); repeat option for multiple",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Optional cap on how many missions to generate (0 = all)",
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

    mission_ids = parse_campaign_mission_ids(MISSION_INDEX)

    if args.mission:
        requested = set(args.mission)
        missing = sorted(requested.difference(mission_ids))
        if missing:
            raise SystemExit(f"Unknown mission id(s): {', '.join(missing)}")
        mission_ids = [mid for mid in mission_ids if mid in requested]

    if args.limit and args.limit > 0:
        mission_ids = mission_ids[: args.limit]

    if not mission_ids:
        raise SystemExit("No missions selected for generation")

    output_dir = resolve_path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = resolve_path(args.manifest)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    manifest = {
        "generator": "submodules/topology_mapgen",
        "source_script": "tools/terrain/generate_mission_terrain_maps.py",
        "mission_index": display_path(MISSION_INDEX),
        "output_directory": display_path(output_dir),
        "image": {
            "width": args.width,
            "height": args.height,
        },
        "target_land_fraction": args.target_land_fraction,
        "missions": [],
    }

    for index, mission_id in enumerate(mission_ids, start=1):
        seed = mission_seed(mission_id, args.seed_offset)
        config = TerrainConfig(
            width=args.width,
            height=args.height,
            seed=seed,
            target_land_fraction=args.target_land_fraction,
        )
        out_name = f"{mission_id}.png"
        out_path = output_dir / out_name

        print(f"[{index}/{len(mission_ids)}] generating {out_name}...")
        result = generate_terrain(config)
        save_png(out_path, result.width, result.height, result.pixels)

        mission_entry = {
            "mission_id": mission_id,
            "seed": seed,
            "map_png": out_name,
            "stats": result.stats_dict(),
        }
        manifest["missions"].append(mission_entry)

    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"wrote {display_path(manifest_path)}")


if __name__ == "__main__":
    main()
