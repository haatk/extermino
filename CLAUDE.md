# Extermino

## Project Overview
Extermino is a 3D open-world exploration game that runs entirely in the browser using Babylon.js. The world is procedurally generated from a seed, meaning every seed produces a unique but deterministic world. The game focuses on peaceful exploration of a lush grassland environment with forests, relaxing ambient sounds, and a beautiful sky.

## Tech Stack
- **Engine:** Babylon.js 7.x (`@babylonjs/core@^7`) installed via npm
- **Language:** TypeScript (strict mode, no `any`)
- **Bundler:** Vite
- **Hosting:** GitHub Pages (deploy `/dist` output)
- **Storage:** localStorage for auto-save + JSON file download/upload for manual saves

## File Structure
```
/
├── index.html              # Entry point
├── vite.config.ts          # Base path set to repo name for GitHub Pages
├── tsconfig.json           # strict: true
├── package.json
├── ATTRIBUTION.md          # Required credits for all assets used
├── CLAUDE.md
├── LICENSE
├── src/
│   ├── main.ts             # Bootstrap, scene init
│   ├── world.ts            # Procedural generation
│   ├── player.ts           # Movement, jump, camera
│   ├── input.ts            # Keyboard/mouse + touch
│   ├── save.ts             # Save/load (localStorage + disk)
│   ├── sky.ts              # Sky, sun, shadows
│   ├── audio.ts            # Ambient sounds
│   ├── ui.ts               # HUD, buttons, mobile controls
│   └── types.ts            # Shared interfaces
├── public/
│   ├── models/             # GLB tree models
│   ├── textures/           # PBR grass/terrain textures
│   └── sounds/             # MP3/OGG ambient audio
└── dist/                   # Vite build output (git-ignored)
```

## World Generation
- Generated from a string or numeric seed — never use `Math.random()`, always use a deterministic PRNG (e.g. mulberry32)
- Terrain height via layered Simplex/Perlin noise
- Tree positions, species, and scale all derived from the seed
- Chunk-based loading: load terrain around the player, unload what's far away
- The seed is stored in the save file and must reproduce the exact same world when loaded

## World Environment
- **Terrain:** Rolling grassland with PBR grass texture (albedo, normal, roughness, AO)
- **Trees:** High-quality deciduous GLB models (oak, birch) from free sources, with LOD variants
- **Sky:** Blue sky with visible sun via `BABYLON.SkyMaterial`
- **Shadows:** Directional sun light + `BABYLON.ShadowGenerator` casting tree shadows on terrain
- **Atmosphere:** Subtle distance fog

## Player Controls

### Desktop (keyboard & mouse)
- `W A S D` / arrow keys — move
- Mouse — look around (pointer lock)
- `Space` — jump
- `Shift` — sprint

### Mobile (touch)
- Left virtual joystick — move
- Right virtual joystick / swipe — look
- On-screen jump button (bottom right)
- Use `BABYLON.VirtualJoystick` or a custom touch overlay

## Save System
Each save is a JSON object:
```json
{
  "version": 1,
  "seed": "abc123",
  "playerPosition": { "x": 0, "y": 1, "z": 0 },
  "playerRotation": { "y": 0 },
  "worldState": { "generatedChunks": [], "customChanges": [] },
  "timestamp": 1234567890
}
```

- **Auto-save:** every 60 seconds and on tab close; stored under key `extermino_save`
- **Save to disk:** download as `extermino_save.json`
- **Load from disk:** `<input type="file">` to upload and restore a save
- On first load: prompt for seed or generate one randomly; offer "Continue" if a save exists

## Assets

### 3D Models — free sources
- [Poly Haven](https://polyhaven.com) — all CC0
- [Sketchfab](https://sketchfab.com) — filter by CC0 or CC-BY
- [KhronosGroup glTF samples](https://github.com/KhronosGroup/glTF-Sample-Assets)
- Prefer GLB format; use LOD variants where available

### Textures — free sources
- [Poly Haven textures](https://polyhaven.com/textures) — all CC0, seamless PBR sets

### Sounds & Music — free sources
- [Freesound.org](https://freesound.org) — filter CC0
- [OpenGameArt.org](https://opengameart.org)
- [Pixabay Music](https://pixabay.com/music/)
- Target: birds, wind in leaves, distant stream, soft looping ambient music
- Use MP3 with OGG fallback; all audio loops seamlessly with fade in/out

### Attribution
Every asset used must be added to `ATTRIBUTION.md` with: name, source URL, author, and license.

## Coding Conventions
- TypeScript strict mode — `strict: true`, no `any`
- Babylon.js imported from npm subpaths only (`@babylonjs/core/...`) for tree-shaking
- Each system exports a class; pass `Scene`/`Engine` explicitly, no globals
- ESLint (TypeScript plugin) + Prettier for code style — run via `lint-staged` on commit
- Unit test pure functions (RNG, noise, save serialization) with Vitest — no need to test rendering
- Comment non-obvious math (noise layering, seed hashing, shadow setup)

## Deployment
- `vite.config.ts`: set `base` to the repo name (e.g. `base: '/extermino/'`)
- GitHub Actions workflow at `.github/workflows/deploy.yml`: `npm ci` → `npm run build` → deploy `/dist` to `gh-pages` branch via `peaceiris/actions-gh-pages@v3`

## Performance
- Target 60fps on iPhone 12 / Samsung Galaxy S21 or newer
- Use `BABYLON.InstancedMesh` for trees and repeated objects
- Only cast shadows from trees near the player
- Merge static geometry with `BABYLON.Mesh.MergeMeshes` where possible

## UI / HUD
- Minimal — don't obstruct the world view
- Top-right corner: Save and Load buttons
- Mobile only: virtual joystick overlay + jump button
- First-load modal: seed input (or random), New Game / Continue

## Known Constraints
- Everything is client-side — no backend
- Audio won't play until the first user gesture (browser autoplay policy)
- GitHub Pages `base` path must match the repo name exactly
