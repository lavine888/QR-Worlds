import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { QRMatrix } from '../qr/generateQR';
import { createGroundMorphGeometry, updateMorphGeometry } from './morphGeometry';
import type { WorldTheme } from './themes';

type LivingGroundProps = {
  matrix: QRMatrix;
  theme: WorldTheme;
  progress: MutableRefObject<number>;
};

function rangeProgress(value: number, start: number, end: number) {
  const local = THREE.MathUtils.clamp((value - start) / Math.max(0.001, end - start), 0, 1);
  return THREE.MathUtils.smootherstep(local, 0, 1);
}

function createContactShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
    gradient.addColorStop(0, 'rgba(26, 35, 29, 0.28)');
    gradient.addColorStop(0.48, 'rgba(26, 35, 29, 0.12)');
    gradient.addColorStop(1, 'rgba(26, 35, 29, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function LivingGround({ matrix, theme, progress }: LivingGroundProps) {
  const groundRef = useRef<THREE.Mesh>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const lastProgress = useRef(-1);
  const geometry = useMemo(createGroundMorphGeometry, []);
  const shadowTexture = useMemo(createContactShadowTexture, []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
    [theme.name],
  );
  const shadowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.16, depthWrite: false }),
    [shadowTexture],
  );

  useLayoutEffect(() => {
    lastProgress.current = -1;
  }, [matrix.size, theme.name]);

  useEffect(() => () => material.dispose(), [material]);
  useEffect(
    () => () => {
      geometry.dispose();
      shadowMaterial.dispose();
      shadowTexture.dispose();
    },
    [geometry, shadowMaterial, shadowTexture],
  );

  useFrame(() => {
    const rawProgress = THREE.MathUtils.clamp(progress.current, 0, 1);
    if (Math.abs(lastProgress.current - rawProgress) < 0.0002) return;
    lastProgress.current = rawProgress;
    const amount = THREE.MathUtils.smootherstep(rawProgress, 0, 1);
    const shapeAmount = rangeProgress(rawProgress, 0.27, 0.84);
    updateMorphGeometry(geometry, shapeAmount);

    if (groundRef.current) {
      const scanSpan = matrix.size + 0.16;
      groundRef.current.scale.set(
        THREE.MathUtils.lerp(14.8, scanSpan, amount),
        THREE.MathUtils.lerp(12.2, scanSpan, amount),
        1,
      );
    }
    material.color.set(theme.ground).lerp(new THREE.Color('#ffffff'), rangeProgress(rawProgress, 0.38, 0.92));
    if (shadowRef.current) {
      const shadowAmount = 1 - rangeProgress(rawProgress, 0.08, 0.58);
      shadowRef.current.scale.set(7.1 * shadowAmount, 5.2 * shadowAmount, 1);
      shadowMaterial.opacity = 0.1 * shadowAmount;
    }
  });

  return (
    <group>
      <mesh
        ref={groundRef}
        geometry={geometry}
        material={material}
        position={[0, -0.075, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        frustumCulled={false}
      />
      <mesh
        ref={shadowRef}
        position={[0, -0.045, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={shadowMaterial}
        renderOrder={1}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
}
