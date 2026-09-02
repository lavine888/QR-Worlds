import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import {
  generateVoxelWorld,
  type VoxelBlock,
  type VoxelKind,
} from '../procedural/voxelWorldGenerator';
import type { QRMatrix } from '../qr/generateQR';
import type { WorldTheme } from './themes';

type WorldProps = {
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
const X_OFFSET_2D = 0.015;
const Y_OFFSET_2D = 0.08;

const dummy = new THREE.Object3D();
const rotY = new THREE.Matrix4();
const rotX = new THREE.Matrix4();
const rotationMatrix = new THREE.Matrix4();
const workingColor = new THREE.Color();

const palette = {
  dirtLight: [1.0, 0.98, 0.94] as const,
  dirtMid: [0.96, 0.94, 0.88] as const,
  dirtDark: [0.92, 0.88, 0.82] as const,
  sakuraLight: [0.70, 0.25, 0.38] as const,
  sakuraMid: [0.58, 0.18, 0.30] as const,
  sakuraDeep: [0.46, 0.12, 0.24] as const,
  sakuraRich: [0.36, 0.07, 0.18] as const,
  barkLight: [0.34, 0.18, 0.07] as const,
  barkMid: [0.26, 0.13, 0.05] as const,
  barkDark: [0.20, 0.09, 0.03] as const,
  barkDeep: [0.14, 0.06, 0.02] as const,
  grassDark: [0.05, 0.18, 0.04] as const,
  grassMid: [0.07, 0.28, 0.05] as const,
  grassBright: [0.12, 0.38, 0.08] as const,
  fallenBrownLight: [0.52, 0.42, 0.30] as const,
  fallenBrownDark: [0.42, 0.32, 0.22] as const,
  fallenGreenLight: [0.38, 0.48, 0.28] as const,
  fallenGreenDark: [0.32, 0.42, 0.24] as const,
};

type RGB = readonly [number, number, number];

function rgb(color: RGB) {
  return workingColor.setRGB(color[0], color[1], color[2]);
}

function between(a: RGB, b: RGB, t: number) {
  return rgb(a).lerp(new THREE.Color(b[0], b[1], b[2]), THREE.MathUtils.clamp(t, 0, 1));
}

function referenceColor(kind: VoxelKind, tone: number) {
  if (kind === 'dirt') {
    return tone < 0.5
      ? between(palette.dirtLight, palette.dirtMid, tone / 0.5)
      : between(palette.dirtMid, palette.dirtDark, (tone - 0.5) / 0.5);
  }

  if (kind === 'blossom') {
    if (tone < 0.33) return between(palette.sakuraLight, palette.sakuraMid, tone / 0.33);
    if (tone < 0.66) return between(palette.sakuraMid, palette.sakuraDeep, (tone - 0.33) / 0.33);
    return between(palette.sakuraDeep, palette.sakuraRich, (tone - 0.66) / 0.34);
  }

  if (kind === 'trunk') {
    if (tone < 0.33) return between(palette.barkLight, palette.barkMid, tone / 0.33);
    if (tone < 0.66) return between(palette.barkMid, palette.barkDark, (tone - 0.33) / 0.33);
    return between(palette.barkDark, palette.barkDeep, (tone - 0.66) / 0.34);
  }

  if (kind === 'grass') {
    if (tone < 0.3) return between(palette.grassBright, palette.grassMid, tone / 0.3);
    return between(palette.grassMid, palette.grassDark, (tone - 0.3) / 0.7);
  }

  if (tone < 0.5) {
    return between(palette.fallenBrownLight, palette.fallenBrownDark, tone / 0.5);
  }
  return between(palette.fallenGreenLight, palette.fallenGreenDark, (tone - 0.5) / 0.5);
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

function makeMaterial() {
  return new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true });
}

function writeInstances(mesh: THREE.InstancedMesh | null, items: VoxelBlock[]) {
  if (!mesh) return;
  items.forEach((item, index) => {
    dummy.position.set(item.x, item.y + 0.5, item.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, referenceColor(item.kind, item.tone));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function applyReferenceTransform(group: THREE.Group | null, progress: number) {
  if (!group) return;
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  const angleY = THREE.MathUtils.lerp(ISO_ANGLE_Y, FLAT_ANGLE_Y, p);
  const angleX = THREE.MathUtils.lerp(ISO_ANGLE_X, FLAT_ANGLE_X, p);
  const viewScale = THREE.MathUtils.lerp(VIEW_SCALE_3D, VIEW_SCALE_2D, p);

  rotY.makeRotationY(angleY);
  rotX.makeRotationX(angleX);
  rotationMatrix.multiplyMatrices(rotX, rotY);
  group.quaternion.setFromRotationMatrix(rotationMatrix);
  group.scale.setScalar(BLOCK_SIZE * viewScale);
  group.position.set(
    THREE.MathUtils.lerp(0, X_OFFSET_2D, p),
    THREE.MathUtils.lerp(0, Y_OFFSET_2D, p),
    0,
  );
}

export function VoxelWorld({
  matrix,
  seedText: _seedText,
  worldSeed,
  theme: _theme,
  progress,
}: WorldProps) {
  const rootRef = useRef<THREE.Group>(null);
  const dirtRef = useRef<THREE.InstancedMesh>(null);
  const blossomRef = useRef<THREE.InstancedMesh>(null);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const fallenRef = useRef<THREE.InstancedMesh>(null);
  const lastProgress = useRef(-1);

  const world = useMemo(() => generateVoxelWorld(matrix, worldSeed), [matrix, worldSeed]);
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
    writeInstances(dirtRef.current, blocks.dirt);
    writeInstances(blossomRef.current, blocks.blossom);
    writeInstances(trunkRef.current, blocks.trunk);
    writeInstances(grassRef.current, blocks.grass);
    writeInstances(fallenRef.current, blocks.fallen);
    applyReferenceTransform(rootRef.current, progress.current);
    lastProgress.current = progress.current;
  }, [blocks, progress]);

  useEffect(
    () => () => Object.values(materials).forEach((material) => material.dispose()),
    [materials],
  );

  useFrame(() => {
    const p = progress.current;
    if (Math.abs(lastProgress.current - p) < 0.0001) return;
    lastProgress.current = p;
    applyReferenceTransform(rootRef.current, p);
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
