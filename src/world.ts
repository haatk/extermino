/**
 * Procedural world generation: terrain and trees, all derived deterministically
 * from the seed. Re-running with the same seed produces an identical world.
 *
 * The world streams in chunk by chunk around the player: terrain tiles and their
 * trees are built when the player nears them and disposed once they fall outside
 * the load radius, so memory and draw calls stay bounded no matter how far the
 * player roams. Trees are drawn with `InstancedMesh` (one prototype per species)
 * and their trunks act as collision bodies.
 */

import type { Scene } from '@babylonjs/core/scene';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';

// Register the glTF loader so SceneLoader can import .glb tree models.
import '@babylonjs/loaders/glTF';

import { ValueNoise2D } from './noise';
import { createRng, randomRange, randomInt, type RandomFn } from './rng';

/** Tunables for terrain shape, chunk streaming and tree distribution. */
const WORLD = {
  /** Side length of one terrain chunk, in world units. */
  chunkSize: 64,
  /** Grid subdivisions per chunk — higher = smoother hills, heavier mesh. */
  chunkSubdivisions: 24,
  /** How many chunks out from the player's chunk to keep loaded (radius). */
  loadRadius: 1,
  /** Within this chunk radius, trees cast shadows; beyond it they do not. */
  shadowRadius: 0,
  /** Horizontal scale of the noise (smaller = broader, gentler hills). */
  noiseScale: 0.012,
  /** Peak-to-trough terrain height. */
  heightAmplitude: 14,
  /** Trees per chunk (inclusive range), chosen deterministically per chunk. */
  treesPerChunkMin: 6,
  treesPerChunkMax: 10,
  /** Keep trees out of this radius around the world origin (spawn point). */
  spawnClearRadius: 8,
  /** Maximum distance from player at which trees are visible (for culling). */
  treeCullDistance: 80,
} as const;

/** The two tree species we place. */
type Species = 'oak' | 'birch';
const SPECIES: readonly Species[] = ['oak', 'birch'];

/**
 * A reusable prototype that instances are cloned from. `trunk` is always the
 * collision body; when a GLB canopy supplies the visuals the trunk instances are
 * kept invisible (`trunkVisible = false`). `canopy` carries the foliage geometry
 * and casts the shadow.
 */
interface TreePrototype {
  trunk: Mesh;
  canopy: Mesh;
  trunkVisible: boolean;
}

/** A single loaded chunk: its terrain tile plus the tree instances on it. */
interface Chunk {
  cx: number;
  cz: number;
  ground: Mesh;
  instances: InstancedMesh[];
  /** Instances that should cast shadows while this chunk is near the player. */
  casters: InstancedMesh[];
  casting: boolean;
}

export class World {
  readonly seed: string;

  private readonly noise: ValueNoise2D;
  private readonly chunks = new Map<string, Chunk>();
  private readonly prototypes: Record<Species, TreePrototype>;
  private readonly grassMaterial: PBRMaterial;

  private constructor(
    private readonly scene: Scene,
    seed: string,
    prototypes: Record<Species, TreePrototype>,
    grassMaterial: PBRMaterial,
    private readonly shadowGenerator?: ShadowGenerator,
  ) {
    this.seed = seed;
    this.noise = new ValueNoise2D(`${seed}:terrain`);
    this.prototypes = prototypes;
    this.grassMaterial = grassMaterial;
  }

  /**
   * Async factory: loads (or falls back to building) the shared tree prototypes
   * and grass material, then streams in the chunks around the spawn point so the
   * player has ground beneath them immediately.
   */
  static async create(
    scene: Scene,
    seed: string,
    spawn: Vector3,
    shadowGenerator?: ShadowGenerator,
  ): Promise<World> {
    const grassMaterial = createGrassMaterial(scene);
    const prototypes: Record<Species, TreePrototype> = {
      oak: await loadTreePrototype(scene, 'oak', new Color3(0.4, 0.27, 0.16), new Color3(0.17, 0.4, 0.18)),
      birch: await loadTreePrototype(scene, 'birch', new Color3(0.82, 0.82, 0.78), new Color3(0.4, 0.6, 0.28)),
    };

    const world = new World(scene, seed, prototypes, grassMaterial, shadowGenerator);
    world.update(spawn);
    return world;
  }

  /**
   * Height of the terrain at world-space (x, z). Used to displace the mesh, to
   * seat trees on the ground, and to drop the player onto the surface at spawn.
   */
  getHeightAt(x: number, z: number): number {
    return this.noise.fbm(x * WORLD.noiseScale, z * WORLD.noiseScale) * WORLD.heightAmplitude;
  }

  /**
   * Stream chunks around the player: build any newly-needed chunks, dispose any
   * that have fallen outside the load radius, and toggle tree shadow-casting so
   * only nearby trees cast. Cull tree instances beyond the render distance.
   * Cheap to call every frame.
   */
  update(playerPos: Vector3): void {
    const pcx = Math.floor(playerPos.x / WORLD.chunkSize);
    const pcz = Math.floor(playerPos.z / WORLD.chunkSize);

    // Load the disc of chunks within loadRadius of the player's chunk.
    for (let dz = -WORLD.loadRadius; dz <= WORLD.loadRadius; dz++) {
      for (let dx = -WORLD.loadRadius; dx <= WORLD.loadRadius; dx++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = chunkKey(cx, cz);
        let chunk = this.chunks.get(key);
        if (!chunk) {
          chunk = this.buildChunk(cx, cz);
          this.chunks.set(key, chunk);
        }
        this.setChunkCasting(chunk, Math.max(Math.abs(dx), Math.abs(dz)) <= WORLD.shadowRadius);
      }
    }

    // Unload chunks the player has left behind.
    for (const [key, chunk] of this.chunks) {
      if (Math.abs(chunk.cx - pcx) > WORLD.loadRadius || Math.abs(chunk.cz - pcz) > WORLD.loadRadius) {
        this.disposeChunk(chunk);
        this.chunks.delete(key);
      }
    }

    // Distance-based instance culling: hide trees beyond the cull distance.
    const cullDistSq = WORLD.treeCullDistance * WORLD.treeCullDistance;
    for (const chunk of this.chunks.values()) {
      for (const instance of chunk.instances) {
        const dx = instance.position.x - playerPos.x;
        const dz = instance.position.z - playerPos.z;
        const distSq = dx * dx + dz * dz;
        instance.isVisible = distSq <= cullDistSq;
      }
    }
  }

  private buildChunk(cx: number, cz: number): Chunk {
    const ground = this.buildTerrainTile(cx, cz);
    const { instances, casters } = this.scatterTrees(cx, cz);
    return { cx, cz, ground, instances, casters, casting: false };
  }

  /** Build one displaced, collidable terrain tile for chunk (cx, cz). */
  private buildTerrainTile(cx: number, cz: number): Mesh {
    const ground = CreateGround(
      `terrain_${cx}_${cz}`,
      {
        width: WORLD.chunkSize,
        height: WORLD.chunkSize,
        subdivisions: WORLD.chunkSubdivisions,
        updatable: true,
      },
      this.scene,
    );
    // Centre the tile on its chunk; the ground builder centres the mesh on origin.
    ground.position.set(cx * WORLD.chunkSize + WORLD.chunkSize / 2, 0, cz * WORLD.chunkSize + WORLD.chunkSize / 2);

    // Displace each vertex by the shared world-space height function so adjacent
    // tiles line up seamlessly along their shared edge.
    const positions = ground.getVerticesData(VertexBuffer.PositionKind);
    if (positions) {
      const baseX = ground.position.x;
      const baseZ = ground.position.z;
      for (let i = 0; i < positions.length; i += 3) {
        const worldX = (positions[i] ?? 0) + baseX;
        const worldZ = (positions[i + 2] ?? 0) + baseZ;
        positions[i + 1] = this.getHeightAt(worldX, worldZ);
      }
      ground.updateVerticesData(VertexBuffer.PositionKind, positions);
      ground.createNormals(true);
    }

    ground.material = this.grassMaterial;
    ground.checkCollisions = true;
    if (this.shadowGenerator) {
      ground.receiveShadows = true;
    }
    return ground;
  }

  /** Place this chunk's trees as instances of the shared species prototypes. */
  private scatterTrees(cx: number, cz: number): { instances: InstancedMesh[]; casters: InstancedMesh[] } {
    const rng: RandomFn = createRng(`${this.seed}:chunk:${cx}:${cz}`);
    const originX = cx * WORLD.chunkSize;
    const originZ = cz * WORLD.chunkSize;

    const count = randomInt(rng, WORLD.treesPerChunkMin, WORLD.treesPerChunkMax);
    const instances: InstancedMesh[] = [];
    const casters: InstancedMesh[] = [];

    for (let i = 0; i < count; i++) {
      const x = originX + randomRange(rng, 0, WORLD.chunkSize);
      const z = originZ + randomRange(rng, 0, WORLD.chunkSize);

      // Keep the spawn area around the world origin clear.
      if (Math.hypot(x, z) < WORLD.spawnClearRadius) {
        continue;
      }

      const y = this.getHeightAt(x, z);
      const scale = randomRange(rng, 0.8, 1.6);
      const rotation = randomRange(rng, 0, Math.PI * 2);
      const species = SPECIES[randomInt(rng, 0, SPECIES.length - 1)] ?? 'oak';
      const proto = this.prototypes[species];

      const trunk = proto.trunk.createInstance(`trunk_${cx}_${cz}_${i}`);
      trunk.position.set(x, y, z);
      trunk.scaling.setAll(scale);
      trunk.rotation.y = rotation;
      trunk.isVisible = proto.trunkVisible;
      // The trunk doubles as the tree's collision body.
      trunk.checkCollisions = true;

      const canopy = proto.canopy.createInstance(`canopy_${cx}_${cz}_${i}`);
      canopy.position.set(x, y, z);
      canopy.scaling.setAll(scale);
      canopy.rotation.y = rotation;

      instances.push(trunk, canopy);
      // Only the foliage casts shadows — cheaper and avoids thin trunk artifacts.
      casters.push(canopy);
    }

    return { instances, casters };
  }

  /** Toggle whether a chunk's trees cast shadows (only nearby ones should). */
  private setChunkCasting(chunk: Chunk, casting: boolean): void {
    if (!this.shadowGenerator || chunk.casting === casting) return;
    chunk.casting = casting;
    for (const mesh of chunk.casters) {
      if (casting) {
        this.shadowGenerator.addShadowCaster(mesh);
      } else {
        this.shadowGenerator.removeShadowCaster(mesh);
      }
    }
  }

  private disposeChunk(chunk: Chunk): void {
    this.setChunkCasting(chunk, false);
    for (const inst of chunk.instances) {
      inst.dispose();
    }
    chunk.ground.dispose();
  }

  dispose(): void {
    for (const chunk of this.chunks.values()) {
      this.disposeChunk(chunk);
    }
    this.chunks.clear();
    for (const species of SPECIES) {
      this.prototypes[species].trunk.dispose();
      this.prototypes[species].canopy.dispose();
    }
    this.grassMaterial.dispose();
  }
}

// --- Asset loading --------------------------------------------------------

/** Key a chunk by its integer chunk coordinates. */
function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

/**
 * PBR grass material built from the texture set in `public/textures/`. If the
 * files are absent the textures simply fail to load and the flat albedo colour
 * shows through, so the world still renders.
 */
function createGrassMaterial(scene: Scene): PBRMaterial {
  const mat = new PBRMaterial('grassMat', scene);
  mat.albedoColor = new Color3(0.33, 0.55, 0.27);
  mat.metallic = 0;
  mat.roughness = 1;

  const tile = WORLD.chunkSize / 8; // texture repeats across one chunk
  const tiled = (url: string): Texture => {
    const tex = new Texture(url, scene);
    tex.uScale = tile;
    tex.vScale = tile;
    return tex;
  };

  mat.albedoTexture = tiled('/textures/grass_albedo.jpg');
  mat.bumpTexture = tiled('/textures/grass_normal.jpg');
  // Roughness packed in the green channel of the metallic texture (glTF style).
  mat.metallicTexture = tiled('/textures/grass_roughness.jpg');
  mat.useRoughnessFromMetallicTextureAlpha = false;
  mat.useRoughnessFromMetallicTextureGreen = true;
  mat.ambientTexture = tiled('/textures/grass_ao.jpg');

  return mat;
}

/**
 * Load a GLB tree model from `public/models/` to use as an instancing source.
 * The visible foliage comes from the GLB; an invisible procedural cylinder backs
 * it as a clean collision body. If the model is missing we fall back to a fully
 * procedural trunk + canopy so the world is never empty.
 */
async function loadTreePrototype(
  scene: Scene,
  species: Species,
  trunkColor: Color3,
  leafColor: Color3,
): Promise<TreePrototype> {
  try {
    const result = await SceneLoader.ImportMeshAsync('', '/models/', `${species}.glb`, scene);
    const renderable = result.meshes.filter(
      (m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0,
    );
    if (renderable.length > 0) {
      const canopy = Mesh.MergeMeshes(renderable, true, true, undefined, false, true);
      if (canopy) {
        canopy.name = `proto_${species}_canopy`;
        parkPrototype(canopy);
        const trunk = buildTrunkMesh(scene, species, trunkColor);
        return { trunk, canopy, trunkVisible: false };
      }
    }
  } catch {
    // Fall through to the procedural fallback below.
  }
  return buildProceduralPrototype(scene, species, trunkColor, leafColor);
}

/** A lightweight trunk + canopy prototype, used when no GLB model is present. */
function buildProceduralPrototype(
  scene: Scene,
  species: Species,
  trunkColor: Color3,
  leafColor: Color3,
): TreePrototype {
  const trunk = buildTrunkMesh(scene, species, trunkColor);

  const leafMat = new StandardMaterial(`proto_${species}_leafMat`, scene);
  leafMat.diffuseColor = leafColor;
  leafMat.specularColor = new Color3(0, 0, 0);

  const canopyRadius = species === 'birch' ? 1.7 : 2.1;
  const canopy = CreateSphere(`proto_${species}_canopy`, { diameter: canopyRadius * 2, segments: 8 }, scene);
  // Seat the canopy above the trunk; the trunk base sits at the instance origin.
  canopy.bakeTransformIntoVertices(Matrix.Translation(0, TRUNK_HEIGHT + canopyRadius * 0.5, 0));
  if (species === 'birch') {
    canopy.scaling.y = 1.3; // birches a touch taller and narrower
  }
  canopy.material = leafMat;
  parkPrototype(canopy);

  return { trunk, canopy, trunkVisible: true };
}

const TRUNK_HEIGHT = 3.2;

/** Build a trunk cylinder whose base sits at the local origin (y = 0). */
function buildTrunkMesh(scene: Scene, species: Species, trunkColor: Color3): Mesh {
  const trunk = CreateCylinder(
    `proto_${species}_trunk`,
    { height: TRUNK_HEIGHT, diameterTop: 0.3, diameterBottom: 0.5, tessellation: 6 },
    scene,
  );
  // The builder centres the cylinder on its origin; lift it so the base is at y=0.
  trunk.bakeTransformIntoVertices(Matrix.Translation(0, TRUNK_HEIGHT / 2, 0));

  const trunkMat = new StandardMaterial(`proto_${species}_trunkMat`, scene);
  trunkMat.diffuseColor = trunkColor;
  trunkMat.specularColor = new Color3(0, 0, 0);
  trunk.material = trunkMat;

  parkPrototype(trunk);
  return trunk;
}

/**
 * Park a prototype mesh far off-world so it never appears as a stray tree near
 * the player. We keep it enabled and `alwaysSelectAsActiveMesh` so that its
 * instances — which live at their own positions — are reliably rendered every
 * frame regardless of where the prototype itself sits. Per-instance `isVisible`
 * then controls whether each clone is drawn.
 */
function parkPrototype(mesh: Mesh): void {
  mesh.position.set(0, -10000, 0);
  mesh.alwaysSelectAsActiveMesh = true;
}
