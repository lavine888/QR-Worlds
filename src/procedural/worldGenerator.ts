import { seededRandom } from './random';
import type { QRMatrix } from '../qr/generateQR';

export type Point3 = [number, number, number];

export type BranchData = {
  start: Point3;
  end: Point3;
  radiusStart: number;
  radiusEnd: number;
  depth: number;
  phase?: number;
};

export type FoliageData = {
  position: Point3;
  scale: number;
  rotation: Point3;
  anchor?: Point3;
  phase?: number;
};

export type BloomPetalData = {
  anchor: Point3;
  gardenPosition: Point3;
  gardenScale: Point3;
  gardenRotation: Point3;
  scanPosition: Point3;
  scanScale: Point3;
  phase: number;
  tone: number;
};

export type StemData = {
  position: Point3;
  height: number;
  width: number;
  yaw: number;
  phase?: number;
};

export type QRGrowthData = {
  stems: StemData[];
  branches: BranchData[];
  leaves: FoliageData[];
  blossoms: FoliageData[];
  blooms: BloomPetalData[];
};

function add(a: Point3, b: Point3): Point3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function multiply(value: Point3, factor: number): Point3 {
  return [value[0] * factor, value[1] * factor, value[2] * factor];
}

function normalize(value: Point3): Point3 {
  const length = Math.hypot(value[0], value[1], value[2]) || 1;
  return [value[0] / length, value[1] / length, value[2] / length];
}

function randomDirection(random: () => number, parent: Point3, spread: number): Point3 {
  const azimuth = random() * Math.PI * 2;
  const lift = spread * (0.62 + random() * 0.55);
  const direction = normalize([
    parent[0] * 0.34 + Math.cos(azimuth) * lift,
    Math.max(0.28, parent[1] * 0.62 + 0.52 + random() * 0.42),
    parent[2] * 0.34 + Math.sin(azimuth) * lift,
  ]);
  return direction;
}

function makeQRLeaf(random: () => number, x: number, y: number, z: number): FoliageData {
  return {
    position: [x + (random() - 0.5) * 0.22, y + (random() - 0.5) * 0.16, z + (random() - 0.5) * 0.22],
    scale: 0.2 + random() * 0.32,
    rotation: [random() * Math.PI, random() * Math.PI, random() * Math.PI],
    anchor: [x, y, z],
    phase: random(),
  };
}

function makeBloomPetal(
  random: () => number,
  x: number,
  z: number,
  cellIndex: number,
  worldSize: number,
): BloomPetalData {
  const angle = random() * Math.PI * 2;
  const radius = 1.8 + random() * 7.2;
  const sourceDrift = Math.min(1.35, Math.hypot(x, z) / Math.max(1, worldSize * 0.5) * 1.2);
  const size = 0.3 + random() * 0.34;
  const rootHeight = 0.5 + random() * 0.2;
  const sourceAngle = Math.atan2(z, x);
  const canopyAngle = angle + sourceAngle * 0.22;

  return {
    anchor: [x, 0.34, z],
    gardenPosition: [
      Math.cos(canopyAngle) * radius + Math.cos(sourceAngle) * sourceDrift,
      rootHeight + 1.2 + random() * 9.5,
      Math.sin(canopyAngle) * radius + Math.sin(sourceAngle) * sourceDrift,
    ],
    gardenScale: [size, 0.18 + random() * 0.18, size],
    gardenRotation: [
      (random() - 0.5) * 0.62,
      angle + Math.PI / 2 + (random() - 0.5) * 0.38,
      (random() - 0.5) * 0.62,
    ],
    scanPosition: [x, 0.055, z],
    scanScale: [1, 0.04, 1],
    phase: 0.04 + Math.min(0.68, random() * 0.5 + (cellIndex % 9) * 0.018),
    tone: random(),
  };
}

export function generateQRGrowthData(matrix: QRMatrix, seed: number): QRGrowthData {
  const random = seededRandom(seed);
  const offset = (matrix.size - 1) / 2;
  const darkCells: Array<{ x: number; z: number }> = [];
  matrix.cells.forEach((row, rowIndex) => {
    row.forEach((isDark, colIndex) => {
      if (isDark) darkCells.push({ x: colIndex - offset, z: rowIndex - offset });
    });
  });

  const growthStride = Math.max(1, Math.ceil(darkCells.length / 1400));
  const growthCells = darkCells.filter((_, index) => index % growthStride === 0);
  const stems: StemData[] = [];
  const branches: BranchData[] = [];
  const leaves: FoliageData[] = [];
  const blossoms: FoliageData[] = [];
  const blooms: BloomPetalData[] = [];
  const terminals: Point3[] = [];
  const stemStride = Math.max(1, Math.floor(growthCells.length / 210));
  const branchStride = Math.max(18, Math.floor(growthCells.length / 34));

  growthCells.forEach((cell, index) => {
    blooms.push(makeBloomPetal(random, cell.x, cell.z, index, matrix.size));

    if (index % stemStride !== 0) return;
    const height = 0.28 + random() * 0.68;
    stems.push({
      position: [cell.x, 0.24, cell.z],
      height,
      width: 0.065 + random() * 0.07,
      yaw: random() * Math.PI * 2,
      phase: random(),
    });
    leaves.push(makeQRLeaf(random, cell.x, 0.24 + height, cell.z));
    if (random() > 0.92) {
      blossoms.push({
        ...makeQRLeaf(random, cell.x, 0.3 + height, cell.z),
        scale: 0.14 + random() * 0.18,
      });
    }

    if (index % branchStride !== 0) return;
    const start: Point3 = [cell.x, 0.24 + height, cell.z];
    const direction = randomDirection(random, [0, 1, 0], 0.5 + random() * 0.2);
    const grow = (
      branchStart: Point3,
      branchDirection: Point3,
      length: number,
      radius: number,
      depth: number,
    ) => {
      const end = add(branchStart, multiply(branchDirection, length));
      branches.push({
        start: [...branchStart],
        end: [...end],
        radiusStart: radius,
        radiusEnd: Math.max(0.025, radius * 0.58),
        depth,
        phase: random(),
      });
      if (depth === 0) {
        terminals.push(end);
        return;
      }
      const childCount = depth > 1 ? 2 : 1;
      for (let child = 0; child < childCount; child += 1) {
        grow(
          end,
          randomDirection(random, branchDirection, 0.58 + random() * 0.2),
          length * (0.54 + random() * 0.16),
          radius * 0.58,
          depth - 1,
        );
      }
    };
    grow(start, direction, 0.95 + random() * 1.55, 0.09 + random() * 0.07, random() > 0.62 ? 2 : 1);
  });

  terminals.forEach((terminal) => {
    const leafCount = 5 + Math.floor(random() * 5);
    for (let index = 0; index < leafCount; index += 1) {
      leaves.push({
        ...makeQRLeaf(random, terminal[0], terminal[1], terminal[2]),
        scale: 0.32 + random() * 0.46,
      });
      if (random() > 0.72) {
        blossoms.push({
          ...makeQRLeaf(random, terminal[0], terminal[1], terminal[2]),
          scale: 0.18 + random() * 0.24,
        });
      }
    }
  });

  return { stems, branches, leaves, blossoms, blooms };
}
