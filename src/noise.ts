/**
 * Deterministic 2D value noise with fractal (fBm) layering, used for terrain
 * height. Seeded from the same seed string as everything else so the terrain is
 * fully reproducible.
 *
 * We use value noise (interpolated lattice of pseudo-random gradients) rather
 * than pulling in a Simplex dependency — it's compact, dependency-free, and
 * smooth enough for rolling grassland.
 */

import { hashSeed } from './rng';

/** Smoothstep-style fade curve (Perlin's 6t^5 - 15t^4 + 10t^3). */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class ValueNoise2D {
  private readonly seed: number;

  constructor(seed: string) {
    this.seed = hashSeed(seed);
  }

  /**
   * Hash an integer lattice point to a pseudo-random value in [-1, 1].
   * Deterministic: same (ix, iy) always yields the same value for a given seed.
   */
  private latticeValue(ix: number, iy: number): number {
    let h = this.seed;
    h = Math.imul(h ^ ix, 2654435761);
    h = Math.imul(h ^ iy, 2246822519);
    h ^= h >>> 13;
    h = Math.imul(h, 3266489917);
    h ^= h >>> 16;
    // Map the unsigned 32-bit hash to [-1, 1].
    return (h >>> 0) / 2147483648 - 1;
  }

  /** Single-octave value noise sampled at (x, y). Returns roughly [-1, 1]. */
  noise(x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const sx = fade(x - x0);
    const sy = fade(y - y0);

    const n00 = this.latticeValue(x0, y0);
    const n10 = this.latticeValue(x1, y0);
    const n01 = this.latticeValue(x0, y1);
    const n11 = this.latticeValue(x1, y1);

    const ix0 = lerp(n00, n10, sx);
    const ix1 = lerp(n01, n11, sx);
    return lerp(ix0, ix1, sy);
  }

  /**
   * Fractal Brownian motion: sum several octaves of noise at increasing
   * frequency and decreasing amplitude for natural-looking detail. The result
   * is normalized to roughly [-1, 1].
   */
  fbm(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amplitude = 1;
    let frequency = 1;
    let sum = 0;
    let totalAmplitude = 0;

    for (let i = 0; i < octaves; i++) {
      sum += this.noise(x * frequency, y * frequency) * amplitude;
      totalAmplitude += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }

    return totalAmplitude > 0 ? sum / totalAmplitude : 0;
  }
}
