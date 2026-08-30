import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { QRMatrix } from '../qr/generateQR';
import type { WorldTheme } from './themes';

type QRTerrainProps = {
  matrix: QRMatrix;
  theme: WorldTheme;
  progress: MutableRefObject<number>;
};

type Cell = { x: number; z: number };

const dummy = new THREE.Object3D();
const scanDark = new THREE.Color('#111111');
const scanLight = new THREE.Color('#ffffff');

export function QRTerrain({ matrix, theme, progress }: QRTerrainProps) {
  const darkRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.InstancedMesh>(null);
  const boardRef = useRef<THREE.Mesh>(null);
  const lastProgress = useRef(-1);
  const lastTheme = useRef('');

  const { darkCells, lightCells } = useMemo(() => {
    const dark: Cell[] = [];
    const light: Cell[] = [];
    const offset = (matrix.size - 1) / 2;

    matrix.cells.forEach((row, rowIndex) => {
      row.forEach((isDark, colIndex) => {
        const cell = { x: colIndex - offset, z: rowIndex - offset };
        (isDark ? dark : light).push(cell);
      });
    });

    return { darkCells: dark, lightCells: light };
  }, [matrix]);

  useFrame(() => {
    const p = THREE.MathUtils.smoothstep(progress.current, 0, 1);
    if (Math.abs(lastProgress.current - p) < 0.0004 && lastTheme.current === theme.name) return;
    lastProgress.current = p;
    lastTheme.current = theme.name;

    const tileSize = THREE.MathUtils.lerp(0.76, 1.005, p);
    const darkHeight = THREE.MathUtils.lerp(0.32, 0.035, p);
    const lightHeight = THREE.MathUtils.lerp(0.12, 0.03, p);

    const updateInstances = (mesh: THREE.InstancedMesh | null, cells: Cell[], height: number) => {
      if (!mesh) return;
      cells.forEach((cell, index) => {
        dummy.position.set(cell.x, height / 2, cell.z);
        dummy.scale.set(tileSize, height, tileSize);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };

    updateInstances(darkRef.current, darkCells, darkHeight);
    updateInstances(lightRef.current, lightCells, lightHeight);

    const darkMaterial = darkRef.current?.material as THREE.MeshBasicMaterial | undefined;
    const lightMaterial = lightRef.current?.material as THREE.MeshBasicMaterial | undefined;
    const boardMaterial = boardRef.current?.material as THREE.MeshStandardMaterial | undefined;

    const gardenDark = new THREE.Color(theme.ground).lerp(new THREE.Color(theme.leaf), 0.035);
    const gardenLight = new THREE.Color(theme.ground).lerp(new THREE.Color(theme.lightTile), 0.08);
    darkMaterial?.color.copy(gardenDark.lerp(scanDark, p));
    lightMaterial?.color.copy(gardenLight.lerp(scanLight, p));
    boardMaterial?.color.copy(new THREE.Color(theme.ground).lerp(scanLight, p));
  });

  return (
    <group>
      <mesh ref={boardRef} position={[0, -0.22, 0]} receiveShadow>
        <boxGeometry args={[matrix.size + 2.4, 0.42, matrix.size + 2.4]} />
        <meshStandardMaterial color={theme.ground} roughness={0.95} />
      </mesh>

      <instancedMesh ref={lightRef} args={[undefined, undefined, lightCells.length]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={theme.lightTile} />
      </instancedMesh>

      <instancedMesh ref={darkRef} args={[undefined, undefined, darkCells.length]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={theme.darkTile} />
      </instancedMesh>
    </group>
  );
}
