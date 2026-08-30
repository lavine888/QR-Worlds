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
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 100], zoom: 18, near: 0.1, far: 300 }}
      gl={{
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.02;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        onCanvasReady?.(gl.domElement);
      }}
    >
      <color attach="background" args={['#f7f7f7']} />

      <ambientLight intensity={0.72} />
      <hemisphereLight args={['#eef4f7', '#80956f', 0.56]} />
      <directionalLight
        color="#fff4e5"
        position={[-18, 24, 14]}
        intensity={2.25}
        castShadow
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-camera-near={0.5}
        shadow-camera-far={90}
        shadow-bias={-0.00018}
      />
      <directionalLight color="#cbdce6" position={[16, 10, -18]} intensity={0.38} />

      <Suspense fallback={null}>
        <VoxelWorld
          matrix={matrix}
          seedText={seedText}
          worldSeed={worldSeed}
          theme={theme}
          progress={progress}
        />
      </Suspense>

      <CameraRig
        target={scanMode ? 1 : 0}
        progress={progress}
        matrixSize={matrix.moduleCount}
        quietZone={matrix.quietZone}
      />
    </Canvas>
  );
}
