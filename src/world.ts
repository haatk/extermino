/**
 * Procedural world generation: terrain and trees, all derived deterministically
 * from the seed. Re-running with the same seed produces an identical world.
 */

import type { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';

import { ValueNoise2D } from './noise';
import { createRng, randomRange, randomInt, type RandomFn } from './rng';

/** Tunables for terrain shape and tree distribution. */
const WORLD = {
  /** Side length of the terrain plane, in world units. */
  size: 400,
  /** Grid subdivisions — higher = smoother hills, heavier mesh. */
  subdivisions: 200,
  /** Horizontal scale of the noise (smaller = broader, gentler hills). */
  noiseScale: 0.012,
  /** Peak-to-trough terrain height. */
  heightAmplitude: 14,
  /** Number of placeholder trees to scatter. */
  treeCount: 120,
  /** Keep trees out of this radius around the spawn point. */
  spawnClearRadius: 8,
} as const;

export class World {
  readonly seed: string;
  readonly terrain: Mesh;

  private readonly noise: ValueNoise2D;
  private readonly trees: Mesh[] = [];

  constructor(scene: Scene, seed: string, shadowGenerator?: ShadowGenerator) {
    this.seed = seed;
    this.noise = new ValueNoise2D(`${seed}:terrain`);

    this.terrain = this.buildTerrain(scene);
    if (shadowGenerator) {
      this.terrain.receiveShadows = true;
    }

    this.scatterTrees(scene, shadowGenerator);
  }

  /**
   * Height of the terrain at world-space (x, z). Used both to displace the mesh
   * and to keep the player grounded. The two must agree, so they share this one
   * function.
   */
  getHeightAt(x: number, z: number): number {
    return this.noise.fbm(x * WORLD.noiseScale, z * WORLD.noiseScale) * WORLD.heightAmplitude;
  }

  private buildTerrain(scene: Scene): Mesh {
    const ground = CreateGround(
      'terrain',
      {
        width: WORLD.size,
        height: WORLD.size,
        subdivisions: WORLD.subdivisions,
        updatable: true,
      },
      scene,
    );

    // Displace each vertex vertically by the shared height function.
    const positions = ground.getVerticesData(VertexBuffer.PositionKind);
    if (positions) {
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i] ?? 0;
        const z = positions[i + 2] ?? 0;
        positions[i + 1] = this.getHeightAt(x, z);
      }
      ground.updateVerticesData(VertexBuffer.PositionKind, positions);
      ground.createNormals(true);
    }

    // Placeholder grassland material until the PBR grass textures land.
    const grass = new StandardMaterial('grassMat', scene);
    grass.diffuseColor = new Color3(0.33, 0.55, 0.27);
    grass.specularColor = new Color3(0.02, 0.02, 0.02);
    ground.material = grass;

    return ground;
  }

  private scatterTrees(scene: Scene, shadowGenerator?: ShadowGenerator): void {
    // A dedicated RNG stream for tree placement keeps it independent of any
    // other seed-derived randomness we add later.
    const rng: RandomFn = createRng(`${this.seed}:trees`);

    const trunkMat = new StandardMaterial('trunkMat', scene);
    trunkMat.diffuseColor = new Color3(0.4, 0.26, 0.15);
    trunkMat.specularColor = new Color3(0, 0, 0);

    const leafMat = new StandardMaterial('leafMat', scene);
    leafMat.diffuseColor = new Color3(0.18, 0.42, 0.2);
    leafMat.specularColor = new Color3(0, 0, 0);

    const half = WORLD.size / 2;

    for (let i = 0; i < WORLD.treeCount; i++) {
      const x = randomRange(rng, -half, half);
      const z = randomRange(rng, -half, half);

      // Leave the spawn area clear.
      if (Math.hypot(x, z) < WORLD.spawnClearRadius) {
        continue;
      }

      const y = this.getHeightAt(x, z);
      const scale = randomRange(rng, 0.8, 1.6);
      const trunkHeight = randomRange(rng, 2.5, 4) * scale;
      const canopyRadius = randomRange(rng, 1.4, 2.4) * scale;
      const rotation = randomRange(rng, 0, Math.PI * 2);
      const species = randomInt(rng, 0, 1); // 0 = oak-ish, 1 = birch-ish

      const trunk = CreateCylinder(
        `tree_trunk_${i}`,
        { height: trunkHeight, diameterTop: 0.3 * scale, diameterBottom: 0.5 * scale, tessellation: 6 },
        scene,
      );
      trunk.position = new Vector3(x, y + trunkHeight / 2, z);
      trunk.rotation.y = rotation;
      trunk.material = trunkMat;

      const canopy = CreateSphere(
        `tree_canopy_${i}`,
        { diameter: canopyRadius * 2, segments: 6 },
        scene,
      );
      canopy.position = new Vector3(x, y + trunkHeight + canopyRadius * 0.6, z);
      canopy.scaling.y = species === 1 ? 1.4 : 1.0; // birches a touch taller
      canopy.material = leafMat;
      canopy.parent = trunk;

      if (shadowGenerator) {
        shadowGenerator.addShadowCaster(trunk);
        shadowGenerator.addShadowCaster(canopy);
      }

      this.trees.push(trunk);
    }
  }

  dispose(): void {
    this.terrain.dispose();
    for (const tree of this.trees) {
      tree.dispose(false, true);
    }
    this.trees.length = 0;
  }
}
