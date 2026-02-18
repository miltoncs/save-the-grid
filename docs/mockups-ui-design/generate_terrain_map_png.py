#!/usr/bin/env python3
import binascii
import math
import struct
import zlib
from pathlib import Path

WIDTH = 1800
HEIGHT = 1080

WATER_DEEP = (61, 128, 182)
WATER_SHALLOW = (98, 166, 214)
FERTILE = (177, 207, 133)
STEPPE = (198, 188, 146)
DRY = (181, 161, 119)
DESERT = (226, 206, 165)
ICE = (246, 246, 243)
RIDGE = (241, 238, 225)


def clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def mix(c1, c2, t):
    return (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
    )


def smoothstep(edge0, edge1, x):
    if edge0 == edge1:
        return 0.0
    t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def terrain_noise(x, y):
    n = 0.0
    n += 0.44 * math.sin(x * 0.013 + y * 0.011)
    n += 0.27 * math.sin(x * 0.028 - y * 0.021)
    n += 0.17 * math.sin((x + y) * 0.008)
    n += 0.12 * math.sin(x * 0.062 + y * 0.055)
    return n


def ellipse_field(nx, ny, cx, cy, rx, ry):
    return 1.0 - (((nx - cx) / rx) ** 2 + ((ny - cy) / ry) ** 2)


def land_field(nx, ny):
    # Broad Asia-like mass (mainland + peninsulas).
    positive = max(
        ellipse_field(nx, ny, 0.35, 0.19, 0.56, 0.22),  # north belt
        ellipse_field(nx, ny, 0.39, 0.31, 0.48, 0.25),  # central body
        ellipse_field(nx, ny, 0.50, 0.43, 0.30, 0.22),  # east/south-central
        ellipse_field(nx, ny, 0.24, 0.61, 0.15, 0.22),  # indian peninsula
        ellipse_field(nx, ny, 0.46, 0.62, 0.13, 0.18),  # indochina
        ellipse_field(nx, ny, 0.50, 0.76, 0.05, 0.16),  # malay extension
        ellipse_field(nx, ny, 0.66, 0.39, 0.05, 0.09),  # korea
    )

    # Carve major seas and bays.
    carve = max(
        ellipse_field(nx, ny, 0.33, 0.61, 0.17, 0.20),  # bay of bengal
        ellipse_field(nx, ny, 0.60, 0.61, 0.19, 0.16),  # south china sea
        ellipse_field(nx, ny, 0.71, 0.44, 0.12, 0.10),  # east china sea
        ellipse_field(nx, ny, 0.54, 0.70, 0.08, 0.08),  # gulf of thailand
    )

    # Keep western side more continental to imply off-canvas continuation.
    west_anchor = 0.26 * smoothstep(-0.06, 0.12, 0.12 - nx)

    coast_warp = 0.06 * terrain_noise(nx * WIDTH * 0.55, ny * HEIGHT * 0.55)
    coast_warp += 0.03 * math.sin((nx * 16.0) + (ny * 7.0))
    return positive - (0.92 * max(0.0, carve)) + west_anchor + coast_warp


def island_field(nx, ny):
    # Japan arc, Taiwan, Philippines, Borneo/Sumatra/Java and nearby groups.
    islands = [
        (0.77, 0.36, 0.05, 0.03),
        (0.81, 0.32, 0.05, 0.03),
        (0.86, 0.30, 0.04, 0.03),
        (0.85, 0.34, 0.03, 0.02),
        (0.72, 0.45, 0.015, 0.024),
        (0.79, 0.58, 0.04, 0.055),
        (0.84, 0.63, 0.03, 0.045),
        (0.87, 0.69, 0.026, 0.042),
        (0.64, 0.70, 0.075, 0.055),  # borneo
        (0.56, 0.78, 0.10, 0.032),   # sumatra chain
        (0.68, 0.79, 0.07, 0.018),   # java chain
        (0.47, 0.69, 0.01, 0.025),   # andaman-like
        (0.24, 0.73, 0.02, 0.035),   # sri lanka-like
    ]
    best = -1.0
    for cx, cy, rx, ry in islands:
        f = ellipse_field(nx, ny, cx, cy, rx, ry)
        if f > best:
            best = f

    jitter = 0.055 * terrain_noise(nx * WIDTH * 0.9, ny * HEIGHT * 0.9)
    return best + jitter


def mountain_elevation(nx, ny):
    # Tibetan plateau + Himalaya sweep + southeast ranges.
    plateau = math.exp(-(((nx - 0.35) / 0.22) ** 2 + ((ny - 0.26) / 0.10) ** 2))
    him_line = 0.33 + 0.028 * math.sin((nx * 8.4) - 0.9)
    him_band = math.exp(-((ny - him_line) / 0.043) ** 2) * smoothstep(0.05, 0.70, nx)
    se_asia = math.exp(-(((nx - 0.55) / 0.18) ** 2 + ((ny - 0.52) / 0.16) ** 2))
    japan_ridge = math.exp(-(((nx - 0.82) / 0.10) ** 2 + ((ny - 0.35) / 0.07) ** 2))
    inland = math.exp(-(((nx - 0.45) / 0.28) ** 2 + ((ny - 0.42) / 0.22) ** 2))
    elev = 0.53 * plateau + 0.55 * him_band + 0.28 * se_asia + 0.16 * japan_ridge + 0.20 * inland
    elev += 0.12 * terrain_noise(nx * WIDTH * 0.7, ny * HEIGHT * 0.7)
    return clamp(elev, 0.0, 1.0)


def dryness_field(nx, ny):
    # Drier in northwest and continental interior.
    dry = 0.52 * (1.0 - nx) + 0.30 * (1.0 - ny)
    dry += 0.21 * math.exp(-(((nx - 0.17) / 0.28) ** 2 + ((ny - 0.23) / 0.14) ** 2))
    dry += 0.14 * math.exp(-(((nx - 0.26) / 0.20) ** 2 + ((ny - 0.40) / 0.18) ** 2))
    dry += 0.10 * terrain_noise(nx * WIDTH * 0.5, ny * HEIGHT * 0.5)
    return clamp(dry, 0.0, 1.0)


def write_pixel(buf, x, y, color):
    i = (y * WIDTH + x) * 3
    buf[i] = color[0]
    buf[i + 1] = color[1]
    buf[i + 2] = color[2]


def blend_pixel(buf, x, y, color, alpha):
    i = (y * WIDTH + x) * 3
    inv = 1.0 - alpha
    buf[i] = int(buf[i] * inv + color[0] * alpha)
    buf[i + 1] = int(buf[i + 1] * inv + color[1] * alpha)
    buf[i + 2] = int(buf[i + 2] * inv + color[2] * alpha)


def png_chunk(tag, data):
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", binascii.crc32(tag + data) & 0xFFFFFFFF)
    )


def save_png(path, rows):
    raw = b"".join(b"\x00" + row for row in rows)
    compressed = zlib.compress(raw, level=9)
    with path.open("wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(png_chunk(b"IHDR", struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 2, 0, 0, 0)))
        f.write(png_chunk(b"IDAT", compressed))
        f.write(png_chunk(b"IEND", b""))


def main():
    pixels = bytearray(WIDTH * HEIGHT * 3)
    land_mask = bytearray(WIDTH * HEIGHT)

    # Build land mask first for better coastline shading and no UI/map markers.
    for y in range(HEIGHT):
        ny = y / HEIGHT
        for x in range(WIDTH):
            nx = x / WIDTH
            idx = y * WIDTH + x
            mainland = land_field(nx, ny)
            island = island_field(nx, ny)
            if mainland > 0.02 or island > 0.11:
                land_mask[idx] = 1

    # Coast proximity map for shallow water glow.
    coast = bytearray(WIDTH * HEIGHT)
    radius = 5
    offsets = []
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            d = math.hypot(dx, dy)
            if d <= radius:
                v = int(255 * (1.0 - d / radius))
                offsets.append((dx, dy, v))

    for y in range(HEIGHT):
        row = y * WIDTH
        for x in range(WIDTH):
            i = row + x
            if land_mask[i] == 0:
                continue
            for dx, dy, v in offsets:
                xx = x + dx
                yy = y + dy
                if xx < 0 or xx >= WIDTH or yy < 0 or yy >= HEIGHT:
                    continue
                j = yy * WIDTH + xx
                if land_mask[j] == 0 and v > coast[j]:
                    coast[j] = v

    # Paint water + land with relief and biome palette.
    for y in range(HEIGHT):
        ny = y / HEIGHT
        sea_band = 0.91 + 0.19 * (1.0 - ny)
        for x in range(WIDTH):
            nx = x / WIDTH
            idx = y * WIDTH + x

            if land_mask[idx] == 0:
                wave = 0.06 * terrain_noise(x * 0.7, y * 0.7)
                base = (
                    clamp(int(WATER_DEEP[0] * (sea_band + wave)), 0, 255),
                    clamp(int(WATER_DEEP[1] * (sea_band + wave)), 0, 255),
                    clamp(int(WATER_DEEP[2] * (sea_band + wave)), 0, 255),
                )
                shallow = coast[idx] / 255.0
                color = mix(base, WATER_SHALLOW, shallow * 0.70)
                write_pixel(pixels, x, y, color)
                continue

            elev = mountain_elevation(nx, ny)
            dry = dryness_field(nx, ny)
            tropical = smoothstep(0.52, 0.86, ny) * smoothstep(0.28, 0.62, nx)
            dry -= 0.13 * tropical
            dry = clamp(dry, 0.0, 1.0)

            if elev > 0.81:
                color = ICE
            elif elev > 0.69:
                color = mix(STEPPE, ICE, (elev - 0.69) / 0.12)
            elif dry > 0.76:
                color = DESERT
            elif dry > 0.58:
                color = DRY
            elif dry > 0.44:
                color = STEPPE
            else:
                color = FERTILE

            shade = 0.90 + (elev * 0.26) + (0.05 * terrain_noise(x * 1.1, y * 1.1))
            color = (
                clamp(int(color[0] * shade), 0, 255),
                clamp(int(color[1] * shade), 0, 255),
                clamp(int(color[2] * shade), 0, 255),
            )
            write_pixel(pixels, x, y, color)

            # Mountain streak texture similar to relief map shading.
            if elev > 0.35:
                orient = (x * 0.12) + (y * 0.043) + (terrain_noise(x * 0.8, y * 0.8) * 3.8)
                stripe = abs(math.sin(orient))
                ridge_alpha = ((elev - 0.35) / 0.65) * (stripe ** 16) * 0.86
                ridge_alpha = clamp(ridge_alpha, 0.0, 0.62)
                if ridge_alpha > 0.01:
                    blend_pixel(pixels, x, y, RIDGE, ridge_alpha)

            # Warm coastal fringe.
            edge = False
            if x > 0 and land_mask[idx - 1] == 0:
                edge = True
            elif x < WIDTH - 1 and land_mask[idx + 1] == 0:
                edge = True
            elif y > 0 and land_mask[idx - WIDTH] == 0:
                edge = True
            elif y < HEIGHT - 1 and land_mask[idx + WIDTH] == 0:
                edge = True
            if edge:
                blend_pixel(pixels, x, y, DESERT, 0.24)

    # Soft atmospheric haze toward the north and open ocean.
    for y in range(HEIGHT):
        fog = clamp((225 - y) / 260.0, 0.0, 1.0) * 0.16
        if fog <= 0:
            continue
        for x in range(WIDTH):
            blend_pixel(pixels, x, y, (210, 229, 244), fog)

    rows = [bytes(pixels[y * WIDTH * 3 : (y + 1) * WIDTH * 3]) for y in range(HEIGHT)]
    out_path = Path("docs/mockups-ui-design/mockup-terrain-map.png")
    save_png(out_path, rows)
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
