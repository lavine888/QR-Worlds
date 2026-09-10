import { Canvas } from '@react-three/fiber';
import { useState } from 'react';
import * as THREE from 'three';
import type { QRMatrix } from '../qr/generateQR';
import { ProceduralWebGPUWorld } from '../procedural/ProceduralWebGPUWorld';
import type { Season } from '../procedural/generateScene';
import { ReferenceVoxelWorldRefined } from './ReferenceVoxelWorldRefined';

type WorldCanvasProps = {
  matrix: QRMatrix;
  season: Season;
  scanMode: boolean;
  fixedProgress?: number | null;
  forceWebGPU?: boolean;
};

type RendererMode = 'procedural-webgpu' | 'webgl';
type NavigatorWithGPU = Navigator & { gpu?: unknown };

function hasWebGPU() {
  return typeof navigator !== 'undefined' && Boolean((navigator as NavigatorWithGPU).gpu);
}

function isDebugMode() {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
}

function WebGLFallback({ matrix, scanMode }: Pick<WorldCanvasProps, 'matrix' | 'scanMode'>) {
  return (
    <Canvas
      dpr={[1, 1.6]}
      camera={{ position: [0, 0, 2], near: 0.1, far: 10 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'default' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#f7f7f7', 1);
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      style={{ width: '100%', height: '100%', background: '#f7f7f7' }}
    >
      <ReferenceVoxelWorldRefined matrix={matrix} scanMode={scanMode} />
    </Canvas>
  );
}

export function WorldCanvas({
  matrix,
  season,
  scanMode,
  fixedProgress = null,
  forceWebGPU = false,
}: WorldCanvasProps) {
  const [mode, setMode] = useState<RendererMode>(() => (
    forceWebGPU || hasWebGPU() ? 'procedural-webgpu' : 'webgl'
  ));
  const debug = isDebugMode();
  const handleUnavailable = forceWebGPU ? undefined : () => setMode('webgl');

  return (
    <div className="reference-stage" data-renderer={mode}>
      {mode === 'webgl' ? (
        <WebGLFallback matrix={matrix} scanMode={scanMode} />
      ) : (
        <ProceduralWebGPUWorld
          matrix={matrix}
          season={season}
          scanMode={scanMode}
          fixedProgress={fixedProgress}
          onUnavailable={handleUnavailable}
        />
      )}

      {debug ? (
        <div className="renderer-debug">
          {mode.toUpperCase()} · {matrix.size}×{matrix.size} · {season.toUpperCase()}
          {fixedProgress !== null ? ` · P=${fixedProgress.toFixed(2)}` : ''}
          {forceWebGPU ? ' · FORCED' : ''}
        </div>
      ) : null}
    </div>
  );
}
