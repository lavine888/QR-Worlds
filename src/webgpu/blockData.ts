import type { QRMatrix } from '../qr/generateQR';

export const BLOCK_SIZE = 0.0245;
export const TRUNK_RADIUS = 2.5;
export const TRUNK_LAYERS = 12;
export const MAX_CANOPY_LAYERS = 12;
export const CANOPY_OUTER_RADIUS_FACTOR = 0.46;

export const enum BlockType {
  Dirt = 0,
  CherryBlossom = 1,
  Trunk = 2,
  Grass = 3,
  FallenPetals = 4,
}

export type GPUBlockData = {
  positions: Float32Array;
  baseLayers: Float32Array;
  types: Uint32Array;
  gridSize: number;
  numBlocks: number;
};

function pseudoRandom(col: number, row: number, seed = 0) {
  const s = Math.sin(col * 127.1 + row * 311.7 + seed * 43.7) * 43758.5;
  return s - Math.floor(s);
}

function coreMatrix(matrix: QRMatrix) {
  const start = matrix.quietZone;
  const end = start + matrix.moduleCount;
  return matrix.cells.slice(start, end).map((row) => row.slice(start, end));
}

export function buildGPUBlockData(matrix: QRMatrix): GPUBlockData {
  const qr = coreMatrix(matrix);
  const gridSize = qr.length;
  const cx = gridSize / 2;
  const cy = gridSize / 2;
  const canopyRadius = gridSize * CANOPY_OUTER_RADIUS_FACTOR;

  const positions: number[] = [];
  const baseLayers: number[] = [];
  const types: number[] = [];

  const push = (col: number, row: number, layer: number, type: BlockType) => {
    positions.push(col, row, 0, 0);
    baseLayers.push(layer);
    types.push(type);
  };

  // Pass 1: exactly one ground cube per QR module.
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      const dark = qr[row][col];
      const dist = Math.hypot(col - cx, row - cy);
      let type = BlockType.Dirt;
      if (!dark) type = BlockType.Dirt;
      else if (dist < TRUNK_RADIUS) type = BlockType.Trunk;
      else if (dist >= canopyRadius) type = BlockType.Grass;
      else type = BlockType.FallenPetals;
      push(col, row, 0, type);
    }
  }

  // Pass 2: QR-owned trunk stack.
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      if (!qr[row][col]) continue;
      const dist = Math.hypot(col - cx, row - cy);
      if (dist >= TRUNK_RADIUS) continue;
      for (let layer = 1; layer < TRUNK_LAYERS; layer += 1) {
        push(col, row, layer, BlockType.Trunk);
      }
    }
  }

  // Pass 3: QR-owned blossom dome, matching the original grammar.
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      if (!qr[row][col]) continue;
      const dist = Math.hypot(col - cx, row - cy);
      if (dist >= canopyRadius) continue;

      const t = 1 - dist / canopyRadius;
      const layersHere = Math.max(
        3,
        Math.round(MAX_CANOPY_LAYERS * (0.25 + 0.75 * t * t)),
      );
      const domeOffset = Math.floor(t * 3);

      for (let layer = 0; layer < layersHere; layer += 1) {
        push(col, row, TRUNK_LAYERS + domeOffset + layer, BlockType.CherryBlossom);
      }

      const extraCount = Math.floor(pseudoRandom(col, row, 500) * 4);
      for (let extra = 0; extra < extraCount; extra += 1) {
        push(
          col,
          row,
          TRUNK_LAYERS + domeOffset + layersHere + extra,
          BlockType.CherryBlossom,
        );
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    baseLayers: new Float32Array(baseLayers),
    types: new Uint32Array(types),
    gridSize,
    numBlocks: types.length,
  };
}
