/**
 * First-person player controller. The camera carries a collision ellipsoid and
 * uses Babylon's built-in gravity + collision system, so it walks over the
 * streamed terrain tiles and is blocked by tree trunks. Movement is read from
 * the InputManager and is always relative to where the camera is facing; we feed
 * it through `camera.cameraDirection` so the engine resolves collisions for us.
 */

import type { Scene } from '@babylonjs/core/scene';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

import type { InputManager } from './input';

const PLAYER = {
  walkSpeed: 6,
  sprintSpeed: 11,
  /** Upward speed applied at the start of a jump, in units/second. */
  jumpSpeed: 12,
  /** How quickly the jump impulse bleeds off (units/second^2). */
  jumpDecay: 24,
  /** Collision capsule half-extents (x/z radius, y half-height). */
  ellipsoid: new Vector3(0.7, 0.9, 0.7),
  /** Offset so the camera sits at roughly eye level above the capsule centre. */
  ellipsoidOffset: new Vector3(0, 0.9, 0),
  /** Look speed for the mobile right joystick, in radians/second at full tilt. */
  lookSpeed: 2.6,
  /** Clamp pitch so the player can't flip the camera over. */
  maxPitch: 1.45,
} as const;

export interface PlayerState {
  position: Vector3;
  /** Yaw in radians. */
  rotationY: number;
}

export class Player {
  readonly camera: UniversalCamera;

  /** Remaining upward jump impulse (units/second); 0 when not rising. */
  private jumpImpulse = 0;
  /** Camera height last frame, used to infer whether we are on the ground. */
  private lastY: number;
  private grounded = true;

  constructor(
    scene: Scene,
    private readonly input: InputManager,
    spawn: PlayerState,
  ) {
    this.camera = new UniversalCamera('playerCamera', spawn.position.clone(), scene);
    this.camera.rotation.y = spawn.rotationY;
    this.camera.minZ = 0.1;
    this.camera.fov = 1.1;
    this.camera.inertia = 0;
    this.camera.angularSensibility = 800;

    // Collision + gravity: the camera is an ellipsoid that the engine slides
    // along terrain and around tree trunks. Gravity is applied each move.
    this.camera.checkCollisions = true;
    this.camera.applyGravity = true;
    this.camera.ellipsoid = PLAYER.ellipsoid.clone();
    this.camera.ellipsoidOffset = PLAYER.ellipsoidOffset.clone();

    // We drive movement ourselves, so strip the camera's built-in keyboard keys
    // and only keep it for mouse / touch look.
    this.camera.keysUp = [];
    this.camera.keysDown = [];
    this.camera.keysLeft = [];
    this.camera.keysRight = [];
    this.camera.speed = 0;

    this.lastY = spawn.position.y;
  }

  /** Hook up pointer-lock look controls to the canvas. */
  attachControl(canvas: HTMLCanvasElement): void {
    this.camera.attachControl(canvas, true);
  }

  /**
   * Advance the simulation by `dt` seconds. Builds this frame's displacement and
   * hands it to the camera, which applies gravity and resolves collisions.
   */
  update(dt: number): void {
    // Are we resting on the ground? If gravity couldn't pull us down last frame
    // (y held steady) and we're not rising, treat us as grounded.
    const fell = this.lastY - this.camera.position.y;
    this.grounded = this.jumpImpulse <= 0 && fell < 0.02;

    // Mobile look: the right joystick turns/tilts the camera at a steady rate.
    const look = this.input.getLookRate();
    if (look.x !== 0 || look.y !== 0) {
      this.camera.rotation.y += look.x * PLAYER.lookSpeed * dt;
      this.camera.rotation.x = clamp(
        this.camera.rotation.x + look.y * PLAYER.lookSpeed * dt,
        -PLAYER.maxPitch,
        PLAYER.maxPitch,
      );
    }

    const axis = this.input.getMoveAxis();
    const speed = this.input.isSprinting() ? PLAYER.sprintSpeed : PLAYER.walkSpeed;

    // Movement vector in the camera's horizontal plane.
    const yaw = this.camera.rotation.y;
    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    const move = forward.scale(axis.z).add(right.scale(axis.x));
    if (move.lengthSquared() > 1) {
      move.normalize();
    }

    this.camera.cameraDirection.x += move.x * speed * dt;
    this.camera.cameraDirection.z += move.z * speed * dt;

    // Jump: kick off an upward impulse that bleeds away; the camera's own
    // gravity then brings us back down and lands us on the terrain.
    if (this.grounded && this.input.isJumping()) {
      this.jumpImpulse = PLAYER.jumpSpeed;
      this.grounded = false;
    }
    if (this.jumpImpulse > 0) {
      this.camera.cameraDirection.y += this.jumpImpulse * dt;
      this.jumpImpulse = Math.max(0, this.jumpImpulse - PLAYER.jumpDecay * dt);
    }

    this.lastY = this.camera.position.y;
  }

  getState(): PlayerState {
    return {
      position: this.camera.position.clone(),
      rotationY: this.camera.rotation.y,
    };
  }

  /** Place the player and reset vertical motion (used on load). */
  setState(state: PlayerState): void {
    this.camera.position.copyFrom(state.position);
    this.camera.rotation.y = state.rotationY;
    this.camera.cameraDirection.setAll(0);
    this.jumpImpulse = 0;
    this.grounded = false;
    this.lastY = state.position.y;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
