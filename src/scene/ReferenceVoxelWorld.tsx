import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { generateVoxelWorld, type VoxelKind } from '../procedural/voxelWorldGenerator';
import type { QRMatrix } from '../qr/generateQR';

const BLOCK_SIZE = 0.0245;
const LERP_SPEED = 4.0;

const KIND_TO_TYPE: Record<VoxelKind, number> = {
  dirt: 0,
  blossom: 1,
  trunk: 2,
  grass: 3,
  fallen: 4,
};

const FACE_DEFS = [
  { normal: [0, 1, 0], corners: [[-1, 1], [1, 1], [-1, -1], [-1, -1], [1, 1], [1, -1]] },
  { normal: [0, -1, 0], corners: [[-1, -1], [1, -1], [-1, 1], [-1, 1], [1, -1], [1, 1]] },
  { normal: [0, 0, 1], corners: [[-1, -1], [1, -1], [-1, 1], [-1, 1], [1, -1], [1, 1]] },
  { normal: [0, 0, -1], corners: [[1, -1], [-1, -1], [1, 1], [1, 1], [-1, -1], [-1, 1]] },
  { normal: [1, 0, 0], corners: [[-1, -1], [1, -1], [-1, 1], [-1, 1], [1, -1], [1, 1]] },
  { normal: [-1, 0, 0], corners: [[1, -1], [-1, -1], [1, 1], [1, 1], [-1, -1], [-1, 1]] },
] as const;

const vertexShader = /* glsl */ `
precision highp float;

attribute vec3 aCenter;
attribute vec3 aOffset;
attribute vec3 aNormal;
attribute vec2 aUv;
attribute float aType;
attribute float aCol;
attribute float aRow;
attribute float aLayer;

uniform float uProgress;
uniform float uAspect;
uniform float uGridSize;

varying vec3 vNormal;
varying vec2 vUv;
varying float vType;
varying float vCol;
varying float vRow;
varying float vLayer;

void main() {
  vec3 localPos = aCenter + aOffset;

  float isoAngleY = mix(0.78, 0.0, uProgress);
  float isoAngleX = mix(-0.55, -1.57079632679, uProgress);

  float cy = cos(isoAngleY);
  float sy = sin(isoAngleY);
  float cx = cos(isoAngleX);
  float sx = sin(isoAngleX);

  float ryX = localPos.x * cy - localPos.z * sy;
  float ryZ = localPos.x * sy + localPos.z * cy;
  float rxY = localPos.y * cx - ryZ * sx;
  float rxZ = localPos.y * sx + ryZ * cx;

  float viewScale = mix(1.6, 2.1, uProgress);
  float scaleX = viewScale / max(uAspect, 1.0);
  float scaleY = viewScale / max(1.0 / uAspect, 1.0);
  float xOffsetScene = mix(0.0, 0.015, uProgress);
  float yOffsetScene = mix(0.0, 0.08, uProgress);

  gl_Position = vec4(
    (ryX + xOffsetScene) * scaleX,
    (rxY + yOffsetScene) * scaleY,
    rxZ * 0.05 + 0.5,
    1.0
  );

  // Rotate the normal through the same isometric transform so face lighting
  // follows the reference rather than Three.js' camera/lights.
  vec3 n = aNormal;
  vec3 ny = vec3(n.x * cy - n.z * sy, n.y, n.x * sy + n.z * cy);
  vNormal = normalize(vec3(ny.x, ny.y * cx - ny.z * sx, ny.y * sx + ny.z * cx));
  vUv = aUv;
  vType = aType;
  vCol = aCol;
  vRow = aRow;
  vLayer = aLayer;
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform float uProgress;
uniform float uGridSize;

varying vec3 vNormal;
varying vec2 vUv;
varying float vType;
varying float vCol;
varying float vRow;
varying float vLayer;

float hash1(float n) { return fract(sin(n) * 43758.5); }

vec3 acesFilm(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec3 N = normalize(vNormal);
  float blockSeed = vCol * 17.3 + vRow * 31.1 + vLayer * 73.7;
  float noise1 = hash1(blockSeed);
  float noise2 = hash1(blockSeed * 1.7 + 127.1);

  vec3 dirtLight = vec3(1.0, 0.98, 0.94);
  vec3 dirtMid = vec3(0.96, 0.94, 0.88);
  vec3 dirtDark = vec3(0.92, 0.88, 0.82);

  vec3 sakuraLight = vec3(0.70, 0.25, 0.38);
  vec3 sakuraMid = vec3(0.58, 0.18, 0.30);
  vec3 sakuraDeep = vec3(0.46, 0.12, 0.24);
  vec3 sakuraRich = vec3(0.36, 0.07, 0.18);

  vec3 barkLight = vec3(0.34, 0.18, 0.07);
  vec3 barkMid = vec3(0.26, 0.13, 0.05);
  vec3 barkDark = vec3(0.20, 0.09, 0.03);
  vec3 barkDeep = vec3(0.14, 0.06, 0.02);

  vec3 grassDark = vec3(0.05, 0.18, 0.04);
  vec3 grassMid = vec3(0.07, 0.28, 0.05);
  vec3 grassBright = vec3(0.12, 0.38, 0.08);

  vec3 fallenLight = vec3(0.52, 0.42, 0.30);
  vec3 fallenDark = vec3(0.32, 0.42, 0.24);

  vec3 albedo = dirtMid;

  if (vType < 0.5) {
    albedo = noise1 < 0.5
      ? mix(dirtLight, dirtMid, noise1 / 0.5)
      : mix(dirtMid, dirtDark, (noise1 - 0.5) / 0.5);
  } else if (vType < 1.5) {
    if (noise1 < 0.33) {
      albedo = mix(sakuraLight, sakuraMid, noise1 / 0.33);
    } else if (noise1 < 0.66) {
      albedo = mix(sakuraMid, sakuraDeep, (noise1 - 0.33) / 0.33);
    } else {
      albedo = mix(sakuraDeep, sakuraRich, (noise1 - 0.66) / 0.34);
    }
    float canopyAO = 0.65 + min(vLayer / 15.0, 1.0) * 0.35;
    albedo *= canopyAO;
  } else if (vType < 2.5) {
    if (noise1 < 0.33) {
      albedo = mix(barkLight, barkMid, noise1 / 0.33);
    } else if (noise1 < 0.66) {
      albedo = mix(barkMid, barkDark, (noise1 - 0.33) / 0.33);
    } else {
      albedo = mix(barkDark, barkDeep, (noise1 - 0.66) / 0.34);
    }
  } else if (vType < 3.5) {
    albedo = noise1 < 0.3
      ? mix(grassBright, grassMid, noise1 / 0.3)
      : mix(grassMid, grassDark, clamp((noise1 - 0.3) / 0.7, 0.0, 1.0));
  } else {
    albedo = mix(fallenLight, fallenDark, noise1);
  }

  albedo *= 1.0 + (noise2 - 0.5) * 0.10;

  vec3 sunDir = normalize(vec3(-0.5, 0.8, -0.5));
  float ndSun = max(dot(N, sunDir), 0.0);
  float ndUp = max(dot(N, vec3(0.0, 1.0, 0.0)), 0.0);
  vec3 light = vec3(0.35, 0.38, 0.45) + vec3(1.15, 1.05, 0.95) * ndSun + vec3(0.85, 0.90, 0.95) * ndUp * 0.22;

  float sideAmount = 1.0 - step(0.5, N.y);
  vec3 shaded = albedo * mix(vec3(1.08, 1.06, 1.02), light, sideAmount);

  // In the final flat state, match the QR contract exactly: dirt is light,
  // every dark-module carrier is black. The reference's color transition is
  // delayed so the object still reads as a tree through most of the turn.
  float scanAmount = smoothstep(0.72, 1.0, uProgress);
  vec3 scanColor = vType < 0.5 ? vec3(1.0) : vec3(0.018);
  vec3 color = mix(shaded, scanColor, scanAmount);

  gl_FragColor = vec4(acesFilm(color), 1.0);
}
`;

type Props = {
  matrix: QRMatrix;
  scanMode: boolean;
};

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function buildGeometry(matrix: QRMatrix) {
  const world = generateVoxelWorld(matrix, 0);
  const positions: number[] = [];
  const offsets: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const types: number[] = [];
  const cols: number[] = [];
  const rows: number[] = [];
  const layers: number[] = [];

  const half = BLOCK_SIZE * 0.5;
  const halfGrid = world.gridSize * BLOCK_SIZE * 0.5;

  for (const block of world.blocks) {
    const col = block.x + world.gridSize / 2;
    const row = block.z + world.gridSize / 2;
    const centerX = col * BLOCK_SIZE - halfGrid;
    const centerY = block.y * BLOCK_SIZE + half;
    const centerZ = row * BLOCK_SIZE - halfGrid;
    const type = KIND_TO_TYPE[block.kind];

    for (let face = 0; face < FACE_DEFS.length; face += 1) {
      const def = FACE_DEFS[face];
      for (const corner of def.corners) {
        const u = corner[0] * 0.5 + 0.5;
        const v = corner[1] * 0.5 + 0.5;
        let ox = 0;
        let oy = 0;
        let oz = 0;

        if (face === 0 || face === 1) {
          ox = corner[0] * half;
          oy = face === 0 ? half : -half;
          oz = -corner[1] * half;
        } else if (face === 2 || face === 3) {
          ox = corner[0] * half * (face === 2 ? 1 : -1);
          oy = corner[1] * half;
          oz = face === 2 ? half : -half;
        } else {
          ox = face === 4 ? half : -half;
          oy = corner[1] * half;
          oz = corner[0] * half * (face === 4 ? 1 : -1);
        }

        positions.push(centerX, centerY, centerZ);
        offsets.push(ox, oy, oz);
        normals.push(def.normal[0], def.normal[1], def.normal[2]);
        uvs.push(u, v);
        types.push(type);
        cols.push(col);
        rows.push(row);
        layers.push(block.y);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('aCenter', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aOffset', new THREE.Float32BufferAttribute(offsets, 3));
  geometry.setAttribute('aNormal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('aUv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aType', new THREE.Float32BufferAttribute(types, 1));
  geometry.setAttribute('aCol', new THREE.Float32BufferAttribute(cols, 1));
  geometry.setAttribute('aRow', new THREE.Float32BufferAttribute(rows, 1));
  geometry.setAttribute('aLayer', new THREE.Float32BufferAttribute(layers, 1));
  return { geometry, gridSize: world.gridSize };
}

export function ReferenceVoxelWorld({ matrix, scanMode }: Props) {
  const { size } = useThree();
  const rawProgress = useRef(scanMode ? 1 : 0);
  const { geometry, gridSize } = useMemo(() => buildGeometry(matrix), [matrix]);
  const material = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      depthTest: true,
      depthWrite: true,
      transparent: false,
      toneMapped: false,
      uniforms: {
        uProgress: { value: rawProgress.current },
        uAspect: { value: Math.max(0.001, size.width / Math.max(1, size.height)) },
        uGridSize: { value: gridSize },
      },
    }),
    [gridSize],
  );

  useEffect(() => {
    material.uniforms.uAspect.value = Math.max(0.001, size.width / Math.max(1, size.height));
  }, [material, size.height, size.width]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame((_, delta) => {
    const target = scanMode ? 1 : 0;
    rawProgress.current += (target - rawProgress.current) * Math.min(1, LERP_SPEED * delta);
    if (Math.abs(rawProgress.current - target) < 0.001) rawProgress.current = target;
    material.uniforms.uProgress.value = easeInOutCubic(rawProgress.current);
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
