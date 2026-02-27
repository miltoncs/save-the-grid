import {
  clamp,
  fractalNoise,
  lerp,
  quantileFromArray,
  randomSeed,
} from "../../tools/terrain/interactive/lib/math.js";

const COLORS = Object.freeze({
  water: [68, 134, 195],
  coastWater: [108, 173, 224],
  coastLand: [156, 170, 112],
  plains: [132, 190, 116],
  mountain: [204, 175, 136],
  mountaintop: [216, 218, 214],
});

function blurHeightField(source, width, height, passes) {
  let input = new Float32Array(source);
  let output = new Float32Array(source.length);

  for (let pass = 0; pass < passes; pass += 1) {
    for (let y = 0; y < height; y += 1) {
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(height - 1, y + 1);
      for (let x = 0; x < width; x += 1) {
        const x0 = Math.max(0, x - 1);
        const x1 = Math.min(width - 1, x + 1);
        let sum = 0;
        let count = 0;

        for (let yy = y0; yy <= y1; yy += 1) {
          const row = yy * width;
          for (let xx = x0; xx <= x1; xx += 1) {
            sum += input[row + xx];
            count += 1;
          }
        }

        output[(y * width) + x] = count > 0 ? sum / count : input[(y * width) + x];
      }
    }

    const next = input;
    input = output;
    output = next;
  }

  return input;
}

function normalizeHeightField(heights) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < heights.length; i += 1) {
    const value = heights[i];
    if (value < min) min = value;
    if (value > max) max = value;
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || Math.abs(max - min) < 1e-6) {
    return new Float32Array(heights.length).fill(0.5);
  }

  const range = max - min;
  const normalized = new Float32Array(heights.length);
  for (let i = 0; i < heights.length; i += 1) {
    normalized[i] = (heights[i] - min) / range;
  }
  return normalized;
}

function buildHeightField(width, height, seed, smoothness, continentScalePercent) {
  const smoothnessNorm = clamp(smoothness / 100, 0, 1);
  const continentScale = clamp(continentScalePercent / 100, 0.5, 2);
  const heights = new Float32Array(width * height);

  const warpStrength = lerp(0.12, 0.035, smoothnessNorm);
  const macroFreq = lerp(3.8, 2.1, smoothnessNorm);
  const detailFreq = lerp(9.8, 4.4, smoothnessNorm);
  const ridgeFreq = lerp(12.4, 6.2, smoothnessNorm);
  const detailWeight = lerp(0.15, 0.06, smoothnessNorm);
  const ridgeWeight = lerp(0.16, 0.09, smoothnessNorm);

  for (let y = 0; y < height; y += 1) {
    const ny = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const nx = x / Math.max(1, width - 1);

      const warpX =
        warpStrength * fractalNoise((nx * 2.1) + 5.17, (ny * 2.1) - 3.47, seed ^ 0x0f0f0f0f, 4);
      const warpY =
        warpStrength * fractalNoise((nx * 2.2) - 8.91, (ny * 2.0) + 6.13, seed ^ 0xabcdef01, 4);

      const wx = nx + warpX;
      const wy = ny + warpY;
      const lowWx = ((wx - 0.52) * continentScale) + 0.52;
      const lowWy = ((wy - 0.53) * continentScale) + 0.53;

      const dx = (lowWx - 0.52) / 0.8;
      const dy = (lowWy - 0.53) / 0.66;
      const radial = Math.sqrt((dx * dx) + (dy * dy));

      let continent = 1 - radial;
      continent += 0.19 * Math.sin((lowWx * 4.6) + (lowWy * 2.3));
      continent += 0.14 * Math.sin((lowWx * 2.1) - (lowWy * 3.9));
      continent += 0.11 * fractalNoise(lowWx * 1.8, lowWy * 1.8, seed ^ 0x001f1f1f, 3);
      continent = clamp(continent, -1, 1);

      const macro = fractalNoise(lowWx * macroFreq, lowWy * macroFreq, seed ^ 0x001a2b3c, 5);
      const detail = fractalNoise(wx * detailFreq, wy * detailFreq, seed ^ 0x004d5e6f, 4);
      const ridge = 1 - Math.abs(fractalNoise(wx * ridgeFreq, wy * ridgeFreq, seed ^ 0x00778899, 3));

      let value = 0.52;
      value += continent * 0.33;
      value += macro * 0.24;
      value += detail * detailWeight;
      value += (ridge - 0.5) * ridgeWeight;

      heights[(y * width) + x] = value;
    }
  }

  const blurPasses = Math.round(lerp(0, 4, smoothnessNorm));
  const filtered = blurPasses > 0 ? blurHeightField(heights, width, height, blurPasses) : heights;
  return normalizeHeightField(filtered);
}

function buildSlopeField(heights, width, height) {
  const slopes = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width) + x;
      const left = heights[x > 0 ? idx - 1 : idx];
      const right = heights[x < width - 1 ? idx + 1 : idx];
      const up = heights[y > 0 ? idx - width : idx];
      const down = heights[y < height - 1 ? idx + width : idx];
      const gx = right - left;
      const gy = down - up;
      slopes[idx] = Math.sqrt((gx * gx) + (gy * gy)) * 0.5;
    }
  }
  return slopes;
}

function colorizeTerrain(heights, slopes, width, height, smoothnessNorm, seaLevelPercent, snowcapsPercent) {
  const seaLevel = quantileFromArray(heights, clamp(seaLevelPercent / 100, 0.05, 0.95));
  const snowcapsFraction = clamp(snowcapsPercent / 100, 0.01, 0.25);
  const mountaintopLevel = quantileFromArray(heights, clamp(1 - snowcapsFraction, 0.75, 0.99));

  const landSlopes = new Float32Array(heights.length);
  let landCursor = 0;
  for (let i = 0; i < heights.length; i += 1) {
    if (heights[i] >= seaLevel) {
      landSlopes[landCursor] = slopes[i];
      landCursor += 1;
    }
  }

  const slopeQuantile = lerp(0.9, 0.82, smoothnessNorm);
  const mountainSlopeLevel = quantileFromArray(landSlopes.subarray(0, landCursor), slopeQuantile);
  const terrainMask = new Uint8Array(width * height);
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width) + x;
      const p = idx * 4;
      const h = heights[idx];

      if (h < seaLevel) {
        pixels[p] = COLORS.water[0];
        pixels[p + 1] = COLORS.water[1];
        pixels[p + 2] = COLORS.water[2];
        pixels[p + 3] = 255;
        terrainMask[idx] = 0;
        continue;
      }

      terrainMask[idx] = 1;
      let color = COLORS.plains;
      if (h >= mountaintopLevel) {
        color = COLORS.mountaintop;
      } else if (slopes[idx] >= mountainSlopeLevel) {
        color = COLORS.mountain;
      }

      pixels[p] = color[0];
      pixels[p + 1] = color[1];
      pixels[p + 2] = color[2];
      pixels[p + 3] = 255;
    }
  }

  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width) + x;
      const isLand = terrainMask[idx] === 1;
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(width - 1, x + 1);
      let adjacentToOpposite = false;

      for (let yy = y0; yy <= y1 && !adjacentToOpposite; yy += 1) {
        const row = yy * width;
        for (let xx = x0; xx <= x1; xx += 1) {
          if (xx === x && yy === y) continue;
          const neighborLand = terrainMask[row + xx] === 1;
          if (neighborLand !== isLand) {
            adjacentToOpposite = true;
            break;
          }
        }
      }

      if (!adjacentToOpposite) continue;
      const p = idx * 4;
      const coastColor = isLand ? COLORS.coastLand : COLORS.coastWater;
      pixels[p] = coastColor[0];
      pixels[p + 1] = coastColor[1];
      pixels[p + 2] = coastColor[2];
    }
  }

  return pixels;
}

export function generateMenuTerrainPreviewDataUrl(options = {}) {
  const width = clamp(Math.round(Number(options.width) || 480), 128, 2048);
  const height = clamp(Math.round(Number(options.height) || 760), 128, 2048);
  const seed = Number.isFinite(Number(options.seed)) ? (Number(options.seed) >>> 0) : randomSeed();
  const smoothness = clamp(Number(options.smoothness) || 72, 1, 100);
  const continentScalePercent = clamp(Number(options.continentScalePercent) || 112, 50, 200);
  const seaLevelPercent = clamp(Number(options.seaLevelPercent) || 56, 10, 90);
  const snowcapsPercent = clamp(Number(options.snowcapsPercent) || 8, 1, 25);

  const heights = buildHeightField(width, height, seed, smoothness, continentScalePercent);
  const slopes = buildSlopeField(heights, width, height);
  const smoothnessNorm = clamp(smoothness / 100, 0, 1);
  const pixels = colorizeTerrain(
    heights,
    slopes,
    width,
    height,
    smoothnessNorm,
    seaLevelPercent,
    snowcapsPercent
  );

  const raster = document.createElement("canvas");
  raster.width = width;
  raster.height = height;

  const context = raster.getContext("2d", { alpha: false });
  if (!context) {
    return {
      dataUrl: "",
      seed,
    };
  }

  const image = new ImageData(pixels, width, height);
  context.putImageData(image, 0, 0);

  return {
    dataUrl: raster.toDataURL("image/png"),
    seed,
  };
}
