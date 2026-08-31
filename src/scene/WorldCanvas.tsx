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
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        onCanvasReady?.(gl.domElement);
      }}
    >
      <color attach="background" args={['#f7f7f7']} />
      <ambientLight intensity={1.22} />
      <hemisphereLight args={['#eef3f4', '#7f8f72', 0.58]} />
      <directionalLight
        color="#fff2de"
        position={[-3.6, 5.8, -4.2]}
        intensity={1.95}
        castShadow
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
        shadow-camera-near={0.1}
        shadow-camera-far={14}
        shadow-bias={-0.00008}
      />
      <directionalLight color="#d9e6ef" position={[4, 3, 2]} intensity={0.32} />

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
