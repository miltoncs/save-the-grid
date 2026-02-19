const canvas = document.getElementById("terrain-canvas");
const ctx = canvas.getContext("2d", { alpha: false });

const regenerateBtn = document.getElementById("regenerate-btn");
const smoothnessSlider = document.getElementById("smoothness-slider");
const seaLevelSlider = document.getElementById("sea-level-slider");
const smoothnessValue = document.getElementById("smoothness-value");
const seaLevelValue = document.getElementById("sea-level-value");
const seedValue = document.getElementById("seed-value");
const statsValue = document.getElementById("stats-value");

const COLORS = {
  water: [68, 134, 195],
  plains: [132, 190, 116],
  mountain: [204, 175, 136],
  mountaintop: [246, 246, 244],
};

const state = {
  seed: randomSeed(),
  renderToken: 0,
  lastRaster: null,
};

let resizeTimer = 0;
let sliderTimer = 0;

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep01(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - (2 * x));
}

function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

function hash2(ix, iy, seed) {
  let n =
    (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 73856093)) >>> 0;
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4294967295;
}

function valueNoise(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const sx = smoothstep01(fx);
  const sy = smoothstep01(fy);

  const v00 = hash2(ix, iy, seed);
  const v10 = hash2(ix + 1, iy, seed);
  const v01 = hash2(ix, iy + 1, seed);
  const v11 = hash2(ix + 1, iy + 1, seed);

  const i0 = lerp(v00, v10, sx);
  const i1 = lerp(v01, v11, sx);
  return (lerp(i0, i1, sy) * 2) - 1;
}

function fractalNoise(x, y, seed, octaves = 5, lacunarity = 2.02, gain = 0.5) {
  let amplitude = 1;
  let frequency = 1;
  let value = 0;
  let normalizer = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    const octaveSeed = (seed + (octave * 911)) >>> 0;
    value += amplitude * valueNoise(x * frequency, y * frequency, octaveSeed);
    normalizer += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return normalizer > 0 ? value / normalizer : 0;
}

function quantileFromArray(values, q) {
  if (!values.length) return 0;
  const clampedQ = clamp(q, 0, 1);
  const sorted = new Float32Array(values.length);
  sorted.set(values);
  sorted.sort();

  if (sorted.length === 1) return sorted[0];

  const pos = clampedQ * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];

  const t = pos - lo;
  return lerp(sorted[lo], sorted[hi], t);
}

function blurHeightField(source, width, height, passes) {
  let field = source;

  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(field.length);

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
            sum += field[row + xx];
            count += 1;
          }
        }

        next[(y * width) + x] = sum / count;
      }
    }

    field = next;
  }

  return field;
}

function buildHeightField(width, height, seed, smoothness) {
  const smoothnessNorm = clamp(smoothness / 100, 0, 1);
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

      const dx = (wx - 0.52) / 0.8;
      const dy = (wy - 0.53) / 0.66;
      const radial = Math.sqrt((dx * dx) + (dy * dy));

      let continent = 1 - radial;
      continent += 0.19 * Math.sin((wx * 4.6) + (wy * 2.3));
      continent += 0.14 * Math.sin((wx * 2.1) - (wy * 3.9));
      continent += 0.11 * fractalNoise(wx * 1.8, wy * 1.8, seed ^ 0x001f1f1f, 3);
      continent = clamp(continent, -1, 1);

      const macro = fractalNoise(wx * macroFreq, wy * macroFreq, seed ^ 0x001a2b3c, 5);
      const detail = fractalNoise(wx * detailFreq, wy * detailFreq, seed ^ 0x004d5e6f, 4);
      const ridge = 1 - Math.abs(fractalNoise(wx * ridgeFreq, wy * ridgeFreq, seed ^ 0x00778899, 3));

      let value = 0.52;
      value += continent * 0.33;
      value += macro * 0.24;
      value += detail * detailWeight;
      value += (ridge - 0.5) * ridgeWeight;

      heights[(y * width) + x] = clamp(value, 0, 1);
    }
  }

  const blurPasses = Math.round(lerp(0, 4, smoothnessNorm));
  if (blurPasses > 0) {
    return blurHeightField(heights, width, height, blurPasses);
  }

  return heights;
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

function hillshadeFactor(heights, width, height, x, y, strength) {
  const idx = (y * width) + x;

  const left = heights[x > 0 ? idx - 1 : idx];
  const right = heights[x < width - 1 ? idx + 1 : idx];
  const up = heights[y > 0 ? idx - width : idx];
  const down = heights[y < height - 1 ? idx + width : idx];

  const gx = right - left;
  const gy = down - up;

  let nx = -gx * 2.6;
  let ny = -gy * 2.6;
  let nz = 1;
  const invLen = 1 / Math.sqrt((nx * nx) + (ny * ny) + (nz * nz));
  nx *= invLen;
  ny *= invLen;
  nz *= invLen;

  const lx = -0.58;
  const ly = -0.42;
  const lz = 0.69;
  const dot = clamp((nx * lx) + (ny * ly) + (nz * lz), -1, 1);
  return clamp(1 + (dot * strength), 0.75, 1.25);
}

function pickRasterSize(viewWidth, viewHeight) {
  const maxPixels = 520000;
  const current = viewWidth * viewHeight;
  const scale = Math.min(1, Math.sqrt(maxPixels / Math.max(1, current)));
  return {
    width: Math.max(360, Math.round(viewWidth * scale)),
    height: Math.max(220, Math.round(viewHeight * scale)),
  };
}

function updateLabels() {
  smoothnessValue.textContent = `${smoothnessSlider.value}`;
  seaLevelValue.textContent = `${seaLevelSlider.value}%`;
  seedValue.textContent = `Seed ${state.seed}`;
}

function updateStats(stats) {
  const landPct = Math.round(stats.landFraction * 100);
  const mountainPct = Math.round(stats.mountainFraction * 100);
  const topPct = Math.round(stats.mountaintopFraction * 100);
  statsValue.textContent = `Land ${landPct}% | Mountain ${mountainPct}% | Tops ${topPct}%`;
}

function setStatus(text) {
  statsValue.textContent = text;
}

function buildTerrainImage(width, height, seed, smoothness, seaLevelPercent) {
  const smoothnessNorm = clamp(smoothness / 100, 0, 1);
  const seaQuantile = clamp(seaLevelPercent / 100, 0.05, 0.95);

  const heights = buildHeightField(width, height, seed, smoothness);
  const slopes = buildSlopeField(heights, width, height);

  const seaLevel = quantileFromArray(heights, seaQuantile);
  const mountaintopLevel = quantileFromArray(heights, 0.95);

  let landCount = 0;
  for (let i = 0; i < heights.length; i += 1) {
    if (heights[i] >= seaLevel) landCount += 1;
  }

  const landSlopes = new Float32Array(Math.max(landCount, 1));
  let cursor = 0;
  for (let i = 0; i < heights.length; i += 1) {
    if (heights[i] >= seaLevel) {
      landSlopes[cursor] = slopes[i];
      cursor += 1;
    }
  }

  const slopeQuantile = lerp(0.9, 0.82, smoothnessNorm);
  const mountainSlopeLevel = quantileFromArray(landSlopes.subarray(0, cursor), slopeQuantile);

  const imageData = new ImageData(width, height);
  const pixels = imageData.data;

  let waterCount = 0;
  let plainsCount = 0;
  let mountainCount = 0;
  let mountaintopCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width) + x;
      const h = heights[idx];

      let r;
      let g;
      let b;

      if (h < seaLevel) {
        [r, g, b] = COLORS.water;
        waterCount += 1;
      } else {
        let baseColor;
        if (h >= mountaintopLevel) {
          baseColor = COLORS.mountaintop;
          mountaintopCount += 1;
        } else if (slopes[idx] >= mountainSlopeLevel) {
          baseColor = COLORS.mountain;
          mountainCount += 1;
        } else {
          baseColor = COLORS.plains;
          plainsCount += 1;
        }

        const shade = hillshadeFactor(heights, width, height, x, y, 0.22);
        r = clamp(baseColor[0] * shade, 0, 255);
        g = clamp(baseColor[1] * shade, 0, 255);
        b = clamp(baseColor[2] * shade, 0, 255);
      }

      const p = idx * 4;
      pixels[p] = r;
      pixels[p + 1] = g;
      pixels[p + 2] = b;
      pixels[p + 3] = 255;
    }
  }

  return {
    imageData,
    stats: {
      landFraction: (plainsCount + mountainCount + mountaintopCount) / (width * height),
      waterFraction: waterCount / (width * height),
      mountainFraction: mountainCount / (width * height),
      mountaintopFraction: mountaintopCount / (width * height),
    },
  };
}

function resizeCanvas() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (state.lastRaster) {
    ctx.drawImage(state.lastRaster, 0, 0, width, height);
  }
}

async function renderTerrain({ newSeed = false } = {}) {
  const renderToken = ++state.renderToken;

  if (newSeed) {
    state.seed = randomSeed();
  }
  updateLabels();

  setStatus("Generating...");
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const { width: rasterWidth, height: rasterHeight } = pickRasterSize(
    window.innerWidth,
    window.innerHeight
  );

  const smoothness = Number(smoothnessSlider.value);
  const seaLevel = Number(seaLevelSlider.value);

  const output = buildTerrainImage(rasterWidth, rasterHeight, state.seed, smoothness, seaLevel);

  if (renderToken !== state.renderToken) {
    return;
  }

  const raster = document.createElement("canvas");
  raster.width = rasterWidth;
  raster.height = rasterHeight;
  raster.getContext("2d").putImageData(output.imageData, 0, 0);

  state.lastRaster = raster;

  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.drawImage(raster, 0, 0, window.innerWidth, window.innerHeight);

  updateStats(output.stats);
}

function scheduleRegenerate(delayMs = 140) {
  window.clearTimeout(sliderTimer);
  sliderTimer = window.setTimeout(() => {
    renderTerrain({ newSeed: false });
  }, delayMs);
}

regenerateBtn.addEventListener("click", () => {
  renderTerrain({ newSeed: true });
});

smoothnessSlider.addEventListener("input", () => {
  updateLabels();
  scheduleRegenerate();
});

seaLevelSlider.addEventListener("input", () => {
  updateLabels();
  scheduleRegenerate();
});

window.addEventListener("resize", () => {
  resizeCanvas();
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => renderTerrain({ newSeed: false }), 180);
});

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyR") {
    event.preventDefault();
    renderTerrain({ newSeed: true });
  }
});

resizeCanvas();
updateLabels();
renderTerrain({ newSeed: false });
