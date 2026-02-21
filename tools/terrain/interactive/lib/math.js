export function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep01(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - (2 * x));
}

export function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export function createMulberry32(seed) {
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

export function fractalNoise(x, y, seed, octaves = 5, lacunarity = 2.02, gain = 0.5) {
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

export function quantileFromArray(values, q) {
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
