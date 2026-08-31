import { useFrame } from '@react-three/fiber';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from 'react';
import * as THREE from 'three';
import { hashString } from '../procedural/hash';
import {
  generateVoxelWorld,
  type VoxelBlock,
  type VoxelKind,
} from '../procedural/voxelWorldGenerator';
import type { QRMatrix } from '../qr/generateQR';
import type { WorldTheme } from './themes';

type VoxelWorldProps = {
  matrix: QRMatrix;
  seedText: string;
  worldSeed: number;
  theme: WorldTheme;
  progress: MutableRefObject<number>;
};

const BLOCK_SIZE = 0.0245;
const ISO_ANGLE_Y = 0.78;
const ISO_ANGLE_X = -0.55;
const FLAT_ANGLE_Y = 0;
const FLAT_ANGLE_X = -Math.PI / 2;
const VIEW_SCALE_3D = 1.6;
const VIEW_SCALE_2D = 2.1;

const dummy = new THREE.Object3D();
const rotY = new THREE.Matrix4();
const rotX = new THREE.Matrix4();
const rotationMatrix = new THREE.Matrix4();
const WHITE = new THREE.Color(1, 1, 1);
const BLACK = new THREE.Color(0.018, 0.018, 0.018);
const workingColor = new THREE.Color();

function smooth(value: number) {
  return THREE.MathUtils.smootherstep(THREE.MathUtils.clamp(value, 0, 1), 0, 1);
}

function groupByKind(blocks: VoxelBlock[]) {
  const grouped: Record<VoxelKind, VoxelBlock[]> = {
    dirt: [],
    blossom: [],
    trunk: [],
    grass: [],
    fallen: [],
  };
  blocks.forEach((block) => grouped[block.kind].push(block));
  return grouped;
}

function mix3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
) {
  return workingColor.setRGB(
    THREE.MathUtils.lerp(a[0], b[0], t),
    THREE.MathUtils.lerp(a[1], b[1], t),
    THREE.MathUtils.lerp(a[2], b[2], t),
  );
}

const palette = {
  dirtLight: [1.0, 0.98, 0.94] as const,
  dirtDark: [0.92, 0.88, 0.82] as const,
  sakuraLight: [0.70, 0.25, 0.38] as const,
  sakuraDeep: [0.36, 0.07, 0.18] as const,
  barkLight: [0.34, 0.18, 0.07] as const,
  barkDeep: [0.14, 0.06, 0.02] as const,
  grassLight: [0.12, 0.38, 0.08] as const,
  grassDark: [0.05, 0.18, 0.04] as const,
  fallenLight: [0.52, 0.42, 0.30] as const,
  fallenDark: [0.32, 0.42, 0.24] as const,
};

function referenceColor(kind: VoxelKind, tone: number, scanAmount: number) {
  let color: THREE.Color;
  switch (kind) {
    case 'dirt':
      color = mix3(palette.dirtLight, palette.dirtDark, tone * 0.82);
      color.lerp(WHITE, scanAmount);
      break;
    case 'blossom':
      color = mix3(palette.sakuraLight, palette.sakuraDeep, tone);
      color.multiplyScalar(0.82 + Math.min(0.18, tone * 0.18));
      color.lerp(BLACK, scanAmount);
      break;
    case 'trunk':
      color = mix3(palette.barkLight, palette.barkDeep, tone);
      color.lerp(BLACK, scanAmount);
      break;
    case 'grass':
      color = mix3(palette.grassLight, palette.grassDark, tone);
      color.lerp(BLACK, scanAmount);
      break;
    case 'fallen':
      color = mix3(palette.fallenLight, palette.fallenDark, tone);
      color.lerp(BLACK, scanAmount);
      break;
  }
  return color;
}

function writeInstances(
  mesh: THREE.InstancedMesh | null,
  items: VoxelBlock[],
  kind: VoxelKind,
  scanAmount: number,
) {
  if (!mesh) return;

  items.forEach((item, index) => {
    dummy.position.set(item.x, item.y + 0.5, item.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, referenceColor(kind, item.tone, scanAmount));
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function makeMaterial() {
  return new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
  });
}

export function VoxelWorld({ matrix, seedText, worldSeed, progress }: VoxelWorldProps) {
  const rootRef = useRef<THREE.Group>(null);
  const dirtRef = useRef<THREE.InstancedMesh>(null);
  const blossomRef = useRef<THREE.InstancedMesh>(null);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const fallenRef = useRef<THREE.InstancedMesh>(null);
  const lastProgress = useRef(-1);
  const seed = useMemo(() => hashString(`${seedText}:${worldSeed}:reference`), [seedText, worldSeed]);
  const world = useMemo(() => generateVoxelWorld(matrix, seed), [matrix, seed]);
  const blocks = useMemo(() => groupByKind(world.blocks), [world.blocks]);

  const materials = useMemo(
    () => ({
      dirt: makeMaterial(),
      blossom: makeMaterial(),
      trunk: makeMaterial(),
      grass: makeMaterial(),
      fallen: makeMaterial(),
    }),
    [],
  );

  useLayoutEffect(() => {
    const meshes = [dirtRef.current, blossomRef.current, trunkRef.current, grassRef.current, fallenRef.current];
    meshes.forEach((mesh) => {
      if (mesh) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    });
    writeInstances(dirtRef.current, blocks.dirt, 'dirt', 0);
    writeInstances(blossomRef.current, blocks.blossom, 'blossom', 0);
    writeInstances(trunkRef.current, blocks.trunk, 'trunk', 0);
    writeInstances(grassRef.current, blocks.grass, 'grass', 0);
    writeInstances(fallenRef.current, blocks.fallen, 'fallen', 0);
    lastProgress.current = -1;
  }, [blocks]);

  useEffect(
    () => () => Object.values(materials).forEach((material) => material.dispose()),
    [materials],
  );

  useFrame(() => {
    const raw = THREE.MathUtils.clamp(progress.current, 0, 1);
    const p = smooth(raw);
    if (Math.abs(lastProgress.current - p) < 0.0002) return;
    lastProgress.current = p;

    const angleY = THREE.MathUtils.lerp(ISO_ANGLE_Y, FLAT_ANGLE_Y, p);
    const angleX = THREE.MathUtils.lerp(ISO_ANGLE_X, FLAT_ANGLE_X, p);
    const viewScale = THREE.MathUtils.lerp(VIEW_SCALE_3D, VIEW_SCALE_2D, p);

    if (rootRef.current) {
      rotY.makeRotationY(-angleY);
      rotX.makeRotationX(angleX);
      rotationMatrix.multiplyMatrices(rotX, rotY);
      rootRef.current.quaternion.setFromRotationMatrix(rotationMatrix);
      rootRef.current.scale.setScalar(BLOCK_SIZE * viewScale);
      rootRef.current.position.set(
        THREE.MathUtils.lerp(0, 0.015, p),
        THREE.MathUtils.lerp(0, 0.08, p),
        0,
      );
    }

    const scanAmount = smooth((p - 0.58) / 0.42);
    writeInstances(dirtRef.current, blocks.dirt, 'dirt', scanAmount);
    writeInstances(blossomRef.current, blocks.blossom, 'blossom', scanAmount);
    writeInstances(trunkRef.current, blocks.trunk, 'trunk', scanAmount);
    writeInstances(grassRef.current, blocks.grass, 'grass', scanAmount);
    writeInstances(fallenRef.current, blocks.fallen, 'fallen', scanAmount);
  });

  return (
    <group ref={rootRef}>
      <instancedMesh ref={dirtRef} args={[undefined, undefined, blocks.dirt.length]} receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={materials.dirt} attach="material" />
      </instancedMesh>
      <instancedMesh ref={fallenRef} args={[undefined, undefined, blocks.fallen.length]} receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={materials.fallen} attach="material" />
      </instancedMesh>
      <instancedMesh ref={grassRef} args={[undefined, undefined, blocks.grass.length]} receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={materials.grass} attach="material" />
      </instancedMesh>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, blocks.trunk.length]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={materials.trunk} attach="material" />
      </instancedMesh>
      <instancedMesh ref={blossomRef} args={[undefined, undefined, blocks.blossom.length]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={materials.blossom} attach="material" />
      </instancedMesh>
    </group>
  );
}
