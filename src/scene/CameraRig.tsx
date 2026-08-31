import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';

type CameraRigProps = {
  target: number;
  progress: MutableRefObject<number>;
};

const LERP_SPEED = 4;

export function CameraRig({ target, progress }: CameraRigProps) {
  const { camera, size } = useThree();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    camera.position.set(0, 0, -10);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.near = 0.1;
    camera.far = 100;

    if (camera instanceof THREE.OrthographicCamera) {
      const aspect = Math.max(0.001, size.width / Math.max(1, size.height));
      const horizontal = Math.max(aspect, 1);
      const vertical = Math.max(1 / aspect, 1);
      camera.left = -horizontal;
      camera.right = horizontal;
      camera.top = vertical;
      camera.bottom = -vertical;
      camera.zoom = 1;
    }

    camera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  useFrame((_, delta) => {
    if (reducedMotion) {
      progress.current = target;
      return;
    }

    const alpha = 1 - Math.exp(-LERP_SPEED * delta);
    progress.current = THREE.MathUtils.lerp(progress.current, target, alpha);
    if (Math.abs(progress.current - target) < 0.001) progress.current = target;
  });

  return null;
}
