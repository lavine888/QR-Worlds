import * as THREE from 'three';

type WindShader = {
  uniforms: Record<string, { value: number }>;
};

type WindShaderMaterial = THREE.MeshStandardMaterial & {
  userData: {
    windShader?: WindShader;
  };
};

export function createWindMaterial(color: string, amplitude = 0.08, vertexColors = false) {
  const material = new THREE.MeshStandardMaterial({
    color,
    vertexColors,
    roughness: 0.88,
    metalness: 0,
  }) as WindShaderMaterial;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = { value: 0 };
    shader.uniforms.uWindAmplitude = { value: amplitude };
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nuniform float uWindTime;\nuniform float uWindAmplitude;',
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nfloat windWave = sin(uWindTime * 1.35 + position.y * 2.7 + position.x * 1.8);\ntransformed.x += windWave * uWindAmplitude * (0.35 + position.y * 0.22);\ntransformed.z += cos(uWindTime * 0.9 + position.z * 2.1) * uWindAmplitude * 0.32;',
    );
    material.userData.windShader = shader;
  };
  material.customProgramCacheKey = () =>
    'qr-garden-wind-v2-' + (vertexColors ? 'instance-colors' : 'plain');
  return material;
}

export function updateWindMaterial(material: THREE.Material | null, time: number, amplitude = 1) {
  const windMaterial = material as WindShaderMaterial | null;
  const shader = windMaterial?.userData.windShader;
  if (shader) {
    shader.uniforms.uWindTime.value = time;
    shader.uniforms.uWindAmplitude.value = amplitude;
  }
}
