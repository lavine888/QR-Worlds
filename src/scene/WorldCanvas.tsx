import { Canvas } from '@react-three/fiber';
import { Suspense, useRef } from 'react';
import * as THREE from 'three';
import type { QRMatrix } from '../qr/generateQR';
import { CameraRig } from './CameraRig';
import type { WorldTheme } from './themes';
import { VoxelWorld } from './VoxelWorld';

type WorldCanvasProps = {
  matrix: QRMatrix;
  theme: WorldTheme;
  seedText: string;
  worldSeed: number;
  scanMode: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
};

export function WorldCanvas({
  matrix,
  theme,
  seedText,
  worldSeed,
  scanMode,
  onCanvasReady,
}: WorldCanvasProps) {
  const progress = useRef(scanMode ? 1 : 0);

  return (
    <Canvas
      orthographic
      shadows
      dpr={[1, 1.5]}
      camera={{
        position: [0, 0, -10],
        left: -1,
        right: 1,
        top: 1,
        bottom: -1,
        zoom: 1,
        near: 0.1,
        far: 100,
      }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'default',
      }}
      fallback={<div className="webgl-fallback">WebGL is unavailable in this browser.</div>}
      onCreated={({ gl }) => {
        // Be explicit here instead of relying on renderer defaults. Some GPU /
        // browser combinations were presenting the preview canvas as black even
        // though the scene had mounted successfully.
        gl.setClearColor('#f7f7f7', 1);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.NoToneMapping;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        onCanvasReady?.(gl.domElement);
      }}
    >
      <color attach="background" args={['#f7f7f7']} />
      <ambientLight intensity={1.35} />
      <hemisphereLight args={['#ffffff', '#9aa792', 0.72]} />
      <directionalLight
        color="#fff7ed"
        position={[-3.6, 5.8, -4.2]}
        intensity={1.55}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
        shadow-camera-near={0.1}
        shadow-camera-far={14}
        shadow-bias={-0.00008}
      />
      <directionalLight color="#e7f0f7" position={[4, 3, 2]} intensity={0.42} />

      <Suspense fallback={null}>
        <VoxelWorld
          matrix={matrix}
          theme={theme}
          seedText={seedText}
          worldSeed={worldSeed}
          progress={progress}
        />
      </Suspense>

      <CameraRig target={scanMode ? 1 : 0} progress={progress} />
    </Canvas>
  );
}
