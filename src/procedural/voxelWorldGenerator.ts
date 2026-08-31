import type { QRMatrix } from '../qr/generateQR';
import { seededRandom } from './random';

export type VoxelKind = 'light' | 'blossom' | 'trunk' | 'grass';

export type VoxelBlock = {
  kind: VoxelKind;
  x: number;
  y: number;
  z: number;
  tone: number;
};

export type VoxelWorldData = {
  blocks: VoxelBlock[];
  gridSize: number;
  trunkLayers: number;
  canopyRadius: number;
};

function classifyDarkModule(distance: number, trunkRadius: number, canopyRadius: number): VoxelKind {
  if (distance < trunkRadius) return 'trunk';
  if (distance < canopyRadius) return 'blossom';
  return 'grass';
}

export function generateVoxelWorld(matrix: QRMatrix, seed: number): VoxelWorldData {
  const random = seededRandom(seed);
  const blocks: VoxelBlock[] = [];
  const offset = (matrix.size - 1) / 2;
  const trunkRadius = Math.max(1.3, matrix.moduleCount * 0.075);
  const canopyRadius = matrix.moduleCount * 0.43;
  const trunkLayers = Math.max(9, Math.round(matrix.moduleCount * 0.42));
  const maxCanopyLayers = Math.max(8, Math.round(matrix.moduleCount * 0.38));
  const canopyBase = Math.max(5, Math.round(trunkLayers * 0.56));

  const push = (kind: VoxelKind, x: number, y: number, z: number, tone = random()) => {
    blocks.push({ kind, x, y, z, tone });
  };

  matrix.cells.forEach((row, rowIndex) => {
    row.forEach((isDark, colIndex) => {
      const x = colIndex - offset;
      const z = rowIndex - offset;
      const distance = Math.hypot(x, z);
      const darkKind = classifyDarkModule(distance, trunkRadius, canopyRadius);

      // Every QR module owns exactly one ground voxel. In the flat view the
      // top faces of these columns reconstruct the source matrix directly.
      push(isDark ? darkKind : 'light', x, 0, z);

      if (!isDark) return;

      if (darkKind === 'trunk') {
        for (let layer = 1; layer < trunkLayers; layer += 1) {
          push('trunk', x, layer, z);
        }
        return;
      }

      if (darkKind === 'blossom') {
        const radial = Math.max(0, 1 - distance / canopyRadius);
        const dome = radial * radial;
        const raggedness = Math.floor(random() * 3);
        const layers = Math.max(2, Math.round(2 + maxCanopyLayers * dome) + raggedness);
        const lift = Math.floor(dome * 2);

        for (let layer = 0; layer < layers; layer += 1) {
          push('blossom', x, canopyBase + lift + layer, z);
        }

        if (random() > 0.62) {
          push('blossom', x, canopyBase + lift + layers, z);
        }
        return;
      }

      // Outer dark modules become the lawn. A restrained second course adds
      // enough relief to read in isometric view without obscuring the matrix.
      if (darkKind === 'grass' && random() > 0.56) {
        push('grass', x, 1, z);
      }
    });
  });

  return {
    blocks,
    gridSize: matrix.size,
    trunkLayers,
    canopyRadius,
  };
}
