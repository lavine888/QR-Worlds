import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';

type CameraRigProps = {
  target: number;
  progress: MutableRefObject<number>;
  matrixSize: number;
  quietZone: number;
};

const LERP_SPEED = 4;

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

export function CameraRig({
  target,
  progress,
  matrixSize,
  quietZone,
}: CameraRigProps) {
  const { camera, size } = useThree();
  const rawProgress = useRef(target);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    camera.position.set(0, 0, 100);
    camera.up.set(0, 1, 0);
    camera.near = 0.1;
    camera.far = 300;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useFrame((_, delta) => {
    if (reducedMotion) {
      rawProgress.current = target;
    } else {
      rawProgress.current +=
        (target - rawProgress.current) * Math.min(1, LERP_SPEED * delta);
      if (Math.abs(rawProgress.current - target) < 0.001) {
        rawProgress.current = target;
      }
    }

    progress.current = easeInOutCubic(
      THREE.MathUtils.clamp(rawProgress.current, 0, 1),
    );

    camera.position.set(0, 0, 100);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);

    if (camera instanceof THREE.OrthographicCamera) {
      const minSide = Math.min(size.width, size.height);
      const compact = size.width < 640;
      const gardenSpan = matrixSize * (compact ? 1.42 : 1.32);
      const scanSpan = matrixSize + quietZone * 2 + 1.25;
      const gardenZoom = minSide / gardenSpan;
      const scanZoom = minSide / scanSpan;
      camera.zoom = THREE.MathUtils.lerp(
        gardenZoom,
        scanZoom,
        progress.current,
      );
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
