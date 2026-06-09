import { describe, it, expect } from 'vitest';
import { ValueNoise2D } from './noise';

describe('ValueNoise2D', () => {
  it('is deterministic for the same seed and coordinates', () => {
    const a = new ValueNoise2D('world');
    const b = new ValueNoise2D('world');
    expect(a.noise(12.3, 4.5)).toBe(b.noise(12.3, 4.5));
    expect(a.fbm(1.1, 2.2)).toBe(b.fbm(1.1, 2.2));
  });

  it('produces different fields for different seeds', () => {
    const a = new ValueNoise2D('seed-a');
    const b = new ValueNoise2D('seed-b');
    // Extremely unlikely to match at this sample point.
    expect(a.fbm(3.7, 8.1)).not.toBe(b.fbm(3.7, 8.1));
  });

  it('keeps single-octave noise within roughly [-1, 1]', () => {
    const n = new ValueNoise2D('bounds');
    for (let i = 0; i < 200; i++) {
      const v = n.noise(i * 0.37, i * 0.91);
      expect(v).toBeGreaterThanOrEqual(-1.0001);
      expect(v).toBeLessThanOrEqual(1.0001);
    }
  });

  it('keeps fbm within roughly [-1, 1]', () => {
    const n = new ValueNoise2D('fbm-bounds');
    for (let i = 0; i < 200; i++) {
      const v = n.fbm(i * 0.13, i * 0.29);
      expect(v).toBeGreaterThanOrEqual(-1.0001);
      expect(v).toBeLessThanOrEqual(1.0001);
    }
  });

  it('is continuous — nearby samples are close', () => {
    const n = new ValueNoise2D('smooth');
    const a = n.noise(5.0, 5.0);
    const b = n.noise(5.001, 5.0);
    expect(Math.abs(a - b)).toBeLessThan(0.05);
  });
});
