import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { generateBotanicalCanopy } from '../procedural/botanicalGenerator';
import { hashString } from '../procedural/hash';
import {
  countDarkModules,
  mapBotanicalsToQR,
  type MorphCarrier,
} from '../procedural/morphMapper';
import { generateTreeStructure, type TreeSegment } from '../procedural/treeGenerator';
import type { QRMatrix } from '../qr/generateQR';
import type { WorldTheme } from './themes';
import {
  createFlowerMorphGeometry,
  createLeafMorphGeometry,
  updateMorphGeometry,
} from './morphGeometry';

type LivingTreeProps = {
  matrix: QRMatrix;
  seedText: string;
  worldSeed: number;
  theme: WorldTheme;
  progress: MutableRefObject<number>;
};

const dummy = new THREE.Object3D();
const up = new THREE.Vector3(0, 1, 0);
const startPosition = new THREE.Vector3();
const endPosition = new THREE.Vector3();
const currentPosition = new THREE.Vector3();
const direction = new THREE.Vector3();
const perpendicular = new THREE.Vector3();
const gardenScale = new THREE.Vector3();
const scanScale = new THREE.Vector3();
const startQuaternion = new THREE.Quaternion();
const scanQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const startEuler = new THREE.Euler();
const workingColor = new THREE.Color();
const scanColor = new THREE.Color('#111411');

function rangeProgress(value: number, start: number, end: number) {
  const local = THREE.MathUtils.clamp((value - start) / Math.max(0.001, end - start), 0, 1);
  return THREE.MathUtils.smootherstep(local, 0, 1);
}

function carrierPosition(item: MorphCarrier, amount: number) {
  startPosition.set(...item.position);
  endPosition.set(...item.scanPosition);
  currentPosition.lerpVectors(startPosition, endPosition, amount);
  direction.subVectors(endPosition, startPosition);
  perpendicular.set(-direction.z, 0, direction.x);
  if (perpendicular.lengthSq() > 0.0001) perpendicular.normalize();
  currentPosition.addScaledVector(perpendicular, item.swirl * Math.sin(amount * Math.PI));
  currentPosition.y += Math.sin(amount * Math.PI) * item.arcHeight;
  return currentPosition;
}

function writeCarrierMesh(
  mesh: THREE.InstancedMesh | null,
  items: MorphCarrier[],
  colors: THREE.Color[],
  progress: number,
  gardenScaleMultiplier: number,
) {
  if (!mesh) return;
  items.forEach((item, index) => {
    const amount = rangeProgress(progress, item.morphStart, item.morphEnd);
    dummy.position.copy(carrierPosition(item, amount));
    startEuler.set(...item.rotation);
    startQuaternion.setFromEuler(startEuler);
    dummy.quaternion.copy(startQuaternion).slerp(scanQuaternion, amount);
    gardenScale.set(...item.scale).multiplyScalar(gardenScaleMultiplier);
    scanScale.set(...item.scanScale);
    dummy.scale.lerpVectors(gardenScale, scanScale, amount);
    if (item.mapped) dummy.scale.multiplyScalar(1 + Math.sin(amount * Math.PI) * 0.055);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);

    const colorAmount = rangeProgress(
      progress,
      Math.max(item.morphStart + 0.2, item.finder ? 0.36 : 0.48),
      item.morphEnd,
    );
    workingColor.copy(colors[index]).lerp(scanColor, colorAmount);
    mesh.setColorAt(index, workingColor);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function writeFlowerCenters(
  mesh: THREE.InstancedMesh | null,
  items: MorphCarrier[],
  progress: number,
) {
  if (!mesh) return;
  const collapse = rangeProgress(progress, 0.08, 0.5);
  items.forEach((item, index) => {
    const amount = rangeProgress(progress, item.morphStart, item.morphEnd);
    dummy.position.copy(carrierPosition(item, amount));
    startEuler.set(...item.rotation);
    startQuaternion.setFromEuler(startEuler);
    dummy.quaternion.copy(startQuaternion).slerp(scanQuaternion, amount);
    const size = Math.max(0.001, item.scale[0] * 0.14 * (1 - collapse));
    dummy.scale.setScalar(size);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function writeBranches(
  mesh: THREE.InstancedMesh | null,
  items: TreeSegment[],
  progress: number,
) {
  if (!mesh) return;
  items.forEach((item, index) => {
    const start = item.level === 2 ? 0.07 : item.level === 1 ? 0.15 : 0.3;
    const end = item.level === 2 ? 0.58 : item.level === 1 ? 0.72 : 0.84;
    const collapse = rangeProgress(progress, start + item.phase * 0.05, end);
    startPosition.set(...item.start);
    endPosition.set(...item.end).lerp(startPosition, collapse);
    direction.subVectors(endPosition, startPosition);
    const length = Math.max(0.001, direction.length());
    direction.normalize();
    dummy.position.copy(startPosition).add(endPosition).multiplyScalar(0.5);
    dummy.quaternion.setFromUnitVectors(up, direction);
    const radius = Math.max(
      0.001,
      THREE.MathUtils.lerp((item.radiusStart + item.radiusEnd) * 0.5, 0.001, collapse),
    );
    dummy.scale.set(radius, length, radius);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function createOrganicColors(items: MorphCarrier[], theme: WorldTheme) {
  const leafBase = new THREE.Color(theme.leaf).offsetHSL(0, -0.03, 0.08);
  const leafDeep = new THREE.Color(theme.leaf).offsetHSL(-0.01, 0.02, -0.06);
  const flowerA = new THREE.Color(theme.blossom);
  const flowerB = new THREE.Color(theme.flower);
  return items.map((item) => {
    const color = item.kind === 'leaf'
      ? leafDeep.clone().lerp(leafBase, 0.24 + item.tone * 0.76)
      : flowerA.clone().lerp(flowerB, item.tone * 0.72);
    color.offsetHSL((item.tone - 0.5) * 0.018, 0, (item.tone - 0.5) * 0.08);
    return color;
  });
}

export function LivingTree({ matrix, seedText, worldSeed, theme, progress }: LivingTreeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const branchRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const flowerRef = useRef<THREE.InstancedMesh>(null);
  const flowerCenterRef = useRef<THREE.InstancedMesh>(null);
  const lastProgress = useRef(-1);
  const seed = useMemo(() => hashString(seedText + ':' + worldSeed), [seedText, worldSeed]);
  const world = useMemo(() => {
    const tree = generateTreeStructure(seed);
    const carrierCount = Math.max(2200, countDarkModules(matrix));
    const botanicals = generateBotanicalCanopy(tree, seed ^ 0x8da6b343, carrierCount);
    const carriers = mapBotanicalsToQR(botanicals, matrix, seed ^ 0x4f1bbcdc);
    return {
      tree,
      leaves: carriers.filter((item) => item.kind === 'leaf'),
      flowers: carriers.filter((item) => item.kind === 'flower'),
    };
  }, [matrix, seed]);
  const leafGeometry = useMemo(createLeafMorphGeometry, []);
  const flowerGeometry = useMemo(createFlowerMorphGeometry, []);
  const leafColors = useMemo(() => createOrganicColors(world.leaves, theme), [theme, world.leaves]);
  const flowerColors = useMemo(() => createOrganicColors(world.flowers, theme), [theme, world.flowers]);
  const branchMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: theme.trunk, roughness: 0.93, metalness: 0 }),
    [theme.trunk],
  );
  const leafMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: new THREE.Color(theme.leaf).multiplyScalar(0.34),
      emissiveIntensity: 0.34,
      roughness: 0.78,
      side: THREE.DoubleSide,
      vertexColors: true,
    }),
    [theme.leaf],
  );
  const flowerMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: new THREE.Color(theme.blossom).multiplyScalar(0.2),
      emissiveIntensity: 0.2,
      roughness: 0.72,
      side: THREE.DoubleSide,
      vertexColors: true,
    }),
    [theme.blossom],
  );
  const centerMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: new THREE.Color(theme.blossom).lerp(new THREE.Color('#f4d99c'), 0.72),
      roughness: 0.74,
    }),
    [theme.blossom],
  );

  useLayoutEffect(() => {
    [branchRef.current, leafRef.current, flowerRef.current, flowerCenterRef.current].forEach((mesh) => {
      mesh?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    });
    lastProgress.current = -1;
  }, [flowerColors, leafColors, world]);

  useEffect(
    () => () => {
      branchMaterial.dispose();
      leafMaterial.dispose();
      flowerMaterial.dispose();
      centerMaterial.dispose();
    },
    [branchMaterial, centerMaterial, flowerMaterial, leafMaterial],
  );

  useEffect(
    () => () => {
      leafGeometry.dispose();
      flowerGeometry.dispose();
    },
    [flowerGeometry, leafGeometry],
  );

  useFrame((state) => {
    const rawProgress = THREE.MathUtils.clamp(progress.current, 0, 1);
    const gardenAmount = 1 - rangeProgress(rawProgress, 0.02, 0.38);
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.008 * gardenAmount;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.44) * 0.018 * gardenAmount;
    }
    if (Math.abs(lastProgress.current - rawProgress) < 0.0002) return;
    lastProgress.current = rawProgress;

    writeBranches(branchRef.current, world.tree.segments, rawProgress);
    const seasonalLeafScale = theme.season === 'winter' ? 0.76 : theme.season === 'autumn' ? 0.92 : 1;
    const seasonalFlowerScale = theme.season === 'summer' ? 0.82 : theme.season === 'winter' ? 0.9 : 1;
    writeCarrierMesh(leafRef.current, world.leaves, leafColors, rawProgress, seasonalLeafScale);
    writeCarrierMesh(flowerRef.current, world.flowers, flowerColors, rawProgress, seasonalFlowerScale);
    writeFlowerCenters(flowerCenterRef.current, world.flowers, rawProgress);

    const shapeAmount = rangeProgress(rawProgress, 0.2, 0.76);
    updateMorphGeometry(leafGeometry, shapeAmount);
    updateMorphGeometry(flowerGeometry, shapeAmount);
    leafMaterial.emissiveIntensity = 0.34 * (1 - rangeProgress(rawProgress, 0.36, 0.86));
    flowerMaterial.emissiveIntensity = 0.2 * (1 - rangeProgress(rawProgress, 0.34, 0.82));
    branchMaterial.color.set(theme.trunk).lerp(new THREE.Color(theme.ground), rangeProgress(rawProgress, 0.34, 0.86));
    centerMaterial.color
      .set(theme.blossom)
      .lerp(new THREE.Color('#f4d99c'), 0.72)
      .lerp(scanColor, rangeProgress(rawProgress, 0.22, 0.66));
  });

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={branchRef}
        args={[undefined, undefined, world.tree.segments.length]}
        castShadow
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.88, 1, 1, 10, 1, false]} />
        <primitive object={branchMaterial} attach="material" />
      </instancedMesh>
      <instancedMesh
        ref={leafRef}
        args={[leafGeometry, leafMaterial, world.leaves.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={flowerRef}
        args={[flowerGeometry, flowerMaterial, world.flowers.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={flowerCenterRef}
        args={[undefined, undefined, world.flowers.length]}
        castShadow
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 7, 5]} />
        <primitive object={centerMaterial} attach="material" />
      </instancedMesh>
    </group>
  );
}
