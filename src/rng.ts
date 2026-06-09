/**
 * Deterministic pseudo-random number generation.
 *
 * The whole world is reproduced from a seed, so we never use `Math.random()`.
 * Everything funnels through a small, well-understood PRNG (mulberry32) seeded
 * from a 32-bit hash of the user's seed string.
 */

/**
 * xmur3 string hash — turns an arbitrary seed string into a well-mixed 32-bit
 * integer suitable for seeding mulberry32. Two different strings are extremely
 * unlikely to collide.
 */
export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** A function that returns the next pseudo-random float in [0, 1). */
export type RandomFn = () => number;

/**
 * mulberry32 — a fast, tiny, statistically decent 32-bit PRNG. Given the same
 * numeric seed it always produces the same sequence.
 */
export function mulberry32(seed: number): RandomFn {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a PRNG directly from a seed string. */
export function createRng(seed: string): RandomFn {
  return mulberry32(hashSeed(seed));
}

/** Random float in [min, max). */
export function randomRange(rng: RandomFn, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Random integer in [min, max] inclusive. */
export function randomInt(rng: RandomFn, min: number, max: number): number {
  return Math.floor(randomRange(rng, min, max + 1));
}
