# Extermino

A 3D open-world exploration game that runs entirely in the browser, built with
[Babylon.js](https://www.babylonjs.com/). The world is procedurally generated
from a seed — every seed produces a unique but fully deterministic world of
rolling grassland, trees, sky and sun.

> This repository is in early bootstrap. Trees and terrain currently use
> procedural placeholders; PBR textures, GLB tree models and ambient audio will
> follow. See [CLAUDE.md](./CLAUDE.md) for the full design.

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the Vite dev server
```

Open the printed local URL, enter a seed (or leave it blank for a random one),
and start exploring.

## Scripts

| Command                | What it does                                |
| ---------------------- | ------------------------------------------- |
| `npm run dev`          | Start the Vite dev server with HMR          |
| `npm run build`        | Type-check and build to `dist/`             |
| `npm run preview`      | Preview the production build locally        |
| `npm run typecheck`    | Run `tsc --noEmit`                          |
| `npm run lint`         | Lint with ESLint (no warnings allowed)      |
| `npm run format`       | Format the codebase with Prettier           |
| `npm test`             | Run the Vitest unit tests                   |

## Controls

**Desktop:** `WASD` / arrow keys to move, mouse to look (click to lock the
pointer), `Space` to jump, `Shift` to sprint.

**Mobile:** left virtual joystick to move, drag the right of the screen to look,
on-screen **Jump** button.

## Project layout

```
src/
├── main.ts     # Bootstrap & game lifecycle
├── world.ts    # Procedural terrain & trees
├── player.ts   # First-person movement, jump, camera
├── input.ts    # Keyboard / mouse / touch input
├── save.ts     # Save/load (localStorage + disk)
├── sky.ts      # Sky, sun, shadows
├── audio.ts    # Ambient audio
├── ui.ts       # HUD, start modal, mobile controls
├── rng.ts      # Deterministic PRNG (mulberry32)
├── noise.ts    # Value-noise terrain heightfield
└── types.ts    # Shared interfaces
```

## License

[MIT](./LICENSE). Third-party assets are credited in
[ATTRIBUTION.md](./ATTRIBUTION.md).
