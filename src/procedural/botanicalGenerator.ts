import { seededRandom } from './random';
import type { CanopyCluster, Point3, TreeStructure } from './treeGenerator';

export type BotanicalKind = 'leaf' | 'flower';

export type BotanicalCarrier = {
  kind: BotanicalKind;
  position: Point3;
  rotation: Point3;
  scale: Point3;
  clusterIndex: number;
  phase: number;
  tone: number;
};

function sampleClusterPoint(
  cluster: CanopyCluster,
  random: () => number,
): { position: Point3; normal: Point3 } {
  const vertical = random() * 2 - 1;
  const angle = random() * Math.PI * 2;
  const radial = Math.sqrt(Math.max(0, 1 - vertical * vertical));
  const shell = 0.28 + Math.cbrt(random()) * 0.72;
  const normal: Point3 = [Math.cos(angle) * radial, vertical, Math.sin(angle) * radial];
  return {
    position: [
      cluster.position[0] + normal[0] * cluster.radius[0] * shell,
      cluster.position[1] + normal[1] * cluster.radius[1] * shell,
      cluster.position[2] + normal[2] * cluster.radius[2] * shell,
    ],
    normal,
  };
}

export function generateBotanicalCanopy(
  tree: TreeStructure,
  seed: number,
  count: number,
): BotanicalCarrier[] {
  const random = seededRandom(seed);
  const safeCount = Math.max(tree.clusters.length, Math.floor(count));
  const densityScale = Math.min(1.08, Math.sqrt(2300 / safeCount));

  return Array.from({ length: safeCount }, (_, index) => {
    const clusterIndex = (index * 17 + Math.floor(random() * tree.clusters.length)) % tree.clusters.length;
    const cluster = tree.clusters[clusterIndex];
    const sample = sampleClusterPoint(cluster, random);
    const isFlower = random() < 0.28;
    const outwardYaw = Math.atan2(sample.normal[0], sample.normal[2]);
    const outwardPitch = -Math.asin(Math.max(-1, Math.min(1, sample.normal[1])));
    const yaw = outwardYaw + (random() - 0.5) * 1.35;
    const pitch = outwardPitch * 0.34 + (random() - 0.5) * 1.1;
    const roll = (random() - 0.5) * (isFlower ? 1.5 : Math.PI);
    const baseScale = densityScale * (isFlower ? 0.82 + random() * 0.34 : 0.78 + random() * 0.42);

    return {
      kind: isFlower ? 'flower' : 'leaf',
      position: sample.position,
      rotation: [pitch, yaw, roll],
      scale: isFlower
        ? [baseScale * 0.72, baseScale * 0.72, baseScale * 0.72]
        : [baseScale * 0.46, baseScale * (0.68 + random() * 0.14), baseScale],
      clusterIndex,
      phase: (cluster.phase * 0.58 + random() * 0.42) % 1,
      tone: random(),
    };
  });
}
