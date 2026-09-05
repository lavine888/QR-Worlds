import { BLOCK_SIZE } from './blockData';

const uniforms = /* wgsl */ `
struct Uniforms {
  aspectRatio: f32,
  time: f32,
  blockCount: f32,
  progress: f32,
  gridSize: f32,
  creeperT: f32,
  fuseT: f32,
  blastT: f32,
  blastX: f32,
  blastZ: f32,
  rebuildT: f32,
  creeperAlpha: f32,
  spawnAngle: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
}
`;

export const skyVertexShader = /* wgsl */ `
${uniforms}
struct SkyOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn main(@builtin(vertex_index) vi: u32) -> SkyOut {
  var tri = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  let p = tri[vi];
  var out: SkyOut;
  out.position = vec4f(p, 1.0, 1.0);
  out.uv = vec2f(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  return out;
}
`;

export const skyFragmentShader = /* wgsl */ `
@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return vec4f(0.969, 0.969, 0.969, 1.0);
}
`;

export const shadowVertexShader = /* wgsl */ `
${uniforms}
struct ShadowOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn main(@builtin(vertex_index) vi: u32) -> ShadowOut {
  var quad = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  let q = quad[vi];
  var out: ShadowOut;
  out.uv = q * 0.5 + vec2f(0.5);

  let halfGrid = uniforms.gridSize * ${BLOCK_SIZE} * 0.5;
  let shadowScale = 0.85;
  let shadowHeight = 0.48;
  let lightDirXZ = vec2f(-0.5, -0.5);
  let shadowOffset = -lightDirXZ * shadowHeight * 0.35 * (1.0 - uniforms.progress);

  let localX = q.x * halfGrid * shadowScale + shadowOffset.x;
  let localY = -shadowHeight;
  let localZ = q.y * halfGrid * shadowScale + shadowOffset.y;

  let angleY = mix(0.78, 0.0, uniforms.progress);
  let angleX = mix(-0.55, -1.5708, uniforms.progress);
  let cy = cos(angleY);
  let sy = sin(angleY);
  let cx = cos(angleX);
  let sx = sin(angleX);

  let ryX = localX * cy - localZ * sy;
  let ryZ = localX * sy + localZ * cy;
  let rxY = localY * cx - ryZ * sx;

  let viewScale = mix(1.6, 2.1, uniforms.progress);
  let scaleX = viewScale / max(uniforms.aspectRatio, 1.0);
  let scaleY = viewScale / max(1.0 / uniforms.aspectRatio, 1.0);
  let xOffset = mix(0.0, 0.015, uniforms.progress);
  let yOffset = mix(0.0, 0.08, uniforms.progress);

  out.position = vec4f(
    (ryX + xOffset) * scaleX,
    (rxY + yOffset) * scaleY,
    0.99,
    1.0
  );
  return out;
}
`;

export const shadowFragmentShader = /* wgsl */ `
${uniforms}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let centered = uv * 2.0 - vec2f(1.0);
  let dist = length(centered);
  let falloff = exp(-dist * dist * 2.5);
  var presence = 1.0;
  if (uniforms.blastT >= 0.0) {
    presence = 1.0 - smoothstep(0.15, 1.7, uniforms.blastT);
    presence = max(presence, uniforms.rebuildT);
  }
  let alpha = 0.08 * falloff * presence;
  let shadowColor = vec3f(0.10, 0.12, 0.15);
  return vec4f(shadowColor * alpha, alpha);
}
`;

export const blocksVertexShader = /* wgsl */ `
${uniforms}
struct BlockOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) faceNx: f32,
  @location(2) faceNy: f32,
  @location(3) faceNz: f32,
  @location(4) blockType: f32,
  @location(5) charge: f32,
  @location(6) col: f32,
  @location(7) row: f32,
  @location(8) layer: f32,
  @location(9) partId: f32,
  @location(10) modelFront: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> blockTypes: array<u32>;
@group(0) @binding(2) var<storage, read> blockPositions: array<vec4f>;
@group(0) @binding(3) var<storage, read> blockResistance: array<f32>;
@group(0) @binding(4) var<storage, read> blockBaseY: array<f32>;

const BLOCK = ${BLOCK_SIZE};

@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> BlockOutput {
  var out: BlockOutput;
  let blockIndex = vertexIndex / 36u;
  let localIndex = vertexIndex % 36u;
  let faceIndex = localIndex / 6u;
  let vertexInFace = localIndex % 6u;

  if (blockIndex >= u32(uniforms.blockCount)) {
    out.position = vec4f(0.0, 0.0, -10.0, 1.0);
    return out;
  }

  let pos = blockPositions[blockIndex];
  let halfGrid = uniforms.gridSize * BLOCK * 0.5;
  let half = BLOCK * 0.5;
  var quad = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0)
  );
  let q = quad[vertexInFace];

  var offset = vec3f(0.0);
  var normal = vec3f(0.0);
  if (faceIndex == 0u) {
    offset = vec3f((q.x - 0.5) * BLOCK, half, (q.y - 0.5) * BLOCK);
    normal = vec3f(0.0, 1.0, 0.0);
  } else if (faceIndex == 1u) {
    offset = vec3f((q.x - 0.5) * BLOCK, -half, (0.5 - q.y) * BLOCK);
    normal = vec3f(0.0, -1.0, 0.0);
  } else if (faceIndex == 2u) {
    offset = vec3f((q.x - 0.5) * BLOCK, (q.y - 0.5) * BLOCK, half);
    normal = vec3f(0.0, 0.0, 1.0);
  } else if (faceIndex == 3u) {
    offset = vec3f((0.5 - q.x) * BLOCK, (q.y - 0.5) * BLOCK, -half);
    normal = vec3f(0.0, 0.0, -1.0);
  } else if (faceIndex == 4u) {
    offset = vec3f(half, (q.y - 0.5) * BLOCK, (q.x - 0.5) * BLOCK);
    normal = vec3f(1.0, 0.0, 0.0);
  } else {
    offset = vec3f(-half, (q.y - 0.5) * BLOCK, (0.5 - q.x) * BLOCK);
    normal = vec3f(-1.0, 0.0, 0.0);
  }

  let centre = vec3f(
    pos.x * BLOCK - halfGrid,
    blockBaseY[blockIndex] + half,
    pos.y * BLOCK - halfGrid
  );
  let localPos = centre + offset;

  let angleY = mix(0.78, 0.0, uniforms.progress);
  let angleX = mix(-0.55, -1.5708, uniforms.progress);
  let cy = cos(angleY);
  let sy = sin(angleY);
  let cx = cos(angleX);
  let sx = sin(angleX);

  let ryX = localPos.x * cy - localPos.z * sy;
  let ryZ = localPos.x * sy + localPos.z * cy;
  let rxY = localPos.y * cx - ryZ * sx;
  let rxZ = localPos.y * sx + ryZ * cx;

  let viewScale = mix(1.6, 2.1, uniforms.progress);
  let scaleX = viewScale / max(uniforms.aspectRatio, 1.0);
  let scaleY = viewScale / max(1.0 / uniforms.aspectRatio, 1.0);
  let xOffset = mix(0.0, 0.015, uniforms.progress);
  let yOffset = mix(0.0, 0.08, uniforms.progress);

  out.position = vec4f(
    (ryX + xOffset) * scaleX,
    (rxY + yOffset) * scaleY,
    rxZ * 0.05 + 0.5,
    1.0
  );
  out.uv = q;
  out.faceNx = normal.x;
  out.faceNy = normal.y;
  out.faceNz = normal.z;
  out.blockType = f32(blockTypes[blockIndex]);
  out.charge = 0.0;
  out.col = pos.x;
  out.row = pos.y;
  out.layer = blockBaseY[blockIndex] / BLOCK;
  out.partId = -1.0;
  out.modelFront = select(0.0, 1.0, faceIndex == 2u);
  return out;
}
`;

export const blocksFragmentShader = /* wgsl */ `
${uniforms}
struct BlockInput {
  @location(0) uv: vec2f,
  @location(1) faceNx: f32,
  @location(2) faceNy: f32,
  @location(3) faceNz: f32,
  @location(4) blockType: f32,
  @location(5) charge: f32,
  @location(6) col: f32,
  @location(7) row: f32,
  @location(8) layer: f32,
  @location(9) partId: f32,
  @location(10) modelFront: f32,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

fn acesFilm(x: vec3f) -> vec3f {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3f(0.0), vec3f(1.0));
}

@fragment
fn main(input: BlockInput) -> @location(0) vec4f {
  let uv = input.uv;
  let N = normalize(vec3f(input.faceNx, input.faceNy, input.faceNz));
  let blockType = i32(input.blockType + 0.5);
  let progress = uniforms.progress;

  let dirtLight = vec3f(1.0, 0.98, 0.94);
  let dirtMid = vec3f(0.96, 0.94, 0.88);
  let dirtDark = vec3f(0.92, 0.88, 0.82);
  let sakuraLight = vec3f(0.70, 0.25, 0.38);
  let sakuraMid = vec3f(0.58, 0.18, 0.30);
  let sakuraDeep = vec3f(0.46, 0.12, 0.24);
  let sakuraRich = vec3f(0.36, 0.07, 0.18);
  let barkLight = vec3f(0.34, 0.18, 0.07);
  let barkMid = vec3f(0.26, 0.13, 0.05);
  let barkDark = vec3f(0.20, 0.09, 0.03);
  let barkDeep = vec3f(0.14, 0.06, 0.02);
  let grassDark = vec3f(0.05, 0.18, 0.04);
  let grassMid = vec3f(0.07, 0.28, 0.05);
  let grassBright = vec3f(0.12, 0.38, 0.08);

  let sunDir = normalize(vec3f(-0.5, 0.8, -0.5));
  let sunCol = vec3f(1.15, 1.05, 0.95);
  let ambient = vec3f(0.35, 0.38, 0.45);
  let skyFill = vec3f(0.85, 0.90, 0.95);
  let bounce = vec3f(0.50, 0.65, 0.42);
  let NdSun = max(dot(N, sunDir), 0.0);
  let NdUp = max(dot(N, vec3f(0.0, 1.0, 0.0)), 0.0);

  let layer = input.layer;
  let blockSeed = input.col * 17.3 + input.row * 31.1 + layer * 73.7;
  let noise1 = fract(sin(blockSeed) * 43758.5);
  let noise2 = fract(sin(blockSeed * 1.7 + 127.1) * 43758.5);

  let center = uniforms.gridSize * 0.5;
  let dx = input.col - (center + 1.5);
  let dy = input.row - (center + 1.5);
  let shadowDist = sqrt(dx * dx + dy * dy);
  let canopyRadius = uniforms.gridSize * 0.46;
  let shadowT = 1.0 - smoothstep(2.5, canopyRadius, shadowDist);
  let treeShadow = 1.0 - shadowT * 0.35;
  let canopyAO = 0.65 + min(layer / 15.0, 1.0) * 0.35;

  var albedo = vec3f(0.5);

  if (input.faceNy > 0.5) {
    let warm = vec3f(1.10, 1.08, 1.02);

    if (blockType == 0) {
      var c = dirtMid;
      if (noise1 < 0.5) {
        c = mix(dirtLight, dirtMid, noise1 / 0.5);
      } else {
        c = mix(dirtMid, dirtDark, (noise1 - 0.5) / 0.5);
      }
      c *= (1.0 + (noise2 - 0.5) * 0.10) * treeShadow;
      albedo = c * warm;
    } else if (blockType == 1) {
      var c = sakuraMid;
      if (noise1 < 0.33) {
        c = mix(sakuraLight, sakuraMid, noise1 / 0.33);
      } else if (noise1 < 0.66) {
        c = mix(sakuraMid, sakuraDeep, (noise1 - 0.33) / 0.33);
      } else {
        c = mix(sakuraDeep, sakuraRich, (noise1 - 0.66) / 0.34);
      }
      c *= 1.0 + (noise2 - 0.5) * 0.15;
      let edgeX = min(uv.x, 1.0 - uv.x);
      let edgeY = min(uv.y, 1.0 - uv.y);
      let rounded = smoothstep(0.0, 0.12, min(edgeX, edgeY));
      let edgeDarken = mix(0.88, 1.0, rounded);
      let finalEdge = mix(edgeDarken, 1.0, progress);
      albedo = c * warm * canopyAO * finalEdge;
    } else if (blockType == 2) {
      var c = barkMid;
      if (noise1 < 0.33) {
        c = mix(barkLight, barkMid, noise1 / 0.33);
      } else if (noise1 < 0.66) {
        c = mix(barkMid, barkDark, (noise1 - 0.33) / 0.33);
      } else {
        c = mix(barkDark, barkDeep, (noise1 - 0.66) / 0.34);
      }
      c *= 1.0 + (noise2 - 0.5) * 0.20;
      let ao = 0.60 + min(layer / 12.0, 1.0) * 0.40;
      let edgeX = min(uv.x, 1.0 - uv.x);
      let edgeY = min(uv.y, 1.0 - uv.y);
      let edgeDist = min(edgeX, edgeY);
      let cornerDist = length(vec2f(0.5 - abs(uv.x - 0.5), 0.5 - abs(uv.y - 0.5)));
      let rounded = smoothstep(0.0, 0.18, edgeDist) * smoothstep(0.25, 0.5, cornerDist);
      let edgeAO = mix(0.55, 1.0, rounded);
      albedo = c * ao * edgeAO * warm;
    } else if (blockType == 3) {
      let brown = vec3f(0.28, 0.25, 0.12);
      let olive = vec3f(0.32, 0.35, 0.15);
      var c = grassMid;
      if (noise1 < 0.30) {
        c = mix(grassBright, grassMid, noise1 / 0.30);
      } else if (noise1 < 0.60) {
        c = mix(grassMid, grassDark, (noise1 - 0.30) / 0.30);
      } else if (noise1 < 0.80) {
        c = mix(grassDark, brown, (noise1 - 0.60) / 0.20);
      } else {
        c = mix(brown, olive, (noise1 - 0.80) / 0.20);
      }
      c *= 1.0 + (noise2 - 0.5) * 0.20;
      albedo = c * warm;
    } else {
      let brownLight = vec3f(0.52, 0.42, 0.30);
      let brownDark = vec3f(0.42, 0.32, 0.22);
      let greenLight = vec3f(0.38, 0.48, 0.28);
      let greenDark = vec3f(0.32, 0.42, 0.24);
      var c = brownLight;
      if (noise1 < 0.5) {
        c = mix(brownLight, brownDark, noise2);
      } else {
        c = mix(greenLight, greenDark, noise2);
      }
      c *= (1.0 + (noise2 - 0.5) * 0.15) * treeShadow;
      albedo = c * warm;
    }
  } else if (abs(input.faceNz) > 0.5 || abs(input.faceNx) > 0.5) {
    let faceN = normalize(vec3f(input.faceNx, input.faceNy, input.faceNz));
    let shade = 0.30 + max(dot(faceN, sunDir), 0.0) * 0.65;
    let tint = vec3f(0.95, 0.95, 0.98);

    if (blockType == 0) {
      var c = dirtMid;
      if (noise1 < 0.33) {
        c = mix(dirtLight, dirtMid, noise1 / 0.33);
      } else if (noise1 < 0.66) {
        c = mix(dirtMid, dirtDark, (noise1 - 0.33) / 0.33);
      } else {
        c = dirtDark * (1.0 - (noise1 - 0.66) * 0.30);
      }
      c *= 1.0 + (noise2 - 0.5) * 0.20;
      albedo = c * shade * tint;
    } else if (blockType == 1) {
      var c = sakuraMid;
      if (noise1 < 0.33) {
        c = mix(sakuraLight, sakuraMid, noise1 / 0.33);
      } else if (noise1 < 0.66) {
        c = mix(sakuraMid, sakuraDeep, (noise1 - 0.33) / 0.33);
      } else {
        c = mix(sakuraDeep, sakuraRich, (noise1 - 0.66) / 0.34);
      }
      c *= 1.0 + (noise2 - 0.5) * 0.25;
      let edgeX = min(uv.x, 1.0 - uv.x);
      let edgeY = min(uv.y, 1.0 - uv.y);
      let rounded = smoothstep(0.0, 0.12, min(edgeX, edgeY));
      let edgeDarken = mix(0.70, 1.0, rounded);
      albedo = c * shade * tint * canopyAO * edgeDarken;
    } else if (blockType == 2) {
      var c = barkMid;
      if (noise1 < 0.33) {
        c = mix(barkLight, barkMid, noise1 / 0.33);
      } else if (noise1 < 0.66) {
        c = mix(barkMid, barkDark, (noise1 - 0.33) / 0.33);
      } else {
        c = mix(barkDark, barkDeep, (noise1 - 0.66) / 0.34);
      }
      c *= 1.0 + (noise2 - 0.5) * 0.20;
      let ao = 0.55 + min(layer / 12.0, 1.0) * 0.45;
      let edgeX = min(uv.x, 1.0 - uv.x);
      let edgeY = min(uv.y, 1.0 - uv.y);
      let rounded = smoothstep(0.0, 0.15, min(edgeX, edgeY));
      let edgeAO = mix(0.50, 1.0, rounded);
      let verticalAO = 0.80 + uv.y * 0.20;
      albedo = c * ao * verticalAO * edgeAO * shade * tint;
    } else if (blockType == 3) {
      let brown = vec3f(0.28, 0.25, 0.12);
      let olive = vec3f(0.32, 0.35, 0.15);
      var c = grassMid;
      if (noise1 < 0.30) {
        c = mix(grassBright, grassMid, noise1 / 0.30);
      } else if (noise1 < 0.60) {
        c = mix(grassMid, grassDark, (noise1 - 0.30) / 0.30);
      } else if (noise1 < 0.80) {
        c = mix(grassDark, brown, (noise1 - 0.60) / 0.20);
      } else {
        c = mix(brown, olive, (noise1 - 0.80) / 0.20);
      }
      c *= 1.0 + (noise2 - 0.5) * 0.20;
      albedo = c * shade * tint;
    } else {
      var c = mix(vec3f(0.45, 0.35, 0.26), vec3f(0.35, 0.42, 0.24), noise1 * 0.60);
      c *= 1.0 + (noise2 - 0.5) * 0.15;
      albedo = c * shade * tint;
    }
  } else {
    let bottomTint = vec3f(0.60, 0.62, 0.70);
    if (blockType == 0) {
      albedo = dirtDark * 0.50 * bottomTint;
    } else if (blockType == 1) {
      albedo = sakuraDeep * 0.50 * bottomTint;
    } else if (blockType == 2) {
      albedo = barkDark * 0.50 * bottomTint;
    } else if (blockType == 3) {
      albedo = grassDark * 0.50 * bottomTint;
    } else {
      albedo = vec3f(0.45, 0.42, 0.32) * 0.60 * bottomTint;
    }
  }

  let diffuse = albedo * (
    ambient + sunCol * NdSun * 0.65 + skyFill * NdUp * 0.25 + bounce * 0.20
  );
  var hdr = acesFilm(diffuse * 1.05);
  hdr = pow(hdr, vec3f(1.0 / 2.2));
  return vec4f(hdr, 1.0);
}
`;
