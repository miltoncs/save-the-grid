const canvas = document.getElementById("terrain-canvas");
const ctx = canvas.getContext("2d", { alpha: false });

const regenerateBtn = document.getElementById("regenerate-btn");
const algorithmValue = document.getElementById("algorithm-value");
const algorithmButtons = Array.from(document.querySelectorAll(".algo-btn"));
const smoothnessSlider = document.getElementById("smoothness-slider");
const seaLevelSlider = document.getElementById("sea-level-slider");
const mountaintopSlider = document.getElementById("mountaintop-slider");
const riversDecBtn = document.getElementById("rivers-dec-btn");
const riversIncBtn = document.getElementById("rivers-inc-btn");
const riversCountValue = document.getElementById("rivers-count-value");
const riverForkSlider = document.getElementById("river-fork-slider");
const resetRiversBtn = document.getElementById("reset-rivers-btn");
const smoothnessValue = document.getElementById("smoothness-value");
const seaLevelValue = document.getElementById("sea-level-value");
const mountaintopValue = document.getElementById("mountaintop-value");
const riverForkValue = document.getElementById("river-fork-value");
const seedValue = document.getElementById("seed-value");
const statsValue = document.getElementById("stats-value");

const COLORS = {
  water: [68, 134, 195],
  river: [84, 158, 222],
  plains: [132, 190, 116],
  mountain: [204, 175, 136],
  mountaintop: [246, 246, 244],
};

const RIVER_COUNT_MIN = 0;
const RIVER_COUNT_MAX = 24;
const RIVER_DEFAULT_COUNT = clamp(Number(riversCountValue.textContent) || 6, RIVER_COUNT_MIN, RIVER_COUNT_MAX);
const RIVER_DEFAULT_FORK = clamp(Number(riverForkSlider.value) || 24, 0, 100);
const RIVER_WIDTH_PX = 3;
const RIVER_ANIMATION_MS = 950;

const state = {
  seed: randomSeed(),
  riverSeed: randomSeed(),
  algorithm: "topology",
  riverCount: RIVER_DEFAULT_COUNT,
  renderToken: 0,
  animationFrameId: 0,
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

function createMulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = Math.imul(value ^ (value >>> 15), value | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

function buildHeightFieldTopology(width, height, seed, smoothness) {
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

function buildHeightFieldMidpoint(width, height, seed, smoothness) {
  const smoothnessNorm = clamp(smoothness / 100, 0, 1);
  const maxDim = Math.max(width, height);
  let side = 1;
  while (side < maxDim - 1) {
    side *= 2;
  }
  side += 1;

  const grid = new Float32Array(side * side);
  const rand = createMulberry32(seed);
  const index = (x, y) => (y * side) + x;
  const randomSigned = () => (rand() * 2) - 1;

  grid[index(0, 0)] = rand();
  grid[index(side - 1, 0)] = rand();
  grid[index(0, side - 1)] = rand();
  grid[index(side - 1, side - 1)] = rand();

  let step = side - 1;
  let amplitude = lerp(0.95, 0.48, smoothnessNorm);
  const roughness = lerp(0.78, 0.5, smoothnessNorm);

  while (step > 1) {
    const half = step / 2;

    // Diamond step.
    for (let y = half; y < side - 1; y += step) {
      for (let x = half; x < side - 1; x += step) {
        const a = grid[index(x - half, y - half)];
        const b = grid[index(x + half, y - half)];
        const c = grid[index(x - half, y + half)];
        const d = grid[index(x + half, y + half)];
        const avg = (a + b + c + d) * 0.25;
        grid[index(x, y)] = clamp(avg + (randomSigned() * amplitude), 0, 1);
      }
    }

    // Square step.
    for (let y = 0; y < side; y += half) {
      for (let x = (y + half) % step; x < side; x += step) {
        let sum = 0;
        let count = 0;

        if (x - half >= 0) {
          sum += grid[index(x - half, y)];
          count += 1;
        }
        if (x + half < side) {
          sum += grid[index(x + half, y)];
          count += 1;
        }
        if (y - half >= 0) {
          sum += grid[index(x, y - half)];
          count += 1;
        }
        if (y + half < side) {
          sum += grid[index(x, y + half)];
          count += 1;
        }

        const avg = count > 0 ? sum / count : 0.5;
        grid[index(x, y)] = clamp(avg + (randomSigned() * amplitude), 0, 1);
      }
    }

    step = half;
    amplitude *= roughness;
  }

  // Bilinear sample to requested raster size.
  const heights = new Float32Array(width * height);
  const maxSrc = side - 1;
  for (let y = 0; y < height; y += 1) {
    const v = (y / Math.max(1, height - 1)) * maxSrc;
    const y0 = Math.floor(v);
    const y1 = Math.min(maxSrc, y0 + 1);
    const ty = v - y0;

    for (let x = 0; x < width; x += 1) {
      const u = (x / Math.max(1, width - 1)) * maxSrc;
      const x0 = Math.floor(u);
      const x1 = Math.min(maxSrc, x0 + 1);
      const tx = u - x0;

      const p00 = grid[index(x0, y0)];
      const p10 = grid[index(x1, y0)];
      const p01 = grid[index(x0, y1)];
      const p11 = grid[index(x1, y1)];
      const i0 = lerp(p00, p10, tx);
      const i1 = lerp(p01, p11, tx);
      heights[(y * width) + x] = lerp(i0, i1, ty);
    }
  }

  const blurPasses = Math.round(lerp(0, 5, smoothnessNorm));
  return blurPasses > 0 ? blurHeightField(heights, width, height, blurPasses) : heights;
}

function buildHeightField(width, height, seed, smoothness, algorithm) {
  if (algorithm === "midpoint") {
    return buildHeightFieldMidpoint(width, height, seed, smoothness);
  }
  return buildHeightFieldTopology(width, height, seed, smoothness);
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

function findNeighborFlowTargets(
  heights,
  width,
  height,
  x,
  y,
  currentHeight,
  visitStamp,
  branchId
) {
  let lowerCount = 0;
  let lowestIdx = -1;
  let secondLowestIdx = -1;
  let lowestHeight = Infinity;
  let secondLowestHeight = Infinity;
  let lowestAnyIdx = -1;
  let secondLowestAnyIdx = -1;
  let lowestAnyHeight = Infinity;
  let secondLowestAnyHeight = Infinity;

  const y0 = Math.max(0, y - 1);
  const y1 = Math.min(height - 1, y + 1);
  const x0 = Math.max(0, x - 1);
  const x1 = Math.min(width - 1, x + 1);

  for (let yy = y0; yy <= y1; yy += 1) {
    const row = yy * width;
    for (let xx = x0; xx <= x1; xx += 1) {
      if (xx === x && yy === y) continue;

      const idx = row + xx;
      const neighborHeight = heights[idx];
      if (visitStamp && visitStamp[idx] === branchId) continue;

      if (neighborHeight < lowestAnyHeight) {
        secondLowestAnyHeight = lowestAnyHeight;
        secondLowestAnyIdx = lowestAnyIdx;
        lowestAnyHeight = neighborHeight;
        lowestAnyIdx = idx;
      } else if (neighborHeight < secondLowestAnyHeight) {
        secondLowestAnyHeight = neighborHeight;
        secondLowestAnyIdx = idx;
      }

      if (neighborHeight >= currentHeight - 1e-6) continue;

      lowerCount += 1;
      if (neighborHeight < lowestHeight) {
        secondLowestHeight = lowestHeight;
        secondLowestIdx = lowestIdx;
        lowestHeight = neighborHeight;
        lowestIdx = idx;
      } else if (neighborHeight < secondLowestHeight) {
        secondLowestHeight = neighborHeight;
        secondLowestIdx = idx;
      }
    }
  }

  return {
    lowerCount,
    lowestIdx,
    secondLowestIdx,
    lowestAnyIdx,
    secondLowestAnyIdx,
  };
}

function hasNearbySource(sourceMask, width, height, x, y, minDistance) {
  const radius = Math.max(1, Math.round(minDistance));
  const radiusSq = radius * radius;
  const y0 = Math.max(0, y - radius);
  const y1 = Math.min(height - 1, y + radius);
  const x0 = Math.max(0, x - radius);
  const x1 = Math.min(width - 1, x + radius);

  for (let yy = y0; yy <= y1; yy += 1) {
    const row = yy * width;
    const dy = yy - y;
    for (let xx = x0; xx <= x1; xx += 1) {
      const dx = xx - x;
      if ((dx * dx) + (dy * dy) > radiusSq) continue;
      if (sourceMask[row + xx]) return true;
    }
  }

  return false;
}

function stampCircle(mask, width, height, cx, cy, radius, arrivalStepField, stepValue) {
  const y0 = Math.max(0, cy - radius);
  const y1 = Math.min(height - 1, cy + radius);
  const x0 = Math.max(0, cx - radius);
  const x1 = Math.min(width - 1, cx + radius);
  const radiusSq = radius * radius;

  for (let y = y0; y <= y1; y += 1) {
    const dy = y - cy;
    const row = y * width;
    for (let x = x0; x <= x1; x += 1) {
      const dx = x - cx;
      if ((dx * dx) + (dy * dy) <= radiusSq) {
        const idx = row + x;
        mask[idx] = 1;
        if (arrivalStepField && stepValue > 0) {
          const current = arrivalStepField[idx];
          if (current === 0 || stepValue < current) {
            arrivalStepField[idx] = stepValue;
          }
        }
      }
    }
  }
}

function buildRiverMask(
  heights,
  width,
  height,
  seaLevel,
  riverCount,
  riverForkChancePercent,
  riverSeed
) {
  const targetSources = Math.max(0, Math.round(riverCount));
  const riverMask = new Uint8Array(width * height);
  const riverArrivalStep = new Uint32Array(width * height);
  const mouthMask = new Uint8Array(width * height);

  if (targetSources === 0) {
    return {
      riverMask,
      riverArrivalStep,
      maxArrivalStep: 1,
      sourceCells: [],
      mouthCells: [],
      sourceCount: 0,
      riverPixels: 0,
    };
  }

  const forkChance = clamp(riverForkChancePercent / 100, 0, 1);
  const seedSalt =
    (riverSeed ^
      0x52f18e33 ^
      Math.imul(targetSources + 1, 2654435761) ^
      Math.imul(Math.round(forkChance * 1000) + 1, 1597334677)) >>> 0;
  const rand = createMulberry32(seedSalt);

  const sourceMask = new Uint8Array(width * height);
  const spineMask = new Uint8Array(width * height);
  const orderedSpineCells = [];
  const sources = [];

  const minSourceSpacing = Math.max(8, Math.round(Math.min(width, height) * 0.04));
  const maxSourceAttempts = Math.max(300, targetSources * 240);
  const sourceMinRise = 0.04;

  for (let attempt = 0; attempt < maxSourceAttempts && sources.length < targetSources; attempt += 1) {
    const x = Math.floor(rand() * width);
    const y = Math.floor(rand() * height);
    const idx = (y * width) + x;
    const h = heights[idx];
    const minRise = attempt < Math.floor(maxSourceAttempts * 0.7) ? sourceMinRise : 0;

    if (h <= seaLevel + minRise) continue;
    if (hasNearbySource(sourceMask, width, height, x, y, minSourceSpacing)) continue;

    const neighbors = findNeighborFlowTargets(heights, width, height, x, y, h);
    if (neighbors.lowerCount === 0 || neighbors.lowestIdx < 0) continue;

    sources.push(idx);
    sourceMask[idx] = 1;
  }

  const stack = sources.slice();
  const maxStepsPerBranch = Math.max(140, Math.round((width + height) * 3.2));
  const visitStamp = new Uint32Array(width * height);
  let branchId = 1;

  while (stack.length > 0) {
    let current = stack.pop();
    let steps = 0;
    branchId += 1;

    while (steps < maxStepsPerBranch) {
      const h = heights[current];
      if (h <= seaLevel) break;

      if (!spineMask[current]) {
        spineMask[current] = 1;
        orderedSpineCells.push(current);
      }

      visitStamp[current] = branchId;

      const x = current % width;
      const y = Math.floor(current / width);
      const neighbors = findNeighborFlowTargets(
        heights,
        width,
        height,
        x,
        y,
        h,
        visitStamp,
        branchId
      );

      let primaryIdx = neighbors.lowestIdx;
      if (primaryIdx < 0) {
        primaryIdx = neighbors.lowestAnyIdx;
      }

      if (primaryIdx < 0) {
        mouthMask[current] = 1;
        break;
      }

      if (heights[primaryIdx] <= seaLevel) {
        mouthMask[current] = 1;
        break;
      }

      if (neighbors.lowerCount > 1 && neighbors.secondLowestIdx >= 0 && rand() < forkChance) {
        const forkIdx = neighbors.secondLowestIdx;
        if (!spineMask[forkIdx] && heights[forkIdx] > seaLevel) {
          stack.push(forkIdx);
        }
      }

      if (spineMask[primaryIdx]) {
        break;
      }

      current = primaryIdx;
      steps += 1;
    }
  }

  const riverRadius = Math.max(1, Math.floor(RIVER_WIDTH_PX / 2));
  for (let i = 0; i < orderedSpineCells.length; i += 1) {
    const idx = orderedSpineCells[i];
    const x = idx % width;
    const y = Math.floor(idx / width);
    stampCircle(riverMask, width, height, x, y, riverRadius, riverArrivalStep, i + 1);
  }

  let riverPixels = 0;
  for (let i = 0; i < riverMask.length; i += 1) {
    if (riverMask[i] && heights[i] > seaLevel) {
      riverPixels += 1;
    }
  }

  const mouthCells = [];
  for (let i = 0; i < mouthMask.length; i += 1) {
    if (mouthMask[i]) {
      mouthCells.push(i);
    }
  }

  return {
    riverMask,
    riverArrivalStep,
    maxArrivalStep: Math.max(1, orderedSpineCells.length),
    sourceCells: sources,
    mouthCells,
    sourceCount: sources.length,
    riverPixels,
  };
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

function composeTerrainFrame(output, progress, targetPixels) {
  const clampedProgress = clamp(progress, 0, 1);
  targetPixels.set(output.basePixels);

  const riverCutoff = Math.max(0, Math.floor(output.river.maxArrivalStep * clampedProgress));
  const riverArrivalStep = output.river.riverArrivalStep;
  const riverShade = output.riverShade;

  for (let idx = 0; idx < riverArrivalStep.length; idx += 1) {
    const step = riverArrivalStep[idx];
    if (step === 0 || step > riverCutoff) continue;

    const shade = riverShade[idx];
    if (shade <= 0) continue;

    const pixel = idx * 4;
    targetPixels[pixel] = clamp(COLORS.river[0] * shade, 0, 255);
    targetPixels[pixel + 1] = clamp(COLORS.river[1] * shade, 0, 255);
    targetPixels[pixel + 2] = clamp(COLORS.river[2] * shade, 0, 255);
  }
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
  mountaintopValue.textContent = `${mountaintopSlider.value}%`;
  riversCountValue.textContent = `${state.riverCount}`;
  riverForkValue.textContent = `${riverForkSlider.value}%`;
  algorithmValue.textContent = state.algorithm === "midpoint" ? "Midpoint" : "Topology";
  seedValue.textContent = `Seed T${state.seed} | R${state.riverSeed}`;
}

function updateStats(stats) {
  const landPct = Math.round(stats.landFraction * 100);
  const mountainPct = Math.round(stats.mountainFraction * 100);
  const topPct = Math.round(stats.mountaintopFraction * 100);
  const riverPct = Math.round(stats.riverFraction * 100);
  const topThreshold = Number(mountaintopSlider.value);
  const algoShort = state.algorithm === "midpoint" ? "M" : "T";
  statsValue.textContent = `Land ${landPct}% | Mountain ${mountainPct}% | Tops ${topPct}% @ ${topThreshold}% | Rivers ${riverPct}% (${stats.riverSourceCount}/${state.riverCount}) | Fork ${Math.round(stats.forkChance * 100)}% | ${algoShort}`;
}

function setStatus(text) {
  statsValue.textContent = text;
}

function buildTerrainImage(
  width,
  height,
  seed,
  riverSeed,
  smoothness,
  seaLevelPercent,
  mountaintopPercent,
  algorithm,
  riverCount,
  riverForkChancePercent
) {
  const smoothnessNorm = clamp(smoothness / 100, 0, 1);
  const seaQuantile = clamp(seaLevelPercent / 100, 0.05, 0.95);
  const mountaintopQuantile = clamp(mountaintopPercent / 100, 0.75, 0.999);

  const heights = buildHeightField(width, height, seed, smoothness, algorithm);
  const slopes = buildSlopeField(heights, width, height);

  const seaLevel = quantileFromArray(heights, seaQuantile);
  const mountaintopLevel = quantileFromArray(heights, mountaintopQuantile);
  const riverOutput = buildRiverMask(
    heights,
    width,
    height,
    seaLevel,
    riverCount,
    riverForkChancePercent,
    riverSeed
  );

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

  const baseImageData = new ImageData(width, height);
  const basePixels = baseImageData.data;
  const riverShade = new Float32Array(width * height);

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

      if (riverOutput.riverMask[idx] && h > seaLevel) {
        riverShade[idx] = hillshadeFactor(heights, width, height, x, y, 0.12);
      }

      const p = idx * 4;
      basePixels[p] = r;
      basePixels[p + 1] = g;
      basePixels[p + 2] = b;
      basePixels[p + 3] = 255;
    }
  }

  return {
    width,
    height,
    basePixels: new Uint8ClampedArray(basePixels),
    river: riverOutput,
    riverShade,
    stats: {
      landFraction: (plainsCount + mountainCount + mountaintopCount) / (width * height),
      waterFraction: waterCount / (width * height),
      mountainFraction: mountainCount / (width * height),
      mountaintopFraction: mountaintopCount / (width * height),
      riverFraction: riverOutput.riverPixels / (width * height),
      riverSourceCount: riverOutput.sourceCount,
      forkChance: clamp(riverForkChancePercent / 100, 0, 1),
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

function cancelActiveAnimation() {
  if (state.animationFrameId) {
    window.cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = 0;
  }
}

function drawRasterToViewport(raster) {
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.drawImage(raster, 0, 0, window.innerWidth, window.innerHeight);
}

function animateTerrainOutput(output, renderToken) {
  cancelActiveAnimation();

  const raster = document.createElement("canvas");
  raster.width = output.width;
  raster.height = output.height;
  const rasterCtx = raster.getContext("2d");

  const framePixels = new Uint8ClampedArray(output.basePixels.length);
  const frameImage = new ImageData(framePixels, output.width, output.height);
  const hasRivers = output.river.sourceCount > 0 && output.river.riverPixels > 0;
  const duration = hasRivers ? RIVER_ANIMATION_MS : 0;
  const startAt = performance.now();

  const drawStep = (timestamp) => {
    if (renderToken !== state.renderToken) return;

    const t = duration > 0 ? clamp((timestamp - startAt) / duration, 0, 1) : 1;
    composeTerrainFrame(output, smoothstep01(t), framePixels);

    rasterCtx.putImageData(frameImage, 0, 0);
    state.lastRaster = raster;
    drawRasterToViewport(raster);

    if (t < 1) {
      state.animationFrameId = window.requestAnimationFrame(drawStep);
      return;
    }

    state.animationFrameId = 0;
    updateStats(output.stats);
  };

  state.animationFrameId = window.requestAnimationFrame(drawStep);
}

async function renderTerrain({ newSeed = false, resetRivers = false } = {}) {
  const renderToken = ++state.renderToken;
  cancelActiveAnimation();

  if (newSeed) {
    state.seed = randomSeed();
    state.riverSeed = randomSeed();
  } else if (resetRivers) {
    state.riverSeed = randomSeed();
  }
  updateLabels();

  setStatus("Generating terrain...");
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const { width: rasterWidth, height: rasterHeight } = pickRasterSize(
    window.innerWidth,
    window.innerHeight
  );

  const smoothness = Number(smoothnessSlider.value);
  const seaLevel = Number(seaLevelSlider.value);
  const mountaintopLevel = Number(mountaintopSlider.value);
  const riverForkChance = Number(riverForkSlider.value);

  const output = buildTerrainImage(
    rasterWidth,
    rasterHeight,
    state.seed,
    state.riverSeed,
    smoothness,
    seaLevel,
    mountaintopLevel,
    state.algorithm,
    state.riverCount,
    riverForkChance
  );

  if (renderToken !== state.renderToken) {
    return;
  }

  setStatus(output.river.sourceCount > 0 ? "Tracing rivers..." : "No rivers to trace");
  animateTerrainOutput(output, renderToken);
}

function scheduleRegenerate(delayMs = 140) {
  window.clearTimeout(sliderTimer);
  sliderTimer = window.setTimeout(() => {
    renderTerrain({ newSeed: false });
  }, delayMs);
}

function setRiverCount(nextValue) {
  const clamped = clamp(Math.round(nextValue), RIVER_COUNT_MIN, RIVER_COUNT_MAX);
  if (clamped === state.riverCount) return;
  state.riverCount = clamped;
  updateLabels();
  renderTerrain({ newSeed: false });
}

function resetRivers() {
  state.riverCount = RIVER_DEFAULT_COUNT;
  riverForkSlider.value = `${RIVER_DEFAULT_FORK}`;
  updateLabels();
  renderTerrain({ resetRivers: true });
}

regenerateBtn.addEventListener("click", () => {
  renderTerrain({ newSeed: true });
});

algorithmButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const next = button.getAttribute("data-algo");
    if (!next || next === state.algorithm) return;
    state.algorithm = next;
    algorithmButtons.forEach((candidate) => {
      candidate.classList.toggle("is-active", candidate.getAttribute("data-algo") === state.algorithm);
    });
    updateLabels();
    renderTerrain({ newSeed: false });
  });
});

smoothnessSlider.addEventListener("input", () => {
  updateLabels();
  scheduleRegenerate();
});

seaLevelSlider.addEventListener("input", () => {
  updateLabels();
  scheduleRegenerate();
});

mountaintopSlider.addEventListener("input", () => {
  updateLabels();
  scheduleRegenerate();
});

riversDecBtn.addEventListener("click", () => {
  setRiverCount(state.riverCount - 1);
});

riversIncBtn.addEventListener("click", () => {
  setRiverCount(state.riverCount + 1);
});

riverForkSlider.addEventListener("input", () => {
  updateLabels();
  scheduleRegenerate();
});

resetRiversBtn.addEventListener("click", () => {
  resetRivers();
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
