import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { QRMatrix } from '../qr/generateQR';
import { hashString } from '../procedural/hash';
import {
  generateQRGrowthData,
  type BloomPetalData,
  type BranchData,
  type FoliageData,
  type StemData,
} from '../procedural/worldGenerator';
import type { WorldTheme } from './themes';
import { createWindMaterial, updateWindMaterial } from './wind';

type ProceduralBloomProps = {
  matrix: QRMatrix;
  seedText: string;
  worldSeed: number;
  theme: WorldTheme;
  progress: MutableRefObject<number>;
};

const dummy = new THREE.Object3D();
const up = new THREE.Vector3(0, 1, 0);
const direction = new THREE.Vector3();
const startVector = new THREE.Vector3();
const endVector = new THREE.Vector3();
const gardenPosition = new THREE.Vector3();
const scanPosition = new THREE.Vector3();
const gardenScale = new THREE.Vector3();
const scanScale = new THREE.Vector3();
const gardenColor = new THREE.Color();
const blossomColor = new THREE.Color();
const petalColor = new THREE.Color();
const scanColor = new THREE.Color();

function revealAmount(phase: number | undefined, gardenProgress: number) {
  const delay = (phase ?? 0) * 0.32;
  const local = THREE.MathUtils.clamp((gardenProgress - delay) / 0.68, 0, 1);
  return THREE.MathUtils.smoothstep(local, 0, 1);
}

function collapseAmount(phase: number, scanProgress: number) {
  const delay = phase * 0.2;
  const local = THREE.MathUtils.clamp((scanProgress - delay) / 0.8, 0, 1);
  return THREE.MathUtils.smoothstep(local, 0, 1);
}

function writeStems(mesh: THREE.InstancedMesh | null, items: StemData[], gardenProgress: number) {
  if (!mesh) return;
  items.forEach((item, index) => {
    const amount = revealAmount(item.phase, gardenProgress);
    const height = Math.max(0.001, item.height * amount);
    const width = Math.max(0.001, item.width * amount);
    dummy.position.set(item.position[0], item.position[1] + height / 2, item.position[2]);
    dummy.rotation.set(0, item.yaw, 0);
    dummy.scale.set(width, height, width);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function writeBranches(mesh: THREE.InstancedMesh | null, items: BranchData[], gardenProgress: number) {
  if (!mesh) return;
  items.forEach((branch, index) => {
    const amount = revealAmount(branch.phase, gardenProgress);
    startVector.set(...branch.start);
    endVector.set(...branch.end);
    direction.subVectors(endVector, startVector);
    const fullLength = direction.length();
    direction.normalize();
    const currentLength = Math.max(0.001, fullLength * amount);
    endVector.copy(startVector).addScaledVector(direction, currentLength);
    dummy.position.copy(startVector).add(endVector).multiplyScalar(0.5);
    dummy.quaternion.setFromUnitVectors(up, direction);
    const radius = Math.max(0.001, THREE.MathUtils.lerp(branch.radiusStart * 0.28, branch.radiusStart, amount));
    dummy.scale.set(radius, currentLength, radius);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function writeFoliage(mesh: THREE.InstancedMesh | null, items: FoliageData[], gardenProgress: number) {
  if (!mesh) return;
  items.forEach((item, index) => {
    const amount = revealAmount(item.phase, gardenProgress);
    if (item.anchor) {
      gardenPosition.set(...item.anchor);
      scanPosition.set(...item.position);
      dummy.position.lerpVectors(gardenPosition, scanPosition, amount);
    } else {
      dummy.position.set(...item.position);
    }
    dummy.rotation.set(...item.rotation);
    dummy.scale.setScalar(Math.max(0.001, item.scale * amount));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function writeBlooms(
  mesh: THREE.InstancedMesh | null,
  items: BloomPetalData[],
  scanProgress: number,
) {
  if (!mesh) return;

  items.forEach((item, index) => {
    const amount = collapseAmount(item.phase, scanProgress);
    gardenPosition.set(...item.gardenPosition);
    scanPosition.set(...item.scanPosition);
    dummy.position.lerpVectors(gardenPosition, scanPosition, amount);
    dummy.rotation.set(
      THREE.MathUtils.lerp(item.gardenRotation[0], 0, amount),
      THREE.MathUtils.lerp(item.gardenRotation[1], 0, amount),
      THREE.MathUtils.lerp(item.gardenRotation[2], 0, amount),
    );
    gardenScale.set(...item.gardenScale);
    scanScale.set(...item.scanScale);
    dummy.scale.lerpVectors(gardenScale, scanScale, amount);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

export function ProceduralBloom({ matrix, seedText, worldSeed, theme, progress }: ProceduralBloomProps) {
  const groupRef = useRef<THREE.Group>(null);
  const stemsRef = useRef<THREE.InstancedMesh>(null);
  const branchesRef = useRef<THREE.InstancedMesh>(null);
  const leavesRef = useRef<THREE.InstancedMesh>(null);
  const blossomsRef = useRef<THREE.InstancedMesh>(null);
  const bloomRefA = useRef<THREE.InstancedMesh>(null);
  const bloomRefB = useRef<THREE.InstancedMesh>(null);
  const bloomRefC = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(
    () => generateQRGrowthData(matrix, hashString(seedText + ':' + worldSeed)),
    [matrix, seedText, worldSeed],
  );
  const bloomBands = useMemo(
    () => [
      data.blooms.filter((item) => item.tone < 0.34),
      data.blooms.filter((item) => item.tone >= 0.34 && item.tone < 0.68),
      data.blooms.filter((item) => item.tone >= 0.68),
    ],
    [data],
  );
  const stemMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: theme.trunk, roughness: 0.94 }),
    [theme.trunk],
  );
  const leafMaterial = useMemo(() => createWindMaterial(theme.leaf, 0.09), [theme.leaf]);
  const blossomMaterial = useMemo(
    () => createWindMaterial(theme.blossom, 0.06),
    [theme.blossom],
  );
  const bloomMaterialA = useMemo(
    () => new THREE.MeshStandardMaterial({ color: theme.flower, roughness: 0.82, metalness: 0 }),
    [theme.blossom, theme.darkTile, theme.flower],
  );
  const bloomMaterialB = useMemo(
    () => new THREE.MeshStandardMaterial({ color: theme.blossom, roughness: 0.82, metalness: 0 }),
    [theme.blossom, theme.darkTile],
  );
  const bloomMaterialC = useMemo(
    () => new THREE.MeshStandardMaterial({ color: theme.accent, roughness: 0.82, metalness: 0 }),
    [theme.accent, theme.darkTile],
  );

  useLayoutEffect(() => {
    writeStems(stemsRef.current, data.stems, 1);
    writeBranches(branchesRef.current, data.branches, 1);
    writeFoliage(leavesRef.current, data.leaves, 1);
    writeFoliage(blossomsRef.current, data.blossoms, 1);
    writeBlooms(bloomRefA.current, bloomBands[0], 0);
    writeBlooms(bloomRefB.current, bloomBands[1], 0);
    writeBlooms(bloomRefC.current, bloomBands[2], 0);
  }, [data, theme]);

  useFrame((state) => {
    const scanProgress = THREE.MathUtils.smoothstep(progress.current, 0, 1);
    const gardenProgress = 1 - scanProgress;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(1);
      groupRef.current.position.y = 0;
    }
    writeStems(stemsRef.current, data.stems, gardenProgress);
    writeBranches(branchesRef.current, data.branches, gardenProgress);
    writeFoliage(leavesRef.current, data.leaves, gardenProgress);
    writeFoliage(blossomsRef.current, data.blossoms, gardenProgress);
    writeBlooms(bloomRefA.current, bloomBands[0], scanProgress);
    writeBlooms(bloomRefB.current, bloomBands[1], scanProgress);
    writeBlooms(bloomRefC.current, bloomBands[2], scanProgress);
    gardenColor.set(theme.flower);
    blossomColor.set(theme.blossom);
    scanColor.set(theme.darkTile);
    petalColor.copy(gardenColor).lerp(scanColor, scanProgress);
    bloomMaterialA.color.copy(petalColor);
    petalColor.set(theme.blossom).lerp(scanColor, scanProgress);
    bloomMaterialB.color.copy(petalColor);
    petalColor.set(theme.accent).lerp(scanColor, scanProgress);
    bloomMaterialC.color.copy(petalColor);
    updateWindMaterial(leafMaterial, state.clock.elapsedTime, gardenProgress);
    updateWindMaterial(blossomMaterial, state.clock.elapsedTime + 0.8, gardenProgress);
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={bloomRefA} args={[undefined, undefined, bloomBands[0].length]}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={bloomMaterialA} attach="material" />
      </instancedMesh>
      <instancedMesh ref={bloomRefB} args={[undefined, undefined, bloomBands[1].length]}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={bloomMaterialB} attach="material" />
      </instancedMesh>
      <instancedMesh ref={bloomRefC} args={[undefined, undefined, bloomBands[2].length]}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={bloomMaterialC} attach="material" />
      </instancedMesh>
      <instancedMesh ref={stemsRef} args={[undefined, undefined, data.stems.length]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={stemMaterial} attach="material" />
      </instancedMesh>
      <instancedMesh ref={branchesRef} args={[undefined, undefined, data.branches.length]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={stemMaterial} attach="material" />
      </instancedMesh>
      <instancedMesh ref={leavesRef} args={[undefined, undefined, data.leaves.length]} castShadow>
        <boxGeometry args={[0.86, 0.86, 0.86]} />
        <primitive object={leafMaterial} attach="material" />
      </instancedMesh>
      <instancedMesh
        ref={blossomsRef}
        args={[undefined, undefined, data.blossoms.length]}
        castShadow
      >
        <boxGeometry args={[0.68, 0.68, 0.68]} />
        <primitive object={blossomMaterial} attach="material" />
      </instancedMesh>
    </group>
  );
}
