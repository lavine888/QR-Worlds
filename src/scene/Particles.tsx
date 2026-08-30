import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { hashString } from '../procedural/hash';
import { seededRandom } from '../procedural/random';
import type { WorldTheme } from './themes';

type ParticlesProps = {
  seedText: string;
  theme: WorldTheme;
  progress: MutableRefObject<number>;
};

type ParticleField = {
  geometry: THREE.BufferGeometry;
  velocities: Float32Array;
  phases: Float32Array;
};

export function Particles({ seedText, theme, progress }: ParticlesProps) {
  const ref = useRef<THREE.Points>(null);
  const { size } = useThree();
  const compact = size.width < 640;
  const field = useMemo<ParticleField>(() => {
    const random = seededRandom(hashString(seedText + ':particles:' + theme.particleKind));
    const count = compact ? 72 : theme.particleKind === 'pollen' ? 92 : 118;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    const phases = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (random() * 2 - 1) * 5.4;
      positions[index * 3 + 1] = 2.5 + random() * 8.8;
      positions[index * 3 + 2] = (random() * 2 - 1) * 4.7;
      velocities[index] = 0.035 + random() * 0.085;
      phases[index] = random() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry, velocities, phases };
  }, [compact, seedText, theme.particleKind]);

  useFrame((state, delta) => {
    const points = ref.current;
    if (!points) return;
    const p = THREE.MathUtils.smoothstep(progress.current, 0, 1);
    const attribute = field.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = attribute.array as Float32Array;
    const material = points.material as THREE.PointsMaterial;
    material.opacity = Math.max(0, 0.34 * (1 - THREE.MathUtils.smootherstep(p, 0.05, 0.62)));
    if (p >= 0.995) return;

    for (let index = 0; index < field.velocities.length; index += 1) {
      const offset = index * 3;
      positions[offset + 1] -= field.velocities[index] * delta;
      positions[offset] += Math.sin(state.clock.elapsedTime * 0.48 + field.phases[index]) * delta * 0.07;
      positions[offset + 2] += Math.cos(state.clock.elapsedTime * 0.36 + field.phases[index]) * delta * 0.05;
      if (positions[offset + 1] < 1.6) positions[offset + 1] = 11.4;
      if (positions[offset] > 5.8) positions[offset] = -5.8;
      if (positions[offset] < -5.8) positions[offset] = 5.8;
      if (positions[offset + 2] > 5.1) positions[offset + 2] = -5.1;
      if (positions[offset + 2] < -5.1) positions[offset + 2] = 5.1;
    }
    attribute.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={field.geometry}>
      <pointsMaterial
        color={theme.particle}
        size={theme.particleKind === 'snow' ? 0.105 : 0.065}
        transparent
        opacity={0.34}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
