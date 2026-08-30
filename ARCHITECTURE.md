# QR Worlds V4 architecture

QR Worlds is a static, client-only Vite application. The browser owns QR generation, validation, deterministic world generation, interaction, URL state, and export.

## Product contract

V4 uses one visual rule:

> the QR matrix is the world.

The 3D scene is not a decorative tree placed over a QR code and it is not a separate artwork that later morphs into one. Every QR module owns a voxel column. The isometric view reads as a tiny world; the orthographic top-down view reads as the original QR.

## Data flow

```text
URL / text
  ↓
generateQRMatrix()      Byte mode + EC H + quiet zone
  ├─ canonical hidden canvas → @zxing/browser verification
  └─ hash(content + seed)
       ↓
     generateVoxelWorld()
       ↓
     VoxelBlock[]
       ├─ light path
       ├─ cherry blossom
       ├─ trunk
       └─ grass
       ↓
     VoxelWorld (InstancedMesh)
       ↓
     CameraRig
       ├─ isometric world
       └─ top-down QR
```

Exports remain independent from WebGL: QR PNG/SVG uses a canonical black/white renderer.

## QR domain

- `generateQR.ts` owns H-level QR encoding and explicit quiet-zone cells.
- `validateQR.ts` verifies a canonical hidden raster with `@zxing/browser`.
- `matrix.ts` owns pixel-perfect QR raster output.
- `downloadQR.ts` owns QR PNG/SVG, world PNG, and clipboard helpers.

These modules do not import Three.js.

## Voxel generation

`voxelWorldGenerator.ts` consumes the complete padded `QRMatrix`.

Every matrix cell receives a base voxel:

- light module → warm ivory path voxel
- dark module near the centre → trunk voxel
- dark module inside the canopy radius → blossom voxel
- dark module outside the canopy radius → grass voxel

Only dark modules receive additional vertical courses. Trunk modules stack upward into the stem; canopy modules stack into a radial dome with seeded raggedness; outer modules get restrained lawn relief.

The important invariant is preserved:

> a light QR module never gets a dark column and a dark QR module never gets a light top face.

That means the top-down view can reconstruct the source matrix without moving thousands of elements to new x/z targets.

## Scene domain

- `VoxelWorld.tsx` renders four instanced cube groups using one `BoxGeometry` grammar.
- `CameraRig.tsx` owns the single reversible progress value and derives camera position, target, up vector, and zoom.
- `WorldCanvas.tsx` wires renderer, lighting, the shared progress ref, the voxel field, and the hidden interaction.
- `VoxelBee.tsx` is a small long-press easter egg built from the same cube grammar.
- `themes.ts` owns the restrained high-contrast palettes.

The previous botanical renderer remains in repository history but is no longer on the active render path.

## Perspective reveal

`progress.current` is clamped to `[0, 1]` and a full transition takes about 0.82 seconds unless reduced motion is requested.

```text
0.0                         1.0
isometric world  ───────→  top-down QR
```

The reveal is driven primarily by orientation, not by a particle-style rebuild:

- camera moves from isometric to vertical;
- the up vector rotates into the scan orientation;
- orthographic zoom changes from world framing to QR framing;
- inter-cube gaps close slightly;
- voxel colors converge from the world palette to black/white;
- the light modules stop receiving scene shadows and gain emissive lift near the scan endpoint.

This creates the intended feeling that the QR was present the entire time.

## Color grammar

Default Sakura intentionally uses a compact four-color family:

- near-white background
- warm cream light modules
- deep cherry blossom
- bark brown
- dark grass green

Lighting supplies face variation. The geometry itself stays uniform.

At the scan endpoint, all dark materials converge toward `#111111` and light modules converge toward white. This protects readability from theme choices.

## Interaction

Primary interaction:

- click/tap/Enter/Space → toggle world ↔ QR

Secondary controls:

- URL input remains visible
- seasons, palettes, downloads, copy, and randomize live behind a single `•••` menu

Hidden interaction:

- long press the world → a small voxel bee flies in and circles the canopy

The hidden interaction deliberately has no persistent UI label.

## Determinism

World variation derives from:

```text
hash(content + ':' + worldSeed + ':voxel')
```

The generator consumes only `seededRandom`; the same content + seed recreates the same voxel relief.

## Performance

- Four scene categories use `InstancedMesh`.
- One shared box geometry language keeps geometry cost small.
- Matrix transforms update only while the world/QR progress changes.
- DPR is capped at 1.75.
- The easter egg contains only a handful of cube meshes.
- WebGL is the required deployment path; WebGPU is not required.

## QR correctness

`QRMatrix.cells` includes the full quiet zone. At progress 1:

- the camera is orthographic and top-down;
- light columns fill their complete module footprint;
- dark columns fill their complete module footprint;
- dark materials converge to a shared near-black;
- light modules converge to white and ignore cast shadows;
- the complete quiet zone remains light.

The canonical PNG/SVG export remains the authority for downloadable QR correctness.

## Deployment

```bash
npm install
npm run build
```

Vite emits static assets to `dist/`. No server, account, API key, database, or environment variable is required.
