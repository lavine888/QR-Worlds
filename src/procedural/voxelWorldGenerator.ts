import type { QRMatrix } from '../qr/generateQR';

export type VoxelKind =
  | 'dirt'
  | 'blossom'
  | 'trunk'
  | 'branch'
  | 'grass'
  | 'fallen'
  | 'petal';

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
const BRANCH_COUNT = 7;

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
  const centerCol = Math.floor(gridSize / 2);
  const centerRow = Math.floor(gridSize / 2);
  const cx = gridSize / 2;
  const cy = gridSize / 2;
  const canopyRadius = gridSize * CANOPY_OUTER_RADIUS_FACTOR;
  const blocks: VoxelBlock[] = [];
  const occupied = new Set<string>();

  const push = (kind: VoxelKind, col: number, row: number, layer: number, salt = 0) => {
    const x = Math.round(col);
    const z = Math.round(row);
    const y = Math.max(0, Math.round(layer));
    const key = `${x}:${y}:${z}`;
    if (occupied.has(key)) return false;
    occupied.add(key);
    blocks.push({
      kind,
      x: x - gridSize / 2,
      y,
      z: z - gridSize / 2,
      tone: pseudoRandom(x, z, seed + y * 17 + salt),
    });
    return true;
  };

  const growPetalCluster = (
    tipCol: number,
    tipRow: number,
    tipLayer: number,
    radiusX: number,
    radiusZ: number,
    radiusY: number,
    salt: number,
  ) => {
    const rx = Math.max(1, Math.round(radiusX));
    const rz = Math.max(1, Math.round(radiusZ));
    const ry = Math.max(1, Math.round(radiusY));

    for (let dy = -ry; dy <= ry; dy += 1) {
      for (let dz = -rz; dz <= rz; dz += 1) {
        for (let dx = -rx; dx <= rx; dx += 1) {
          const ellipsoid =
            (dx * dx) / Math.max(1, rx * rx) +
            (dz * dz) / Math.max(1, rz * rz) +
            (dy * dy) / Math.max(1, ry * ry);
          if (ellipsoid > 1.08) continue;

          const edgeNoise = pseudoRandom(tipCol + dx * 3, tipRow + dz * 5, seed + salt + dy * 29);
          const threshold = 0.22 + Math.max(0, ellipsoid - 0.55) * 0.45;
          if (edgeNoise < threshold) continue;

          push('petal', tipCol + dx, tipRow + dz, tipLayer + dy, salt + 90);
        }
      }
    }
  };

  // Pass 1: every core QR module owns one ground cube. This plate remains the
  // exact scan structure; decorative voxels are never required for decoding.
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

  // Pass 2: compact central trunk. These cubes are structural QR voxels, so
  // they stay present all the way into the flat scan reveal.
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

  // Pass 3: QR-owned blossom dome. This is deliberately denser than V4 so the
  // tree reads as one crown before the decorative silhouette is added.
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

  // Pass 4: decorative branch grammar. These voxels are allowed to break out
  // of the QR silhouette so the first frame reads as a cherry tree rather than
  // a QR-shaped dome. They collapse before scan colors appear.
  const baseAngles = [-2.72, -2.08, -1.35, -0.56, 0.18, 0.93, 2.08];

  for (let branchIndex = 0; branchIndex < BRANCH_COUNT; branchIndex += 1) {
    const jitter = (pseudoRandom(branchIndex, seed % 97, seed + 811) - 0.5) * 0.34;
    const angle = baseAngles[branchIndex] + jitter;
    const length = Math.max(
      5,
      Math.round(gridSize * (0.13 + pseudoRandom(branchIndex, 9, seed + 901) * 0.065)),
    );
    const startLayer = 7 + (branchIndex % 3) + Math.round(pseudoRandom(branchIndex, 4, seed + 77) * 2);
    const horizontalStep = 0.76 + pseudoRandom(branchIndex, 12, seed + 31) * 0.16;
    const rise = 0.43 + pseudoRandom(branchIndex, 17, seed + 41) * 0.18;

    let tipCol = centerCol;
    let tipRow = centerRow;
    let tipLayer = startLayer;

    for (let step = 1; step <= length; step += 1) {
      const t = step / length;
      const bend = Math.sin(t * Math.PI) * (branchIndex % 2 === 0 ? 0.32 : -0.26);
      const branchAngle = angle + bend;
      tipCol = centerCol + Math.cos(branchAngle) * step * horizontalStep;
      tipRow = centerRow + Math.sin(branchAngle) * step * horizontalStep;
      tipLayer = startLayer + step * rise + Math.sin(t * Math.PI) * 1.25;
      push('branch', tipCol, tipRow, tipLayer, 120 + branchIndex * 7);

      // Keep the inner half of a few limbs visually substantial instead of a
      // single-cube diagonal line.
      if (step < length * 0.55 && (branchIndex + step) % 3 === 0) {
        const side = branchIndex % 2 === 0 ? 1 : -1;
        push(
          'branch',
          tipCol + Math.cos(branchAngle + Math.PI / 2) * side,
          tipRow + Math.sin(branchAngle + Math.PI / 2) * side,
          tipLayer,
          150 + branchIndex,
        );
      }
    }

    const clusterScale = 0.84 + pseudoRandom(branchIndex, 23, seed + 301) * 0.42;
    growPetalCluster(
      Math.round(tipCol),
      Math.round(tipRow),
      Math.round(tipLayer + 1),
      3.7 * clusterScale,
      3.0 * clusterScale,
      2.6 * clusterScale,
      200 + branchIndex * 31,
    );

    // A shorter secondary twig gives the crown a recognisable asymmetry.
    if (branchIndex === 1 || branchIndex === 3 || branchIndex === 5) {
      const twigAngle = angle + (branchIndex === 3 ? -0.72 : 0.62);
      const twigLength = Math.max(3, Math.round(length * 0.48));
      let twigCol = centerCol + Math.cos(angle) * length * horizontalStep * 0.58;
      let twigRow = centerRow + Math.sin(angle) * length * horizontalStep * 0.58;
      let twigLayer = startLayer + length * rise * 0.56;

      for (let step = 1; step <= twigLength; step += 1) {
        twigCol += Math.cos(twigAngle) * 0.78;
        twigRow += Math.sin(twigAngle) * 0.78;
        twigLayer += 0.46;
        push('branch', twigCol, twigRow, twigLayer, 320 + branchIndex * 11);
      }

      growPetalCluster(
        Math.round(twigCol),
        Math.round(twigRow),
        Math.round(twigLayer + 1),
        2.8,
        2.3,
        2.1,
        420 + branchIndex * 19,
      );
    }
  }

  return {
    blocks,
    gridSize,
    trunkLayers: TRUNK_LAYERS,
    canopyRadius,
  };
}
