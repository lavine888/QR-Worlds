import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';

type CameraRigProps = {
  target: number;
  progress: MutableRefObject<number>;
  worldSize: number;
};

const garden = new THREE.Vector3();
const scan = new THREE.Vector3();
const position = new THREE.Vector3();

export function CameraRig({ target, progress, worldSize }: CameraRigProps) {
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
    const speed = reducedMotion ? 48 : 4.6;
    progress.current += (target - progress.current) * (1 - Math.exp(-speed * delta));
    if (Math.abs(target - progress.current) < 0.0005) progress.current = target;

    const p = THREE.MathUtils.smoothstep(progress.current, 0, 1);
    garden.set(worldSize * 0.54, worldSize * 0.66, worldSize * 0.54);
    scan.set(0, worldSize * 1.35, 0.001);
    position.lerpVectors(garden, scan, p);
    camera.position.copy(position);

    camera.up.set(0, 1 - p, -p).normalize();
    camera.lookAt(0, 0, 0);

    if (camera instanceof THREE.OrthographicCamera) {
      const minSide = Math.min(size.width, size.height);
      const gardenZoom = minSide / (worldSize * 1.45);
      const scanZoom = minSide / (worldSize * 1.12);
      camera.zoom = THREE.MathUtils.lerp(gardenZoom, scanZoom, p);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
