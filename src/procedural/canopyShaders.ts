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

  let viewScale = mix(1.48, 1.78, p);
  let scaleX = viewScale / max(u.aspect, 1.0);
  let scaleY = viewScale / max(1.0 / u.aspect, 1.0);
  let yOffset = mix(-0.045, 0.018, p);

  return vec4f(
    ryX * scaleX,
    (rxY + yOffset) * scaleY,
    rxZ * 0.035 + 0.5,
    1.0
  );
}

fn easeInOut(t: f32) -> f32 {
  return select(4.0 * t * t * t, 1.0 - pow(-2.0 * t + 2.0, 3.0) * 0.5, t >= 0.5);
}
`;

export const canopyVertexShader = /* wgsl */ `
${uniformsStruct}
${common}

struct Out {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) kind: f32,
  @location(2) tone: f32,
  @location(3) localMorph: f32,
  @location(4) mapped: f32,
  @location(5) finder: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> starts: array<vec4f>;
@group(0) @binding(2) var<storage, read> targets: array<vec4f>;
@group(0) @binding(3) var<storage, read> metas: array<vec4f>;
@group(0) @binding(4) var<storage, read> motions: array<vec4f>;

fn qv(i: u32) -> vec2f {
  var q = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0)
  );
  return q[i];
}

@vertex
fn main(@builtin(vertex_index) vi: u32) -> Out {
  let index = vi / 36u;
  let local = vi % 36u;
  let face = local / 6u;
  let uv = qv(local % 6u);
  let a = starts[index];
  let b = targets[index];
  let meta = metas[index];
  let motion = motions[index];
  let p = clamp(u.progress, 0.0, 1.0);
  let denom = max(0.0001, meta.w - meta.z);
  let rawMorph = clamp((p - meta.z) / denom, 0.0, 1.0);
  let m = easeInOut(rawMorph);
  let mapped = select(0.0, 1.0, b.w > 0.001);

  var center = mix(a.xyz, b.xyz, m);
  let travel = b.xz - a.xz;
  let travelLen = max(length(travel), 0.0001);
  let perpendicular = vec2f(-travel.y, travel.x) / travelLen;
  let arc = sin(m * 3.14159265);
  center.y += arc * motion.x;
  center.xz += perpendicular * arc * motion.y * u.cell * 2.2;

  // Living canopy movement vanishes as soon as a carrier starts committing to
  // its QR destination, so the morph reads as intentional rather than noisy.
  let windWeight = (1.0 - m) * (1.0 - p);
  let wind = sin(u.time * 0.74 + motion.z * 9.0 + f32(index) * 0.017) * u.cell * 0.17;
  center.x += wind * windWeight;
  center.z += wind * 0.62 * windWeight;

  let sizeXZ = mix(a.w, b.w, m);
  let heightScale = mix(1.0, 0.10, m * mapped);
  let sizeY = sizeXZ * heightScale;
  let hx = sizeXZ * 0.5;
  let hy = sizeY * 0.5;
  let hz = sizeXZ * 0.5;

  var offset = vec3f(0.0);
  var normal = vec3f(0.0, 1.0, 0.0);
  if (face == 0u) {
    offset = vec3f((uv.x - 0.5) * sizeXZ, hy, (uv.y - 0.5) * sizeXZ);
    normal = vec3f(0.0, 1.0, 0.0);
  } else if (face == 1u) {
    offset = vec3f((uv.x - 0.5) * sizeXZ, -hy, (0.5 - uv.y) * sizeXZ);
    normal = vec3f(0.0, -1.0, 0.0);
  } else if (face == 2u) {
    offset = vec3f((uv.x - 0.5) * sizeXZ, (uv.y - 0.5) * sizeY, hz);
    normal = vec3f(0.0, 0.0, 1.0);
  } else if (face == 3u) {
    offset = vec3f((0.5 - uv.x) * sizeXZ, (uv.y - 0.5) * sizeY, -hz);
    normal = vec3f(0.0, 0.0, -1.0);
  } else if (face == 4u) {
    offset = vec3f(hx, (uv.y - 0.5) * sizeY, (uv.x - 0.5) * sizeXZ);
    normal = vec3f(1.0, 0.0, 0.0);
  } else {
    offset = vec3f(-hx, (uv.y - 0.5) * sizeY, (0.5 - uv.x) * sizeXZ);
    normal = vec3f(-1.0, 0.0, 0.0);
  }

  // Unmapped decorative carriers collapse completely before the final frame.
  if (mapped < 0.5 && sizeXZ < 0.0015) {
    center = vec3f(0.0, 0.0, 0.0);
    offset = vec3f(0.0);
  }

  var out: Out;
  out.position = projectWorld(center + offset, u);
  out.normal = normal;
  out.kind = meta.x;
  out.tone = meta.y;
  out.localMorph = m;
  out.mapped = mapped;
  out.finder = motion.w;
  return out;
}
`;

export const canopyFragmentShader = /* wgsl */ `
${uniformsStruct}

struct In {
  @location(0) normal: vec3f,
  @location(1) kind: f32,
  @location(2) tone: f32,
  @location(3) localMorph: f32,
  @location(4) mapped: f32,
  @location(5) finder: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

@fragment
fn main(input: In) -> @location(0) vec4f {
  let m = clamp(input.localMorph, 0.0, 1.0);
  if (input.mapped < 0.5 && m > 0.985) { discard; }

  let n = normalize(input.normal);
  let sun = normalize(vec3f(-0.48, 0.83, -0.42));
  let faceLight = 0.42 + max(dot(n, sun), 0.0) * 0.48 + max(n.y, 0.0) * 0.18;

  var base = vec3f(0.79, 0.31, 0.48);
  var accent = vec3f(1.0, 0.61, 0.73);
  if (u.season > 0.5 && u.season < 1.5) {
    base = vec3f(0.16, 0.42, 0.18);
    accent = vec3f(0.42, 0.66, 0.30);
  } else if (u.season > 1.5) {
    base = vec3f(0.78, 0.31, 0.075);
    accent = vec3f(1.0, 0.62, 0.12);
  }

  if (input.kind > 0.5 && u.season < 0.5) {
    base = vec3f(0.94, 0.47, 0.62);
    accent = vec3f(1.0, 0.72, 0.80);
  }

  let variation = mix(base, accent, 0.18 + input.tone * 0.72) * faceLight;
  let qrDark = mix(vec3f(0.035, 0.037, 0.032), vec3f(0.012, 0.014, 0.012), input.finder * 0.28);
  let color = mix(variation, qrDark, smoothstep(0.34, 0.94, m));
  let alpha = select(1.0 - smoothstep(0.72, 1.0, m), 1.0, input.mapped > 0.5);
  if (alpha < 0.01) { discard; }
  return vec4f(color, alpha);
}
`;
