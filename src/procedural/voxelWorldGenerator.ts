import type { QRMatrix } from '../qr/generateQR';

export type VoxelKind = 'dirt' | 'blossom' | 'trunk' | 'grass' | 'fallen';

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

const TRUNK_RADIUS = 2.5;
const TRUNK_LAYERS = 12;
const MAX_CANOPY_LAYERS = 12;
const CANOPY_OUTER_RADIUS_FACTOR = 0.46;

function pseudoRandom(col: number, row: number, seed = 0) {
  const s = Math.sin(col * 127.1 + row * 311.7 + seed * 43.7) * 43758.5;
  return s - Math.floor(s);
}

function getCoreMatrix(matrix: QRMatrix) {
  const start = matrix.quietZone;
  const end = start + matrix.moduleCount;
  return matrix.cells.slice(start, end).map((row) => row.slice(start, end));
}

export function generateVoxelWorld(matrix: QRMatrix, seed: number): VoxelWorldData {
  const qr = getCoreMatrix(matrix);
  const gridSize = qr.length;
  const cx = gridSize / 2;
  const cy = gridSize / 2;
  const canopyRadius = gridSize * CANOPY_OUTER_RADIUS_FACTOR;
  const blocks: VoxelBlock[] = [];

  const push = (kind: VoxelKind, col: number, row: number, layer: number, salt = 0) => {
    blocks.push({
      kind,
      x: col - gridSize / 2,
      y: layer,
      z: row - gridSize / 2,
      tone: pseudoRandom(col, row, seed + layer * 17 + salt),
    });
  };

  // Pass 1: every QR module owns one ground cube. This is the visual plate.
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      const isDark = qr[row][col];
      const dx = col - cx;
      const dy = row - cy;
      const dist = Math.hypot(dx, dy);

      if (!isDark) {
        push('dirt', col, row, 0, 1);
      } else if (dist < TRUNK_RADIUS) {
        push('trunk', col, row, 0, 2);
      } else if (dist >= canopyRadius) {
        push('grass', col, row, 0, 3);
      } else {
        push('fallen', col, row, 0, 4);
      }
    }
  }

  // Pass 2: a compact, constant 12-course trunk like the reference.
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      if (!qr[row][col]) continue;
      const dx = col - cx;
      const dy = row - cy;
      if (Math.hypot(dx, dy) >= TRUNK_RADIUS) continue;

      for (let layer = 1; layer < TRUNK_LAYERS; layer += 1) {
        push('trunk', col, row, layer, 20);
      }
    }
  }

  // Pass 3: a dense QR-owned blossom dome. Central trunk cells also grow
  // blossom courses, which closes the canopy instead of punching a hole in it.
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      if (!qr[row][col]) continue;

      const dx = col - cx;
      const dy = row - cy;
      const dist = Math.hypot(dx, dy);
      if (dist >= canopyRadius) continue;

      const t = 1 - dist / canopyRadius;
      const layersHere = Math.max(
        3,
        Math.round(MAX_CANOPY_LAYERS * (0.25 + 0.75 * t * t)),
      );
      const domeOffset = Math.floor(t * 3);

      for (let layer = 0; layer < layersHere; layer += 1) {
        push('blossom', col, row, TRUNK_LAYERS + domeOffset + layer, 40);
      }

      const extraCount = Math.floor(pseudoRandom(col, row, seed + 500) * 4);
      for (let extra = 0; extra < extraCount; extra += 1) {
        push(
          'blossom',
          col,
          row,
          TRUNK_LAYERS + domeOffset + layersHere + extra,
          70,
        );
      }
    }
  }

  return {
    blocks,
    gridSize,
    trunkLayers: TRUNK_LAYERS,
    canopyRadius,
  };
}
