import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { generateVoxelWorld, type VoxelKind } from '../procedural/voxelWorldGenerator';
import type { QRMatrix } from '../qr/generateQR';

const BLOCK_SIZE = 0.0245;
const LERP_SPEED = 4.6;

const KIND_TO_TYPE: Record<VoxelKind, number> = {
  dirt: 0,
  blossom: 1,
  trunk: 2,
  grass: 3,
  fallen: 4,
  decorative: 5,
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
  float decorative = step(4.5, aType);
  float decorativeExit = smoothstep(0.10, 0.60, uProgress);
  float decorativeScale = mix(1.0, 0.012, decorativeExit);

  vec3 center = aCenter;
  center.y -= decorative * decorativeExit * 0.055;
  vec3 p = center + aOffset * mix(1.0, decorativeScale, decorative);

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

  // Make the tree state a little more dominant while preserving the reference
  // flat scale exactly at the end of the reveal.
  float viewScale = mix(1.70, 2.10, uProgress);
  float scaleX = viewScale / max(uAspect, 1.0);
  float scaleY = viewScale / max(1.0 / uAspect, 1.0);
  float offsetX = mix(0.0, 0.015, uProgress);
  float offsetY = mix(0.012, 0.08, uProgress);

  gl_Position = vec4(
    (ryX + offsetX) * scaleX,
    (rxY + offsetY) * scaleY,
    rxZ * 0.05 + 0.5,
    1.0
  );

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

vec3 sakura(float n, vec3 lightC, vec3 midC, vec3 deepC, vec3 richC) {
  if (n < 0.33) return mix(lightC, midC, n / 0.33);
  if (n < 0.66) return mix(midC, deepC, (n - 0.33) / 0.33);
  return mix(deepC, richC, (n - 0.66) / 0.34);
}

vec3 bark(float n, vec3 lightC, vec3 midC, vec3 darkC, vec3 deepC) {
  if (n < 0.33) return mix(lightC, midC, n / 0.33);
  if (n < 0.66) return mix(midC, darkC, (n - 0.33) / 0.33);
  return mix(darkC, deepC, (n - 0.66) / 0.34);
}

void main() {
  vec3 N = normalize(vFaceNormal);
  float blockSeed = vCol * 17.3 + vRow * 31.1 + vLayer * 73.7;
  float noise1 = hash1(blockSeed);
  float noise2 = hash1(blockSeed * 1.7 + 127.1);

  vec3 dirtLight = vec3(1.00, 0.985, 0.95);
  vec3 dirtMid = vec3(0.965, 0.945, 0.895);
  vec3 dirtDark = vec3(0.925, 0.89, 0.83);

  vec3 sakuraLight = vec3(0.74, 0.29, 0.41);
  vec3 sakuraMid = vec3(0.60, 0.19, 0.31);
  vec3 sakuraDeep = vec3(0.47, 0.115, 0.235);
  vec3 sakuraRich = vec3(0.36, 0.07, 0.18);

  vec3 barkLight = vec3(0.37, 0.205, 0.085);
  vec3 barkMid = vec3(0.285, 0.145, 0.055);
  vec3 barkDark = vec3(0.215, 0.095, 0.032);
  vec3 barkDeep = vec3(0.145, 0.06, 0.02);

  vec3 grassDark = vec3(0.06, 0.17, 0.045);
  vec3 grassMid = vec3(0.08, 0.25, 0.06);
  vec3 grassBright = vec3(0.12, 0.34, 0.09);

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
  float shadowDist = length(vec2(dx, dy));
  float canopyRadius = uGridSize * 0.46;
  float treeShadow = 1.0 - (1.0 - smoothstep(2.5, canopyRadius, shadowDist)) * 0.31;
  float canopyAO = 0.68 + min(vLayer / 16.0, 1.0) * 0.32;

  bool decorative = vType > 4.5;
  bool blossom = (vType > 0.5 && vType < 1.5) || decorative;
  bool trunk = vType > 1.5 && vType < 2.5;
  bool grass = vType > 2.5 && vType < 3.5;
  bool fallen = vType > 3.5 && vType < 4.5;
  bool topFace = N.y > 0.5;
  bool sideFace = abs(N.x) > 0.5 || abs(N.z) > 0.5;

  vec3 albedo = dirtMid;

  if (topFace) {
    vec3 warm = vec3(1.10, 1.08, 1.02);
    if (vType < 0.5) {
      albedo = (noise1 < 0.5
        ? mix(dirtLight, dirtMid, noise1 / 0.5)
        : mix(dirtMid, dirtDark, (noise1 - 0.5) / 0.5));
      albedo *= (1.0 + (noise2 - 0.5) * 0.08) * treeShadow * warm;
    } else if (blossom) {
      albedo = sakura(noise1, sakuraLight, sakuraMid, sakuraDeep, sakuraRich);
      albedo *= 1.0 + (noise2 - 0.5) * 0.14;
      float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
      float edgeShade = mix(0.88, 1.0, smoothstep(0.0, 0.12, edge));
      albedo *= warm * canopyAO * mix(edgeShade, 1.0, uProgress);
      if (decorative) albedo *= 1.06;
    } else if (trunk) {
      albedo = bark(noise1, barkLight, barkMid, barkDark, barkDeep);
      float heightLift = 1.0 + smoothstep(5.0, 11.0, vLayer) * 0.055;
      albedo *= heightLift * (1.0 + (noise2 - 0.5) * 0.17) * warm;
    } else if (grass) {
      vec3 brown = vec3(0.27, 0.245, 0.13);
      vec3 olive = vec3(0.30, 0.325, 0.16);
      if (noise1 < 0.30) albedo = mix(grassBright, grassMid, noise1 / 0.30);
      else if (noise1 < 0.60) albedo = mix(grassMid, grassDark, (noise1 - 0.30) / 0.30);
      else if (noise1 < 0.80) albedo = mix(grassDark, brown, (noise1 - 0.60) / 0.20);
      else albedo = mix(brown, olive, (noise1 - 0.80) / 0.20);
      albedo *= warm;
    } else if (fallen) {
      vec3 brownLight = vec3(0.50, 0.41, 0.31);
      vec3 brownDark = vec3(0.41, 0.32, 0.23);
      vec3 greenLight = vec3(0.36, 0.45, 0.29);
      vec3 greenDark = vec3(0.30, 0.39, 0.25);
      albedo = noise1 < 0.5 ? mix(brownLight, brownDark, noise2) : mix(greenLight, greenDark, noise2);
      albedo *= treeShadow * warm;
    }
  } else if (sideFace) {
    float shade = 0.30 + max(dot(N, sunDir), 0.0) * 0.65;
    vec3 tint = vec3(0.95, 0.95, 0.98);
    if (vType < 0.5) {
      albedo = mix(dirtMid, dirtDark, noise1) * shade * tint;
    } else if (blossom) {
      albedo = sakura(noise1, sakuraLight, sakuraMid, sakuraDeep, sakuraRich);
      float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
      albedo *= shade * tint * canopyAO * mix(0.70, 1.0, smoothstep(0.0, 0.12, edge));
      if (decorative) albedo *= 1.045;
    } else if (trunk) {
      albedo = bark(noise1, barkLight, barkMid, barkDark, barkDeep);
      float heightLift = 1.0 + smoothstep(5.0, 11.0, vLayer) * 0.045;
      albedo *= heightLift * shade * tint;
    } else if (grass) {
      albedo = mix(grassMid, grassDark, noise1) * shade * tint;
    } else {
      albedo = mix(vec3(0.43, 0.34, 0.26), vec3(0.34, 0.40, 0.25), noise1) * shade * tint;
    }
  } else {
    vec3 bottomTint = vec3(0.60, 0.62, 0.70);
    if (blossom) albedo = sakuraDeep * 0.50 * bottomTint;
    else if (trunk) albedo = barkDark * 0.50 * bottomTint;
    else if (grass) albedo = grassDark * 0.50 * bottomTint;
    else albedo = dirtDark * 0.50 * bottomTint;
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
  float shadowScale = 0.88;
  float shadowHeight = 0.48;
  vec2 shadowOffset = vec2(0.5, 0.5) * shadowHeight * 0.30 * (1.0 - uProgress);
  float x = q.x * halfGrid * shadowScale + shadowOffset.x;
  float y = -shadowHeight;
  float z = q.y * halfGrid * shadowScale + shadowOffset.y;

  float angleY = mix(0.78, 0.0, uProgress);
  float angleX = mix(-0.55, -1.57079632679, uProgress);
  float cy = cos(angleY); float sy = sin(angleY);
  float cx = cos(angleX); float sx = sin(angleX);
  float ryX = x * cy - z * sy;
  float ryZ = x * sy + z * cy;
  float rxY = y * cx - ryZ * sx;

  float viewScale = mix(1.70, 2.10, uProgress);
  float scaleX = viewScale / max(uAspect, 1.0);
  float scaleY = viewScale / max(1.0 / uAspect, 1.0);
  float offsetX = mix(0.0, 0.015, uProgress);
  float offsetY = mix(0.012, 0.08, uProgress);

  gl_Position = vec4((ryX + offsetX) * scaleX, (rxY + offsetY) * scaleY, 0.99, 1.0);
}
`;

const shadowFragmentShader = /* glsl */ `
precision highp float;
uniform float uProgress;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  float presence = 1.0 - smoothstep(0.42, 0.94, uProgress);
  float alpha = 0.058 * exp(-d * d * 2.15) * presence;
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

function revealCurve(t: number) {
  if (t <= 0.12) return 0;
  if (t < 0.78) {
    const local = (t - 0.12) / 0.66;
    return easeInOutCubic(local) * 0.88;
  }
  const local = Math.min(1, (t - 0.78) / 0.22);
  return 0.88 + (1 - Math.pow(1 - local, 3)) * 0.12;
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

export function ReferenceVoxelWorldRefined({ matrix, scanMode }: Props) {
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
        uProgress: { value: revealCurve(rawProgress.current) },
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
        uProgress: { value: revealCurve(rawProgress.current) },
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
    const progress = revealCurve(rawProgress.current);
    blockMaterial.uniforms.uProgress.value = progress;
    shadowMaterial.uniforms.uProgress.value = progress;
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
