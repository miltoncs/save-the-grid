#!/usr/bin/env python3
"""Generate one unique terrain map PNG per campaign mission.

This script reuses the procedural terrain functions from:
- tools/terrain/generate_terrain_map_png.py

It does not modify existing files; it writes new outputs under:
- assets/maps/terrain/mission-terrain-maps/
"""

from __future__ import annotations

import importlib.util
import json
import math
import random
import re
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE_GENERATOR = ROOT / "tools/terrain/generate_terrain_map_png.py"
MISSION_SOURCE = ROOT / "src/data.js"
OUTPUT_DIR = ROOT / "assets/maps/terrain/mission-terrain-maps"


def load_generator_module():
    spec = importlib.util.spec_from_file_location("terrain_base", SOURCE_GENERATOR)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load terrain generator from {SOURCE_GENERATOR}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def parse_campaign_mission_ids(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    block_match = re.search(
        r"export\s+const\s+CAMPAIGN_MISSIONS\s*=\s*\[(.*?)\n\];",
        text,
        re.DOTALL,
    )
    if not block_match:
        raise RuntimeError("Could not find CAMPAIGN_MISSIONS block in src/data.js")

    block = block_match.group(1)
    ids = re.findall(r"\bid:\s*\"([^\"]+)\"", block)
    if not ids:
        raise RuntimeError("No mission ids found in CAMPAIGN_MISSIONS block")
    return ids


def mission_params(mission_id: str) -> dict[str, float]:
    seed = zlib.crc32(mission_id.encode("utf-8")) & 0xFFFFFFFF
    r = random.Random(seed)
    return {
        "seed": seed,
        "noise_phase_x": r.uniform(-900.0, 900.0),
        "noise_phase_y": r.uniform(-900.0, 900.0),
        "shift_x": r.uniform(-0.09, 0.09),
        "shift_y": r.uniform(-0.07, 0.07),
        "warp_x": r.uniform(0.018, 0.052),
        "warp_y": r.uniform(0.018, 0.047),
        "warp_fx": r.uniform(4.5, 9.8),
        "warp_fy": r.uniform(4.2, 9.4),
        "phase_a": r.uniform(0.0, math.tau),
        "phase_b": r.uniform(0.0, math.tau),
        "sea_tilt": r.uniform(-0.08, 0.08),
        "arid_bias": r.uniform(-0.08, 0.10),
        "ridge_bias": r.uniform(-0.07, 0.08),
        "tropical_shift": r.uniform(-0.05, 0.05),
    }


def generate_map_for_mission(gen, mission_id: str, params: dict[str, float], out_path: Path):
    width = gen.WIDTH
    height = gen.HEIGHT

    pixels = bytearray(width * height * 3)
    land_mask = bytearray(width * height)

    base_noise = gen.terrain_noise

    def seeded_noise(x: float, y: float) -> float:
        return base_noise(x + params["noise_phase_x"], y + params["noise_phase_y"])

    gen.terrain_noise = seeded_noise

    try:
        for y in range(height):
            ny0 = y / height
            for x in range(width):
                nx0 = x / width
                idx = y * width + x

                nx = gen.clamp(
                    nx0
                    + params["shift_x"]
                    + params["warp_x"] * math.sin((ny0 * params["warp_fx"] * math.pi) + params["phase_a"]),
                    0.0,
                    1.0,
                )
                ny = gen.clamp(
                    ny0
                    + params["shift_y"]
                    + params["warp_y"] * math.sin((nx0 * params["warp_fy"] * math.pi) + params["phase_b"]),
                    0.0,
                    1.0,
                )

                mainland = gen.land_field(nx, ny)
                island = gen.island_field(nx, ny)
                if mainland > 0.02 or island > 0.11:
                    land_mask[idx] = 1

        coast = bytearray(width * height)
        radius = 5
        offsets = []
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                d = math.hypot(dx, dy)
                if d <= radius:
                    v = int(255 * (1.0 - d / radius))
                    offsets.append((dx, dy, v))

        for y in range(height):
            row = y * width
            for x in range(width):
                i = row + x
                if land_mask[i] == 0:
                    continue
                for dx, dy, v in offsets:
                    xx = x + dx
                    yy = y + dy
                    if xx < 0 or xx >= width or yy < 0 or yy >= height:
                        continue
                    j = yy * width + xx
                    if land_mask[j] == 0 and v > coast[j]:
                        coast[j] = v

        for y in range(height):
            ny0 = y / height
            for x in range(width):
                nx0 = x / width
                idx = y * width + x

                nx = gen.clamp(
                    nx0
                    + params["shift_x"]
                    + params["warp_x"] * math.sin((ny0 * params["warp_fx"] * math.pi) + params["phase_a"]),
                    0.0,
                    1.0,
                )
                ny = gen.clamp(
                    ny0
                    + params["shift_y"]
                    + params["warp_y"] * math.sin((nx0 * params["warp_fy"] * math.pi) + params["phase_b"]),
                    0.0,
                    1.0,
                )

                if land_mask[idx] == 0:
                    wave = 0.06 * gen.terrain_noise(x * 0.7, y * 0.7)
                    sea_band = 0.91 + 0.19 * (1.0 - ny0) + params["sea_tilt"] * (nx0 - 0.5)
                    base = (
                        gen.clamp(int(gen.WATER_DEEP[0] * (sea_band + wave)), 0, 255),
                        gen.clamp(int(gen.WATER_DEEP[1] * (sea_band + wave)), 0, 255),
                        gen.clamp(int(gen.WATER_DEEP[2] * (sea_band + wave)), 0, 255),
                    )
                    shallow = coast[idx] / 255.0
                    color = gen.mix(base, gen.WATER_SHALLOW, shallow * 0.70)
                    gen.write_pixel(pixels, x, y, color)
                    continue

                elev = gen.mountain_elevation(nx, ny)
                elev += params["ridge_bias"] * math.sin(nx * 9.0 + ny * 6.5)
                elev = gen.clamp(elev, 0.0, 1.0)

                dry = gen.dryness_field(nx, ny) + params["arid_bias"]
                tropical = gen.smoothstep(0.52 + params["tropical_shift"], 0.86, ny) * gen.smoothstep(0.28, 0.62, nx)
                dry -= 0.13 * tropical
                dry = gen.clamp(dry, 0.0, 1.0)

                if elev > 0.81:
                    color = gen.ICE
                elif elev > 0.69:
                    color = gen.mix(gen.STEPPE, gen.ICE, (elev - 0.69) / 0.12)
                elif dry > 0.76:
                    color = gen.DESERT
                elif dry > 0.58:
                    color = gen.DRY
                elif dry > 0.44:
                    color = gen.STEPPE
                else:
                    color = gen.FERTILE

                shade = 0.90 + (elev * 0.26) + (0.05 * gen.terrain_noise(x * 1.1, y * 1.1))
                color = (
                    gen.clamp(int(color[0] * shade), 0, 255),
                    gen.clamp(int(color[1] * shade), 0, 255),
                    gen.clamp(int(color[2] * shade), 0, 255),
                )
                gen.write_pixel(pixels, x, y, color)

                if elev > 0.35:
                    orient = (x * 0.12) + (y * 0.043) + (gen.terrain_noise(x * 0.8, y * 0.8) * 3.8)
                    stripe = abs(math.sin(orient))
                    ridge_alpha = ((elev - 0.35) / 0.65) * (stripe**16) * 0.86
                    ridge_alpha = gen.clamp(ridge_alpha, 0.0, 0.62)
                    if ridge_alpha > 0.01:
                        gen.blend_pixel(pixels, x, y, gen.RIDGE, ridge_alpha)

                edge = False
                if x > 0 and land_mask[idx - 1] == 0:
                    edge = True
                elif x < width - 1 and land_mask[idx + 1] == 0:
                    edge = True
                elif y > 0 and land_mask[idx - width] == 0:
                    edge = True
                elif y < height - 1 and land_mask[idx + width] == 0:
                    edge = True
                if edge:
                    gen.blend_pixel(pixels, x, y, gen.DESERT, 0.24)

        for y in range(height):
            fog = gen.clamp((225 - y) / 260.0, 0.0, 1.0) * 0.16
            if fog <= 0:
                continue
            for x in range(width):
                gen.blend_pixel(pixels, x, y, (210, 229, 244), fog)

        rows = [bytes(pixels[y * width * 3 : (y + 1) * width * 3]) for y in range(height)]
        gen.save_png(out_path, rows)

    finally:
        gen.terrain_noise = base_noise


def main():
    gen = load_generator_module()
    mission_ids = parse_campaign_mission_ids(MISSION_SOURCE)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = {
        "source_generator": str(SOURCE_GENERATOR.relative_to(ROOT)),
        "output_directory": str(OUTPUT_DIR.relative_to(ROOT)),
        "image": {"width": gen.WIDTH, "height": gen.HEIGHT},
        "missions": [],
    }

    for i, mission_id in enumerate(mission_ids, start=1):
        params = mission_params(mission_id)
        out_file = OUTPUT_DIR / f"{mission_id}.png"
        print(f"[{i}/{len(mission_ids)}] generating {out_file.name}...")
        generate_map_for_mission(gen, mission_id, params, out_file)
        manifest["missions"].append(
            {
                "mission_id": mission_id,
                "map_png": out_file.name,
                "seed": params["seed"],
            }
        )

    manifest_path = OUTPUT_DIR / "index.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"wrote {manifest_path}")


if __name__ == "__main__":
    main()
