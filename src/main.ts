/**
 * Bootstrap: creates the engine and scene, wires together every system
 * (sky, world, player, input, audio, UI, saving) and runs the render loop.
 *
 * Lifecycle: a start modal lets the player begin a New Game from a seed or
 * Continue from the auto-save. Once a game starts, the world is generated, the
 * player spawns, controls attach, and auto-save runs every 60s and on tab close.
 */

import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
// CollisionCoordinator side-effect: required for collision system to work.
import '@babylonjs/core/Collisions/collisionCoordinator';

import { createSky } from './sky';
import { World } from './world';
import { Player, type PlayerState } from './player';
import { InputManager } from './input';
import { AudioManager } from './audio';
import { UI } from './ui';
import {
  serialize,
  saveToLocalStorage,
  loadFromLocalStorage,
  loadSaveFromFile,
  downloadSave,
  hasLocalSave,
} from './save';
import type { SaveData } from './types';

const AUTO_SAVE_INTERVAL_MS = 60_000;

/**
 * Gravity for the scene and camera collision system. This is applied directly
 * to velocity each frame (not an acceleration), so it pulls the camera downward
 * to keep it resting on the terrain. A value around -9.81 simulates Earth's gravity.
 */
const SCENE_GRAVITY_Y = -0.5;

class Game {
  private readonly engine: Engine;
  private scene: Scene | null = null;
  private world: World | null = null;
  private player: Player | null = null;
  private autoSaveTimer: number | null = null;
  private currentSeed = '';

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly input: InputManager,
    private readonly ui: UI,
  ) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    window.addEventListener('resize', () => this.engine.resize());
  }

  /** Show the start screen; the UI callbacks drive new/continue/load. */
  start(): void {
    this.ui.showStartModal(hasLocalSave());
  }

  newGame(seed: string): void {
    void this.beginGame(
      seed,
      {
        position: new Vector3(0, 0, 0),
        rotationY: 0,
      },
      true,
    );
  }

  continueGame(): void {
    const save = loadFromLocalStorage();
    if (!save) {
      // Nothing to continue — fall back to a fresh random world.
      this.newGame(seedFromNothing());
      return;
    }
    this.restoreFromSave(save);
  }

  loadFromFile(file: File): void {
    loadSaveFromFile(file)
      .then((save) => this.restoreFromSave(save))
      .catch((err: unknown) => {
        console.error(err);
        this.ui.toast('Could not load that save file.');
      });
  }

  private restoreFromSave(save: SaveData): void {
    void this.beginGame(
      save.seed,
      {
        position: new Vector3(save.playerPosition.x, save.playerPosition.y, save.playerPosition.z),
        rotationY: save.playerRotation.y,
      },
      false,
    );
  }

  /** Tear down any existing scene and build a fresh one for `seed`. */
  private async beginGame(seed: string, spawn: PlayerState, freshSpawn: boolean): Promise<void> {
    this.disposeScene();
    this.currentSeed = seed;

    const scene = new Scene(this.engine);
    this.scene = scene;

    // Collisions + gravity drive the player's contact with terrain and trees.
    scene.collisionsEnabled = true;
    scene.gravity = new Vector3(0, SCENE_GRAVITY_Y, 0);

    // Distance fog to soften the horizon.
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = new Color3(0.74, 0.85, 0.95);
    scene.fogDensity = 0.0035;

    const sky = createSky(scene);
    const world = await World.create(scene, seed, spawn.position, sky.shadowGenerator);

    // A newer scene may have been requested while we awaited; if so, bail out.
    if (this.scene !== scene) {
      world.dispose();
      scene.dispose();
      return;
    }
    this.world = world;

    // Drop a freshly-spawned player above the surface so gravity seats them on it.
    if (freshSpawn) {
      spawn.position.y = world.getHeightAt(spawn.position.x, spawn.position.z) + 2;
    }

    const player = new Player(scene, this.input, spawn);
    player.attachControl(this.canvas);
    this.player = player;

    const audio = new AudioManager(scene);
    audio.init();

    this.ui.buildHud();

    scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
      world.update(player.camera.position);
      player.update(dt);
    });

    this.engine.runRenderLoop(() => scene.render());

    this.startAutoSave();
  }

  private snapshotSave(): SaveData | null {
    if (!this.player) return null;
    const state = this.player.getState();
    return serialize(
      {
        seed: this.currentSeed,
        position: { x: state.position.x, y: state.position.y, z: state.position.z },
        rotation: { y: state.rotationY },
      },
      Date.now(),
    );
  }

  save(): void {
    const data = this.snapshotSave();
    if (!data) return;
    saveToLocalStorage(data);
    downloadSave(data);
    this.ui.toast('Saved');
  }

  private autoSave(): void {
    const data = this.snapshotSave();
    if (data) saveToLocalStorage(data);
  }

  private startAutoSave(): void {
    if (this.autoSaveTimer !== null) window.clearInterval(this.autoSaveTimer);
    this.autoSaveTimer = window.setInterval(() => this.autoSave(), AUTO_SAVE_INTERVAL_MS);
    window.addEventListener('beforeunload', () => this.autoSave());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.autoSave();
    });
  }

  private disposeScene(): void {
    if (this.autoSaveTimer !== null) {
      window.clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.engine.stopRenderLoop();
    this.world?.dispose();
    this.scene?.dispose();
    this.world = null;
    this.player = null;
    this.scene = null;
  }
}

/** Fallback seed when we truly have nothing. Only picks *which* world, not how */
/* it generates — generation stays fully deterministic from this string. */
function seedFromNothing(): string {
  return Math.random().toString(36).slice(2, 10);
}

function main(): void {
  const canvas = document.getElementById('renderCanvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Render canvas not found');
  }

  const input = new InputManager();
  input.attach();

  // The UI is constructed first so its callbacks can reference the game; we
  // close over a mutable reference to break the chicken-and-egg.
  let game: Game | null = null;
  const ui = new UI(
    {
      onNewGame: (seed) => game?.newGame(seed),
      onContinue: () => game?.continueGame(),
      onSave: () => game?.save(),
      onLoadFile: (file) => game?.loadFromFile(file),
    },
    input,
  );

  game = new Game(canvas, input, ui);
  game.start();
}

main();
