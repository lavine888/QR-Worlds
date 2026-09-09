import { Canvas } from '@react-three/fiber';
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import type { QRMatrix } from '../qr/generateQR';
import { RNWebGPUWorld } from '../v9/RNWebGPUWorld';
import { WebGPUWorld } from '../webgpu/WebGPUWorld';
import { ReferenceVoxelWorldRefined } from './ReferenceVoxelWorldRefined';

type WorldCanvasProps = {
  matrix: QRMatrix;
  scanMode: boolean;
  fixedProgress?: number | null;
  forceWebGPU?: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
};

type RendererMode = 'rnwebgpu' | 'raw-webgpu' | 'webgl';

type NavigatorWithGPU = Navigator & { gpu?: unknown };

function hasWebGPU() {
  return typeof navigator !== 'undefined' && Boolean((navigator as NavigatorWithGPU).gpu);
}

function params() {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
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

export function WorldCanvas({
  matrix,
  scanMode,
  fixedProgress = null,
  forceWebGPU = false,
  onCanvasReady,
}: WorldCanvasProps) {
  const runtimeParams = useMemo(params, []);
  const debug = runtimeParams.get('debug') === '1';
  const requested = runtimeParams.get('renderer');
  const initialMode: RendererMode = requested === 'raw'
    ? 'raw-webgpu'
    : requested === 'webgl'
      ? 'webgl'
      : 'rnwebgpu';
  const [mode, setMode] = useState<RendererMode>(initialMode);

  const viewportLabel = typeof window === 'undefined'
    ? ''
    : `${window.innerWidth}×${Math.round(window.innerHeight * 0.6)}`;

  const failToFallback = (message?: string) => {
    console.warn('[QR Worlds v9] RN WebGPU unavailable:', message);
    if (forceWebGPU) return;
    if (hasWebGPU()) setMode('raw-webgpu');
    else setMode('webgl');
  };

  return (
    <div className="reference-stage" data-renderer={mode}>
      {mode === 'rnwebgpu' ? (
        <RNWebGPUWorld
          matrix={matrix}
          scanMode={scanMode}
          fixedProgress={fixedProgress}
          onUnavailable={failToFallback}
        />
      ) : mode === 'raw-webgpu' ? (
        <WebGPUWorld
          matrix={matrix}
          scanMode={scanMode}
          fixedProgress={fixedProgress}
          onCanvasReady={onCanvasReady}
          onUnavailable={forceWebGPU ? undefined : () => setMode('webgl')}
        />
      ) : (
        <WebGLFallback
          matrix={matrix}
          scanMode={scanMode}
          onCanvasReady={onCanvasReady}
        />
      )}

      {debug ? (
        <div className="renderer-debug">
          {mode.toUpperCase()} · {matrix.moduleCount}×{matrix.moduleCount}
          {fixedProgress !== null ? ` · P=${fixedProgress.toFixed(2)}` : ''}
          {viewportLabel ? ` · ${viewportLabel}` : ''}
          {forceWebGPU ? ' · FORCED' : ''}
        </div>
      ) : null}
    </div>
  );
}
