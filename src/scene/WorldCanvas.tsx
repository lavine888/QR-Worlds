import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import type { QRMatrix } from '../qr/generateQR';
import type { WorldTheme } from './themes';
import { ReferenceVoxelWorld } from './ReferenceVoxelWorld';

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
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 2], near: 0.1, far: 10 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'default',
        preserveDrawingBuffer: true,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor('#f7f7f7', 0);
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        onCanvasReady?.(gl.domElement);
      }}
    >
      <ReferenceVoxelWorld matrix={matrix} scanMode={scanMode} />
    </Canvas>
  );
}
