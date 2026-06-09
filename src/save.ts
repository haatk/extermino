/**
 * Save system: serialize game state to JSON, persist to localStorage for
 * auto-save, and download/upload to disk for manual saves. The pure
 * serialize/deserialize functions are unit-tested (see save.test.ts).
 */

import { SAVE_VERSION, type SaveData, type Vec3, type PlayerRotation } from './types';

export const SAVE_KEY = 'extermino_save';
const SAVE_FILENAME = 'extermino_save.json';

export interface GameSnapshot {
  seed: string;
  position: Vec3;
  rotation: PlayerRotation;
}

/** Build a versioned, timestamped SaveData from a lightweight snapshot. */
export function serialize(snapshot: GameSnapshot, now: number): SaveData {
  return {
    version: SAVE_VERSION,
    seed: snapshot.seed,
    playerPosition: {
      x: snapshot.position.x,
      y: snapshot.position.y,
      z: snapshot.position.z,
    },
    playerRotation: { y: snapshot.rotation.y },
    worldState: { generatedChunks: [], customChanges: [] },
    timestamp: now,
  };
}

/**
 * Validate and normalize arbitrary parsed JSON into SaveData. Returns null if
 * the data is missing required fields or is from an unsupported version, so
 * callers can fall back to a new game rather than crashing.
 */
export function deserialize(raw: unknown): SaveData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  if (obj.version !== SAVE_VERSION) return null;
  if (typeof obj.seed !== 'string') return null;

  const pos = asVec3(obj.playerPosition);
  if (!pos) return null;

  const rot = obj.playerRotation;
  const rotY =
    typeof rot === 'object' && rot !== null && typeof (rot as Record<string, unknown>).y === 'number'
      ? (rot as Record<string, unknown>).y as number
      : 0;

  const world = obj.worldState as Record<string, unknown> | undefined;

  return {
    version: SAVE_VERSION,
    seed: obj.seed,
    playerPosition: pos,
    playerRotation: { y: rotY },
    worldState: {
      generatedChunks: Array.isArray(world?.generatedChunks)
        ? (world.generatedChunks as string[])
        : [],
      customChanges: Array.isArray(world?.customChanges) ? (world.customChanges as unknown[]) : [],
    },
    timestamp: typeof obj.timestamp === 'number' ? obj.timestamp : 0,
  };
}

function asVec3(value: unknown): Vec3 | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.x !== 'number' || typeof v.y !== 'number' || typeof v.z !== 'number') return null;
  return { x: v.x, y: v.y, z: v.z };
}

// --- localStorage (auto-save) -------------------------------------------

export function saveToLocalStorage(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to auto-save to localStorage', err);
  }
}

export function loadFromLocalStorage(): SaveData | null {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (!text) return null;
    return deserialize(JSON.parse(text));
  } catch (err) {
    console.warn('Failed to read save from localStorage', err);
    return null;
  }
}

export function hasLocalSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

// --- Disk (manual save) -------------------------------------------------

/** Trigger a browser download of the save as a JSON file. */
export function downloadSave(data: SaveData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = SAVE_FILENAME;
  a.click();
  URL.revokeObjectURL(url);
}

/** Read and parse a user-supplied save file. Rejects on invalid data. */
export async function loadSaveFromFile(file: File): Promise<SaveData> {
  const text = await file.text();
  const data = deserialize(JSON.parse(text));
  if (!data) {
    throw new Error('Invalid or unsupported save file.');
  }
  return data;
}
