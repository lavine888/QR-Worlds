import { seededRandom } from './random';

export type Point3 = [number, number, number];

export type TreeSegment = {
  start: Point3;
  end: Point3;
  radiusStart: number;
  radiusEnd: number;
  level: 0 | 1 | 2;
  phase: number;
};

export type CanopyCluster = {
  position: Point3;
  radius: Point3;
  phase: number;
};

export type TreeStructure = {
  segments: TreeSegment[];
  clusters: CanopyCluster[];
  height: number;
  crownRadius: number;
};

type Curve = {
  start: Point3;
  controlA: Point3;
  controlB: Point3;
  end: Point3;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, amount: number) {
  return a + (b - a) * amount;
}

function cubicPoint(curve: Curve, amount: number): Point3 {
  const inverse = 1 - amount;
  const a = inverse * inverse * inverse;
  const b = 3 * inverse * inverse * amount;
  const c = 3 * inverse * amount * amount;
  const d = amount * amount * amount;
  return [
    curve.start[0] * a + curve.controlA[0] * b + curve.controlB[0] * c + curve.end[0] * d,
    curve.start[1] * a + curve.controlA[1] * b + curve.controlB[1] * c + curve.end[1] * d,
    curve.start[2] * a + curve.controlA[2] * b + curve.controlB[2] * c + curve.end[2] * d,
  ];
}

function addCurve(
  segments: TreeSegment[],
  curve: Curve,
  steps: number,
  radiusStart: number,
  radiusEnd: number,
  level: TreeSegment['level'],
  phase: number,
) {
  let previous = curve.start;
  for (let index = 1; index <= steps; index += 1) {
    const amount = index / steps;
    const next = cubicPoint(curve, amount);
    segments.push({
      start: previous,
      end: next,
      radiusStart: lerp(radiusStart, radiusEnd, (index - 1) / steps),
      radiusEnd: lerp(radiusStart, radiusEnd, amount),
      level,
      phase: clamp(phase + amount * 0.08, 0, 1),
    });
    previous = next;
  }
}

function shuffle<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function generateTreeStructure(seed: number): TreeStructure {
  const random = seededRandom(seed);
  const segments: TreeSegment[] = [];
  const terminalCandidates: Point3[] = [];
  const height = 10.3 + random() * 0.7;
  const crownRadius = 3.72 + random() * 0.38;
  const swayAngle = random() * Math.PI * 2;

  const trunkPoint = (amount: number): Point3 => {
    const sway = Math.sin(amount * Math.PI * 1.42) * 0.34 * amount;
    const secondarySway = Math.sin(amount * Math.PI * 2.25 + 0.6) * 0.12 * amount;
    return [
      Math.cos(swayAngle) * sway + Math.cos(swayAngle + Math.PI / 2) * secondarySway,
      0.06 + height * 0.88 * amount,
      Math.sin(swayAngle) * sway + Math.sin(swayAngle + Math.PI / 2) * secondarySway,
    ];
  };

  const trunkSteps = 14;
  let previous = trunkPoint(0);
  for (let index = 1; index <= trunkSteps; index += 1) {
    const amount = index / trunkSteps;
    const next = trunkPoint(amount);
    segments.push({
      start: previous,
      end: next,
      radiusStart: lerp(0.62, 0.15, (index - 1) / trunkSteps),
      radiusEnd: lerp(0.62, 0.15, amount),
      level: 0,
      phase: amount * 0.24,
    });
    previous = next;
  }

  const primaryCount = 10 + Math.floor(random() * 4);
  for (let primaryIndex = 0; primaryIndex < primaryCount; primaryIndex += 1) {
    const heightBand = primaryIndex / Math.max(1, primaryCount - 1);
    const startAmount = 0.31 + heightBand * 0.47 + (random() - 0.5) * 0.045;
    const start = trunkPoint(startAmount);
    const angle = primaryIndex * GOLDEN_ANGLE + (random() - 0.5) * 0.34;
    const reach = crownRadius * (0.72 + random() * 0.28) * (1 - heightBand * 0.08);
    const end: Point3 = [
      Math.cos(angle) * reach,
      height * (0.48 + heightBand * 0.31 + (random() - 0.5) * 0.075),
      Math.sin(angle) * reach,
    ];
    const curve: Curve = {
      start,
      controlA: [
        lerp(start[0], end[0], 0.24),
        start[1] + height * (0.09 + random() * 0.035),
        lerp(start[2], end[2], 0.24),
      ],
      controlB: [
        lerp(start[0], end[0], 0.72) + Math.cos(angle + Math.PI / 2) * (random() - 0.5) * 0.55,
        end[1] + height * (0.025 + random() * 0.045),
        lerp(start[2], end[2], 0.72) + Math.sin(angle + Math.PI / 2) * (random() - 0.5) * 0.55,
      ],
      end,
    };
    const primaryRadius = 0.29 - heightBand * 0.07;
    addCurve(segments, curve, 6, primaryRadius, 0.095, 1, 0.17 + heightBand * 0.22);
    terminalCandidates.push(end);

    const secondaryCount = 2 + Math.floor(random() * 4);
    for (let secondaryIndex = 0; secondaryIndex < secondaryCount; secondaryIndex += 1) {
      const branchAmount = 0.48 + (secondaryIndex / Math.max(1, secondaryCount - 1)) * 0.42;
      const branchStart = cubicPoint(curve, branchAmount);
      const side = secondaryIndex % 2 === 0 ? 1 : -1;
      const childAngle = angle + side * (0.34 + random() * 0.5) + (random() - 0.5) * 0.24;
      const childReach = 1.1 + random() * 1.45;
      const childEnd: Point3 = [
        branchStart[0] + Math.cos(childAngle) * childReach,
        branchStart[1] + 0.42 + random() * 1.18,
        branchStart[2] + Math.sin(childAngle) * childReach,
      ];
      const secondaryCurve: Curve = {
        start: branchStart,
        controlA: [
          lerp(branchStart[0], childEnd[0], 0.3),
          branchStart[1] + 0.42 + random() * 0.26,
          lerp(branchStart[2], childEnd[2], 0.3),
        ],
        controlB: [
          lerp(branchStart[0], childEnd[0], 0.74),
          childEnd[1] + 0.12 + random() * 0.28,
          lerp(branchStart[2], childEnd[2], 0.74),
        ],
        end: childEnd,
      };
      addCurve(
        segments,
        secondaryCurve,
        4,
        0.105 + random() * 0.035,
        0.035,
        2,
        0.34 + heightBand * 0.24 + secondaryIndex * 0.012,
      );
      terminalCandidates.push(childEnd);
    }
  }

  terminalCandidates.push(trunkPoint(0.93), trunkPoint(1));
  const clusterCount = 20 + Math.floor(random() * 7);
  const selected = shuffle(terminalCandidates, random).slice(0, clusterCount - 4);
  const innerClusters: Point3[] = Array.from({ length: 4 }, (_, index) => {
    const angle = index * GOLDEN_ANGLE + random() * 0.4;
    const radius = 0.8 + random() * 1.35;
    return [
      Math.cos(angle) * radius,
      height * (0.61 + index * 0.075) + (random() - 0.5) * 0.35,
      Math.sin(angle) * radius,
    ];
  });

  const clusters = [...selected, ...innerClusters].map((position, index): CanopyCluster => {
    const normalizedHeight = clamp(position[1] / height, 0, 1);
    const edgeAmount = clamp(Math.hypot(position[0], position[2]) / crownRadius, 0, 1);
    return {
      position: [
        position[0] * 0.9,
        Math.min(height + 0.35, position[1] + 0.14 + random() * 0.34),
        position[2] * 0.9,
      ],
      radius: [
        1.08 + random() * 0.42 - edgeAmount * 0.1,
        0.82 + random() * 0.42 + normalizedHeight * 0.08,
        1.04 + random() * 0.42 - edgeAmount * 0.08,
      ],
      phase: index / Math.max(1, clusterCount - 1),
    };
  });

  return { segments, clusters, height, crownRadius };
}
