# Reference analysis: `enzomanuelmangano/demos`

This document records the implementation ideas that informed QR Worlds. The
reference was inspected at commit `68c8cde` on the `main` branch, especially
[`src/animations/cherry-blossom-qrcode/`](https://github.com/enzomanuelmangano/demos/tree/main/src/animations/cherry-blossom-qrcode).

## 1. Core technology

The reference is not a browser/Three.js project. It is an Expo / React Native
animation demo built from React Native, Reanimated, Gesture Handler-related
components, `react-native-webgpu`, and the project's `react-native-pulsar`
utilities. The screen owns a QR content state, a canvas ref, and a mutable
`isFlat` ref. A press toggles the flat state; a long press starts a separate
creeper detonation sequence.

The important transferable idea is the data path, not the platform code:

```text
QR content -> boolean module matrix -> typed voxel buffers -> one GPU render loop
```

## 2. QR matrix generation

`utils/qr-matrix.ts` calls `QRCode.create(content, { errorCorrectionLevel: 'M' })`
from the `qrcode` package and copies `modules.get(x, y)` into a
`boolean[][]`. Empty or invalid input falls back to the demo's default URL.
The matrix returned by this helper is the QR symbol itself; the reference
does not add a separate quiet-zone ring in this function.

There is a meaningful difference between the reference and this product's
contract: QR Worlds uses `qrcode-generator` in byte mode with error correction
level **H**, then explicitly adds a four-module quiet zone. The reference
source currently says `M`, even though nearby comments discuss scanability.

## 3. WebGPU rendering pipeline

`hooks/use-web-gpu.ts` obtains a WebGPU canvas context, requests an adapter and
device, configures the preferred canvas format, and creates storage buffers for
block types, packed positions, resistance, and base Y values. A shared uniform
buffer is bound to several pipelines:

- sky fullscreen triangle;
- soft shadow quad;
- block triangle-list (`36 * blockCount` vertices, six faces per cube);
- dust fullscreen triangle for the detonation effect.

The render pass clears the color/depth attachments, draws the sky and shadow,
draws the buffered block geometry, optionally draws dust, and submits one
command buffer. Block geometry is therefore GPU-expanded from storage buffers;
the reference does not use `THREE.InstancedMesh` because it is not a Three.js
application.

## 4. Camera / flat transition

The reference does not move a conventional Three.js camera. Instead, the block
vertex shader interpolates an isometric rotation (`ISO_ANGLE_X/Y`) to a flat
rotation (`FLAT_ANGLE_X/Y`) and interpolates the view scale and 2D offsets.
The CPU render loop moves one raw progress value toward `0` or `1` with a
delta-time-aware exponential step, then applies cubic easing before writing
the uniform. This keeps the QR, tree, debris, shadow, and camera-like
projection on one timeline.

## 5. Tree / voxel generation

`utils/block-generator.ts` creates four passes over the QR matrix:

1. one ground block per module;
2. stacked trunk blocks around the center;
3. a dome-shaped canopy with position-based pseudo-random extra blocks;
4. an optional creeper model appended to the same buffers.

Dark modules are classified into trunk, cherry blossom, fallen petals, or
grass depending on distance from the center. Light modules become dirt/path.
This is a voxel classification strategy rather than a general-purpose tree
generator. Its organic variation is a sine-based function of column, row, and
layer. The reference block generator is not seeded from the full input string;
QR shape and grid coordinates are the main source of variation.

## 6. Instancing and memory strategy

The reference's equivalent of instancing is a single draw call over a fixed
vertex pattern, with per-block data read from storage buffers using
`@builtin(vertex_index)`. The vertex shader hides unused blocks, calculates
cube faces, and performs debris ballistics without mutating the block buffers.

QR Worlds uses the web-friendly Three.js equivalent: shared low-vertex morph
geometry and `InstancedMesh` for branch segments, leaves, blossoms, blossom
centers, and seasonal particles. Every dark target receives a botanical
carrier, while React stays out of the per-object update loop.

## 7. Shaders

`shaders/helpers.ts` provides WGSL hash functions, axis rotations, Rodrigues
rotation, and easing. `blocks-vertex.ts` handles cube expansion, flat/isometric
projection, creeper rigging, blast trajectories, per-block hiding, and rebuild
staggering. `blocks-fragment.ts` supplies material colors, face lighting,
per-block variation, canopy shadowing, and the creeper face mask. `sky.ts`,
`shadow.ts`, and `dust.ts` are separate small passes.

The shader design worth reusing is the principle that animation parameters are
uniforms and geometry data is stable. QR Worlds keeps the same principle for
its shared transition progress and uses light-weight renderer-side materials
plus bounded instance buffers for the web fallback path.

## 8. Ideas worth borrowing

- Treat the QR matrix as the authoritative spatial data source.
- Keep one continuous progress value for the world-to-scan reveal.
- Use deterministic data generation so a shared input recreates a scene.
- Keep per-element variation in compact buffers / instances instead of React
  state or thousands of component nodes.
- Separate background, shadow, geometry, and atmospheric effects.
- Design the flat state as a real scan surface, not a second unrelated UI.

## 9. What QR Worlds reimplements differently

- Independent browser implementation in Vite + React + TypeScript + Three.js;
- MIT-licensed project code with no copied source from the reference;
- actual H-level QR generation, explicit quiet-zone preservation, and hidden
  canvas decoding with `@zxing/browser`;
- a QR-independent hierarchical tree generator plus a separate deterministic
  botanical-to-module mapping;
- pointed leaf and five-petal geometry whose silhouette continuously changes into
  square scan modules instead of a persistent tiled board;
- deterministic tree seed derived from the input plus an explicit tree variant;
- separate Spring / Summer / Autumn / Winter seasons and six named palettes;
- QR-safe black/white scan mode and 1024px PNG export;
- Garden PNG export from the preserved Three.js drawing buffer;
- responsive controls, shareable URL state, reduced-motion behavior, and a
  WebGL path that remains available when WebGPU is missing or unsuitable.

## License boundary

The reference repository's [`LICENSE.md`](https://github.com/enzomanuelmangano/demos/blob/main/LICENSE.md)
is a custom software license that permits use in applications but restricts
redistribution and competing animation libraries. QR Worlds therefore uses
the reference only as a public design/implementation study and contains an
independent implementation. The target QR Worlds repository is MIT-licensed.
