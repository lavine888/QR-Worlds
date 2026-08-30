# QR Worlds V3 architecture

QR Worlds is a static, client-only Vite application. The browser is the only
runtime authority for user content, QR generation, verification, procedural
generation, animation, URL state, and export.

## Product contract

The Garden frame must stand on its own as a premium generative flowering tree.
The QR is a discoverable state of that artwork, not a second layer placed under
or over it. One reversible transition progress is the only visual clock.

Functional reliability remains independent from the artwork: QR encoding,
quiet-zone recovery, canonical validation, and crisp exports do not depend on
Three.js lighting or animation.

## Data flow

```text
URL / text
  ├─ 300 ms input debounce
  ├─ QR generator (Byte + H)
  │    └─ QRMatrix: boolean cells + 4–8 module quiet zone
  ├─ canonical canvas -> @zxing/browser -> verification state
  ├─ hash(content + worldSeed)
  │    ├─ treeGenerator -> branch hierarchy + canopy clusters
  │    ├─ botanicalGenerator -> deterministic leaves / flowers
  │    └─ morphMapper
  │         ├─ botanical carrier ↔ every dark QR module
  │         ├─ finder priority timing
  │         └─ scan transform / arc / stagger metadata
  ├─ scene -> one shared transition progress
  ├─ canonical PNG / SVG renderer
  └─ URL serializer -> data + season + palette + seed
```

## Module boundaries

### QR domain

- `generateQR.ts` owns byte-mode H-level encoding and explicit quiet-zone cells.
- `validateQR.ts` decodes a canonical hidden canvas and reports verified, low,
  or unavailable.
- `matrix.ts` owns pixel-perfect black/white raster output.
- `downloadQR.ts` owns QR PNG/SVG, Garden PNG, and clipboard operations.

These modules do not import React or Three.js.

### Procedural domain

- `treeGenerator.ts` produces one biological hierarchy in fixed art-space:
  trunk segments, primary curves, secondary curves, terminal clusters, and
  stable bounds. It never receives QR coordinates.
- `botanicalGenerator.ts` samples pointed leaves and blossoms inside the canopy
  clusters. It receives only a requested count; matrix topology remains hidden.
- `morphMapper.ts` is the only bridge from botanical art-space to matrix-space.
  It gathers dark targets, detects the three 7 × 7 finder regions, assigns one
  unique carrier to every dark target, and creates deterministic transition
  metadata.

Typical worlds use 2,200 carriers. If a valid dense matrix contains more than
2,200 dark modules, the count rises to the dark-module count and element scale
decreases to preserve the same crown mass. Matrix density therefore does not
change the tree skeleton or camera composition.

### Scene domain

- `LivingTree.tsx` owns instanced branch, leaf, blossom, and blossom-center
  meshes. It consumes generated immutable data and updates matrices directly in
  the frame loop only while progress changes.
- `morphGeometry.ts` creates low-vertex fan meshes whose botanical perimeter and
  square scan perimeter share topology. Updating a few shared vertices changes
  every instance from leaf/flower to module without swapping meshes.
- `LivingGround.tsx` uses the same topology technique to become an irregular
  root patch in Garden mode and the square white quiet-zone surface in QR mode.
- `Particles.tsx` owns a bounded crown-local atmosphere and continuously fades
  it during transition.
- `CameraRig.tsx` advances the shared progress and derives camera position,
  target, up vector, and orthographic zoom from it.
- `WorldCanvas.tsx` wires renderer, lights, shared progress, and scene layers.

No scene child owns a second timeline or React state update inside `useFrame`.

## Unified transition

`progress.current` is reversible and clamped to `[0, 1]`. A complete trip takes
1.55 seconds unless reduced motion is requested.

### 0.00–0.20 · Settle

- Secondary growth and blossom centers begin folding inward.
- Extra canopy carriers that do not own QR targets collapse toward the tree
  core; they never travel to random matrix cells.
- Camera framing starts to widen before distant finder targets move into place.

### 0.04–0.62 · Recognize

- Carriers mapped to the three finder regions move first.
- Leaf and five-petal perimeter geometry begins becoming square.
- Camera view already contains all three regions, so none assemble off-screen.

### 0.12–0.93 · Assemble

- Data carriers move along restrained curved paths to unique dark targets.
- Organic rotations slerp to the horizontal scan orientation.
- Branch levels retract secondary-first, trunk-last.
- Botanical colors converge to the shared scan dark.

### 0.27–1.00 · Lock

- The root patch expands and changes from an irregular fan to the white square.
- Every mapped carrier reaches module scale and every extra reaches zero scale.
- Camera reaches an exact top-down orthographic view.
- Atmosphere and branch geometry reach zero continuously, without visibility
  switches.

The reverse path uses the same pure mapping, so a QR always blooms back into
the same tree and can reverse cleanly in the middle of a transition.

## Camera contract

Garden framing is based on fixed tree art-space, not `matrix.size`. Payload
length therefore cannot make the tree tiny. Scan framing alone uses padded
matrix size. Orthographic zoom expands earlier than camera rotation so finder
patterns remain in frame during assembly.

Responsive CSS reserves roughly 70vh for desktop artwork and 60vh for mobile.
The camera uses viewport-aware framing values rather than separate scene data.

## QR correctness contract

`QRMatrix.cells` includes the symbol and the complete light quiet zone. At
progress 1:

- one mapped carrier occupies every and only dark cell;
- both leaf and flower fan geometries have become a square with matching
  topology;
- carriers use a slight 1.015 overlap to avoid antialias seams;
- the ground is a white square spanning the padded matrix;
- camera orientation is top-down and orthographic.

The exported PNG/SVG remains the canonical black/white implementation. Hidden
decoding verifies that canonical output rather than claiming that every physical
camera/display setup will succeed.

## Determinism contract

`hashString(content + ':' + worldSeed)` produces the base 32-bit seed. All
procedural stages consume only `seededRandom`; scene generation never uses
`Math.random()`. Content + seed recreates the same trunk, clusters, carriers,
mapping, stagger, and color variation.

## Interaction and URL state

The artwork is the primary toggle and supports click, tap, Enter, and Space.
The first-visit “Tap the world” hint appears after two seconds and stores only a
local acknowledgement flag. Share URLs preserve `data`, `season`, `palette`,
and `seed`, including legacy theme migration.

## Performance policy

- Leaves, flowers, centers, and branch segments use shared geometry with
  `InstancedMesh`.
- Instance matrices and colors update only while progress changes.
- Shared fan geometry contains tens of vertices, so profile morphing is cheap.
- Particles are bounded and device-count aware.
- Device pixel ratio is capped at 1.75.
- Shadow casting is limited to woody geometry and flower centers; thin canopy
  meshes avoid expensive noisy shadows.
- WebGL is the required safe path; WebGPU is not a deployment dependency.

## Error handling

- Oversized content keeps the last valid matrix and displays an actionable
  message.
- Low verification can expand quiet zone from four to six or eight modules.
- Clipboard failure is surfaced near the controls.
- Downloads remain disabled only until the WebGL canvas is available.
- Reduced-motion users snap to the requested endpoint while retaining all
  correctness properties.

## Deployment

`npm run build` runs TypeScript project checks and emits static assets to
`dist/`. No server process or environment variable is required. `base: './'`
keeps the output compatible with Vercel, Cloudflare Pages, Netlify, and GitHub
Pages.
