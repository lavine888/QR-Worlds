import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { hashString } from '../procedural/hash';
import { seededRandom } from '../procedural/random';
import type { WorldTheme } from './themes';

type ProceduralTreeProps = {
  seedText: string;
  theme: WorldTheme;
  progress: MutableRefObject<number>;
};

type Leaf = { position: THREE.Vector3; scale: number; rotation: THREE.Euler };

const dummy = new THREE.Object3D();

export function ProceduralTree({ seedText, theme, progress }: ProceduralTreeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const leavesRef = useRef<THREE.InstancedMesh>(null);
  const blossomsRef = useRef<THREE.InstancedMesh>(null);

  const { leaves, blossoms, branches } = useMemo(() => {
    const random = seededRandom(hashString(seedText));
    const leafItems: Leaf[] = [];
    const blossomItems: Leaf[] = [];
    const branchItems = Array.from({ length: 9 }, (_, index) => {
      const angle = (index / 9) * Math.PI * 2 + random() * 0.45;
      const y = 3.1 + random() * 2.1;
      const length = 2.3 + random() * 1.5;
      return { angle, y, length, tilt: 0.55 + random() * 0.35 };
    });

    for (let i = 0; i < 190; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.pow(random(), 0.68) * 4.1;
      const crown = Math.max(0, 1 - radius / 4.5);
      const y = 5.1 + crown * 2.7 + (random() - 0.5) * 2.1;
      const position = new THREE.Vector3(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius,
      );
      const item = {
        position,
        scale: 0.5 + random() * 0.52,
        rotation: new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI),
      };
      leafItems.push(item);
      if (random() > 0.62) {
        blossomItems.push({
          position: position.clone().add(
            new THREE.Vector3((random() - 0.5) * 0.4, (random() - 0.5) * 0.35, (random() - 0.5) * 0.4),
          ),
          scale: 0.2 + random() * 0.24,
          rotation: new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI),
        });
      }
    }

    return { leaves: leafItems, blossoms: blossomItems, branches: branchItems };
  }, [seedText]);

  useLayoutEffect(() => {
    const write = (mesh: THREE.InstancedMesh | null, items: Leaf[]) => {
      if (!mesh) return;
      items.forEach((item, index) => {
        dummy.position.copy(item.position);
        dummy.rotation.copy(item.rotation);
        dummy.scale.setScalar(item.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    write(leavesRef.current, leaves);
    write(blossomsRef.current, blossoms);
  }, [leaves, blossoms]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const p = THREE.MathUtils.smoothstep(progress.current, 0, 1);
    const vanish = 1 - THREE.MathUtils.smoothstep(p, 0.02, 0.82);
    const breeze = Math.sin(state.clock.elapsedTime * 0.7) * 0.012 * vanish;
    groupRef.current.scale.setScalar(Math.max(0.001, vanish));
    groupRef.current.rotation.z = breeze;
    groupRef.current.position.y = THREE.MathUtils.lerp(0.14, -0.5, p);
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 2.3, 0]} castShadow>
        <cylinderGeometry args={[0.48, 0.78, 4.6, 9]} />
        <meshStandardMaterial color={theme.trunk} roughness={0.95} />
      </mesh>

      {branches.map((branch, index) => (
        <mesh
          key={index}
          position={[
            Math.cos(branch.angle) * branch.length * 0.28,
            branch.y,
            Math.sin(branch.angle) * branch.length * 0.28,
          ]}
          rotation={[Math.PI / 2 - branch.tilt, branch.angle, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.14, 0.28, branch.length, 7]} />
          <meshStandardMaterial color={theme.trunk} roughness={0.95} />
        </mesh>
      ))}

      <instancedMesh ref={leavesRef} args={[undefined, undefined, leaves.length]} castShadow>
        <icosahedronGeometry args={[0.72, 1]} />
        <meshStandardMaterial color={theme.leaf} roughness={0.9} />
      </instancedMesh>

      <instancedMesh ref={blossomsRef} args={[undefined, undefined, blossoms.length]} castShadow>
        <icosahedronGeometry args={[0.58, 0]} />
        <meshStandardMaterial color={theme.blossom} roughness={0.86} />
      </instancedMesh>
    </group>
  );
}
