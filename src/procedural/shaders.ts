const uniformsStruct = /* wgsl */ `
struct Uniforms {
  aspect: f32,
  time: f32,
  progress: f32,
  gridSize: f32,
  season: f32,
  cell: f32,
  groundSpan: f32,
  seed: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
  pad3: f32,
  pad4: f32,
  pad5: f32,
  pad6: f32,
  pad7: f32,
};
`;

const common = /* wgsl */ `
fn hash11(n: f32) -> f32 {
  return fract(sin(n * 127.1 + 311.7) * 43758.5453);
}

fn projectWorld(world: vec3f, u: Uniforms) -> vec4f {
  let p = clamp(u.progress, 0.0, 1.0);
  let ay = mix(0.76, 0.0, p);
  let ax = mix(-0.52, -1.5707963, p);
  let cy = cos(ay);
  let sy = sin(ay);
  let cx = cos(ax);
  let sx = sin(ax);

  let ryX = world.x * cy - world.z * sy;
  let ryZ = world.x * sy + world.z * cy;
  let rxY = world.y * cx - ryZ * sx;
  let rxZ = world.y * sx + ryZ * cx;

  let viewScale = mix(1.42, 1.72, p);
  let scaleX = viewScale / max(u.aspect, 1.0);
  let scaleY = viewScale / max(1.0 / u.aspect, 1.0);
  let yOffset = mix(-0.05, 0.02, p);

  return vec4f(
    ryX * scaleX,
    (rxY + yOffset) * scaleY,
    rxZ * 0.035 + 0.5,
    1.0
  );
}

fn seasonLeafBase(season: f32) -> vec3f {
  if (season < 0.5) { return vec3f(0.92, 0.39, 0.57); }
  if (season < 1.5) { return vec3f(0.20, 0.48, 0.20); }
  return vec3f(0.86, 0.40, 0.10);
}
`;

export const groundVertexShader = /* wgsl */ `
${uniformsStruct}
${common}

struct Out {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) normal: vec3f,
  @location(2) dark: f32,
  @location(3) noise: f32,
  @location(4) worldXZ: vec2f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> cells: array<vec4f>;

fn quadVertex(i: u32) -> vec2f {
  var q = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0)
  );
  return q[i];
}

@vertex
fn main(@builtin(vertex_index) vi: u32) -> Out {
  let cellIndex = vi / 36u;
  let local = vi % 36u;
  let face = local / 6u;
  let qv = quadVertex(local % 6u);
  let data = cells[cellIndex];
  let p = clamp(u.progress, 0.0, 1.0);
  let half = u.cell * 0.5;
  let height = mix(u.cell * 0.22, u.cell * 0.025, smoothstep(0.15, 1.0, p));

  var offset = vec3f(0.0);
  var normal = vec3f(0.0, 1.0, 0.0);

  if (face == 0u) {
    offset = vec3f((qv.x - 0.5) * u.cell, height * 0.5, (qv.y - 0.5) * u.cell);
    normal = vec3f(0.0, 1.0, 0.0);
  } else if (face == 1u) {
    offset = vec3f((qv.x - 0.5) * u.cell, -height * 0.5, (0.5 - qv.y) * u.cell);
    normal = vec3f(0.0, -1.0, 0.0);
  } else if (face == 2u) {
    offset = vec3f((qv.x - 0.5) * u.cell, (qv.y - 0.5) * height, half);
    normal = vec3f(0.0, 0.0, 1.0);
  } else if (face == 3u) {
    offset = vec3f((0.5 - qv.x) * u.cell, (qv.y - 0.5) * height, -half);
    normal = vec3f(0.0, 0.0, -1.0);
  } else if (face == 4u) {
    offset = vec3f(half, (qv.y - 0.5) * height, (qv.x - 0.5) * u.cell);
    normal = vec3f(1.0, 0.0, 0.0);
  } else {
    offset = vec3f(-half, (qv.y - 0.5) * height, (0.5 - qv.x) * u.cell);
    normal = vec3f(-1.0, 0.0, 0.0);
  }

  let centre = vec3f(data.x, height * 0.5, data.y);
  let world = centre + offset;
  var out: Out;
  out.position = projectWorld(world, u);
  out.uv = qv;
  out.normal = normal;
  out.dark = data.z;
  out.noise = data.w;
  out.worldXZ = vec2f(data.x, data.y);
  return out;
}
`;

export const groundFragmentShader = /* wgsl */ `
${uniformsStruct}
${common}

struct In {
  @location(0) uv: vec2f,
  @location(1) normal: vec3f,
  @location(2) dark: f32,
  @location(3) noise: f32,
  @location(4) worldXZ: vec2f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

@fragment
fn main(input: In) -> @location(0) vec4f {
  let p = clamp(u.progress, 0.0, 1.0);
  var sceneDark = vec3f(0.33, 0.36, 0.24);
  if (u.season >= 0.5 && u.season < 1.5) { sceneDark = vec3f(0.20, 0.36, 0.18); }
  if (u.season >= 1.5) { sceneDark = vec3f(0.42, 0.31, 0.15); }
  let sceneLight = vec3f(0.94, 0.93, 0.88);
  let qrDark = vec3f(0.025, 0.028, 0.024);
  let qrLight = vec3f(0.985, 0.985, 0.975);
  let targetScene = mix(sceneLight, sceneDark, input.dark);
  let targetQR = mix(qrLight, qrDark, input.dark);
  var color = mix(targetScene, targetQR, smoothstep(0.34, 0.94, p));

  let top = max(input.normal.y, 0.0);
  let side = 0.62 + top * 0.38;
  let noise = (input.noise - 0.5) * 0.055 * (1.0 - p);
  color *= side + noise;

  let shadowRadius = u.groundSpan * 0.28;
  let d = length(input.worldXZ + vec2f(-u.cell * 1.2, -u.cell * 0.8));
  let treeShadow = 1.0 - (1.0 - smoothstep(shadowRadius * 0.2, shadowRadius, d)) * 0.17 * (1.0 - p);
  color *= treeShadow;

  return vec4f(color, 1.0);
}
`;

export const branchVertexShader = /* wgsl */ `
${uniformsStruct}
${common}

struct Out {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) alpha: f32,
  @location(2) noise: f32,
  @location(3) height: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> starts: array<vec4f>;
@group(0) @binding(2) var<storage, read> ends: array<vec4f>;

fn qv(i: u32) -> vec2f {
  var q = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0)
  );
  return q[i];
}

@vertex
fn main(@builtin(vertex_index) vi: u32) -> Out {
  let seg = vi / 36u;
  let local = vi % 36u;
  let face = local / 6u;
  let uv = qv(local % 6u);
  let a = starts[seg];
  let b = ends[seg];
  let start = a.xyz;
  let finish = b.xyz;
  let dir = normalize(finish - start + vec3f(0.000001, 0.0, 0.0));
  let helper = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(dir.y) > 0.92);
  let side = normalize(cross(dir, helper));
  let binormal = normalize(cross(side, dir));
  let r0 = a.w;
  let r1 = b.w;

  var world = start;
  var normal = dir;
  if (face == 0u) {
    world = finish + side * ((uv.x - 0.5) * 2.0 * r1) + binormal * ((uv.y - 0.5) * 2.0 * r1);
    normal = dir;
  } else if (face == 1u) {
    world = start + side * ((uv.x - 0.5) * 2.0 * r0) + binormal * ((0.5 - uv.y) * 2.0 * r0);
    normal = -dir;
  } else {
    let t = uv.y;
    let radius = mix(r0, r1, t);
    let center = mix(start, finish, t);
    if (face == 2u) {
      world = center + side * radius + binormal * ((uv.x - 0.5) * 2.0 * radius);
      normal = side;
    } else if (face == 3u) {
      world = center - side * radius + binormal * ((0.5 - uv.x) * 2.0 * radius);
      normal = -side;
    } else if (face == 4u) {
      world = center + binormal * radius + side * ((0.5 - uv.x) * 2.0 * radius);
      normal = binormal;
    } else {
      world = center - binormal * radius + side * ((uv.x - 0.5) * 2.0 * radius);
      normal = -binormal;
    }
  }

  let p = clamp(u.progress, 0.0, 1.0);
  let collapse = smoothstep(0.08, 0.82, p);
  let wind = sin(u.time * 0.72 + finish.x * 4.7 + finish.z * 3.9 + f32(seg) * 0.021) * 0.009;
  world.x += wind * smoothstep(0.18, 0.95, world.y / max(u.groundSpan, 0.001)) * (1.0 - p);
  world.z += wind * 0.55 * smoothstep(0.18, 0.95, world.y / max(u.groundSpan, 0.001)) * (1.0 - p);
  world.y = mix(world.y, u.cell * 0.12, collapse * 0.88);
  world.xz *= mix(1.0, 0.91, collapse);

  var out: Out;
  out.position = projectWorld(world, u);
  out.normal = normal;
  out.alpha = 1.0 - smoothstep(0.22, 0.78, p);
  out.noise = hash11(f32(seg) + u.seed * 0.00001);
  out.height = finish.y;
  return out;
}
`;

export const branchFragmentShader = /* wgsl */ `
${uniformsStruct}
${common}

struct In {
  @location(0) normal: vec3f,
  @location(1) alpha: f32,
  @location(2) noise: f32,
  @location(3) height: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

@fragment
fn main(input: In) -> @location(0) vec4f {
  if (input.alpha < 0.015) { discard; }
  let n = normalize(input.normal);
  let sun = normalize(vec3f(-0.45, 0.82, -0.38));
  let diffuse = 0.35 + max(dot(n, sun), 0.0) * 0.58 + max(n.y, 0.0) * 0.12;
  let barkA = vec3f(0.26, 0.115, 0.045);
  let barkB = vec3f(0.40, 0.20, 0.075);
  let variation = mix(barkA, barkB, input.noise * 0.68);
  let heightLift = 0.94 + smoothstep(0.0, u.groundSpan, input.height) * 0.08;
  let color = variation * diffuse * heightLift;
  return vec4f(color, input.alpha);
}
`;

export const spriteVertexShader = /* wgsl */ `
${uniformsStruct}
${common}

struct Out {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) kind: f32,
  @location(2) alpha: f32,
  @location(3) noise: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> sprites: array<vec4f>;

fn quad(i: u32) -> vec2f {
  var q = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0)
  );
  return q[i];
}

@vertex
fn main(@builtin(vertex_index) vi: u32) -> Out {
  let index = vi / 6u;
  let uv = quad(vi % 6u);
  let raw = sprites[index];
  let kind = floor(raw.w + 0.0001);
  let size = fract(raw.w);
  let noise = hash11(f32(index) * 1.37 + u.seed * 0.000013);
  let p = clamp(u.progress, 0.0, 1.0);
  var out: Out;
  out.uv = uv;
  out.kind = kind;
  out.noise = noise;

  if (kind > 1.5) {
    var base = raw.xyz;
    let sway = sin(u.time * 1.25 + noise * 9.0) * size * 0.16;
    let top = base + vec3f(sway, size * 1.8, sway * 0.35);
    let t = uv.y;
    let world = mix(base, top, t);
    var clip = projectWorld(world, u);
    let width = size * 0.13 * (1.0 - t * 0.72);
    clip.x += (uv.x - 0.5) * width / max(u.aspect, 1.0);
    out.position = clip;
    out.alpha = 1.0 - smoothstep(0.04, 0.48, p);
    return out;
  }

  var center = raw.xyz;
  if (kind > 0.5) {
    let cycle = fract(raw.y / max(u.groundSpan, 0.001) + noise - u.time * mix(0.035, 0.065, step(1.5, u.season)));
    center.y = u.cell * 0.25 + cycle * u.groundSpan * 0.92;
    center.x += sin(u.time * 0.52 + noise * 10.0) * u.cell * 1.8;
    center.z += cos(u.time * 0.41 + noise * 7.0) * u.cell * 1.3;
  } else {
    let crownHeight = smoothstep(u.groundSpan * 0.20, u.groundSpan * 0.95, center.y);
    center.x += sin(u.time * 0.68 + noise * 8.0) * 0.012 * crownHeight * (1.0 - p);
    center.z += cos(u.time * 0.61 + noise * 6.0) * 0.009 * crownHeight * (1.0 - p);
    let collapse = smoothstep(0.04, 0.66, p);
    center.y = mix(center.y, u.cell * 0.18, collapse * 0.92);
  }

  let clipCenter = projectWorld(center, u);
  let collapseScale = mix(1.0, 0.20, smoothstep(0.03, 0.68, p));
  let screenSize = size * 1.55 * collapseScale;
  let sx = screenSize / max(u.aspect, 1.0);
  let sy = screenSize / max(1.0 / u.aspect, 1.0);
  out.position = clipCenter + vec4f((uv.x - 0.5) * sx, (uv.y - 0.5) * sy, 0.0, 0.0);
  out.alpha = select(
    1.0 - smoothstep(0.03, 0.62, p),
    (1.0 - smoothstep(0.0, 0.44, p)) * 0.88,
    kind > 0.5
  );
  return out;
}
`;

export const spriteFragmentShader = /* wgsl */ `
${uniformsStruct}
${common}

struct In {
  @location(0) uv: vec2f,
  @location(1) kind: f32,
  @location(2) alpha: f32,
  @location(3) noise: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

@fragment
fn main(input: In) -> @location(0) vec4f {
  if (input.alpha < 0.01) { discard; }
  let p = input.uv - vec2f(0.5);

  if (input.kind > 1.5) {
    let taper = 1.0 - input.uv.y * 0.72;
    let blade = 1.0 - smoothstep(0.16 * taper, 0.5 * taper + 0.001, abs(p.x));
    let alpha = input.alpha * blade;
    if (alpha < 0.02) { discard; }
    var grass = vec3f(0.32, 0.43, 0.18);
    if (u.season > 0.5 && u.season < 1.5) { grass = vec3f(0.21, 0.46, 0.19); }
    if (u.season > 1.5) { grass = vec3f(0.50, 0.37, 0.12); }
    grass *= 0.88 + input.noise * 0.22;
    return vec4f(grass, alpha);
  }

  if (input.kind > 0.5) {
    let angle = (input.noise - 0.5) * 1.4;
    let c = cos(angle);
    let s = sin(angle);
    let q = vec2f(c * p.x - s * p.y, s * p.x + c * p.y);
    let d = length(vec2f(q.x / 0.36, q.y / 0.16));
    let alpha = input.alpha * (1.0 - smoothstep(0.84, 1.0, d));
    if (alpha < 0.015) { discard; }
    var color = vec3f(0.93, 0.52, 0.64);
    if (u.season > 0.5 && u.season < 1.5) { color = vec3f(0.38, 0.58, 0.24); }
    if (u.season > 1.5) { color = vec3f(0.92, 0.48, 0.10); }
    color *= 0.90 + input.noise * 0.18;
    return vec4f(color, alpha);
  }

  let r = length(p);
  let a = atan2(p.y, p.x);
  var boundary = 0.42 + 0.045 * sin(a * 7.0 + input.noise * 4.0);
  if (u.season < 0.5) {
    boundary = 0.31 + 0.105 * cos(a * 5.0 + input.noise * 1.7);
  } else if (u.season > 1.5) {
    boundary = 0.38 + 0.07 * cos(a * 3.0 + input.noise * 2.1);
  }
  let alpha = input.alpha * (1.0 - smoothstep(boundary, boundary + 0.065, r));
  if (alpha < 0.015) { discard; }

  let base = seasonLeafBase(u.season);
  let light = vec3f(1.0, 0.91, 0.84);
  let shade = 0.76 + input.noise * 0.30 + (1.0 - r) * 0.10;
  var color = base * shade;
  if (u.season < 0.5) { color = mix(base, light, 0.08 + input.noise * 0.20); }
  return vec4f(color, alpha);
}
`;
