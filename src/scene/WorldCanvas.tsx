import { Canvas } from '@react-three/fiber';
import { useState } from 'react';
import * as THREE from 'three';
import type { QRMatrix } from '../qr/generateQR';
import { WebGPUWorld } from '../webgpu/WebGPUWorld';
import { ReferenceVoxelWorldRefined } from './ReferenceVoxelWorldRefined';

type WorldCanvasProps = {
  matrix: QRMatrix;
  scanMode: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
};

type RendererMode = 'webgpu' | 'webgl';

function canUseWebGPU() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
}

function WebGLFallback({ matrix, scanMode, onCanvasReady }: WorldCanvasProps) {
  return (
    <Canvas
      dpr={[1, 1.6]}
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
      style={{ width: '100%', height: '100%', background: '#f7f7f7' }}
    >
      <ReferenceVoxelWorldRefined matrix={matrix} scanMode={scanMode} />
    </Canvas>
  );
}

export function WorldCanvas({ matrix, scanMode, onCanvasReady }: WorldCanvasProps) {
  const [mode, setMode] = useState<RendererMode>(() => (canUseWebGPU() ? 'webgpu' : 'webgl'));

  if (mode === 'webgl') {
    return (
      <WebGLFallback
        matrix={matrix}
        scanMode={scanMode}
        onCanvasReady={onCanvasReady}
      />
    );
  }

  return (
    <WebGPUWorld
      matrix={matrix}
      scanMode={scanMode}
      onCanvasReady={onCanvasReady}
      onUnavailable={() => setMode('webgl')}
    />
  );
}
