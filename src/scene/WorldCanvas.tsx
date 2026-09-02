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
        position: [0, 0, 3],
        left: -1,
        right: 1,
        top: 1,
        bottom: -1,
        near: 0.1,
        far: 10,
      }}
      gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#f7f7f7', 0);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        onCanvasReady?.(gl.domElement);
      }}
    >
      <ambientLight intensity={1.05} />
      <hemisphereLight args={['#d1e0eb', '#80966b', 0.58]} />
      <directionalLight
        color="#fff1df"
        position={[-3.8, 5.8, 4.5]}
        intensity={2.05}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-1.2}
        shadow-camera-right={1.2}
        shadow-camera-top={1.2}
        shadow-camera-bottom={-1.2}
        shadow-camera-near={1}
        shadow-camera-far={8}
        shadow-bias={-0.00015}
      />
      <directionalLight color="#d9e7f0" position={[4, 3, 2]} intensity={0.34} />

      <Suspense fallback={null}>
        <VoxelWorld
          matrix={matrix}
          seedText={seedText}
          worldSeed={worldSeed}
          theme={theme}
          progress={progress}
        />
      </Suspense>

      <CameraRig target={scanMode ? 1 : 0} progress={progress} />
    </Canvas>
  );
}
