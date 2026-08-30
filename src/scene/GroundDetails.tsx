import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { hashString } from '../procedural/hash';
import { seededRandom } from '../procedural/random';
import type { WorldTheme } from './themes';
import { createWindMaterial, updateWindMaterial } from './wind';

type GroundDetailsProps = {
  seedText: string;
  worldSize: number;
  theme: WorldTheme;
  progress: React.MutableRefObject<number>;
};

type Detail = { x: number; z: number; scale: number; yaw: number };
const dummy = new THREE.Object3D();

function writeDetails(mesh: THREE.InstancedMesh | null, details: Detail[], y: number, width: number) {
  if (!mesh) return;
  details.forEach((detail, index) => {
    dummy.position.set(detail.x, y, detail.z);
    dummy.rotation.set(0, detail.yaw, 0);
    dummy.scale.set(width * detail.scale, detail.scale, width * detail.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

export function GroundDetails({ seedText, worldSize, theme, progress }: GroundDetailsProps) {
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const flowerRef = useRef<THREE.InstancedMesh>(null);
  const { size } = useThree();
  const compact = size.width < 640;
  const details = useMemo(() => {
    const random = seededRandom(hashString(seedText + ':ground'));
    const half = worldSize / 2 + 1.15;
    const makeEdgeDetails = (count: number, spread: number): Detail[] =>
      Array.from({ length: count }, () => {
        const horizontal = random() > 0.5;
        const sign = random() > 0.5 ? 1 : -1;
        const edge = half - random() * spread;
        return {
          x: horizontal ? (random() * 2 - 1) * half : sign * edge,
          z: horizontal ? sign * edge : (random() * 2 - 1) * half,
          scale: 0.36 + random() * 0.7,
          yaw: random() * Math.PI * 2,
        };
      });
    return {
      grass: makeEdgeDetails(compact ? 1800 : 4200, 2.2),
      flowers: makeEdgeDetails(compact ? 220 : 600, 2.8),
    };
  }, [compact, seedText, worldSize]);
  const grassMaterial = useMemo(() => createWindMaterial(theme.leaf, 0.12), [theme.leaf]);
  const flowerMaterial = useMemo(() => createWindMaterial(theme.flower, 0.06), [theme.flower]);

  useLayoutEffect(() => {
    writeDetails(grassRef.current, details.grass, 0.32, 0.14);
    writeDetails(flowerRef.current, details.flowers, 0.48, 0.22);
  }, [details]);

  useFrame((state) => {
    const p = THREE.MathUtils.smoothstep(progress.current, 0, 1);
    const visible = p < 0.96;
    const amount = Math.max(0.0001, 1 - p * 1.12);
    if (grassRef.current) {
      grassRef.current.scale.setScalar(amount);
      grassRef.current.visible = visible;
    }
    if (flowerRef.current) {
      flowerRef.current.scale.setScalar(amount);
      flowerRef.current.visible = visible;
    }
    updateWindMaterial(grassMaterial, state.clock.elapsedTime, amount);
    updateWindMaterial(flowerMaterial, state.clock.elapsedTime + 0.4, amount);
  });

  return (
    <group>
      <instancedMesh ref={grassRef} args={[undefined, undefined, details.grass.length]} castShadow>
        <boxGeometry args={[1, 1.2, 1]} />
        <primitive object={grassMaterial} attach="material" />
      </instancedMesh>
      <instancedMesh ref={flowerRef} args={[undefined, undefined, details.flowers.length]} castShadow>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
        <primitive object={flowerMaterial} attach="material" />
      </instancedMesh>
    </group>
  );
}
