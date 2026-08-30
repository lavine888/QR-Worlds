import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { hashString } from '../procedural/hash';
import { seededRandom } from '../procedural/random';
import type { WorldTheme } from './themes';

type GroundDetailsProps = {
  seedText: string;
  worldSize: number;
  theme: WorldTheme;
  progress: MutableRefObject<number>;
};

const dummy = new THREE.Object3D();

export function GroundDetails({ seedText, worldSize, theme, progress }: GroundDetailsProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const points = useMemo(() => {
    const random = seededRandom(hashString(`${seedText}:grass`));
    const half = worldSize / 2 - 1.4;
    return Array.from({ length: 150 }, () => {
      const edge = random() > 0.5;
      const sign = random() > 0.5 ? 1 : -1;
      const x = edge ? sign * (half - random() * 2.2) : (random() * 2 - 1) * half;
      const z = edge ? (random() * 2 - 1) * half : sign * (half - random() * 2.2);
      return { x, z, scale: 0.38 + random() * 0.5, yaw: random() * Math.PI };
    });
  }, [seedText, worldSize]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    points.forEach((point, index) => {
      dummy.position.set(point.x, 0.35, point.z);
      dummy.rotation.set(0, point.yaw, 0);
      dummy.scale.set(0.16 * point.scale, 0.7 * point.scale, 0.16 * point.scale);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(index, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [points]);

  useFrame(() => {
    if (!ref.current) return;
    const p = THREE.MathUtils.smoothstep(progress.current, 0, 1);
    ref.current.scale.setScalar(Math.max(0.001, 1 - p * 1.15));
    ref.current.visible = p < 0.94;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, points.length]} castShadow>
      <coneGeometry args={[1, 1, 4]} />
      <meshStandardMaterial color={theme.leaf} roughness={0.95} />
    </instancedMesh>
  );
}
