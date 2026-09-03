import type { QRMatrix } from '../qr/generateQR';

export type VoxelKind = 'dirt' | 'blossom' | 'trunk' | 'grass' | 'fallen' | 'decorative';

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

const TRUNK_RADIUS = 2.65;
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
  const occupied = new Set<string>();

  const push = (kind: VoxelKind, col: number, row: number, layer: number, salt = 0) => {
    const key = `${col}:${row}:${layer}`;
    if (occupied.has(key)) return false;
    occupied.add(key);
    blocks.push({
      kind,
      x: col - gridSize / 2,
      y: layer,
      z: row - gridSize / 2,
      tone: pseudoRandom(col, row, layer * 17 + salt),
    });
    return true;
  };

  // Structural pass 1: authoritative QR footprint.
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      const isDark = qr[row][col];
      const dx = col - cx;
      const dy = row - cy;
      const dist = Math.hypot(dx, dy);

      if (!isDark) push('dirt', col, row, 0, 1);
      else if (dist < TRUNK_RADIUS) push('trunk', col, row, 0, 2);
      else if (dist >= canopyRadius) push('grass', col, row, 0, 3);
      else push('fallen', col, row, 0, 4);
    }
  }

  // Structural pass 2: restrained tapered trunk.
  for (let layer = 1; layer < TRUNK_LAYERS; layer += 1) {
    const radius = layer < 4 ? 2.72 : layer < 9 ? 2.40 : 2.16;
    for (let row = 0; row < gridSize; row += 1) {
      for (let col = 0; col < gridSize; col += 1) {
        if (!qr[row][col]) continue;
        const dx = col - cx;
        const dy = row - cy;
        if (Math.hypot(dx, dy) < radius) push('trunk', col, row, layer, 20);
      }
    }
  }

  // Structural pass 3: quiet QR-owned crown. This is deliberately regular;
  // the decorative islands are responsible for the hand-built silhouette.
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      if (!qr[row][col]) continue;

      const dx = col - cx;
      const dy = row - cy;
      const dist = Math.hypot(dx, dy);
      if (dist >= canopyRadius) continue;

      const t = 1 - dist / canopyRadius;
      const angle = Math.atan2(dy, dx);
      const smallLobe = Math.sin(angle * 3 + 0.5) * 0.55 + Math.sin(angle * 5 - 0.8) * 0.24;
      const jitter = (pseudoRandom(col, row, 913) - 0.5) * 0.55;
      const layersHere = Math.max(
        2,
        Math.round(MAX_CANOPY_LAYERS * (0.20 + 0.80 * Math.pow(t, 1.78)) + smallLobe + jitter),
      );
      const domeOffset = Math.floor(t * 3);

      let undercut = 0;
      if (dist < 4.0) undercut = 2;
      else if (dist < 5.7 && pseudoRandom(col, row, 271) > 0.42) undercut = 1;
      const startLayer = TRUNK_LAYERS + domeOffset + undercut;

      for (let layer = 0; layer < layersHere; layer += 1) {
        push('blossom', col, row, startLayer + layer, 40);
      }

      const extraCount = Math.floor(pseudoRandom(col, row, 500) * (1.0 + t * 1.9));
      for (let extra = 0; extra < extraCount; extra += 1) {
        push('blossom', col, row, startLayer + layersHere + extra, 70);
      }
    }
  }

  // Decorative pass: nine intentionally composed blossom islands. Unlike the
  // old evenly-spaced ring, these have clear hierarchy: three larger crown
  // masses, four side masses and only two restrained lower accents. The result
  // reads like one tree rather than a procedural halo around the QR.
  const clusterSpecs = [
    // angle, radius factor, height lift, size
    [-2.30, 0.63, 3, 6],
    [-1.57, 0.55, 5, 7],
    [-0.82, 0.64, 4, 6],
    [-2.88, 0.78, 1, 4],
    [-0.22, 0.80, 2, 5],
    [2.88, 0.80, 1, 4],
    [0.34, 0.76, 2, 5],
    [2.18, 0.68, 0, 3],
    [0.98, 0.70, 0, 3],
  ] as const;

  const clusterOffsets = [
    [0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [1, 0, 1], [-1, 0, 1], [1, -1, 0], [-1, 1, 0],
  ] as const;

  clusterSpecs.forEach(([angle, radiusFactor, heightLift, clusterSize], cluster) => {
    const radius = canopyRadius * radiusFactor;
    const anchorCol = Math.round(cx + Math.cos(angle) * radius);
    const anchorRow = Math.round(cy + Math.sin(angle) * radius);
    const radialT = Math.max(0, 1 - radius / canopyRadius);
    const baseHeight = TRUNK_LAYERS + 3 + Math.round(radialT * 6) + heightLift;

    for (let i = 0; i < clusterSize; i += 1) {
      const [ox, oz, oy] = clusterOffsets[(i + cluster * 2) % clusterOffsets.length];
      const lift = i > 2 && pseudoRandom(cluster, i, 705) > 0.48 ? 1 : 0;
      const col = anchorCol + ox;
      const row = anchorRow + oz;
      if (col < 1 || row < 1 || col >= gridSize - 1 || row >= gridSize - 1) continue;
      push(
        'decorative',
        col,
        row,
        Math.max(TRUNK_LAYERS + 1, baseHeight + oy + lift),
        110 + cluster * 7 + i,
      );
    }
  });

  return {
    blocks,
    gridSize,
    trunkLayers: TRUNK_LAYERS,
    canopyRadius,
  };
}
