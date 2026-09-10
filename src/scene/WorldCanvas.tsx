import { Canvas } from '@react-three/fiber';
import { useState } from 'react';
import * as THREE from 'three';
import type { QRMatrix } from '../qr/generateQR';
import { ProceduralWebGPUWorld } from '../procedural/ProceduralWebGPUWorld';
import { ProceduralWebGLFallback } from '../procedural/ProceduralWebGLFallback';
import type { Season } from '../procedural/generateScene';

type WorldCanvasProps = {
  matrix: QRMatrix;
  season: Season;
  scanMode: boolean;
  fixedProgress?: number | null;
  forceWebGPU?: boolean;
};

type RendererMode = 'procedural-webgpu' | 'procedural-webgl';
type NavigatorWithGPU = Navigator & { gpu?: unknown };

function hasWebGPU() {
  return typeof navigator !== 'undefined' && Boolean((navigator as NavigatorWithGPU).gpu);
}

function isDebugMode() {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
}

function WebGLFallback({
  matrix,
  season,
  scanMode,
  fixedProgress = null,
}: WorldCanvasProps) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0.35, 2.7], fov: 38, near: 0.01, far: 20 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#f7f7f7', 1);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      style={{ width: '100%', height: '100%', background: '#f7f7f7' }}
    >
      <ambientLight intensity={2.0} />
      <directionalLight position={[-2.5, 4, 3]} intensity={3.2} />
      <directionalLight position={[3, 1.5, -2]} intensity={0.9} />
      <ProceduralWebGLFallback
        matrix={matrix}
        season={season}
        scanMode={scanMode}
        fixedProgress={fixedProgress}
      />
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
    forceWebGPU || hasWebGPU() ? 'procedural-webgpu' : 'procedural-webgl'
  ));
  const debug = isDebugMode();
  const handleUnavailable = forceWebGPU ? undefined : () => setMode('procedural-webgl');

  return (
    <div className="reference-stage" data-renderer={mode}>
      {mode === 'procedural-webgl' ? (
        <WebGLFallback
          matrix={matrix}
          season={season}
          scanMode={scanMode}
          fixedProgress={fixedProgress}
        />
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
