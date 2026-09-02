import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';

type CameraRigProps = {
  target: number;
  progress: MutableRefObject<number>;
};

const LERP_SPEED = 4;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function CameraRig({ target, progress }: CameraRigProps) {
  const { camera, size } = useThree();
  const rawProgress = useRef(progress.current);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    camera.position.set(0, 0, 3);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.near = 0.1;
    camera.far = 10;

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
      progress.current = target;
      return;
    }

    rawProgress.current +=
      (target - rawProgress.current) * Math.min(1, LERP_SPEED * Math.min(delta, 0.05));

    if (Math.abs(rawProgress.current - target) < 0.001) {
      rawProgress.current = target;
    }

    progress.current = easeInOutCubic(rawProgress.current);
  });

  return null;
}
