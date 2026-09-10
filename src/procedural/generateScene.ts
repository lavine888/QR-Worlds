import type { QRMatrix } from '../qr/generateQR';

export type Season = 'spring' | 'summer' | 'autumn';

export type ProceduralScene = {
  ground: Float32Array;
  branchStart: Float32Array;
  branchEnd: Float32Array;
  sprites: Float32Array;
  groundCount: number;
  branchCount: number;
  spriteCount: number;
  gridSize: number;
  cellSize: number;
  groundSpan: number;
  seed: number;
};

type Vec3 = [number, number, number];

type TurtleState = {
  position: Vec3;
  heading: Vec3;
  left: Vec3;
  up: Vec3;
  step: number;
  radius: number;
  depth: number;
};

const CELL_SIZE = 0.036;
const RULE = 'F[&+X][&-X][/&X]FX';

function hashString(value: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function rotate(v: Vec3, axisInput: Vec3, angle: number): Vec3 {
  const axis = normalize(axisInput);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const term1 = scale(v, c);
  const term2 = scale(cross(axis, v), s);
  const term3 = scale(axis, dot(axis, v) * (1 - c));
  return add(add(term1, term2), term3);
}

function cloneState(state: TurtleState): TurtleState {
  return {
    position: [...state.position] as Vec3,
    heading: [...state.heading] as Vec3,
    left: [...state.left] as Vec3,
    up: [...state.up] as Vec3,
    step: state.step,
    radius: state.radius,
    depth: state.depth,
  };
}

function buildLSystem(iterations: number) {
  let word = 'FFFFX';
  for (let i = 0; i < iterations; i += 1) {
    let next = '';
    for (const token of word) next += token === 'X' ? RULE : token;
    word = next;
  }
  return word;
}

function randomDirection(rng: () => number): Vec3 {
  const theta = rng() * Math.PI * 2;
  const y = rng() * 2 - 1;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  return [Math.cos(theta) * r, y, Math.sin(theta) * r];
}

function pushBranch(
  starts: number[],
  ends: number[],
  start: Vec3,
  end: Vec3,
  radiusStart: number,
  radiusEnd: number,
) {
  starts.push(start[0], start[1], start[2], radiusStart);
  ends.push(end[0], end[1], end[2], radiusEnd);
}

function generateTree(seed: number, groundSpan: number) {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const starts: number[] = [];
  const ends: number[] = [];
  const tips: Vec3[] = [];
  const stack: TurtleState[] = [];
  const word = buildLSystem(4);

  const basePitch = 0.44 + rng() * 0.13;
  const baseTurn = 0.56 + rng() * 0.18;
  let state: TurtleState = {
    position: [0, CELL_SIZE * 0.12, 0],
    heading: [0, 1, 0],
    left: [1, 0, 0],
    up: [0, 0, 1],
    step: groundSpan * (0.061 + rng() * 0.008),
    radius: groundSpan * 0.033,
    depth: 0,
  };

  const rotateYaw = (angle: number) => {
    state.heading = normalize(rotate(state.heading, state.up, angle));
    state.left = normalize(rotate(state.left, state.up, angle));
  };

  const rotatePitch = (angle: number) => {
    state.heading = normalize(rotate(state.heading, state.left, angle));
    state.up = normalize(rotate(state.up, state.left, angle));
  };

  const rotateRoll = (angle: number) => {
    state.left = normalize(rotate(state.left, state.heading, angle));
    state.up = normalize(rotate(state.up, state.heading, angle));
  };

  for (const token of word) {
    if (starts.length / 4 > 700) break;

    if (token === 'F') {
      const jitterPitch = (rng() - 0.5) * 0.055;
      const jitterYaw = (rng() - 0.5) * 0.07;
      rotatePitch(jitterPitch);
      rotateYaw(jitterYaw);

      const length = state.step * (0.88 + rng() * 0.24);
      const start = state.position;
      const end = add(start, scale(state.heading, length));
      const nextRadius = Math.max(CELL_SIZE * 0.055, state.radius * 0.9);
      pushBranch(starts, ends, start, end, state.radius, nextRadius);
      state.position = end;
      state.radius = Math.max(CELL_SIZE * 0.05, state.radius * 0.984);
      state.step *= 0.992;
    } else if (token === '[') {
      stack.push(cloneState(state));
      state = cloneState(state);
      state.depth += 1;
      state.step *= 0.745 + rng() * 0.035;
      state.radius *= 0.70 + rng() * 0.035;
    } else if (token === ']') {
      if (state.depth >= 2) tips.push([...state.position] as Vec3);
      state = stack.pop() ?? state;
    } else if (token === '+') {
      rotateYaw(baseTurn * (0.82 + rng() * 0.28));
    } else if (token === '-') {
      rotateYaw(-baseTurn * (0.82 + rng() * 0.28));
    } else if (token === '&') {
      rotatePitch(basePitch * (0.82 + rng() * 0.28));
    } else if (token === '^') {
      rotatePitch(-basePitch * (0.82 + rng() * 0.28));
    } else if (token === '/') {
      rotateRoll((0.62 + rng() * 0.5) * (rng() > 0.5 ? 1 : -1));
    } else if (token === 'X') {
      tips.push([...state.position] as Vec3);
    }
  }

  const uniqueTips: Vec3[] = [];
  for (const tip of tips) {
    if (tip[1] < groundSpan * 0.32) continue;
    const tooClose = uniqueTips.some((other) => Math.hypot(
      other[0] - tip[0],
      other[1] - tip[1],
      other[2] - tip[2],
    ) < CELL_SIZE * 1.3);
    if (!tooClose) uniqueTips.push(tip);
    if (uniqueTips.length >= 260) break;
  }

  return {
    branchStart: new Float32Array(starts),
    branchEnd: new Float32Array(ends),
    tips: uniqueTips,
  };
}

function seasonDensity(season: Season) {
  if (season === 'summer') return { crown: 7, petals: 34, grass: 0.42 };
  if (season === 'autumn') return { crown: 5, petals: 150, grass: 0.30 };
  return { crown: 4, petals: 110, grass: 0.26 };
}

export function buildProceduralScene(matrix: QRMatrix, season: Season): ProceduralScene {
  const seed = hashString(`${matrix.content}|${matrix.moduleCount}`);
  const rng = mulberry32(seed);
  const size = matrix.size;
  const groundSpan = size * CELL_SIZE;
  const half = (size - 1) * 0.5;

  const ground: number[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const x = (col - half) * CELL_SIZE;
      const z = (row - half) * CELL_SIZE;
      const dark = matrix.cells[row][col] ? 1 : 0;
      const noise = rng();
      ground.push(x, z, dark, noise);
    }
  }

  const tree = generateTree(seed, groundSpan);
  const density = seasonDensity(season);
  const sprites: number[] = [];

  for (const tip of tree.tips) {
    for (let i = 0; i < density.crown; i += 1) {
      const dir = randomDirection(rng);
      const spread = CELL_SIZE * (0.55 + rng() * 1.8);
      const sizeJitter = CELL_SIZE * (0.78 + rng() * 0.95);
      sprites.push(
        tip[0] + dir[0] * spread,
        tip[1] + Math.abs(dir[1]) * spread * 0.85,
        tip[2] + dir[2] * spread,
        sizeJitter,
      );
    }
  }

  const centerSafe = groundSpan * 0.12;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (rng() > density.grass) continue;
      const x = (col - half) * CELL_SIZE + (rng() - 0.5) * CELL_SIZE * 0.55;
      const z = (row - half) * CELL_SIZE + (rng() - 0.5) * CELL_SIZE * 0.55;
      if (Math.hypot(x, z) < centerSafe) continue;
      const height = CELL_SIZE * (0.55 + rng() * 1.1);
      sprites.push(x, CELL_SIZE * 0.16, z, 2 + height);
    }
  }

  for (let i = 0; i < density.petals; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = groundSpan * (0.08 + rng() * 0.38);
    const y = groundSpan * (0.22 + rng() * 0.78);
    const petalSize = CELL_SIZE * (0.30 + rng() * 0.36);
    sprites.push(
      Math.cos(angle) * radius,
      y,
      Math.sin(angle) * radius,
      1 + petalSize,
    );
  }

  return {
    ground: new Float32Array(ground),
    branchStart: tree.branchStart,
    branchEnd: tree.branchEnd,
    sprites: new Float32Array(sprites),
    groundCount: ground.length / 4,
    branchCount: tree.branchStart.length / 4,
    spriteCount: sprites.length / 4,
    gridSize: size,
    cellSize: CELL_SIZE,
    groundSpan,
    seed,
  };
}
