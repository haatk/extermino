import { describe, it, expect } from 'vitest';
import { serialize, deserialize, type GameSnapshot } from './save';
import { SAVE_VERSION } from './types';

const snapshot: GameSnapshot = {
  seed: 'abc123',
  position: { x: 1, y: 2, z: 3 },
  rotation: { y: 0.5 },
};

describe('serialize', () => {
  it('produces a versioned, timestamped save', () => {
    const data = serialize(snapshot, 1234567890);
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.seed).toBe('abc123');
    expect(data.playerPosition).toEqual({ x: 1, y: 2, z: 3 });
    expect(data.playerRotation).toEqual({ y: 0.5 });
    expect(data.timestamp).toBe(1234567890);
    expect(data.worldState).toEqual({ generatedChunks: [], customChanges: [] });
  });
});

describe('deserialize', () => {
  it('round-trips a serialized save', () => {
    const data = serialize(snapshot, 42);
    const json = JSON.parse(JSON.stringify(data)) as unknown;
    expect(deserialize(json)).toEqual(data);
  });

  it('rejects non-objects', () => {
    expect(deserialize(null)).toBeNull();
    expect(deserialize('nope')).toBeNull();
    expect(deserialize(42)).toBeNull();
  });

  it('rejects an unsupported version', () => {
    const data = serialize(snapshot, 1);
    expect(deserialize({ ...data, version: 999 })).toBeNull();
  });

  it('rejects a missing seed', () => {
    const data = serialize(snapshot, 1) as unknown as Record<string, unknown>;
    delete data.seed;
    expect(deserialize(data)).toBeNull();
  });

  it('rejects a malformed position', () => {
    const data = serialize(snapshot, 1) as unknown as Record<string, unknown>;
    data.playerPosition = { x: 1, y: 'oops', z: 3 };
    expect(deserialize(data)).toBeNull();
  });

  it('defaults rotation and worldState when absent', () => {
    const minimal = {
      version: SAVE_VERSION,
      seed: 'x',
      playerPosition: { x: 0, y: 0, z: 0 },
      timestamp: 0,
    };
    const result = deserialize(minimal);
    expect(result).not.toBeNull();
    expect(result?.playerRotation).toEqual({ y: 0 });
    expect(result?.worldState).toEqual({ generatedChunks: [], customChanges: [] });
  });
});
