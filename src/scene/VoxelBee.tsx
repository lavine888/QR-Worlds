import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

type VoxelBeeProps = {
  trigger: number;
  worldSize: number;
};

const start = new THREE.Vector3();
const target = new THREE.Vector3();
const current = new THREE.Vector3();
const previous = new THREE.Vector3();

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

export function VoxelBee({ trigger, worldSize }: VoxelBeeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lastTrigger = useRef(trigger);
  const startedAt = useRef(-100);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    if (lastTrigger.current !== trigger) {
      lastTrigger.current = trigger;
      startedAt.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - startedAt.current;
    const duration = 4.6;
    if (elapsed < 0 || elapsed > duration) {
      group.visible = false;
      return;
    }

    group.visible = true;
    previous.copy(group.position);

    const hoverY = Math.max(6.2, worldSize * 0.22);
    if (elapsed < 1.45) {
      const t = easeOutCubic(elapsed / 1.45);
      start.set(worldSize * 0.62, hoverY + 2.6, worldSize * 0.36);
      target.set(1.8, hoverY, 1.3);
      current.lerpVectors(start, target, t);
      current.y += Math.sin(elapsed * 10) * 0.22;
    } else if (elapsed < 3.25) {
      const t = (elapsed - 1.45) / 1.8;
      const angle = t * Math.PI * 2.15 + 0.6;
      current.set(
        Math.cos(angle) * (2.2 + Math.sin(t * Math.PI) * 0.6),
        hoverY + Math.sin(t * Math.PI * 4) * 0.28,
        Math.sin(angle) * 2.2,
      );
    } else {
      const t = easeOutCubic((elapsed - 3.25) / (duration - 3.25));
      start.set(-1.6, hoverY + 0.2, -1.2);
      target.set(-worldSize * 0.7, hoverY + 4.4, -worldSize * 0.42);
      current.lerpVectors(start, target, t);
      current.y += Math.sin(elapsed * 9) * 0.18;
    }

    group.position.copy(current);
    const velocity = current.clone().sub(previous);
    if (velocity.lengthSq() > 0.00001) {
      group.rotation.y = Math.atan2(velocity.x, velocity.z) + Math.PI / 2;
    }
    group.rotation.z = Math.sin(elapsed * 14) * 0.06;
  });

  return (
    <group ref={groupRef} visible={false} scale={0.72}>
      <mesh position={[-0.72, 0, 0]} castShadow>
        <boxGeometry args={[0.55, 0.6, 0.65]} />
        <meshStandardMaterial color="#2a2218" roughness={0.9} />
      </mesh>
      <mesh position={[-0.2, 0, 0]} castShadow>
        <boxGeometry args={[0.52, 0.66, 0.7]} />
        <meshStandardMaterial color="#e5b83f" roughness={0.88} />
      </mesh>
      <mesh position={[0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.5, 0.62, 0.68]} />
        <meshStandardMaterial color="#2a2218" roughness={0.9} />
      </mesh>
      <mesh position={[0.72, 0, 0]} castShadow>
        <boxGeometry args={[0.38, 0.56, 0.6]} />
        <meshStandardMaterial color="#e5b83f" roughness={0.88} />
      </mesh>
      <mesh position={[-0.05, 0.5, -0.28]} rotation={[0.22, 0, -0.32]}>
        <boxGeometry args={[0.5, 0.08, 0.82]} />
        <meshStandardMaterial color="#eee8d9" roughness={0.8} transparent opacity={0.82} />
      </mesh>
      <mesh position={[-0.05, 0.5, 0.28]} rotation={[-0.22, 0, -0.32]}>
        <boxGeometry args={[0.5, 0.08, 0.82]} />
        <meshStandardMaterial color="#eee8d9" roughness={0.8} transparent opacity={0.82} />
      </mesh>
    </group>
  );
}
