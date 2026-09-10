import type { QRMatrix } from '../qr/generateQR';
import { generateBotanicalCanopy } from './botanicalGenerator';
import { hashString } from './hash';
import { mapBotanicalsToQR } from './morphMapper';
import { seededRandom } from './random';
import { generateTreeStructure, type Point3 } from './treeGenerator';
import type { Season } from './generateScene';

export type HybridScene = {
  ground: Float32Array;
  branchStart: Float32Array;
  branchEnd: Float32Array;
  canopyStart: Float32Array;
  canopyTarget: Float32Array;
  canopyMeta: Float32Array;
  canopyMotion: Float32Array;
  sprites: Float32Array;
  groundCount: number;
  branchCount: number;
  canopyCount: number;
  spriteCount: number;
  gridSize: number;
  cellSize: number;
  groundSpan: number;
  seed: number;
};

const CELL_SIZE = 0.036;

function seasonConfig(season: Season) {
  if (season === 'summer') {
    return { canopy: 1900, grass: 0.44, particles: 34, crownScale: 0.83 };
  }
  if (season === 'autumn') {
    return { canopy: 1500, grass: 0.29, particles: 150, crownScale: 0.72 };
  }
  return { canopy: 1700, grass: 0.27, particles: 105, crownScale: 0.66 };
}

function scalePoint(point: Point3, scale: number): Point3 {
  return [point[0] * scale, point[1] * scale, point[2] * scale];
}

export function buildHybridScene(matrix: QRMatrix, season: Season): HybridScene {
  const seed = hashString(`${matrix.content}|${matrix.moduleCount}|icqr-hybrid`);
  const rng = seededRandom(seed ^ 0x51f15e);
  const size = matrix.size;
  const groundSpan = size * CELL_SIZE;
  const half = (size - 1) * 0.5;
  const config = seasonConfig(season);

  const ground: number[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const x = (col - half) * CELL_SIZE;
      const z = (row - half) * CELL_SIZE;
      ground.push(x, z, matrix.cells[row][col] ? 1 : 0, rng());
    }
  }

  // A smooth, deterministic branch skeleton supplies the silhouette. The QR
  // does not dictate branch topology directly; it dictates the seed and the
  // final destinations of the canopy carriers below.
  const tree = generateTreeStructure(seed ^ 0x9e3779b9);
  const treeScale = (groundSpan * 0.345) / Math.max(tree.crownRadius, 0.001);
  const branchStart: number[] = [];
  const branchEnd: number[] = [];

  for (const segment of tree.segments) {
    const a = scalePoint(segment.start, treeScale);
    const b = scalePoint(segment.end, treeScale);
    branchStart.push(a[0], a[1] + CELL_SIZE * 0.08, a[2], Math.max(CELL_SIZE * 0.045, segment.radiusStart * treeScale * 0.92));
    branchEnd.push(b[0], b[1] + CELL_SIZE * 0.08, b[2], Math.max(CELL_SIZE * 0.032, segment.radiusEnd * treeScale * 0.92));
  }

  // Leaf / flower carriers are generated around branch-tip canopy clusters,
  // then deterministically assigned to the actual dark QR modules. In 3D they
  // form the crown; during the reveal mapped carriers become the QR modules and
  // excess carriers collapse away. This is the central ICQR-style illusion.
  const botanicals = generateBotanicalCanopy(tree, seed ^ 0xa511e9b3, config.canopy);
  const mapped = mapBotanicalsToQR(botanicals, matrix, seed ^ 0x7f4a7c15);
  const canopyStart: number[] = [];
  const canopyTarget: number[] = [];
  const canopyMeta: number[] = [];
  const canopyMotion: number[] = [];

  for (const carrier of mapped) {
    const start = scalePoint(carrier.position, treeScale);
    const target = carrier.scanPosition;
    const shape = (carrier.scale[0] + carrier.scale[1] + carrier.scale[2]) / 3;
    const flowerBoost = carrier.kind === 'flower' ? 0.86 : 1.0;
    const startSize = CELL_SIZE * config.crownScale * flowerBoost * (0.58 + Math.min(1.25, shape) * 0.42);
    const targetSize = carrier.mapped ? CELL_SIZE * (carrier.finder ? 0.985 : 0.94) : 0.0001;

    canopyStart.push(
      start[0],
      start[1] + CELL_SIZE * 0.08,
      start[2],
      startSize,
    );
    canopyTarget.push(
      target[0] * CELL_SIZE,
      CELL_SIZE * 0.085,
      target[2] * CELL_SIZE,
      targetSize,
    );
    canopyMeta.push(
      carrier.kind === 'flower' ? 1 : 0,
      carrier.tone,
      carrier.morphStart,
      carrier.morphEnd,
    );
    canopyMotion.push(
      CELL_SIZE * (4.2 + carrier.arcHeight * 2.7),
      carrier.swirl,
      carrier.phase,
      carrier.finder ? 1 : 0,
    );
  }

  // Only genuinely decorative elements stay as lightweight sprites. They exit
  // before the final QR frame and never carry QR information.
  const sprites: number[] = [];
  const centerSafe = groundSpan * 0.11;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (rng() > config.grass) continue;
      const x = (col - half) * CELL_SIZE + (rng() - 0.5) * CELL_SIZE * 0.58;
      const z = (row - half) * CELL_SIZE + (rng() - 0.5) * CELL_SIZE * 0.58;
      if (Math.hypot(x, z) < centerSafe) continue;
      const height = CELL_SIZE * (0.52 + rng() * 1.15);
      sprites.push(x, CELL_SIZE * 0.14, z, 2 + height);
    }
  }

  for (let index = 0; index < config.particles; index += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = groundSpan * (0.07 + rng() * 0.39);
    const y = groundSpan * (0.22 + rng() * 0.78);
    const particleSize = CELL_SIZE * (0.28 + rng() * 0.38);
    sprites.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius, 1 + particleSize);
  }

  return {
    ground: new Float32Array(ground),
    branchStart: new Float32Array(branchStart),
    branchEnd: new Float32Array(branchEnd),
    canopyStart: new Float32Array(canopyStart),
    canopyTarget: new Float32Array(canopyTarget),
    canopyMeta: new Float32Array(canopyMeta),
    canopyMotion: new Float32Array(canopyMotion),
    sprites: new Float32Array(sprites),
    groundCount: ground.length / 4,
    branchCount: branchStart.length / 4,
    canopyCount: canopyStart.length / 4,
    spriteCount: sprites.length / 4,
    gridSize: size,
    cellSize: CELL_SIZE,
    groundSpan,
    seed,
  };
}
