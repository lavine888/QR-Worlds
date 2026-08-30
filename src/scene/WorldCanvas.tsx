import { Canvas } from '@react-three/fiber';
import { Suspense, useRef } from 'react';
import type { QRMatrix } from '../qr/generateQR';
import { CameraRig } from './CameraRig';
import { GroundDetails } from './GroundDetails';
import { ProceduralTree } from './ProceduralTree';
import { QRTerrain } from './QRTerrain';
import type { WorldTheme } from './themes';

type WorldCanvasProps = {
  matrix: QRMatrix;
  theme: WorldTheme;
  seedText: string;
  scanMode: boolean;
};

export function WorldCanvas({ matrix, theme, seedText, scanMode }: WorldCanvasProps) {
  const progress = useRef(scanMode ? 1 : 0);

  return (
    <Canvas
      orthographic
      shadows
      dpr={[1, 2]}
      camera={{ position: [20, 24, 20], zoom: 18, near: 0.1, far: 1000 }}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={[theme.sky]} />
      <ambientLight intensity={2.1} />
      <directionalLight
        position={[12, 20, 8]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <hemisphereLight args={['#ffffff', '#c8c4b8', 0.7]} />

      <Suspense fallback={null}>
        <QRTerrain matrix={matrix} theme={theme} progress={progress} />
        <GroundDetails seedText={seedText} worldSize={matrix.size} theme={theme} progress={progress} />
        <ProceduralTree seedText={seedText} theme={theme} progress={progress} />
      </Suspense>

      <CameraRig target={scanMode ? 1 : 0} progress={progress} worldSize={matrix.size} />
    </Canvas>
  );
}
