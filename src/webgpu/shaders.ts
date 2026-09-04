import { BLOCK_SIZE } from './blockData';

const uniforms = /* wgsl */ `
struct Uniforms {
  aspect: f32,
  time: f32,
  blockCount: f32,
  progress: f32,
  gridSize: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
}
`;

export const skyVertexShader = /* wgsl */ `
${uniforms}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  return vec4f(p[i], 0.999, 1.0);
}
`;

export const skyFragmentShader = /* wgsl */ `
@fragment
fn main() -> @location(0) vec4f {
  return vec4f(0.96862745, 0.96862745, 0.96862745, 1.0);
}
`;

export const shadowVertexShader = /* wgsl */ `
${uniforms}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct Out {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn main(@builtin(vertex_index) i: u32) -> Out {
  var out: Out;
  var q = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  let v = q[i];
  out.uv = v * 0.5 + vec2f(0.5);

  let halfGrid = uniforms.gridSize * ${BLOCK_SIZE} * 0.5;
  let shadowScale = 0.85;
  let shadowHeight = 0.48;
  let shadowOffset = vec2f(0.5, 0.5) * shadowHeight * 0.35 * (1.0 - uniforms.progress);
  let x = v.x * halfGrid * shadowScale + shadowOffset.x;
  let y = -shadowHeight;
  let z = v.y * halfGrid * shadowScale + shadowOffset.y;

  let angleY = mix(0.78, 0.0, uniforms.progress);
  let angleX = mix(-0.55, -1.57079632679, uniforms.progress);
  let cy = cos(angleY);
  let sy = sin(angleY);
  let cx = cos(angleX);
  let sx = sin(angleX);
  let ryX = x * cy - z * sy;
  let ryZ = x * sy + z * cy;
  let rxY = y * cx - ryZ * sx;

  let viewScale = mix(1.6, 2.1, uniforms.progress);
  let scaleX = viewScale / max(uniforms.aspect, 1.0);
  let scaleY = viewScale / max(1.0 / uniforms.aspect, 1.0);
  let offsetX = mix(0.0, 0.015, uniforms.progress);
  let offsetY = mix(0.0, 0.08, uniforms.progress);

  out.position = vec4f(
    (ryX + offsetX) * scaleX,
    (rxY + offsetY) * scaleY,
    0.99,
    1.0
  );
  return out;
}
`;

export const shadowFragmentShader = /* wgsl */ `
@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = uv * 2.0 - vec2f(1.0);
  let d = length(p);
  let alpha = 0.08 * exp(-d * d * 2.5);
  let ink = vec3f(0.10, 0.12, 0.15) * alpha;
  return vec4f(ink, alpha);
}
`;

export const blocksVertexShader = /* wgsl */ `
${uniforms}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> blockTypes: array<u32>;
@group(0) @binding(2) var<storage, read> blockPositions: array<vec4f>;
@group(0) @binding(3) var<storage, read> blockBaseLayers: array<f32>;

struct Out {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) normal: vec3f,
  @location(2) blockType: f32,
  @location(3) col: f32,
  @location(4) row: f32,
  @location(5) layer: f32,
}

@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> Out {
  var out: Out;
  let blockIndex = vertexIndex / 36u;
  let localIndex = vertexIndex % 36u;
  let faceIndex = localIndex / 6u;
  let vertexInFace = localIndex % 6u;

  if (blockIndex >= u32(uniforms.blockCount)) {
    out.position = vec4f(0.0, 0.0, -10.0, 1.0);
    return out;
  }

  var quad = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0)
  );
  let q = quad[vertexInFace];
  let cube = ${BLOCK_SIZE};
  let half = cube * 0.5;
  var offset = vec3f(0.0);
  var normal = vec3f(0.0);

  if (faceIndex == 0u) {
    offset = vec3f((q.x - 0.5) * cube, half, (q.y - 0.5) * cube);
    normal = vec3f(0.0, 1.0, 0.0);
  } else if (faceIndex == 1u) {
    offset = vec3f((q.x - 0.5) * cube, -half, (0.5 - q.y) * cube);
    normal = vec3f(0.0, -1.0, 0.0);
  } else if (faceIndex == 2u) {
    offset = vec3f((q.x - 0.5) * cube, (q.y - 0.5) * cube, half);
    normal = vec3f(0.0, 0.0, 1.0);
  } else if (faceIndex == 3u) {
    offset = vec3f((0.5 - q.x) * cube, (q.y - 0.5) * cube, -half);
    normal = vec3f(0.0, 0.0, -1.0);
  } else if (faceIndex == 4u) {
    offset = vec3f(half, (q.y - 0.5) * cube, (q.x - 0.5) * cube);
    normal = vec3f(1.0, 0.0, 0.0);
  } else {
    offset = vec3f(-half, (q.y - 0.5) * cube, (0.5 - q.x) * cube);
    normal = vec3f(-1.0, 0.0, 0.0);
  }

  let pos = blockPositions[blockIndex];
  let layer = blockBaseLayers[blockIndex];
  let halfGrid = uniforms.gridSize * cube * 0.5;
  let centre = vec3f(
    pos.x * cube - halfGrid,
    layer * cube + half,
    pos.y * cube - halfGrid
  );
  let p = centre + offset;

  let angleY = mix(0.78, 0.0, uniforms.progress);
  let angleX = mix(-0.55, -1.57079632679, uniforms.progress);
  let cy = cos(angleY);
  let sy = sin(angleY);
  let cx = cos(angleX);
  let sx = sin(angleX);

  let ryX = p.x * cy - p.z * sy;
  let ryZ = p.x * sy + p.z * cy;
  let rxY = p.y * cx - ryZ * sx;
  let rxZ = p.y * sx + ryZ * cx;

  let viewScale = mix(1.6, 2.1, uniforms.progress);
  let scaleX = viewScale / max(uniforms.aspect, 1.0);
  let scaleY = viewScale / max(1.0 / uniforms.aspect, 1.0);
  let offsetX = mix(0.0, 0.015, uniforms.progress);
  let offsetY = mix(0.0, 0.08, uniforms.progress);

  out.position = vec4f(
    (ryX + offsetX) * scaleX,
    (rxY + offsetY) * scaleY,
    rxZ * 0.05 + 0.5,
    1.0
  );
  out.uv = q;
  out.normal = normal;
  out.blockType = f32(blockTypes[blockIndex]);
  out.col = pos.x;
  out.row = pos.y;
  out.layer = layer;
  return out;
}
`;

export const blocksFragmentShader = /* wgsl */ `
${uniforms}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

fn hash1(n: f32) -> f32 {
  return fract(sin(n) * 43758.5);
}

fn acesFilm(x: vec3f) -> vec3f {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + vec3f(b))) / (x * (c * x + vec3f(d)) + vec3f(e)), vec3f(0.0), vec3f(1.0));
}

fn sakura(n: f32) -> vec3f {
  let lightC = vec3f(0.70, 0.25, 0.38);
  let midC = vec3f(0.58, 0.18, 0.30);
  let deepC = vec3f(0.46, 0.12, 0.24);
  let richC = vec3f(0.36, 0.07, 0.18);
  if (n < 0.33) { return mix(lightC, midC, n / 0.33); }
  if (n < 0.66) { return mix(midC, deepC, (n - 0.33) / 0.33); }
  return mix(deepC, richC, (n - 0.66) / 0.34);
}

fn bark(n: f32) -> vec3f {
  let lightC = vec3f(0.34, 0.18, 0.07);
  let midC = vec3f(0.26, 0.13, 0.05);
  let darkC = vec3f(0.20, 0.09, 0.03);
  let deepC = vec3f(0.14, 0.06, 0.02);
  if (n < 0.33) { return mix(lightC, midC, n / 0.33); }
  if (n < 0.66) { return mix(midC, darkC, (n - 0.33) / 0.33); }
  return mix(darkC, deepC, (n - 0.66) / 0.34);
}

@fragment
fn main(
  @location(0) uv: vec2f,
  @location(1) normalIn: vec3f,
  @location(2) blockType: f32,
  @location(3) col: f32,
  @location(4) row: f32,
  @location(5) layer: f32
) -> @location(0) vec4f {
  let n = normalize(normalIn);
  let seed = col * 17.3 + row * 31.1 + layer * 73.7;
  let noise1 = hash1(seed);
  let noise2 = hash1(seed * 1.7 + 127.1);

  let dirtLight = vec3f(1.00, 0.98, 0.94);
  let dirtMid = vec3f(0.96, 0.94, 0.88);
  let dirtDark = vec3f(0.92, 0.88, 0.82);
  let grassDark = vec3f(0.05, 0.18, 0.04);
  let grassMid = vec3f(0.07, 0.28, 0.05);
  let grassBright = vec3f(0.12, 0.38, 0.08);

  let sunDir = normalize(vec3f(-0.5, 0.8, -0.5));
  let sunCol = vec3f(1.15, 1.05, 0.95);
  let ambient = vec3f(0.35, 0.38, 0.45);
  let skyFill = vec3f(0.85, 0.90, 0.95);
  let bounce = vec3f(0.50, 0.65, 0.42);
  let ndSun = max(dot(n, sunDir), 0.0);
  let ndUp = max(dot(n, vec3f(0.0, 1.0, 0.0)), 0.0);

  let center = uniforms.gridSize * 0.5;
  let shadowDist = length(vec2f(col - (center + 1.5), row - (center + 1.5)));
  let canopyRadius = uniforms.gridSize * 0.46;
  let treeShadow = 1.0 - (1.0 - smoothstep(2.5, canopyRadius, shadowDist)) * 0.35;
  let canopyAO = 0.65 + min(layer / 15.0, 1.0) * 0.35;

  let topFace = n.y > 0.5;
  let sideFace = abs(n.x) > 0.5 || abs(n.z) > 0.5;
  var albedo = dirtMid;

  if (topFace) {
    let warm = vec3f(1.10, 1.08, 1.02);
    if (blockType < 0.5) {
      if (noise1 < 0.5) {
        albedo = mix(dirtLight, dirtMid, noise1 / 0.5);
      } else {
        albedo = mix(dirtMid, dirtDark, (noise1 - 0.5) / 0.5);
      }
      albedo = albedo * (1.0 + (noise2 - 0.5) * 0.10) * treeShadow * warm;
    } else if (blockType < 1.5) {
      albedo = sakura(noise1) * (1.0 + (noise2 - 0.5) * 0.15);
      let edgeX = min(uv.x, 1.0 - uv.x);
      let edgeY = min(uv.y, 1.0 - uv.y);
      let rounded = smoothstep(0.0, 0.12, min(edgeX, edgeY));
      let edgeDarken = mix(0.88, 1.0, rounded);
      let finalEdge = mix(edgeDarken, 1.0, uniforms.progress);
      albedo = albedo * warm * canopyAO * finalEdge;
    } else if (blockType < 2.5) {
      albedo = bark(noise1) * (1.0 + (noise2 - 0.5) * 0.20);
      let ao = 0.60 + min(layer / 12.0, 1.0) * 0.40;
      albedo = albedo * ao * warm;
    } else if (blockType < 3.5) {
      let brown = vec3f(0.28, 0.25, 0.12);
      let olive = vec3f(0.32, 0.35, 0.15);
      if (noise1 < 0.30) {
        albedo = mix(grassBright, grassMid, noise1 / 0.30);
      } else if (noise1 < 0.60) {
        albedo = mix(grassMid, grassDark, (noise1 - 0.30) / 0.30);
      } else if (noise1 < 0.80) {
        albedo = mix(grassDark, brown, (noise1 - 0.60) / 0.20);
      } else {
        albedo = mix(brown, olive, (noise1 - 0.80) / 0.20);
      }
      albedo = albedo * warm;
    } else {
      let brownLight = vec3f(0.52, 0.42, 0.30);
      let brownDark = vec3f(0.42, 0.32, 0.22);
      let greenLight = vec3f(0.38, 0.48, 0.28);
      let greenDark = vec3f(0.32, 0.42, 0.24);
      if (noise1 < 0.5) {
        albedo = mix(brownLight, brownDark, noise2);
      } else {
        albedo = mix(greenLight, greenDark, noise2);
      }
      albedo = albedo * treeShadow * warm;
    }
  } else if (sideFace) {
    let shade = 0.30 + max(dot(n, sunDir), 0.0) * 0.65;
    let tint = vec3f(0.95, 0.95, 0.98);
    if (blockType < 0.5) {
      albedo = mix(dirtMid, dirtDark, noise1) * shade * tint;
    } else if (blockType < 1.5) {
      albedo = sakura(noise1) * (1.0 + (noise2 - 0.5) * 0.25) * shade * tint * canopyAO;
    } else if (blockType < 2.5) {
      albedo = bark(noise1) * (1.0 + (noise2 - 0.5) * 0.20) * shade * tint;
    } else if (blockType < 3.5) {
      albedo = mix(grassMid, grassDark, noise1) * shade * tint;
    } else {
      albedo = mix(vec3f(0.45, 0.35, 0.26), vec3f(0.35, 0.42, 0.24), noise1 * 0.60) * shade * tint;
    }
  } else {
    let bottomTint = vec3f(0.60, 0.62, 0.70);
    if (blockType < 0.5) { albedo = dirtDark * 0.50 * bottomTint; }
    else if (blockType < 1.5) { albedo = vec3f(0.46, 0.12, 0.24) * 0.50 * bottomTint; }
    else if (blockType < 2.5) { albedo = vec3f(0.20, 0.09, 0.03) * 0.50 * bottomTint; }
    else if (blockType < 3.5) { albedo = grassDark * 0.50 * bottomTint; }
    else { albedo = vec3f(0.45, 0.42, 0.32) * 0.60 * bottomTint; }
  }

  let diffuse = albedo * (
    ambient + sunCol * ndSun * 0.65 + skyFill * ndUp * 0.25 + bounce * 0.20
  );
  var outColor = acesFilm(diffuse * 1.05);
  outColor = pow(outColor, vec3f(1.0 / 2.2));
  return vec4f(outColor, 1.0);
}
`;
