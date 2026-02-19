from __future__ import annotations

import binascii
import math
import struct
import zlib
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Sequence

WATER_BLUE = (68, 134, 195)
PLAINS_GREEN = (132, 190, 116)
MOUNTAIN_BROWN = (204, 175, 136)
MOUNTAINTOP_WHITE = (246, 246, 244)


@dataclass(frozen=True)
class TerrainConfig:
    width: int = 1800
    height: int = 1080
    seed: int = 1337
    target_land_fraction: float = 0.42
    mountaintop_percentile: float = 0.95
    mountain_slope_percentile: float = 0.83
    hillshade_strength: float = 0.22


@dataclass(frozen=True)
class TerrainStats:
    sea_level: float
    mountaintop_level: float
    mountain_slope_level: float
    target_land_fraction: float
    actual_land_fraction: float
    water_fraction: float
    plains_fraction: float
    mountain_fraction: float
    mountaintop_fraction: float


@dataclass(frozen=True)
class TerrainResult:
    width: int
    height: int
    pixels: bytes
    stats: TerrainStats

    def stats_dict(self) -> dict:
        return asdict(self.stats)


def _clamp(value: float, lo: float, hi: float) -> float:
    return lo if value < lo else hi if value > hi else value


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _smoothstep01(t: float) -> float:
    t = _clamp(t, 0.0, 1.0)
    return t * t * (3.0 - (2.0 * t))


def _hash2(ix: int, iy: int, seed: int) -> float:
    n = (ix * 374761393) + (iy * 668265263) + (seed * 73856093)
    n = (n ^ (n >> 13)) & 0xFFFFFFFF
    n = (n * 1274126177) & 0xFFFFFFFF
    n = n ^ (n >> 16)
    return (n & 0xFFFFFFFF) / 4294967295.0


def _value_noise(x: float, y: float, seed: int) -> float:
    ix = math.floor(x)
    iy = math.floor(y)
    fx = x - ix
    fy = y - iy

    sx = _smoothstep01(fx)
    sy = _smoothstep01(fy)

    v00 = _hash2(ix, iy, seed)
    v10 = _hash2(ix + 1, iy, seed)
    v01 = _hash2(ix, iy + 1, seed)
    v11 = _hash2(ix + 1, iy + 1, seed)

    i0 = _lerp(v00, v10, sx)
    i1 = _lerp(v01, v11, sx)
    return (_lerp(i0, i1, sy) * 2.0) - 1.0


def _fractal_noise(
    x: float,
    y: float,
    seed: int,
    octaves: int = 5,
    lacunarity: float = 2.02,
    gain: float = 0.5,
) -> float:
    amplitude = 1.0
    frequency = 1.0
    value = 0.0
    normalizer = 0.0

    for octave in range(octaves):
        octave_seed = seed + (octave * 911)
        value += amplitude * _value_noise(x * frequency, y * frequency, octave_seed)
        normalizer += amplitude
        amplitude *= gain
        frequency *= lacunarity

    if normalizer <= 0.0:
        return 0.0
    return value / normalizer


def _quantile(values: Sequence[float], q: float) -> float:
    if not values:
        return 0.0

    q = _clamp(q, 0.0, 1.0)
    ordered = sorted(values)
    n = len(ordered)
    if n == 1:
        return ordered[0]

    pos = q * (n - 1)
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return ordered[lo]

    t = pos - lo
    return _lerp(ordered[lo], ordered[hi], t)


def _shade(color: tuple[int, int, int], factor: float) -> tuple[int, int, int]:
    return (
        int(_clamp(color[0] * factor, 0.0, 255.0)),
        int(_clamp(color[1] * factor, 0.0, 255.0)),
        int(_clamp(color[2] * factor, 0.0, 255.0)),
    )


def _build_heightfield(config: TerrainConfig) -> list[float]:
    width = config.width
    height = config.height
    seed = int(config.seed)

    heights = [0.0] * (width * height)

    for y in range(height):
        ny = y / max(1, height - 1)
        for x in range(width):
            nx = x / max(1, width - 1)

            warp_x = 0.11 * _fractal_noise(nx * 2.1 + 5.17, ny * 2.1 - 3.47, seed ^ 0x0F0F0F0F, 4)
            warp_y = 0.11 * _fractal_noise(nx * 2.2 - 8.91, ny * 2.0 + 6.13, seed ^ 0xABCDEF01, 4)

            wx = nx + warp_x
            wy = ny + warp_y

            dx = (wx - 0.52) / 0.80
            dy = (wy - 0.53) / 0.66
            radial = math.sqrt((dx * dx) + (dy * dy))
            continent = 1.0 - radial
            continent += 0.19 * math.sin((wx * 4.6) + (wy * 2.3))
            continent += 0.14 * math.sin((wx * 2.1) - (wy * 3.9))
            continent += 0.11 * _fractal_noise(wx * 1.8, wy * 1.8, seed ^ 0x001F1F1F, 3)
            continent = _clamp(continent, -1.0, 1.0)

            macro = _fractal_noise(wx * 3.7, wy * 3.7, seed ^ 0x001A2B3C, 5)
            detail = _fractal_noise(wx * 8.8, wy * 8.8, seed ^ 0x004D5E6F, 4)
            ridge = 1.0 - abs(_fractal_noise(wx * 11.6, wy * 11.6, seed ^ 0x00778899, 3))

            height_value = 0.52
            height_value += continent * 0.33
            height_value += macro * 0.24
            height_value += detail * 0.13
            height_value += (ridge - 0.5) * 0.14
            height_value = _clamp(height_value, 0.0, 1.0)

            heights[(y * width) + x] = height_value

    return heights


def _build_slope_field(heights: Sequence[float], width: int, height: int) -> list[float]:
    slopes = [0.0] * (width * height)

    for y in range(height):
        for x in range(width):
            idx = (y * width) + x

            left = heights[idx - 1] if x > 0 else heights[idx]
            right = heights[idx + 1] if x < width - 1 else heights[idx]
            up = heights[idx - width] if y > 0 else heights[idx]
            down = heights[idx + width] if y < height - 1 else heights[idx]

            gx = right - left
            gy = down - up
            slopes[idx] = math.sqrt((gx * gx) + (gy * gy)) * 0.5

    return slopes


def _hillshade_factor(
    heights: Sequence[float],
    width: int,
    height: int,
    x: int,
    y: int,
    strength: float,
) -> float:
    idx = (y * width) + x

    left = heights[idx - 1] if x > 0 else heights[idx]
    right = heights[idx + 1] if x < width - 1 else heights[idx]
    up = heights[idx - width] if y > 0 else heights[idx]
    down = heights[idx + width] if y < height - 1 else heights[idx]

    gx = right - left
    gy = down - up

    nx = -gx * 2.6
    ny = -gy * 2.6
    nz = 1.0
    inv_len = 1.0 / math.sqrt((nx * nx) + (ny * ny) + (nz * nz))
    nx *= inv_len
    ny *= inv_len
    nz *= inv_len

    lx, ly, lz = -0.58, -0.42, 0.69
    dot = _clamp((nx * lx) + (ny * ly) + (nz * lz), -1.0, 1.0)
    return _clamp(1.0 + (dot * strength), 0.75, 1.25)


def generate_terrain(config: TerrainConfig) -> TerrainResult:
    width = int(config.width)
    height = int(config.height)

    if width < 16 or height < 16:
        raise ValueError("Terrain dimensions are too small")

    target_land_fraction = _clamp(config.target_land_fraction, 0.05, 0.95)
    mountaintop_percentile = _clamp(config.mountaintop_percentile, 0.50, 0.999)
    mountain_slope_percentile = _clamp(config.mountain_slope_percentile, 0.50, 0.999)

    heights = _build_heightfield(config)
    slopes = _build_slope_field(heights, width, height)

    sea_level = _quantile(heights, 1.0 - target_land_fraction)
    mountaintop_level = _quantile(heights, mountaintop_percentile)

    land_slopes = [slopes[i] for i, h in enumerate(heights) if h >= sea_level]
    mountain_slope_level = _quantile(land_slopes, mountain_slope_percentile)

    pixels = bytearray(width * height * 3)

    water_count = 0
    plains_count = 0
    mountain_count = 0
    mountaintop_count = 0

    for y in range(height):
        row = y * width
        for x in range(width):
            idx = row + x
            h = heights[idx]

            if h < sea_level:
                color = WATER_BLUE
                water_count += 1
            else:
                if h >= mountaintop_level:
                    base = MOUNTAINTOP_WHITE
                    mountaintop_count += 1
                elif slopes[idx] >= mountain_slope_level:
                    base = MOUNTAIN_BROWN
                    mountain_count += 1
                else:
                    base = PLAINS_GREEN
                    plains_count += 1

                shade = _hillshade_factor(heights, width, height, x, y, config.hillshade_strength)
                color = _shade(base, shade)

            p = idx * 3
            pixels[p] = color[0]
            pixels[p + 1] = color[1]
            pixels[p + 2] = color[2]

    total = width * height
    actual_land = plains_count + mountain_count + mountaintop_count

    stats = TerrainStats(
        sea_level=sea_level,
        mountaintop_level=mountaintop_level,
        mountain_slope_level=mountain_slope_level,
        target_land_fraction=target_land_fraction,
        actual_land_fraction=actual_land / total,
        water_fraction=water_count / total,
        plains_fraction=plains_count / total,
        mountain_fraction=mountain_count / total,
        mountaintop_fraction=mountaintop_count / total,
    )

    return TerrainResult(width=width, height=height, pixels=bytes(pixels), stats=stats)


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", binascii.crc32(tag + data) & 0xFFFFFFFF)
    )


def save_png(path: Path, width: int, height: int, pixels: bytes) -> None:
    path = Path(path)
    if len(pixels) != width * height * 3:
        raise ValueError("Pixel byte length does not match width*height*3")

    rows = [pixels[y * width * 3 : (y + 1) * width * 3] for y in range(height)]
    raw = b"".join(b"\x00" + row for row in rows)
    compressed = zlib.compress(raw, level=9)

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n")
        fh.write(_png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)))
        fh.write(_png_chunk(b"IDAT", compressed))
        fh.write(_png_chunk(b"IEND", b""))
