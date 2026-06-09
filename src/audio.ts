/**
 * Ambient audio skeleton. Browsers block audio until the first user gesture, so
 * we lazily start the looping ambience on the first interaction. Audio files
 * don't exist yet (see public/sounds/), so loads fail gracefully and the game
 * stays silent rather than erroring.
 */

import type { Scene } from '@babylonjs/core/scene';
import { Sound } from '@babylonjs/core/Audio/sound';
import '@babylonjs/core/Audio/audioSceneComponent';

export interface AmbientTrack {
  name: string;
  /** Candidate URLs in preference order (e.g. mp3 then ogg fallback). */
  urls: string[];
  volume: number;
}

const DEFAULT_TRACKS: AmbientTrack[] = [
  { name: 'ambience', urls: ['/sounds/ambience.mp3', '/sounds/ambience.ogg'], volume: 0.5 },
  { name: 'birds', urls: ['/sounds/birds.mp3', '/sounds/birds.ogg'], volume: 0.3 },
];

export class AudioManager {
  private readonly sounds: Sound[] = [];
  private unlocked = false;

  constructor(
    private readonly scene: Scene,
    private readonly tracks: AmbientTrack[] = DEFAULT_TRACKS,
  ) {}

  /**
   * Load tracks and arrange to start them on the first user gesture. Safe to
   * call during boot — nothing plays until the player interacts.
   */
  init(): void {
    for (const track of this.tracks) {
      const sound = new Sound(
        track.name,
        track.urls[0] ?? null,
        this.scene,
        null,
        { loop: true, autoplay: false, volume: track.volume },
      );
      this.sounds.push(sound);
    }

    const unlock = (): void => this.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  }

  /** Begin playback with a short fade-in. Called on first gesture. */
  private unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;

    for (const sound of this.sounds) {
      if (sound.isReady()) {
        sound.play();
        sound.setVolume(sound.getVolume(), 1.5); // fade in over 1.5s
      }
    }
  }

  dispose(): void {
    for (const sound of this.sounds) {
      sound.dispose();
    }
    this.sounds.length = 0;
  }
}
