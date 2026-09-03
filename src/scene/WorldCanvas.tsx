import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import type { QRMatrix } from '../qr/generateQR';
import { ReferenceVoxelWorldRefined } from './ReferenceVoxelWorldRefined';
import type { WorldTheme } from './themes';

type WorldCanvasProps = {
  matrix: QRMatrix;
  theme: WorldTheme;
  seedText: string;
  worldSeed: number;
  scanMode: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
};

export function WorldCanvas({ matrix, scanMode, onCanvasReady }: WorldCanvasProps) {
  return (
    <Canvas
      dpr={[1.25, 1.85]}
      camera={{ position: [0, 0, 2], near: 0.1, far: 10 }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'default',
        preserveDrawingBuffer: true,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor('#f7f7f7', 1);
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        onCanvasReady?.(gl.domElement);
      }}
    >
      <ReferenceVoxelWorldRefined matrix={matrix} scanMode={scanMode} />
    </Canvas>
  );
}
