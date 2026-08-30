import * as THREE from 'three';

type StoredMorphGeometry = THREE.BufferGeometry & {
  userData: {
    gardenPositions: Float32Array;
    scanPositions: Float32Array;
  };
};

function squareBoundary(angle: number): [number, number] {
  const x = Math.sin(angle);
  const y = Math.cos(angle);
  const amount = 0.5 / Math.max(Math.abs(x), Math.abs(y), 0.0001);
  return [x * amount, y * amount];
}

function createFanGeometry(
  perimeterCount: number,
  gardenPoint: (angle: number, index: number) => [number, number, number],
) {
  const gardenPositions = new Float32Array((perimeterCount + 1) * 3);
  const scanPositions = new Float32Array((perimeterCount + 1) * 3);
  const indices: number[] = [];

  gardenPositions.set([0, 0, 0.08], 0);
  scanPositions.set([0, 0, 0], 0);
  for (let index = 0; index < perimeterCount; index += 1) {
    const angle = (index / perimeterCount) * Math.PI * 2;
    gardenPositions.set(gardenPoint(angle, index), (index + 1) * 3);
    const [scanX, scanY] = squareBoundary(angle);
    scanPositions.set([scanX, scanY, 0], (index + 1) * 3);
    indices.push(0, index + 1, ((index + 1) % perimeterCount) + 1);
  }

  const geometry = new THREE.BufferGeometry() as StoredMorphGeometry;
  geometry.setAttribute('position', new THREE.BufferAttribute(gardenPositions.slice(), 3));
  geometry.setIndex(indices);
  geometry.userData.gardenPositions = gardenPositions;
  geometry.userData.scanPositions = scanPositions;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createLeafMorphGeometry() {
  return createFanGeometry(16, (angle) => {
    const vertical = Math.cos(angle);
    const width = Math.sin(angle) * 0.34 * (0.82 + Math.max(0, vertical) * 0.18);
    const length = vertical >= 0 ? 0.72 : 0.5;
    const y = vertical * length;
    const z = 0.035 + (1 - Math.min(1, Math.abs(width) / 0.34)) * 0.065;
    return [width, y, z];
  });
}

export function createFlowerMorphGeometry() {
  return createFanGeometry(30, (angle) => {
    const petal = Math.pow(Math.max(0, Math.cos(angle * 5)), 0.58);
    const radius = 0.27 + petal * 0.2;
    return [
      Math.sin(angle) * radius,
      Math.cos(angle) * radius,
      0.018 + petal * 0.035,
    ];
  });
}

export function createGroundMorphGeometry() {
  return createFanGeometry(48, (angle, index) => {
    const wobble = 1 + Math.sin(index * 2.17) * 0.035 + Math.cos(index * 0.83) * 0.025;
    return [Math.cos(angle) * 0.5 * wobble, Math.sin(angle) * 0.42 * wobble, 0];
  });
}

export function updateMorphGeometry(geometry: THREE.BufferGeometry, amount: number) {
  const stored = geometry as StoredMorphGeometry;
  const garden = stored.userData.gardenPositions;
  const scan = stored.userData.scanPositions;
  const attribute = stored.getAttribute('position') as THREE.BufferAttribute;
  const positions = attribute.array as Float32Array;
  for (let index = 0; index < positions.length; index += 1) {
    positions[index] = THREE.MathUtils.lerp(garden[index], scan[index], amount);
  }
  attribute.needsUpdate = true;
  stored.computeVertexNormals();
}
