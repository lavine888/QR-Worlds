import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';

type CameraRigProps = {
  target: number;
  progress: MutableRefObject<number>;
  matrixSize: number;
};

const garden = new THREE.Vector3();
const scan = new THREE.Vector3();
const position = new THREE.Vector3();
const gardenTarget = new THREE.Vector3();
const scanTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

const TRANSITION_SECONDS = 0.82;

function rangeProgress(value: number, start: number, end: number) {
  const local = THREE.MathUtils.clamp((value - start) / Math.max(0.001, end - start), 0, 1);
  return THREE.MathUtils.smootherstep(local, 0, 1);
}

export function CameraRig({ target, progress, matrixSize }: CameraRigProps) {
  const { camera, size } = useThree();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    camera.near = 0.1;
    camera.far = 1000;
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
      progress.current = target;
    } else if (progress.current !== target) {
      const direction = Math.sign(target - progress.current);
      progress.current = THREE.MathUtils.clamp(
        progress.current + direction * (delta / TRANSITION_SECONDS),
        0,
        1,
      );
      if (Math.abs(target - progress.current) < 0.001) progress.current = target;
    }

    const p = rangeProgress(progress.current, 0.03, 0.97);
    const world = matrixSize;

    garden.set(world * 0.66, world * 0.58, world * 0.74);
    scan.set(0, world * 1.55, 0.001);
    position.lerpVectors(garden, scan, p);
    camera.position.copy(position);

    gardenTarget.set(0, world * 0.13, 0);
    scanTarget.set(0, 0, 0);
    lookTarget.lerpVectors(gardenTarget, scanTarget, p);
    camera.up.set(0, 1 - p, -p).normalize();
    camera.lookAt(lookTarget);

    if (camera instanceof THREE.OrthographicCamera) {
      const minSide = Math.min(size.width, size.height);
      const compact = size.width < 640;
      const gardenZoom = minSide / (world * (compact ? 1.02 : 0.82));
      const scanZoom = minSide / (world * 1.08);
      camera.zoom = THREE.MathUtils.lerp(gardenZoom, scanZoom, rangeProgress(p, 0.08, 0.9));
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
