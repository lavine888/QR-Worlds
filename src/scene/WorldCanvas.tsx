import type { QRMatrix } from '../qr/generateQR';
import { WebGPUWorld } from '../webgpu/WebGPUWorld';
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
    <WebGPUWorld
      matrix={matrix}
      scanMode={scanMode}
      onCanvasReady={onCanvasReady}
    />
  );
}
