import { describe, it, expect } from 'vitest';
import { hashSeed, mulberry32, createRng, randomInt, randomRange } from './rng';

describe('hashSeed', () => {
  it('is deterministic for the same string', () => {
    expect(hashSeed('extermino')).toBe(hashSeed('extermino'));
  });

  it('produces different hashes for different strings', () => {
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = hashSeed('some seed');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(h)).toBe(true);
  });
});

describe('mulberry32', () => {
  it('produces the same sequence for the same seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('createRng', () => {
  it('reproduces an identical sequence from a string seed', () => {
    const first = createRng('grassland');
    const second = createRng('grassland');
    const a = Array.from({ length: 5 }, () => first());
    const b = Array.from({ length: 5 }, () => second());
    expect(a).toEqual(b);
  });
});

describe('randomRange / randomInt', () => {
  it('randomRange stays within bounds', () => {
    const rng = createRng('range');
    for (let i = 0; i < 500; i++) {
      const v = randomRange(rng, 5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it('randomInt stays within inclusive bounds', () => {
    const rng = createRng('int');
    for (let i = 0; i < 500; i++) {
      const v = randomInt(rng, 1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});
