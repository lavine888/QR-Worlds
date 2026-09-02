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

const TRUNK_RADIUS = 2.8;
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

export function generateVoxelWorld(matrix: QRMatrix, _seed: number): VoxelWorldData {
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
      tone: pseudoRandom(col, row, layer * 17 + salt),
    });
  };

  // Pass 1: one ground cube per QR module. The footprint never changes, so
  // the flat state remains the exact QR symbol even as the canopy is sculpted.
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

  // Pass 2: slightly broader compact trunk. It still occupies only QR-dark
  // cells, so the flat symbol is untouched while the tree reads more clearly.
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

  // Pass 3: same QR-owned canopy footprint, but a much more visible vertical
  // silhouette. Three broad crown lobes plus five smaller ones create distinct
  // high/low masses, while an undercut around the centre exposes the trunk.
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      if (!qr[row][col]) continue;

      const dx = col - cx;
      const dy = row - cy;
      const dist = Math.hypot(dx, dy);
      if (dist >= canopyRadius) continue;

      const t = 1 - dist / canopyRadius;
      const angle = Math.atan2(dy, dx);
      const edgeWeight = 1 - Math.min(1, t * 1.45);
      const crownLobes =
        Math.sin(angle * 3 + 0.55) * 1.55 +
        Math.sin(angle * 5 - 0.85) * 0.72;
      const localJitter = (pseudoRandom(col, row, 913) - 0.5) * 1.8;
      const silhouetteLift = Math.round(
        crownLobes * (0.52 + edgeWeight * 0.72) + localJitter * 0.55,
      );

      // Fuller centre, visibly thinner outer edge.
      const baseLayers = MAX_CANOPY_LAYERS * (0.18 + 0.82 * Math.pow(t, 1.7));
      const layersHere = Math.max(2, Math.round(baseLayers) + silhouetteLift);
      const domeOffset = Math.floor(t * 3.4);

      // Lift the underside around the trunk by 2–3 courses. This is the main
      // readability change: the crown now visibly hangs above a trunk instead
      // of swallowing it into one solid pink mass.
      let undercut = 0;
      if (dist < 3.8) undercut = 3;
      else if (dist < 5.4) undercut = 2;
      else if (dist < 6.8 && pseudoRandom(col, row, 271) > 0.46) undercut = 1;

      // A slight directional opening keeps the lower silhouette asymmetric.
      const frontOpening = dy > 0 && Math.abs(dx) < canopyRadius * 0.28 && t > 0.42 ? 1 : 0;
      const startLayer = TRUNK_LAYERS + domeOffset + undercut + frontOpening;

      for (let layer = 0; layer < layersHere; layer += 1) {
        push('blossom', col, row, startLayer + layer, 40);
      }

      // Ragged upper courses are now concentrated in the crown core. The edge
      // stays thin, which makes the lobe silhouette easier to read at a glance.
      const extraBudget = pseudoRandom(col, row, 500) * (1.1 + t * 2.9);
      const extraCount = Math.floor(extraBudget);
      for (let extra = 0; extra < extraCount; extra += 1) {
        push('blossom', col, row, startLayer + layersHere + extra, 70);
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
