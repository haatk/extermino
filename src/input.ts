/**
 * Unified input: keyboard for desktop, plus a writable mobile channel that the
 * on-screen joystick (see ui.ts) feeds into. The player reads a single,
 * normalized movement intent regardless of source.
 */

export interface MoveAxis {
  /** Strafe: -1 (left) .. +1 (right). */
  x: number;
  /** Forward/back: -1 (back) .. +1 (forward). */
  z: number;
}

export interface LookRate {
  /** Yaw rate: -1 (turn left) .. +1 (turn right). */
  x: number;
  /** Pitch rate: -1 (look up) .. +1 (look down). */
  y: number;
}

export class InputManager {
  private readonly pressed = new Set<string>();

  /** Movement coming from the mobile joystick, if any. */
  private mobileMove: MoveAxis = { x: 0, z: 0 };
  /** Look rate coming from the mobile right joystick, if any. */
  private mobileLook: LookRate = { x: 0, y: 0 };
  private mobileJump = false;
  private mobileSprint = false;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.pressed.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.pressed.delete(e.code);
  };
  private readonly onBlur = (): void => {
    this.pressed.clear();
  };

  attach(target: Window = window): void {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  detach(target: Window = window): void {
    target.removeEventListener('keydown', this.onKeyDown);
    target.removeEventListener('keyup', this.onKeyUp);
    target.removeEventListener('blur', this.onBlur);
  }

  /** Called by the mobile movement joystick overlay. */
  setMobileMove(axis: MoveAxis): void {
    this.mobileMove = axis;
  }

  /** Called by the mobile look joystick overlay. */
  setMobileLook(rate: LookRate): void {
    this.mobileLook = rate;
  }

  /** Current look rate from the mobile joystick (zero on desktop). */
  getLookRate(): LookRate {
    return this.mobileLook;
  }

  setMobileJump(active: boolean): void {
    this.mobileJump = active;
  }

  setMobileSprint(active: boolean): void {
    this.mobileSprint = active;
  }

  /** Combined movement intent from keyboard + mobile, clamped to [-1, 1]. */
  getMoveAxis(): MoveAxis {
    let x = this.mobileMove.x;
    let z = this.mobileMove.z;

    if (this.pressed.has('KeyW') || this.pressed.has('ArrowUp')) z += 1;
    if (this.pressed.has('KeyS') || this.pressed.has('ArrowDown')) z -= 1;
    if (this.pressed.has('KeyD') || this.pressed.has('ArrowRight')) x += 1;
    if (this.pressed.has('KeyA') || this.pressed.has('ArrowLeft')) x -= 1;

    return { x: clamp(x, -1, 1), z: clamp(z, -1, 1) };
  }

  isJumping(): boolean {
    return this.mobileJump || this.pressed.has('Space');
  }

  isSprinting(): boolean {
    return this.mobileSprint || this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight');
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
