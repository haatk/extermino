/**
 * DOM overlay UI: the first-load modal (seed / New Game / Continue), the
 * top-right Save & Load buttons, and the mobile touch controls (movement
 * joystick + jump button). Kept as lightweight DOM rather than Babylon GUI so
 * it never competes with the 3D scene for draw calls.
 */

import type { InputManager } from './input';

export interface UICallbacks {
  onNewGame: (seed: string) => void;
  onContinue: () => void;
  onSave: () => void;
  onLoadFile: (file: File) => void;
}

/** Detect a touch-primary device so we only show mobile controls there. */
function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export class UI {
  private readonly root: HTMLDivElement;

  constructor(
    private readonly callbacks: UICallbacks,
    private readonly input: InputManager,
  ) {
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:fixed;inset:0;pointer-events:none;font-family:system-ui,sans-serif;z-index:10;';
    document.body.appendChild(this.root);
  }

  /** Show the initial modal; offers "Continue" only when a save exists. */
  showStartModal(hasSave: boolean): void {
    const overlay = el('div', {
      cssText:
        'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(10,20,30,0.55);pointer-events:auto;backdrop-filter:blur(2px);',
    });

    const panel = el('div', {
      cssText:
        'background:#fbfdf7;border-radius:14px;padding:28px 32px;width:min(360px,86vw);' +
        'box-shadow:0 12px 40px rgba(0,0,0,0.35);text-align:center;',
    });

    const title = el('h1', { textContent: 'Extermino', cssText: 'margin:0 0 4px;color:#2f5d34;' });
    const subtitle = el('p', {
      textContent: 'A seed becomes a world. Explore it.',
      cssText: 'margin:0 0 20px;color:#6b7d6e;font-size:14px;',
    });

    const seedInput = el('input', {
      cssText:
        'width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cfd9cd;' +
        'border-radius:8px;font-size:15px;margin-bottom:12px;',
    }) as HTMLInputElement;
    seedInput.type = 'text';
    seedInput.placeholder = 'Enter a seed (or leave blank for random)';

    const newGameBtn = button('New Game', '#2f8f3e');
    newGameBtn.style.width = '100%';
    newGameBtn.style.marginBottom = '8px';
    newGameBtn.addEventListener('click', () => {
      const seed = seedInput.value.trim() || randomSeed();
      this.root.removeChild(overlay);
      this.callbacks.onNewGame(seed);
    });

    panel.append(title, subtitle, seedInput, newGameBtn);

    if (hasSave) {
      const continueBtn = button('Continue', '#3a6ea5');
      continueBtn.style.width = '100%';
      continueBtn.addEventListener('click', () => {
        this.root.removeChild(overlay);
        this.callbacks.onContinue();
      });
      panel.append(continueBtn);
    }

    overlay.append(panel);
    this.root.append(overlay);
  }

  /** Build the in-game HUD: Save / Load buttons and mobile controls. */
  buildHud(): void {
    const bar = el('div', {
      cssText: 'position:absolute;top:12px;right:12px;display:flex;gap:8px;pointer-events:auto;',
    });

    const saveBtn = button('Save', '#2f8f3e');
    saveBtn.addEventListener('click', () => this.callbacks.onSave());

    const loadBtn = button('Load', '#3a6ea5');
    const fileInput = el('input', { cssText: 'display:none;' }) as HTMLInputElement;
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) this.callbacks.onLoadFile(file);
      fileInput.value = '';
    });
    loadBtn.addEventListener('click', () => fileInput.click());

    bar.append(saveBtn, loadBtn, fileInput);
    this.root.append(bar);

    if (isTouchDevice()) {
      this.buildMobileControls();
    }
  }

  /** Transient toast message (e.g. "Saved"). */
  toast(message: string): void {
    const t = el('div', {
      textContent: message,
      cssText:
        'position:absolute;bottom:24px;left:50%;transform:translateX(-50%);' +
        'background:rgba(20,30,20,0.85);color:#fff;padding:8px 16px;border-radius:20px;' +
        'font-size:14px;pointer-events:none;transition:opacity 0.4s;',
    });
    this.root.append(t);
    window.setTimeout(() => {
      t.style.opacity = '0';
    }, 1400);
    window.setTimeout(() => t.remove(), 1900);
  }

  // --- Mobile controls ---------------------------------------------------

  private buildMobileControls(): void {
    this.buildJoystick();
    this.buildJumpButton();
  }

  private buildJoystick(): void {
    const base = el('div', {
      cssText:
        'position:absolute;left:24px;bottom:24px;width:120px;height:120px;border-radius:50%;' +
        'background:rgba(255,255,255,0.18);border:2px solid rgba(255,255,255,0.4);' +
        'pointer-events:auto;touch-action:none;',
    });
    const thumb = el('div', {
      cssText:
        'position:absolute;left:35px;top:35px;width:50px;height:50px;border-radius:50%;' +
        'background:rgba(255,255,255,0.6);',
    });
    base.append(thumb);
    this.root.append(base);

    const radius = 35;
    let activeId: number | null = null;

    const setFromTouch = (clientX: number, clientY: number): void => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > radius) {
        dx = (dx / dist) * radius;
        dy = (dy / dist) * radius;
      }
      thumb.style.left = `${35 + dx}px`;
      thumb.style.top = `${35 + dy}px`;
      // Screen down (+dy) means moving backward (-z).
      this.input.setMobileMove({ x: dx / radius, z: -dy / radius });
    };

    const reset = (): void => {
      thumb.style.left = '35px';
      thumb.style.top = '35px';
      this.input.setMobileMove({ x: 0, z: 0 });
      activeId = null;
    };

    base.addEventListener('pointerdown', (e: PointerEvent) => {
      activeId = e.pointerId;
      base.setPointerCapture(e.pointerId);
      setFromTouch(e.clientX, e.clientY);
    });
    base.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId === activeId) setFromTouch(e.clientX, e.clientY);
    });
    base.addEventListener('pointerup', reset);
    base.addEventListener('pointercancel', reset);
  }

  private buildJumpButton(): void {
    const jump = el('div', {
      textContent: 'Jump',
      cssText:
        'position:absolute;right:24px;bottom:40px;width:88px;height:88px;border-radius:50%;' +
        'display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;' +
        'background:rgba(47,143,62,0.55);border:2px solid rgba(255,255,255,0.5);' +
        'pointer-events:auto;touch-action:none;user-select:none;',
    });
    jump.addEventListener('pointerdown', () => this.input.setMobileJump(true));
    jump.addEventListener('pointerup', () => this.input.setMobileJump(false));
    jump.addEventListener('pointercancel', () => this.input.setMobileJump(false));
    this.root.append(jump);
  }
}

// --- Small DOM helpers ----------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { cssText?: string; textContent?: string } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.cssText) node.style.cssText = props.cssText;
  if (props.textContent) node.textContent = props.textContent;
  return node;
}

function button(label: string, color: string): HTMLButtonElement {
  const b = el('button', { textContent: label });
  b.style.cssText =
    `background:${color};color:#fff;border:none;border-radius:8px;padding:9px 16px;` +
    'font-size:14px;font-weight:600;cursor:pointer;pointer-events:auto;';
  return b;
}

/** A short, human-friendly random seed. Uses Math.random because it only seeds */
/* the *choice* of world, not world generation itself (which stays deterministic). */
function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}
