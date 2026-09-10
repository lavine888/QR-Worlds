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

const projection = /* wgsl */ `
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
`;

export const glowVertexShader = /* wgsl */ `
${uniformsStruct}
${projection}

struct Out {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) brightness: f32,
  @location(2) phase: f32,
  @location(3) flare: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> particles: array<vec4f>;

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
  let base = particles[index * 2u];
  let motion = particles[index * 2u + 1u];

  let orbitRadius = motion.x;
  let speed = motion.y;
  let phase = motion.z;
  let brightness = motion.w;
  let angle = phase + u.time * speed;
  let p = clamp(u.progress, 0.0, 1.0);

  var center = base.xyz;
  center.x += cos(angle) * orbitRadius;
  center.z += sin(angle) * orbitRadius;
  center.y += sin(u.time * 0.72 + phase) * orbitRadius * 0.34;

  let scatter = smoothstep(0.08, 0.46, p);
  center.x += cos(phase * 1.37) * scatter * u.groundSpan * 0.075;
  center.z += sin(phase * 1.13) * scatter * u.groundSpan * 0.075;
  center.y += scatter * u.groundSpan * 0.028;

  let clipCenter = projectWorld(center, u);
  let pulse = 0.83 + 0.17 * sin(u.time * 1.08 + phase);
  let flare = exp(-pow((p - 0.12) / 0.075, 2.0));
  let reveal = 1.0 - smoothstep(0.08, 0.50, p);
  let screenSize = base.w * mix(1.0, 1.18, flare) * reveal;
  let sx = screenSize / max(u.aspect, 1.0);
  let sy = screenSize / max(1.0 / u.aspect, 1.0);

  var out: Out;
  out.position = clipCenter + vec4f((uv.x - 0.5) * sx, (uv.y - 0.5) * sy, 0.0, 0.0);
  out.uv = uv;
  out.brightness = brightness * pulse * reveal;
  out.phase = phase;
  out.flare = flare;
  return out;
}
`;

export const glowFragmentShader = /* wgsl */ `
${uniformsStruct}

struct In {
  @location(0) uv: vec2f,
  @location(1) brightness: f32,
  @location(2) phase: f32,
  @location(3) flare: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

@fragment
fn main(input: In) -> @location(0) vec4f {
  let q = input.uv * 2.0 - vec2f(1.0);
  let d2 = dot(q, q);
  if (d2 > 1.0) { discard; }

  let core = exp(-d2 * 6.8);
  let halo = exp(-d2 * 2.15) * 0.24;
  let sparkle = pow(max(core, 0.0), 2.2) * (0.08 + input.flare * 0.10);
  let alpha = (core * 0.28 + halo * 0.17 + sparkle) * input.brightness;
  if (alpha < 0.004) { discard; }

  var warm = vec3f(1.0, 0.94, 0.86);
  var accent = vec3f(1.0, 0.73, 0.80);
  if (u.season > 0.5 && u.season < 1.5) {
    warm = vec3f(0.94, 1.0, 0.86);
    accent = vec3f(0.69, 0.91, 0.56);
  }
  if (u.season > 1.5) {
    warm = vec3f(1.0, 0.91, 0.72);
    accent = vec3f(1.0, 0.62, 0.25);
  }

  let variation = 0.10 + 0.08 * sin(input.phase * 2.7);
  let color = mix(warm, accent, variation + input.flare * 0.05);
  return vec4f(color, alpha);
}
`;
