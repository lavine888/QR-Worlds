import type { QRMatrix } from '../qr/generateQR';
import { WebGPUWorld } from '../webgpu/WebGPUWorld';

type WorldCanvasProps = {
  matrix: QRMatrix;
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
