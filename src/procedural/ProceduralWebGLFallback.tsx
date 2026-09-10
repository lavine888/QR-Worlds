import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { QRMatrix } from '../qr/generateQR';
import { buildProceduralScene, type ProceduralScene, type Season } from './generateScene';

type Props = {
  matrix: QRMatrix;
  season: Season;
  scanMode: boolean;
  fixedProgress?: number | null;
};

const UP = new THREE.Vector3(0, 1, 0);
const TMP_POS = new THREE.Vector3();
const TMP_DIR = new THREE.Vector3();
const TMP_MID = new THREE.Vector3();
const TMP_QUAT = new THREE.Quaternion();
const TMP_SCALE = new THREE.Vector3();
const TMP_MATRIX = new THREE.Matrix4();

function palette(season: Season) {
  if (season === 'summer') return { crown: '#5d8f54', petal: '#8fb879', branch: '#49362b' };
  if (season === 'autumn') return { crown: '#c9823e', petal: '#d89a55', branch: '#51362a' };
  return { crown: '#d9809d', petal: '#e7a0b8', branch: '#4f372f' };
}

function seasonIndex(season: Season) {
  if (season === 'summer') return 1;
  if (season === 'autumn') return 2;
  return 0;
}

function GlowField({
  scene,
  season,
  scanMode,
  fixedProgress,
}: {
  scene: ProceduralScene;
  season: Season;
  scanMode: boolean;
  fixedProgress: number | null;
}) {
  const progress = useRef(fixedProgress ?? (scanMode ? 1 : 0));
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(scene.glowCount * 3);
    const sizes = new Float32Array(scene.glowCount);
    const motions = new Float32Array(scene.glowCount * 4);

    for (let i = 0; i < scene.glowCount; i += 1) {
      const src = i * 8;
      const p = i * 3;
      const m = i * 4;
      positions[p] = scene.glowParticles[src];
      positions[p + 1] = scene.glowParticles[src + 1];
      positions[p + 2] = scene.glowParticles[src + 2];
      sizes[i] = scene.glowParticles[src + 3];
      motions[m] = scene.glowParticles[src + 4];
      motions[m + 1] = scene.glowParticles[src + 5];
      motions[m + 2] = scene.glowParticles[src + 6];
      motions[m + 3] = scene.glowParticles[src + 7];
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aMotion', new THREE.BufferAttribute(motions, 4));
    return g;
  }, [scene]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: progress.current },
      uGroundSpan: { value: scene.groundSpan },
      uSeason: { value: seasonIndex(season) },
    },
    vertexShader: `
      attribute float aSize;
      attribute vec4 aMotion;
      uniform float uTime;
      uniform float uProgress;
      uniform float uGroundSpan;
      varying float vBrightness;
      varying float vPhase;
      varying float vFlare;

      void main() {
        float orbitRadius = aMotion.x;
        float speed = aMotion.y;
        float phase = aMotion.z;
        float brightness = aMotion.w;
        float angle = phase + uTime * speed;

        vec3 p = position;
        p.x += cos(angle) * orbitRadius;
        p.z += sin(angle) * orbitRadius;
        p.y += sin(uTime * 0.72 + phase) * orbitRadius * 0.34;

        float scatter = smoothstep(0.08, 0.46, uProgress);
        p.x += cos(phase * 1.37) * scatter * uGroundSpan * 0.075;
        p.z += sin(phase * 1.13) * scatter * uGroundSpan * 0.075;
        p.y += scatter * uGroundSpan * 0.028;

        float reveal = 1.0 - smoothstep(0.08, 0.50, uProgress);
        float flare = exp(-pow((uProgress - 0.12) / 0.075, 2.0));
        float pulse = 0.83 + 0.17 * sin(uTime * 1.08 + phase);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);

        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.0, aSize * 1800.0 * mix(1.0, 1.18, flare) * reveal / max(0.8, -mv.z));
        vBrightness = brightness * pulse * reveal;
        vPhase = phase;
        vFlare = flare;
      }
    `,
    fragmentShader: `
      uniform float uSeason;
      varying float vBrightness;
      varying float vPhase;
      varying float vFlare;

      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0;
        float d2 = dot(q, q);
        if (d2 > 1.0) discard;

        float core = exp(-d2 * 6.8);
        float halo = exp(-d2 * 2.15) * 0.24;
        float sparkle = pow(max(core, 0.0), 2.2) * (0.08 + vFlare * 0.10);
        float alpha = (core * 0.28 + halo * 0.17 + sparkle) * vBrightness;
        if (alpha < 0.004) discard;

        vec3 warm = vec3(1.0, 0.94, 0.86);
        vec3 accent = vec3(1.0, 0.73, 0.80);
        if (uSeason > 0.5 && uSeason < 1.5) {
          warm = vec3(0.94, 1.0, 0.86);
          accent = vec3(0.69, 0.91, 0.56);
        }
        if (uSeason > 1.5) {
          warm = vec3(1.0, 0.91, 0.72);
          accent = vec3(1.0, 0.62, 0.25);
        }

        float variation = 0.10 + 0.08 * sin(vPhase * 2.7);
        vec3 color = mix(warm, accent, variation + vFlare * 0.05);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
  }), [scene.groundSpan, season]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame((state, dt) => {
    const target = fixedProgress ?? (scanMode ? 1 : 0);
    progress.current += (target - progress.current) * Math.min(1, dt * 4.2);
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uProgress.value = progress.current;
    materialRef.current.uniforms.uSeason.value = seasonIndex(season);
  });

  return <points geometry={geometry} material={material} ref={undefined} frustumCulled={false}>
    <primitive object={material} ref={materialRef} attach="material" />
  </points>;
}

export function ProceduralWebGLFallback({ matrix, season, scanMode, fixedProgress = null }: Props) {
  const scene = useMemo(() => buildProceduralScene(matrix, season), [matrix, season]);
  const colors = useMemo(() => palette(season), [season]);
  const root = useRef<THREE.Group>(null);
  const branches = useRef<THREE.InstancedMesh>(null);
  const ground = useRef<THREE.InstancedMesh>(null);
  const foliage = useRef<THREE.InstancedMesh>(null);
  const grass = useRef<THREE.InstancedMesh>(null);
  const petals = useRef<THREE.InstancedMesh>(null);
  const progressRef = useRef(fixedProgress ?? (scanMode ? 1 : 0));

  const spriteGroups = useMemo(() => {
    const crown: number[][] = [];
    const grassItems: number[][] = [];
    const petalItems: number[][] = [];
    for (let i = 0; i < scene.spriteCount; i += 1) {
      const o = i * 4;
      const item = [scene.sprites[o], scene.sprites[o + 1], scene.sprites[o + 2], scene.sprites[o + 3]];
      if (item[3] >= 2) grassItems.push(item);
      else if (item[3] >= 1) petalItems.push(item);
      else crown.push(item);
    }
    return { crown, grassItems, petalItems };
  }, [scene]);

  useEffect(() => {
    if (!ground.current) return;
    const dark = new THREE.Color('#1d1d1d');
    const light = new THREE.Color('#f4f1e8');
    for (let i = 0; i < scene.groundCount; i += 1) {
      const o = i * 4;
      TMP_POS.set(scene.ground[o], 0, scene.ground[o + 1]);
      TMP_QUAT.identity();
      TMP_SCALE.set(scene.cellSize * 0.94, scene.cellSize * 0.13, scene.cellSize * 0.94);
      TMP_MATRIX.compose(TMP_POS, TMP_QUAT, TMP_SCALE);
      ground.current.setMatrixAt(i, TMP_MATRIX);
      ground.current.setColorAt(i, scene.ground[o + 2] > 0.5 ? dark : light);
    }
    ground.current.instanceMatrix.needsUpdate = true;
    if (ground.current.instanceColor) ground.current.instanceColor.needsUpdate = true;
  }, [scene]);

  useEffect(() => {
    if (!branches.current) return;
    for (let i = 0; i < scene.branchCount; i += 1) {
      const o = i * 4;
      const start = TMP_POS.set(scene.branchStart[o], scene.branchStart[o + 1], scene.branchStart[o + 2]).clone();
      const end = TMP_DIR.set(scene.branchEnd[o], scene.branchEnd[o + 1], scene.branchEnd[o + 2]).clone();
      const length = start.distanceTo(end);
      TMP_MID.copy(start).add(end).multiplyScalar(0.5);
      TMP_DIR.copy(end).sub(start).normalize();
      TMP_QUAT.setFromUnitVectors(UP, TMP_DIR);
      const radius = Math.max(scene.cellSize * 0.035, (scene.branchStart[o + 3] + scene.branchEnd[o + 3]) * 0.5);
      TMP_SCALE.set(radius, length, radius);
      TMP_MATRIX.compose(TMP_MID, TMP_QUAT, TMP_SCALE);
      branches.current.setMatrixAt(i, TMP_MATRIX);
    }
    branches.current.instanceMatrix.needsUpdate = true;
  }, [scene]);

  useEffect(() => {
    const setSprites = (mesh: THREE.InstancedMesh | null, items: number[][], kind: 'crown' | 'grass' | 'petal') => {
      if (!mesh) return;
      items.forEach((item, i) => {
        TMP_POS.set(item[0], item[1], item[2]);
        TMP_QUAT.setFromEuler(new THREE.Euler((i * 0.37) % Math.PI, (i * 0.83) % Math.PI, 0));
        const s = kind === 'grass' ? Math.max(scene.cellSize * 0.18, item[3] - 2) : kind === 'petal' ? Math.max(scene.cellSize * 0.12, item[3] - 1) : item[3];
        TMP_SCALE.set(kind === 'grass' ? s * 0.18 : s, kind === 'grass' ? s : s * 0.72, kind === 'grass' ? s * 0.18 : s * 0.45);
        TMP_MATRIX.compose(TMP_POS, TMP_QUAT, TMP_SCALE);
        mesh.setMatrixAt(i, TMP_MATRIX);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    setSprites(foliage.current, spriteGroups.crown, 'crown');
    setSprites(grass.current, spriteGroups.grassItems, 'grass');
    setSprites(petals.current, spriteGroups.petalItems, 'petal');
  }, [scene, spriteGroups]);

  useFrame((state, dt) => {
    const target = fixedProgress ?? (scanMode ? 1 : 0);
    progressRef.current += (target - progressRef.current) * Math.min(1, dt * 4.2);
    const p = progressRef.current;
    if (!root.current) return;
    root.current.rotation.x = THREE.MathUtils.lerp(-0.50, -Math.PI / 2, p);
    root.current.rotation.y = THREE.MathUtils.lerp(0.72, 0, p);
    const s = THREE.MathUtils.lerp(1.0, 1.18, p);
    root.current.scale.setScalar(s);
    root.current.position.y = THREE.MathUtils.lerp(-scene.groundSpan * 0.15, 0, p);

    const branchMaterial = branches.current?.material as THREE.MeshStandardMaterial | undefined;
    const foliageMaterial = foliage.current?.material as THREE.MeshStandardMaterial | undefined;
    const grassMaterial = grass.current?.material as THREE.MeshStandardMaterial | undefined;
    const petalMaterial = petals.current?.material as THREE.MeshStandardMaterial | undefined;
    if (branchMaterial) branchMaterial.opacity = Math.max(0, 1 - p * 1.35);
    if (foliageMaterial) foliageMaterial.opacity = Math.max(0, 1 - p * 1.65);
    if (grassMaterial) grassMaterial.opacity = Math.max(0, 1 - p * 1.5);
    if (petalMaterial) petalMaterial.opacity = Math.max(0, 1 - p * 1.8);

    if (petals.current && p < 0.8) {
      petals.current.rotation.y = state.clock.elapsedTime * 0.05;
      petals.current.position.y = Math.sin(state.clock.elapsedTime * 0.7) * scene.cellSize * 0.7;
    }
  });

  return (
    <group ref={root}>
      <instancedMesh ref={ground} args={[undefined, undefined, scene.groundCount]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors />
      </instancedMesh>

      <instancedMesh ref={branches} args={[undefined, undefined, scene.branchCount]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 7, 1, false]} />
        <meshStandardMaterial color={colors.branch} roughness={0.9} transparent />
      </instancedMesh>

      <instancedMesh ref={foliage} args={[undefined, undefined, spriteGroups.crown.length]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={colors.crown} roughness={0.86} transparent />
      </instancedMesh>

      <instancedMesh ref={grass} args={[undefined, undefined, spriteGroups.grassItems.length]} frustumCulled={false}>
        <coneGeometry args={[1, 1, 4]} />
        <meshStandardMaterial color="#647d4f" roughness={0.9} transparent />
      </instancedMesh>

      <instancedMesh ref={petals} args={[undefined, undefined, spriteGroups.petalItems.length]} frustumCulled={false}>
        <tetrahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={colors.petal} roughness={0.78} transparent />
      </instancedMesh>

      <GlowField
        scene={scene}
        season={season}
        scanMode={scanMode}
        fixedProgress={fixedProgress}
      />
    </group>
  );
}
