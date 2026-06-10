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

const FADE_SECONDS = 2;

const DEFAULT_TRACKS: AmbientTrack[] = [
  { name: 'music', urls: ['/sounds/music.mp3', '/sounds/music.ogg'], volume: 0.35 },
  { name: 'birds', urls: ['/sounds/birds.mp3', '/sounds/birds.ogg'], volume: 0.4 },
  { name: 'wind', urls: ['/sounds/wind.mp3', '/sounds/wind.ogg'], volume: 0.3 },
  { name: 'stream', urls: ['/sounds/stream.mp3', '/sounds/stream.ogg'], volume: 0.25 },
];

export class AudioManager {
  private readonly sounds: Sound[] = [];
  private readonly targetVolume = new Map<Sound, number>();
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
        // Once the file is loaded, start it if the player has already interacted.
        () => {
          if (this.unlocked) this.fadeIn(sound, track.volume);
        },
        { loop: true, autoplay: false, volume: track.volume },
      );
      this.targetVolume.set(sound, track.volume);
      this.sounds.push(sound);
    }

    const unlock = (): void => this.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  }

  /** Begin playback with a fade-in. Called on the first user gesture. */
  private unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;

    for (const sound of this.sounds) {
      if (sound.isReady()) {
        this.fadeIn(sound, this.targetVolume.get(sound) ?? 1);
      }
      // Sounds still loading start themselves via the readyToPlay callback above.
    }
  }

  /** Start a looping track silent and ramp it up to its target volume. */
  private fadeIn(sound: Sound, target: number): void {
    sound.setVolume(0);
    sound.play();
    sound.setVolume(target, FADE_SECONDS);
  }

  dispose(): void {
    for (const sound of this.sounds) {
      sound.dispose();
    }
    this.sounds.length = 0;
  }
}
