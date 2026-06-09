/**
 * Sky, sun and shadows. Builds a SkyMaterial dome, a directional "sun" light
 * positioned to match the sky's sun, and a shadow generator for tree shadows.
 */

import type { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { SkyMaterial } from '@babylonjs/materials/sky/skyMaterial';

// Shadow generator depends on the shadow map renderer being registered.
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';

export interface SkySystem {
  sun: DirectionalLight;
  shadowGenerator: ShadowGenerator;
}

/** Direction the sun sits in the sky, as an azimuth/elevation pair. */
const SUN_AZIMUTH = 0.3;
const SUN_INCLINATION = 0.6; // 0 = horizon, ~0.5 = high noon-ish

export function createSky(scene: Scene): SkySystem {
  scene.clearColor = new Color4(0.49, 0.75, 0.93, 1);

  // --- Sky dome ---------------------------------------------------------
  const skyMaterial = new SkyMaterial('skyMaterial', scene);
  skyMaterial.backFaceCulling = false;
  skyMaterial.turbidity = 6;
  skyMaterial.luminance = 1;
  skyMaterial.inclination = SUN_INCLINATION;
  skyMaterial.azimuth = SUN_AZIMUTH;

  const skybox = CreateBox('skyBox', { size: 2000 }, scene);
  skybox.material = skyMaterial;
  skybox.infiniteDistance = true;

  // Compute the sun's world direction from the same azimuth/inclination the
  // SkyMaterial uses, so the directional light lines up with the painted sun.
  const theta = Math.PI * (SUN_INCLINATION - 0.5);
  const phi = 2 * Math.PI * (SUN_AZIMUTH - 0.5);
  const sunPosition = new Vector3(
    Math.cos(phi),
    Math.sin(theta),
    Math.sin(phi),
  );
  skyMaterial.useSunPosition = true;
  skyMaterial.sunPosition = sunPosition;

  // --- Lights -----------------------------------------------------------
  const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.55;
  ambient.diffuse = new Color3(0.9, 0.95, 1);
  ambient.groundColor = new Color3(0.4, 0.45, 0.35);

  const sun = new DirectionalLight('sun', sunPosition.scale(-1), scene);
  sun.position = sunPosition.scale(120);
  sun.intensity = 1.1;
  sun.diffuse = new Color3(1, 0.96, 0.86);

  // --- Shadows ----------------------------------------------------------
  const shadowGenerator = new ShadowGenerator(1024, sun);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 16;
  shadowGenerator.darkness = 0.4;

  return { sun, shadowGenerator };
}
