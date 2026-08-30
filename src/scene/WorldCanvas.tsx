import { Canvas } from '@react-three/fiber';
import { Suspense, useRef } from 'react';
import * as THREE from 'three';
import type { QRMatrix } from '../qr/generateQR';
import { CameraRig } from './CameraRig';
import { LivingGround } from './LivingGround';
import { LivingTree } from './LivingTree';
import { Particles } from './Particles';
import type { WorldTheme } from './themes';

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
      camera={{ position: [11.4, 9.4, 12.8], zoom: 38, near: 0.1, far: 1000 }}
      gl={{
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        onCanvasReady?.(gl.domElement);
      }}
    >
      <color attach="background" args={[theme.sky]} />
      <ambientLight intensity={1.08} />
      <directionalLight
        color="#fff2de"
        position={[-7, 16, 10]}
        intensity={2.25}
        castShadow
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={14}
        shadow-camera-bottom={-10}
        shadow-camera-near={0.5}
        shadow-camera-far={42}
        shadow-bias={-0.00028}
      />
      <directionalLight color="#cadde0" position={[8, 8, -10]} intensity={0.72} />
      <hemisphereLight args={['#fffdf7', '#b9c5bd', 0.92]} />

      <Suspense fallback={null}>
        <LivingGround matrix={matrix} theme={theme} progress={progress} />
        <LivingTree
          matrix={matrix}
          seedText={seedText}
          worldSeed={worldSeed}
          theme={theme}
          progress={progress}
        />
        <Particles
          seedText={seedText}
          theme={theme}
          progress={progress}
        />
      </Suspense>

      <CameraRig target={scanMode ? 1 : 0} progress={progress} matrixSize={matrix.size} />
    </Canvas>
  );
}
