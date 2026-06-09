/** Shared interfaces used across the game's systems. */

/** Current schema version of the save file. Bump when the shape changes. */
export const SAVE_VERSION = 1;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerRotation {
  /** Yaw, in radians. */
  y: number;
}

/**
 * Forward-looking container for world mutations the player has made and which
 * chunks have already been generated. Empty for now — the world is fully
 * deterministic from the seed, so nothing here is required to reproduce it yet.
 */
export interface WorldState {
  generatedChunks: string[];
  customChanges: unknown[];
}

/** A complete, serializable snapshot of a game. */
export interface SaveData {
  version: number;
  seed: string;
  playerPosition: Vec3;
  playerRotation: PlayerRotation;
  worldState: WorldState;
  timestamp: number;
}
