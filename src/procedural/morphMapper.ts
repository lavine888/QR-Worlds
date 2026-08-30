import type { QRMatrix } from '../qr/generateQR';
import type { BotanicalCarrier } from './botanicalGenerator';
import { seededRandom } from './random';
import type { Point3 } from './treeGenerator';

export type MorphCarrier = BotanicalCarrier & {
  scanPosition: Point3;
  scanScale: Point3;
  scanRotation: Point3;
  morphStart: number;
  morphEnd: number;
  arcHeight: number;
  swirl: number;
  finder: boolean;
  mapped: boolean;
};

type DarkTarget = {
  position: Point3;
  row: number;
  col: number;
  finder: boolean;
  angle: number;
  radius: number;
};

export function countDarkModules(matrix: QRMatrix) {
  return matrix.cells.reduce(
    (total, row) => total + row.reduce((rowTotal, dark) => rowTotal + Number(dark), 0),
    0,
  );
}

function isFinderModule(matrix: QRMatrix, row: number, col: number) {
  const sourceRow = row - matrix.quietZone;
  const sourceCol = col - matrix.quietZone;
  const limit = matrix.moduleCount - 7;
  const top = sourceRow >= 0 && sourceRow < 7;
  const left = sourceCol >= 0 && sourceCol < 7;
  const right = sourceCol >= limit && sourceCol < matrix.moduleCount;
  const bottom = sourceRow >= limit && sourceRow < matrix.moduleCount;
  return (top && left) || (top && right) || (bottom && left);
}

function collectTargets(matrix: QRMatrix): DarkTarget[] {
  const offset = (matrix.size - 1) / 2;
  const targets: DarkTarget[] = [];
  matrix.cells.forEach((row, rowIndex) => {
    row.forEach((dark, colIndex) => {
      if (!dark) return;
      const x = colIndex - offset;
      const z = rowIndex - offset;
      targets.push({
        position: [x, 0.055, z],
        row: rowIndex,
        col: colIndex,
        finder: isFinderModule(matrix, rowIndex, colIndex),
        angle: Math.atan2(z, x),
        radius: Math.hypot(x, z),
      });
    });
  });
  return targets.sort((a, b) => a.angle - b.angle || a.radius - b.radius || a.row - b.row || a.col - b.col);
}

export function mapBotanicalsToQR(
  botanicals: BotanicalCarrier[],
  matrix: QRMatrix,
  seed: number,
): MorphCarrier[] {
  const random = seededRandom(seed);
  const targets = collectTargets(matrix);
  const carrierOrder = botanicals
    .map((carrier, index) => ({
      index,
      angle: Math.atan2(carrier.position[2], carrier.position[0]),
      radius: Math.hypot(carrier.position[0], carrier.position[2]) + carrier.position[1] * 0.035,
    }))
    .sort((a, b) => a.angle - b.angle || a.radius - b.radius);
  const assignments = new Map<number, DarkTarget>();
  targets.forEach((target, index) => {
    const carrier = carrierOrder[Math.floor((index / Math.max(1, targets.length)) * carrierOrder.length)];
    assignments.set(carrier.index, target);
  });

  return botanicals.map((carrier, index) => {
    const target = assignments.get(index);
    const finder = target?.finder ?? false;
    const mapped = Boolean(target);
    const start = finder
      ? 0.04 + random() * 0.035
      : mapped
        ? 0.12 + carrier.phase * 0.12 + random() * 0.025
        : 0.025 + random() * 0.055;
    const end = finder
      ? 0.55 + random() * 0.065
      : mapped
        ? 0.82 + random() * 0.11
        : 0.45 + random() * 0.1;
    const destination = target?.position ?? ([
      carrier.position[0] * 0.2,
      0.16,
      carrier.position[2] * 0.2,
    ] as Point3);
    const travel = Math.hypot(
      destination[0] - carrier.position[0],
      destination[2] - carrier.position[2],
    );

    return {
      ...carrier,
      scanPosition: destination,
      scanScale: mapped ? [1.015, 1.015, 1] : [0.001, 0.001, 0.001],
      scanRotation: [-Math.PI / 2, 0, 0],
      morphStart: start,
      morphEnd: Math.max(start + 0.2, end),
      arcHeight: mapped ? 0.32 + Math.min(0.78, travel * 0.018) + random() * 0.24 : 0.16,
      swirl: mapped
        ? (random() > 0.5 ? 1 : -1) * (0.06 + random() * 0.2)
        : (random() - 0.5) * 0.08,
      finder,
      mapped,
    };
  });
}
