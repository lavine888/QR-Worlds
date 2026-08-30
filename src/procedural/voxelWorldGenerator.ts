import type { QRMatrix } from '../qr/generateQR';

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

const TRUNK_LAYERS = 12;
const MAX_CANOPY_LAYERS = 12;
const CANOPY_RADIUS_FACTOR = 0.46;

function fract(value: number) {
  return value - Math.floor(value);
}

function pseudoRandom(col: number, row: number, layer: number, seed: number) {
  const s = Math.sin(
    col * 127.1 + row * 311.7 + layer * 73.7 + (seed >>> 0) * 0.000031,
  ) * 43758.5453123;
  return fract(s);
}

function coreCell(matrix: QRMatrix, row: number, col: number) {
  return matrix.cells[row + matrix.quietZone]?.[col + matrix.quietZone] ?? false;
}

export function generateVoxelWorld(matrix: QRMatrix, seed: number): VoxelWorldData {
  // The artwork deliberately excludes the encoded quiet-zone cells. The
  // reference composition treats the pale page around the object as breathing
  // room, while the QR core itself becomes the physical world. A dedicated
  // scan plate restores the required quiet zone only in the flat endpoint.
  const gridSize = matrix.moduleCount;
  const center = gridSize / 2;
  const offset = (gridSize - 1) / 2;
  const trunkRadius = Math.min(3, Math.max(2.25, gridSize * 0.1));
  const canopyRadius = gridSize * CANOPY_RADIUS_FACTOR;
  const blocks: VoxelBlock[] = [];

  const push = (kind: VoxelKind, col: number, row: number, layer: number) => {
    blocks.push({
      kind,
      x: col - offset,
      y: layer,
      z: row - offset,
      tone: pseudoRandom(col, row, layer, seed),
    });
  };

  // Course 0 is the QR itself. Dark cells change semantic material according
  // to their position, but never stop being dark cells.
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      const dark = coreCell(matrix, row, col);
      const dx = col - center;
      const dz = row - center;
      const distance = Math.hypot(dx, dz);

      if (!dark) {
        push('light', col, row, 0);
      } else if (distance < trunkRadius) {
        push('trunk', col, row, 0);
      } else if (distance >= canopyRadius) {
        push('grass', col, row, 0);
      } else {
        push('blossom', col, row, 0);
      }
    }
  }

  // A stout voxel trunk grows only from dark cells near the centre. Keeping a
  // fixed 12-course height is intentional: short QR payloads therefore have
  // the same chunky toy proportions as the reference instead of scaling into a
  // tall procedural tree.
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      if (!coreCell(matrix, row, col)) continue;
      const distance = Math.hypot(col - center, row - center);
      if (distance >= trunkRadius) continue;

      for (let layer = 1; layer < TRUNK_LAYERS; layer += 1) {
        push('trunk', col, row, layer);
      }
    }
  }

  // The canopy is not an independent tree mesh. It is the same dark QR modules
  // stacked upward into a dome. Central trunk cells also receive blossom
  // courses above the trunk, which closes the crown instead of leaving a hole.
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      if (!coreCell(matrix, row, col)) continue;

      const distance = Math.hypot(col - center, row - center);
      if (distance >= canopyRadius) continue;

      const radial = Math.max(0, 1 - distance / canopyRadius);
      const layers = Math.max(
        3,
        Math.round(MAX_CANOPY_LAYERS * (0.25 + 0.75 * radial * radial)),
      );
      const domeOffset = Math.floor(radial * 3);

      for (let layer = 0; layer < layers; layer += 1) {
        push('blossom', col, row, TRUNK_LAYERS + domeOffset + layer);
      }

      const extraCount = Math.floor(pseudoRandom(col, row, 500, seed) * 4);
      for (let extra = 0; extra < extraCount; extra += 1) {
        push(
          'blossom',
          col,
          row,
          TRUNK_LAYERS + domeOffset + layers + extra,
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
