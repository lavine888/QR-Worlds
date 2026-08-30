import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
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

const dummy = new THREE.Object3D();
const WHITE = new THREE.Color('#ffffff');
const DARK = new THREE.Color('#111111');
const workingColor = new THREE.Color();

function rangeProgress(value: number, start: number, end: number) {
  const local = THREE.MathUtils.clamp((value - start) / Math.max(0.001, end - start), 0, 1);
  return THREE.MathUtils.smootherstep(local, 0, 1);
}

function groupByKind(blocks: VoxelBlock[]) {
  const grouped: Record<VoxelKind, VoxelBlock[]> = {
    light: [],
    blossom: [],
    trunk: [],
    grass: [],
  };
  blocks.forEach((block) => grouped[block.kind].push(block));
  return grouped;
}

function writeBlocks(mesh: THREE.InstancedMesh | null, items: VoxelBlock[], progress: number) {
  if (!mesh) return;
  const fill = THREE.MathUtils.lerp(0.92, 1, rangeProgress(progress, 0.34, 0.9));
  const height = THREE.MathUtils.lerp(0.94, 0.995, rangeProgress(progress, 0.46, 0.96));

  items.forEach((item, index) => {
    dummy.position.set(item.x, item.y + 0.5, item.z);
    const gardenJitter = 1 + (item.tone - 0.5) * 0.035 * (1 - progress);
    dummy.scale.set(fill * gardenJitter, height, fill * gardenJitter);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

export function VoxelWorld({ matrix, seedText, worldSeed, theme, progress }: VoxelWorldProps) {
  const lightRef = useRef<THREE.InstancedMesh>(null);
  const blossomRef = useRef<THREE.InstancedMesh>(null);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const lastProgress = useRef(-1);
  const seed = useMemo(() => hashString(`${seedText}:${worldSeed}:voxel`), [seedText, worldSeed]);
  const world = useMemo(() => generateVoxelWorld(matrix, seed), [matrix, seed]);
  const blocks = useMemo(() => groupByKind(world.blocks), [world.blocks]);

  const lightMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: theme.lightTile, roughness: 0.93, metalness: 0 }),
    [theme.lightTile],
  );
  const blossomMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: theme.blossom, roughness: 0.88, metalness: 0 }),
    [theme.blossom],
  );
  const trunkMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: theme.trunk, roughness: 0.95, metalness: 0 }),
    [theme.trunk],
  );
  const grassMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: theme.leaf, roughness: 0.94, metalness: 0 }),
    [theme.leaf],
  );

  useLayoutEffect(() => {
    [lightRef.current, blossomRef.current, trunkRef.current, grassRef.current].forEach((mesh) => {
      if (mesh) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    });
    writeBlocks(lightRef.current, blocks.light, progress.current);
    writeBlocks(blossomRef.current, blocks.blossom, progress.current);
    writeBlocks(trunkRef.current, blocks.trunk, progress.current);
    writeBlocks(grassRef.current, blocks.grass, progress.current);
    lastProgress.current = -1;
  }, [blocks, progress]);

  useFrame(() => {
    const p = THREE.MathUtils.clamp(progress.current, 0, 1);
    if (Math.abs(p - lastProgress.current) < 0.0002) return;
    lastProgress.current = p;

    writeBlocks(lightRef.current, blocks.light, p);
    writeBlocks(blossomRef.current, blocks.blossom, p);
    writeBlocks(trunkRef.current, blocks.trunk, p);
    writeBlocks(grassRef.current, blocks.grass, p);

    const scanColorAmount = rangeProgress(p, 0.55, 0.98);
    workingColor.set(theme.lightTile).lerp(WHITE, scanColorAmount);
    lightMaterial.color.copy(workingColor);

    workingColor.set(theme.blossom).lerp(DARK, scanColorAmount);
    blossomMaterial.color.copy(workingColor);
    workingColor.set(theme.trunk).lerp(DARK, scanColorAmount);
    trunkMaterial.color.copy(workingColor);
    workingColor.set(theme.leaf).lerp(DARK, scanColorAmount);
    grassMaterial.color.copy(workingColor);
  });

  return (
    <group>
      <instancedMesh ref={lightRef} args={[undefined, undefined, blocks.light.length]} receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={lightMaterial} attach="material" />
      </instancedMesh>
      <instancedMesh ref={blossomRef} args={[undefined, undefined, blocks.blossom.length]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={blossomMaterial} attach="material" />
      </instancedMesh>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, blocks.trunk.length]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={trunkMaterial} attach="material" />
      </instancedMesh>
      <instancedMesh ref={grassRef} args={[undefined, undefined, blocks.grass.length]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={grassMaterial} attach="material" />
      </instancedMesh>
    </group>
  );
}
