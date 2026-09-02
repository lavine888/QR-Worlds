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

const QUAD = [
  [0, 0], [1, 0], [0, 1],
  [0, 1], [1, 0], [1, 1],
] as const;

const FACE_NORMALS = [
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
  [1, 0, 0],
  [-1, 0, 0],
] as const;

const blockVertexShader = /* glsl */ `
precision highp float;
attribute vec3 aCenter;
attribute vec3 aOffset;
attribute vec3 aFaceNormal;
attribute vec2 aFaceUv;
attribute float aType;
attribute float aCol;
attribute float aRow;
attribute float aLayer;
uniform float uProgress;
uniform float uAspect;
varying vec3 vFaceNormal;
varying vec2 vUv;
varying float vType;
varying float vCol;
varying float vRow;
varying float vLayer;

void main() {
  vec3 p = aCenter + aOffset;

  float angleY = mix(0.78, 0.0, uProgress);
  float angleX = mix(-0.55, -1.57079632679, uProgress);
  float cy = cos(angleY);
  float sy = sin(angleY);
  float cx = cos(angleX);
  float sx = sin(angleX);

  float ryX = p.x * cy - p.z * sy;
  float ryZ = p.x * sy + p.z * cy;
  float rxY = p.y * cx - ryZ * sx;
  float rxZ = p.y * sx + ryZ * cx;

  float viewScale = mix(1.6, 2.1, uProgress);
  float scaleX = viewScale / max(uAspect, 1.0);
  float scaleY = viewScale / max(1.0 / uAspect, 1.0);
  float offsetX = mix(0.0, 0.015, uProgress);
  float offsetY = mix(0.0, 0.08, uProgress);

  gl_Position = vec4(
    (ryX + offsetX) * scaleX,
    (rxY + offsetY) * scaleY,
    rxZ * 0.05 + 0.5,
    1.0
  );

  // The reference keeps face lighting in model space while the object morphs.
  // That stable per-face lighting is a large part of the crisp voxel look.
  vFaceNormal = aFaceNormal;
  vUv = aFaceUv;
  vType = aType;
  vCol = aCol;
  vRow = aRow;
  vLayer = aLayer;
}
`;

const blockFragmentShader = /* glsl */ `
precision highp float;
uniform float uProgress;
uniform float uGridSize;
varying vec3 vFaceNormal;
varying vec2 vUv;
varying float vType;
varying float vCol;
varying float vRow;
varying float vLayer;

float hash1(float n) {
  return fract(sin(n) * 43758.5);
}

vec3 acesFilm(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec3 N = normalize(vFaceNormal);
  float blockSeed = vCol * 17.3 + vRow * 31.1 + vLayer * 73.7;
  float noise1 = hash1(blockSeed);
  float noise2 = hash1(blockSeed * 1.7 + 127.1);

  vec3 dirtLight = vec3(1.00, 0.98, 0.94);
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

  vec3 sunDir = normalize(vec3(-0.5, 0.8, -0.5));
  vec3 sunCol = vec3(1.15, 1.05, 0.95);
  vec3 ambient = vec3(0.35, 0.38, 0.45);
  vec3 skyFill = vec3(0.85, 0.90, 0.95);
  vec3 bounce = vec3(0.50, 0.65, 0.42);
  float ndSun = max(dot(N, sunDir), 0.0);
  float ndUp = max(dot(N, vec3(0.0, 1.0, 0.0)), 0.0);

  float cxGrid = uGridSize * 0.5;
  float cyGrid = uGridSize * 0.5;
  float dx = vCol - (cxGrid + 1.5);
  float dy = vRow - (cyGrid + 1.5);
  float shadowDist = sqrt(dx * dx + dy * dy);
  float canopyRadius = uGridSize * 0.46;
  float shadowT = 1.0 - smoothstep(2.5, canopyRadius, shadowDist);
  float treeShadow = 1.0 - shadowT * 0.35;
  float canopyAO = 0.65 + min(vLayer / 15.0, 1.0) * 0.35;

  vec3 albedo = dirtMid;
  bool isTop = N.y > 0.5;
  bool isSide = abs(N.x) > 0.5 || abs(N.z) > 0.5;

  if (isTop) {
    vec3 warm = vec3(1.10, 1.08, 1.02);

    if (vType < 0.5) {
      vec3 c = noise1 < 0.5
        ? mix(dirtLight, dirtMid, noise1 / 0.5)
        : mix(dirtMid, dirtDark, (noise1 - 0.5) / 0.5);
      c *= (1.0 + (noise2 - 0.5) * 0.10) * treeShadow;
      albedo = c * warm;
    } else if (vType < 1.5) {
      vec3 c;
      if (noise1 < 0.33) c = mix(sakuraLight, sakuraMid, noise1 / 0.33);
      else if (noise1 < 0.66) c = mix(sakuraMid, sakuraDeep, (noise1 - 0.33) / 0.33);
      else c = mix(sakuraDeep, sakuraRich, (noise1 - 0.66) / 0.34);
      c *= 1.0 + (noise2 - 0.5) * 0.15;
      float edgeX = min(vUv.x, 1.0 - vUv.x);
      float edgeY = min(vUv.y, 1.0 - vUv.y);
      float rounded = smoothstep(0.0, 0.12, min(edgeX, edgeY));
      float edgeDarken = mix(0.88, 1.0, rounded);
      float finalEdge = mix(edgeDarken, 1.0, uProgress);
      albedo = c * warm * canopyAO * finalEdge;
    } else if (vType < 2.5) {
      vec3 c;
      if (noise1 < 0.33) c = mix(barkLight, barkMid, noise1 / 0.33);
      else if (noise1 < 0.66) c = mix(barkMid, barkDark, (noise1 - 0.33) / 0.33);
      else c = mix(barkDark, barkDeep, (noise1 - 0.66) / 0.34);
      c *= 1.0 + (noise2 - 0.5) * 0.20;
      float aoShadow = 0.60 + min(vLayer / 12.0, 1.0) * 0.40;
      float edgeX = min(vUv.x, 1.0 - vUv.x);
      float edgeY = min(vUv.y, 1.0 - vUv.y);
      float edgeDist = min(edgeX, edgeY);
      float cornerDist = length(vec2(0.5 - abs(vUv.x - 0.5), 0.5 - abs(vUv.y - 0.5)));
      float rounded = smoothstep(0.0, 0.18, edgeDist) * smoothstep(0.25, 0.5, cornerDist);
      albedo = c * aoShadow * mix(0.55, 1.0, rounded) * warm;
    } else if (vType < 3.5) {
      vec3 brown = vec3(0.28, 0.25, 0.12);
      vec3 olive = vec3(0.32, 0.35, 0.15);
      vec3 c;
      if (noise1 < 0.30) c = mix(grassBright, grassMid, noise1 / 0.30);
      else if (noise1 < 0.60) c = mix(grassMid, grassDark, (noise1 - 0.30) / 0.30);
      else if (noise1 < 0.80) c = mix(grassDark, brown, (noise1 - 0.60) / 0.20);
      else c = mix(brown, olive, (noise1 - 0.80) / 0.20);
      c *= 1.0 + (noise2 - 0.5) * 0.20;
      albedo = c * warm;
    } else {
      vec3 brownLight = vec3(0.52, 0.42, 0.30);
      vec3 brownDark = vec3(0.42, 0.32, 0.22);
      vec3 greenLight = vec3(0.38, 0.48, 0.28);
      vec3 greenDark = vec3(0.32, 0.42, 0.24);
      vec3 c = noise1 < 0.5
        ? mix(brownLight, brownDark, noise2)
        : mix(greenLight, greenDark, noise2);
      c *= (1.0 + (noise2 - 0.5) * 0.15) * treeShadow;
      albedo = c * warm;
    }
  } else if (isSide) {
    float sunLight = max(dot(N, sunDir), 0.0);
    float shade = 0.30 + sunLight * 0.65;
    vec3 tint = vec3(0.95, 0.95, 0.98);

    if (vType < 0.5) {
      vec3 c;
      if (noise1 < 0.33) c = mix(dirtLight, dirtMid, noise1 / 0.33);
      else if (noise1 < 0.66) c = mix(dirtMid, dirtDark, (noise1 - 0.33) / 0.33);
      else c = dirtDark * (1.0 - (noise1 - 0.66) * 0.30);
      c *= 1.0 + (noise2 - 0.5) * 0.20;
      albedo = c * shade * tint;
    } else if (vType < 1.5) {
      vec3 c;
      if (noise1 < 0.33) c = mix(sakuraLight, sakuraMid, noise1 / 0.33);
      else if (noise1 < 0.66) c = mix(sakuraMid, sakuraDeep, (noise1 - 0.33) / 0.33);
      else c = mix(sakuraDeep, sakuraRich, (noise1 - 0.66) / 0.34);
      c *= 1.0 + (noise2 - 0.5) * 0.25;
      float edgeX = min(vUv.x, 1.0 - vUv.x);
      float edgeY = min(vUv.y, 1.0 - vUv.y);
      float rounded = smoothstep(0.0, 0.12, min(edgeX, edgeY));
      albedo = c * shade * tint * canopyAO * mix(0.70, 1.0, rounded);
    } else if (vType < 2.5) {
      vec3 c;
      if (noise1 < 0.33) c = mix(barkLight, barkMid, noise1 / 0.33);
      else if (noise1 < 0.66) c = mix(barkMid, barkDark, (noise1 - 0.33) / 0.33);
      else c = mix(barkDark, barkDeep, (noise1 - 0.66) / 0.34);
      c *= 1.0 + (noise2 - 0.5) * 0.20;
      float aoShadow = 0.55 + min(vLayer / 12.0, 1.0) * 0.45;
      float edgeX = min(vUv.x, 1.0 - vUv.x);
      float edgeY = min(vUv.y, 1.0 - vUv.y);
      float rounded = smoothstep(0.0, 0.15, min(edgeX, edgeY));
      float verticalAO = 0.80 + vUv.y * 0.20;
      albedo = c * aoShadow * verticalAO * mix(0.50, 1.0, rounded) * shade * tint;
    } else if (vType < 3.5) {
      vec3 brown = vec3(0.28, 0.25, 0.12);
      vec3 olive = vec3(0.32, 0.35, 0.15);
      vec3 c;
      if (noise1 < 0.30) c = mix(grassBright, grassMid, noise1 / 0.30);
      else if (noise1 < 0.60) c = mix(grassMid, grassDark, (noise1 - 0.30) / 0.30);
      else if (noise1 < 0.80) c = mix(grassDark, brown, (noise1 - 0.60) / 0.20);
      else c = mix(brown, olive, (noise1 - 0.80) / 0.20);
      c *= 1.0 + (noise2 - 0.5) * 0.20;
      albedo = c * shade * tint;
    } else {
      vec3 c = mix(vec3(0.45, 0.35, 0.26), vec3(0.35, 0.42, 0.24), noise1 * 0.60);
      c *= 1.0 + (noise2 - 0.5) * 0.15;
      albedo = c * shade * tint;
    }
  } else {
    vec3 bottomTint = vec3(0.60, 0.62, 0.70);
    if (vType < 0.5) albedo = dirtDark * 0.50 * bottomTint;
    else if (vType < 1.5) albedo = sakuraDeep * 0.50 * bottomTint;
    else if (vType < 2.5) albedo = barkDark * 0.50 * bottomTint;
    else if (vType < 3.5) albedo = grassDark * 0.50 * bottomTint;
    else albedo = vec3(0.45, 0.42, 0.32) * 0.60 * bottomTint;
  }

  vec3 diffuse = albedo * (
    ambient
    + sunCol * ndSun * 0.65
    + skyFill * ndUp * 0.25
    + bounce * 0.20
  );

  vec3 outColor = acesFilm(diffuse * 1.05);
  outColor = pow(outColor, vec3(1.0 / 2.2));
  gl_FragColor = vec4(outColor, 1.0);
}
`;

const shadowVertexShader = /* glsl */ `
precision highp float;
uniform float uProgress;
uniform float uAspect;
uniform float uGridSize;
varying vec2 vUv;

void main() {
  vec2 q = position.xy;
  vUv = q * 0.5 + 0.5;

  float halfGrid = uGridSize * ${BLOCK_SIZE.toFixed(4)} * 0.5;
  float shadowScale = 0.85;
  float shadowHeight = 0.48;
  vec2 shadowOffset = vec2(0.5, 0.5) * shadowHeight * 0.35 * (1.0 - uProgress);

  float x = q.x * halfGrid * shadowScale + shadowOffset.x;
  float y = -shadowHeight;
  float z = q.y * halfGrid * shadowScale + shadowOffset.y;

  float angleY = mix(0.78, 0.0, uProgress);
  float angleX = mix(-0.55, -1.57079632679, uProgress);
  float cy = cos(angleY);
  float sy = sin(angleY);
  float cx = cos(angleX);
  float sx = sin(angleX);
  float ryX = x * cy - z * sy;
  float ryZ = x * sy + z * cy;
  float rxY = y * cx - ryZ * sx;

  float viewScale = mix(1.6, 2.1, uProgress);
  float scaleX = viewScale / max(uAspect, 1.0);
  float scaleY = viewScale / max(1.0 / uAspect, 1.0);
  float offsetX = mix(0.0, 0.015, uProgress);
  float offsetY = mix(0.0, 0.08, uProgress);

  gl_Position = vec4(
    (ryX + offsetX) * scaleX,
    (rxY + offsetY) * scaleY,
    0.99,
    1.0
  );
}
`;

const shadowFragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  float alpha = 0.08 * exp(-d * d * 2.5);
  vec3 ink = vec3(0.10, 0.12, 0.15) * alpha;
  gl_FragColor = vec4(ink, alpha);
}
`;

type Props = {
  matrix: QRMatrix;
  scanMode: boolean;
};

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function cubeOffset(face: number, u: number, v: number, half: number) {
  if (face === 0) return [(u - 0.5) * half * 2, half, (v - 0.5) * half * 2];
  if (face === 1) return [(u - 0.5) * half * 2, -half, (0.5 - v) * half * 2];
  if (face === 2) return [(u - 0.5) * half * 2, (v - 0.5) * half * 2, half];
  if (face === 3) return [(0.5 - u) * half * 2, (v - 0.5) * half * 2, -half];
  if (face === 4) return [half, (v - 0.5) * half * 2, (u - 0.5) * half * 2];
  return [-half, (v - 0.5) * half * 2, (0.5 - u) * half * 2];
}

function buildGeometry(matrix: QRMatrix) {
  const world = generateVoxelWorld(matrix, 0);
  const centers: number[] = [];
  const offsets: number[] = [];
  const normals: number[] = [];
  const faceUvs: number[] = [];
  const types: number[] = [];
  const cols: number[] = [];
  const rows: number[] = [];
  const layers: number[] = [];
  const half = BLOCK_SIZE * 0.5;
  const halfGrid = world.gridSize * BLOCK_SIZE * 0.5;

  for (const block of world.blocks) {
    const col = block.x + world.gridSize / 2;
    const row = block.z + world.gridSize / 2;
    const center = [
      col * BLOCK_SIZE - halfGrid,
      block.y * BLOCK_SIZE + half,
      row * BLOCK_SIZE - halfGrid,
    ];
    const type = KIND_TO_TYPE[block.kind];

    for (let face = 0; face < 6; face += 1) {
      const normal = FACE_NORMALS[face];
      for (const [u, v] of QUAD) {
        const offset = cubeOffset(face, u, v, half);
        centers.push(center[0], center[1], center[2]);
        offsets.push(offset[0], offset[1], offset[2]);
        normals.push(normal[0], normal[1], normal[2]);
        faceUvs.push(u, v);
        types.push(type);
        cols.push(col);
        rows.push(row);
        layers.push(block.y);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  const centerAttribute = new THREE.Float32BufferAttribute(centers, 3);
  geometry.setAttribute('position', centerAttribute.clone());
  geometry.setAttribute('aCenter', centerAttribute);
  geometry.setAttribute('aOffset', new THREE.Float32BufferAttribute(offsets, 3));
  geometry.setAttribute('aFaceNormal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('aFaceUv', new THREE.Float32BufferAttribute(faceUvs, 2));
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

  const blockMaterial = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: blockVertexShader,
      fragmentShader: blockFragmentShader,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: true,
      transparent: false,
      toneMapped: false,
      uniforms: {
        uProgress: { value: rawProgress.current },
        uAspect: { value: 1 },
        uGridSize: { value: gridSize },
      },
    }),
    [gridSize],
  );

  const shadowMaterial = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: shadowVertexShader,
      fragmentShader: shadowFragmentShader,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      toneMapped: false,
      uniforms: {
        uProgress: { value: rawProgress.current },
        uAspect: { value: 1 },
        uGridSize: { value: gridSize },
      },
    }),
    [gridSize],
  );

  useEffect(() => {
    const aspect = Math.max(0.001, size.width / Math.max(1, size.height));
    blockMaterial.uniforms.uAspect.value = aspect;
    shadowMaterial.uniforms.uAspect.value = aspect;
  }, [blockMaterial, shadowMaterial, size.height, size.width]);

  useEffect(() => () => {
    geometry.dispose();
    blockMaterial.dispose();
    shadowMaterial.dispose();
  }, [blockMaterial, geometry, shadowMaterial]);

  useFrame((_, delta) => {
    const target = scanMode ? 1 : 0;
    rawProgress.current += (target - rawProgress.current) * Math.min(1, LERP_SPEED * delta);
    if (Math.abs(rawProgress.current - target) < 0.001) rawProgress.current = target;
    const eased = easeInOutCubic(rawProgress.current);
    blockMaterial.uniforms.uProgress.value = eased;
    shadowMaterial.uniforms.uProgress.value = eased;
  });

  return (
    <>
      <mesh renderOrder={-1} material={shadowMaterial} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <mesh geometry={geometry} material={blockMaterial} frustumCulled={false} />
    </>
  );
}
