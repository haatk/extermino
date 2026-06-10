/**
 * First-person player controller: a camera for looking around plus manual
 * movement, gravity and jumping. Movement is read from the InputManager and is
 * always relative to where the camera is facing. The player is kept on the
 * terrain surface via World.getHeightAt.
 */

import type { Scene } from '@babylonjs/core/scene';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

import type { World } from './world';
import type { InputManager } from './input';

const PLAYER = {
  /** Camera height above the ground (eye level), in world units. */
  eyeHeight: 1.7,
  walkSpeed: 6,
  sprintSpeed: 11,
  jumpSpeed: 7,
  gravity: -20,
} as const;

export interface PlayerState {
  position: Vector3;
  /** Yaw in radians. */
  rotationY: number;
}

export class Player {
  readonly camera: UniversalCamera;

  private verticalVelocity = 0;
  private grounded = true;

  constructor(
    private readonly _scene: Scene,
    private readonly world: World,
    private readonly input: InputManager,
    spawn: PlayerState,
  ) {
    this.camera = new UniversalCamera('playerCamera', spawn.position.clone(), _scene);
    this.camera.rotation.y = spawn.rotationY;
    this.camera.minZ = 0.1;
    this.camera.fov = 1.1;
    this.camera.inertia = 0;
    this.camera.angularSensibility = 800;

    // We drive movement ourselves, so strip the camera's built-in keyboard keys
    // and only keep it for mouse / touch look.
    this.camera.keysUp = [];
    this.camera.keysDown = [];
    this.camera.keysLeft = [];
    this.camera.keysRight = [];
    this.camera.speed = 0;
  }

  /** Hook up pointer-lock look controls to the canvas. */
  attachControl(canvas: HTMLCanvasElement): void {
    this.camera.attachControl(canvas, true);
  }

  /** Advance the simulation by `dt` seconds. */
  update(dt: number): void {
    const axis = this.input.getMoveAxis();
    const speed = this.input.isSprinting() ? PLAYER.sprintSpeed : PLAYER.walkSpeed;

    // Build a movement vector in the camera's horizontal plane.
    const yaw = this.camera.rotation.y;
    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    const move = forward.scale(axis.z).add(right.scale(axis.x));
    if (move.lengthSquared() > 1) {
      move.normalize();
    }

    const pos = this.camera.position;
    pos.x += move.x * speed * dt;
    pos.z += move.z * speed * dt;

    // Vertical: gravity + jump, grounded against the terrain height.
    const groundY = this.world.getHeightAt(pos.x, pos.z) + PLAYER.eyeHeight;

    if (this.grounded && this.input.isJumping()) {
      this.verticalVelocity = PLAYER.jumpSpeed;
      this.grounded = false;
    }

    this.verticalVelocity += PLAYER.gravity * dt;
    pos.y += this.verticalVelocity * dt;

    if (pos.y <= groundY) {
      pos.y = groundY;
      this.verticalVelocity = 0;
      this.grounded = true;
    }
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
    this.verticalVelocity = 0;
    this.grounded = false;
  }
}
