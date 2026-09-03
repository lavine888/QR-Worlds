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
const DECORATIVE_CLUSTER_COUNT = 11;

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

  // Structural pass 1: one ground cube per QR module. This footprint is the
  // authoritative symbol and is never modified by the decorative canopy.
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

  // Structural pass 2: tapered trunk. Every block still belongs to a QR-dark
  // column, but the upper courses narrow slightly so it reads like a trunk
  // rather than a straight voxel pillar.
  for (let layer = 1; layer < TRUNK_LAYERS; layer += 1) {
    const radius = layer < 4 ? 2.75 : layer < 9 ? 2.42 : 2.18;
    for (let row = 0; row < gridSize; row += 1) {
      for (let col = 0; col < gridSize; col += 1) {
        if (!qr[row][col]) continue;
        const dx = col - cx;
        const dy = row - cy;
        if (Math.hypot(dx, dy) < radius) push('trunk', col, row, layer, 20);
      }
    }
  }

  // Structural pass 3: a restrained QR-owned blossom crown. Decorative
  // clusters below will carry the organic silhouette, so this layer no longer
  // needs exaggerated lobes that make the QR pattern itself look distorted.
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      if (!qr[row][col]) continue;

      const dx = col - cx;
      const dy = row - cy;
      const dist = Math.hypot(dx, dy);
      if (dist >= canopyRadius) continue;

      const t = 1 - dist / canopyRadius;
      const angle = Math.atan2(dy, dx);
      const smallLobe = Math.sin(angle * 3 + 0.55) * 0.7 + Math.sin(angle * 5 - 0.85) * 0.35;
      const jitter = (pseudoRandom(col, row, 913) - 0.5) * 0.8;
      const layersHere = Math.max(
        2,
        Math.round(MAX_CANOPY_LAYERS * (0.2 + 0.8 * Math.pow(t, 1.75)) + smallLobe + jitter),
      );
      const domeOffset = Math.floor(t * 3);

      let undercut = 0;
      if (dist < 4.0) undercut = 2;
      else if (dist < 5.8 && pseudoRandom(col, row, 271) > 0.4) undercut = 1;
      const startLayer = TRUNK_LAYERS + domeOffset + undercut;

      for (let layer = 0; layer < layersHere; layer += 1) {
        push('blossom', col, row, startLayer + layer, 40);
      }

      const extraCount = Math.floor(pseudoRandom(col, row, 500) * (1.2 + t * 2.2));
      for (let extra = 0; extra < extraCount; extra += 1) {
        push('blossom', col, row, startLayer + layersHere + extra, 70);
      }
    }
  }

  // Decorative pass: deterministic flower islands that exist only to make the
  // 3D frame read as a cherry tree. They are deliberately NOT constrained to
  // QR-dark cells. The vertex shader collapses them before the scene becomes
  // flat, leaving the structural QR untouched.
  const clusterOffsets = [
    [0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [1, 0, 1], [-1, 0, 1], [1, -1, 0], [-1, 1, 0],
  ] as const;

  for (let cluster = 0; cluster < DECORATIVE_CLUSTER_COUNT; cluster += 1) {
    const angleJitter = (pseudoRandom(cluster, 17, 701) - 0.5) * 0.34;
    const angle = (cluster / DECORATIVE_CLUSTER_COUNT) * Math.PI * 2 + angleJitter;
    const radiusFactor = 0.58 + pseudoRandom(cluster, 31, 702) * 0.43;
    const radius = canopyRadius * radiusFactor;
    const anchorCol = Math.round(cx + Math.cos(angle) * radius);
    const anchorRow = Math.round(cy + Math.sin(angle) * radius);
    const radialT = Math.max(0, 1 - radius / canopyRadius);
    const baseHeight =
      TRUNK_LAYERS +
      3 +
      Math.round(radialT * 6) +
      Math.round((pseudoRandom(cluster, 47, 703) - 0.35) * 4);
    const clusterSize = 3 + Math.floor(pseudoRandom(cluster, 59, 704) * 4);

    for (let i = 0; i < clusterSize; i += 1) {
      const [ox, oz, oy] = clusterOffsets[(i + cluster * 3) % clusterOffsets.length];
      const lift = i > 2 && pseudoRandom(cluster, i, 705) > 0.45 ? 1 : 0;
      const col = anchorCol + ox;
      const row = anchorRow + oz;
      if (col < 1 || row < 1 || col >= gridSize - 1 || row >= gridSize - 1) continue;
      push('decorative', col, row, Math.max(TRUNK_LAYERS + 1, baseHeight + oy + lift), 110 + cluster * 7 + i);
    }
  }

  return {
    blocks,
    gridSize,
    trunkLayers: TRUNK_LAYERS,
    canopyRadius,
  };
}
