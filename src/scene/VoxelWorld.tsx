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

const ISO_ANGLE_Y = 0.78;
const ISO_ANGLE_X = -0.55;
const FLAT_ANGLE_Y = 0;
const FLAT_ANGLE_X = -Math.PI / 2;
const SCAN_DARK = new THREE.Color('#111111');
const SCAN_LIGHT = new THREE.Color('#ffffff');
const dummy = new THREE.Object3D();
const workingColor = new THREE.Color();

function rangeProgress(value: number, start: number, end: number) {
  const local = THREE.MathUtils.clamp(
    (value - start) / Math.max(0.001, end - start),
    0,
    1,
  );
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

function gardenColor(item: VoxelBlock, theme: WorldTheme) {
  const base =
    item.kind === 'light'
      ? theme.lightTile
      : item.kind === 'blossom'
        ? theme.blossom
        : item.kind === 'trunk'
          ? theme.trunk
          : theme.leaf;

  const color = new THREE.Color(base);
  const centered = item.tone - 0.5;

  if (item.kind === 'light') {
    color.offsetHSL(centered * 0.01, -0.02, centered * 0.1);
  } else if (item.kind === 'blossom') {
    color.offsetHSL(centered * 0.012, 0.035, centered * 0.19 - 0.035);
  } else if (item.kind === 'trunk') {
    color.offsetHSL(centered * 0.009, 0.025, centered * 0.15 - 0.045);
  } else {
    color.offsetHSL(centered * 0.014, 0.03, centered * 0.14 - 0.035);
  }

  return color;
}

function writeBlocks(
  mesh: THREE.InstancedMesh | null,
  items: VoxelBlock[],
  theme: WorldTheme,
  progress: number,
) {
  if (!mesh) return;
  const scanAmount = rangeProgress(progress, 0.58, 0.98);

  items.forEach((item, index) => {
    dummy.position.set(item.x, item.y + 0.5, item.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);

    const base = gardenColor(item, theme);
    const endpoint = item.kind === 'light' ? SCAN_LIGHT : SCAN_DARK;
    workingColor.copy(base).lerp(endpoint, scanAmount);
    mesh.setColorAt(index, workingColor);
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function createMaterial() {
  return new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.94,
    metalness: 0,
    vertexColors: true,
  });
}

export function VoxelWorld({
  matrix,
  seedText,
  worldSeed,
  theme,
  progress,
}: VoxelWorldProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.InstancedMesh>(null);
  const blossomRef = useRef<THREE.InstancedMesh>(null);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const lastProgress = useRef(-1);

  const seed = useMemo(
    () => hashString(`${seedText}:${worldSeed}:reference-voxel`),
    [seedText, worldSeed],
  );
  const world = useMemo(() => generateVoxelWorld(matrix, seed), [matrix, seed]);
  const blocks = useMemo(() => groupByKind(world.blocks), [world.blocks]);

  const lightMaterial = useMemo(createMaterial, []);
  const blossomMaterial = useMemo(createMaterial, []);
  const trunkMaterial = useMemo(createMaterial, []);
  const grassMaterial = useMemo(createMaterial, []);
  const quietMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useLayoutEffect(() => {
    [lightRef.current, blossomRef.current, trunkRef.current, grassRef.current].forEach(
      (mesh) => {
        if (mesh) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      },
    );
    lastProgress.current = -1;
  }, [blocks]);

  useEffect(
    () => () => {
      lightMaterial.dispose();
      blossomMaterial.dispose();
      trunkMaterial.dispose();
      grassMaterial.dispose();
      quietMaterial.dispose();
    }, [
      blossomMaterial,
      grassMaterial,
      lightMaterial,
      quietMaterial,
      trunkMaterial,
    ],
  );

  useFrame(() => {
    const p = THREE.MathUtils.clamp(progress.current, 0, 1);

    if (groupRef.current) {
      groupRef.current.rotation.order = 'YXZ';
      groupRef.current.rotation.y = THREE.MathUtils.lerp(ISO_ANGLE_Y, FLAT_ANGLE_Y, p);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(ISO_ANGLE_X, FLAT_ANGLE_X, p);
      groupRef.current.rotation.z = 0;
      groupRef.current.position.y = THREE.MathUtils.lerp(0, world.gridSize * 0.028, p);
    }

    quietMaterial.opacity = rangeProgress(p, 0.72, 0.98);

    const scanLight = rangeProgress(p, 0.78, 1);
    lightMaterial.emissive.set('#ffffff');
    lightMaterial.emissiveIntensity = scanLight * 0.78;
    blossomMaterial.emissive.set('#000000');
    trunkMaterial.emissive.set('#000000');
    grassMaterial.emissive.set('#000000');

    if (Math.abs(lastProgress.current - p) < 0.0002) return;
    lastProgress.current = p;

    writeBlocks(lightRef.current, blocks.light, theme, p);
    writeBlocks(blossomRef.current, blocks.blossom, theme, p);
    writeBlocks(trunkRef.current, blocks.trunk, theme, p);
    writeBlocks(grassRef.current, blocks.grass, theme, p);
  });

  const quietSpan = world.gridSize + matrix.quietZone * 2;

  return (
    <group ref={groupRef}>
      <mesh
        position={[0, -0.012, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={quietMaterial}
        renderOrder={-1}
      >
        <planeGeometry args={[quietSpan, quietSpan]} />
      </mesh>

      <instancedMesh
        ref={lightRef}
        args={[undefined, undefined, blocks.light.length]}
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={lightMaterial} attach="material" />
      </instancedMesh>

      <instancedMesh
        ref={blossomRef}
        args={[undefined, undefined, blocks.blossom.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={blossomMaterial} attach="material" />
      </instancedMesh>

      <instancedMesh
        ref={trunkRef}
        args={[undefined, undefined, blocks.trunk.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={trunkMaterial} attach="material" />
      </instancedMesh>

      <instancedMesh
        ref={grassRef}
        args={[undefined, undefined, blocks.grass.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={grassMaterial} attach="material" />
      </instancedMesh>
    </group>
  );
}
