import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { hashString } from '../procedural/hash';
import { seededRandom } from '../procedural/random';
import type { WorldTheme } from './themes';

type ParticlesProps = {
  seedText: string;
  worldSize: number;
  theme: WorldTheme;
  progress: MutableRefObject<number>;
};

type ParticleField = {
  geometry: THREE.BufferGeometry;
  velocities: Float32Array;
  phases: Float32Array;
};

export function Particles({ seedText, worldSize, theme, progress }: ParticlesProps) {
  const ref = useRef<THREE.Points>(null);
  const field = useMemo<ParticleField>(() => {
    const random = seededRandom(hashString(seedText + ':particles:' + theme.particleKind));
    const count = theme.particleKind === 'pollen' ? 170 : 220;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    const phases = new Float32Array(count);
    const half = worldSize * 0.64;
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (random() * 2 - 1) * half;
      positions[index * 3 + 1] = 1.3 + random() * 7.2;
      positions[index * 3 + 2] = (random() * 2 - 1) * half;
      velocities[index] = 0.04 + random() * 0.13;
      phases[index] = random() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry, velocities, phases };
  }, [seedText, theme.particleKind, worldSize]);

  useFrame((state, delta) => {
    const points = ref.current;
    if (!points) return;
    const p = THREE.MathUtils.smoothstep(progress.current, 0, 1);
    const attribute = field.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = attribute.array as Float32Array;
    const half = worldSize * 0.7;
    points.visible = p < 0.96;
    const material = points.material as THREE.PointsMaterial;
    material.opacity = Math.max(0, 0.52 * (1 - p));
    if (p >= 0.96) return;

    for (let index = 0; index < field.velocities.length; index += 1) {
      const offset = index * 3;
      positions[offset + 1] -= field.velocities[index] * delta;
      positions[offset] += Math.sin(state.clock.elapsedTime * 0.55 + field.phases[index]) * delta * 0.12;
      positions[offset + 2] += Math.cos(state.clock.elapsedTime * 0.4 + field.phases[index]) * delta * 0.08;
      if (positions[offset + 1] < 0.45) positions[offset + 1] = 8.5;
      if (positions[offset] > half) positions[offset] = -half;
      if (positions[offset] < -half) positions[offset] = half;
      if (positions[offset + 2] > half) positions[offset + 2] = -half;
      if (positions[offset + 2] < -half) positions[offset + 2] = half;
    }
    attribute.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={field.geometry}>
      <pointsMaterial
        color={theme.particle}
        size={theme.particleKind === 'snow' ? 0.13 : 0.09}
        transparent
        opacity={0.52}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
