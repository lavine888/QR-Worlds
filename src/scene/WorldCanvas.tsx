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
      camera={{ position: [24, 22, 28], zoom: 22, near: 0.1, far: 1000 }}
      gl={{
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.03;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        onCanvasReady?.(gl.domElement);
      }}
    >
      <color attach="background" args={['#f7f7f7']} />
      <ambientLight intensity={1.15} />
      <hemisphereLight args={['#ffffff', '#b5b1a8', 0.72]} />
      <directionalLight
        color="#fff5e7"
        position={[-10, 18, 12]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-camera-near={0.5}
        shadow-camera-far={70}
        shadow-bias={-0.00022}
      />
      <directionalLight color="#dbe5ea" position={[10, 8, -12]} intensity={0.48} />

      <Suspense fallback={null}>
        <VoxelWorld
          matrix={matrix}
          seedText={seedText}
          worldSeed={worldSeed}
          theme={theme}
          progress={progress}
        />
      </Suspense>

      <CameraRig target={scanMode ? 1 : 0} progress={progress} matrixSize={matrix.size} />
    </Canvas>
  );
}
