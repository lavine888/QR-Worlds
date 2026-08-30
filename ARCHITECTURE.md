# QR Worlds architecture

QR Worlds is a static, client-only Vite application. The browser is the only
runtime authority for user content, QR generation, seed derivation, scene
generation, validation, and export. No URL or text is sent to an API.

## Task contract

### Outcome

- An independently implemented QR-to-diorama web app that runs with
  `npm install`, `npm run dev`, and `npm run build`.
- A click/tap morphs the same rendered scene between a deterministic garden
  and a square, high-contrast QR scan view.

### Authority

- Source of truth: this QR Worlds repository. During this task it is checked
  out locally as `.tmp-qr-worlds-reference` because the active parent workspace
  is a different `lavine-site` repository.
- Inputs read: the target repository at `85de99c`, the product requirements,
  and the public reference analysis in `REFERENCE_ANALYSIS.md`.

### Scope

- In scope: real H-level QR matrices, quiet zones, deterministic procedural
  garden generation, one shared transition progress, seasons, palettes,
  instanced details, lightweight particles/wind, QR verification, PNG/SVG
  export, shareable state, responsive UI, and static deployment configuration.
- Out of scope: accounts, analytics, server-side content storage, dynamic QR
  redirects, payments, uploaded assets, and a database.
- Allowed writes: `src/`, `index.html`, `package.json`, lockfile, and project
  documentation in this repository.
- Forbidden changes: the parent `lavine-site` source, its untracked user files,
  and any remote GitHub state.

### Acceptance criteria

- [ ] `npm run build` exits successfully from the QR Worlds repository.
- [ ] The generated matrix contains an explicit quiet zone and reports H error
      correction; QR export is 1024 × 1024.
- [ ] The hidden canvas validation reports `QR verified` for representative
      URLs, plain text, and Unicode where the decoder is available; failure is
      surfaced as a reliability warning rather than hidden.
- [ ] The garden and scan views use the same scene graph and a single progress
      value for camera, tiles, QR-rooted bloom, details, particles, and
      contrast.
- [ ] A browser check can edit content, switch season/palette, toggle scan
      mode, and invoke share/download actions without console errors.

### Evidence required

- Static: source tree, documentation, imports, and QR/export helpers.
- Build/test: `npm run build` and focused pure-function checks where available.
- Browser/UI: dev server, visible scene, input update, mode transition, status
  badge, and action feedback.
- Human/production: not claimed locally; a maintainer still needs to test
  physical camera scans and deploy the static `dist/` output.

### Risks and controls

- QR visual decoration can reduce scan reliability. Controls: H correction,
  four-module quiet zone (expanded on failed verification), clean hidden-canvas
  validation, high-contrast scan progress, and a plain QR PNG export.
- Long text can exceed QR capacity. Control: retain the last valid scene and
  show an actionable error instead of producing an invalid matrix.
- Mobile GPU cost can grow with instance counts. Controls: shared low-poly
  geometry, capped device-aware budgets, DPR capped at 2, and no React state
  updates inside the frame loop.
- WebGPU availability and Three.js material compatibility vary by browser.
  Control: WebGL remains the safe renderer path; WebGPU is optional and must
  never be required to open the product.

### Pause conditions

- The target repository authority changes or a requested push/remote mutation
  is explicitly required.
- An external dependency cannot be installed or its API is incompatible with
  the locked toolchain.
- Physical scan acceptance is requested but no device/camera is available.

## Data flow

```text
URL / text
  ├─ debounce 300 ms
  ├─ QR generator (Byte + H)
  │    └─ boolean matrix + 4/6-module quiet zone
  ├─ hidden canvas renderer -> @zxing/browser -> verification status
  ├─ hash(content + worldSeed) -> seeded random stream
  │    └─ dark QR modules -> square bloom tiles / stems / branches / leaves
  │         + perimeter grass / seasonal particles
  └─ URL state serializer -> share link

matrix + season + palette + seed
  └─ WorldCanvas
       ├─ Orthographic camera + CameraRig
       ├─ QRTerrain (dark/light InstancedMesh)
       ├─ ProceduralBloom (QR-rooted square bloom canopy + stems)
       ├─ GroundDetails (grass/flowers)
       └─ Particles (seasonal Points)
```

## Unified transition contract

`progress` is the only visual transition clock:

- `0`: Garden mode, isometric camera, raised tiles, square bloom canopy and
  details visible, wind and seasonal particles active;
- `1`: Scan mode, top-down orthographic camera, tiles nearly coplanar,
  black/white contrast, bloom tiles settled onto their QR coordinates and
  peripheral details/particles faded out.

The camera rig eases the target into a mutable progress ref. Every scene
consumer reads the same ref in `useFrame`; no consumer owns a second mode
animation. Values are interpolated from the same eased progress: camera
position/up/zoom, tile spacing/height, bloom positions/scales, detail
visibility, particle opacity, shadow strength, and QR colors.

The growth source is the QR matrix itself: generateQRGrowthData iterates the
dark modules, gives each sampled module a square bloom tile anchored at its
exact QR coordinate, and animates that tile into a seeded central canopy.
Selected anchors also grow restrained stems and branches. The central canopy
is only the Garden-mode destination; it is never an independent object that
replaces the QR matrix.

## Renderer policy

The default path is React Three Fiber with an orthographic Three.js camera and
WebGL-compatible materials. This is intentional: it gives a reliable fallback
on browsers without WebGPU and supports the lightweight wind/material path.
The architecture does not make WebGPU a prerequisite. If a future renderer
adapter is enabled, it must preserve the same scene contract and fall back to
WebGL on adapter failure; it must also use Three.js node-compatible materials
because custom `ShaderMaterial` / `onBeforeCompile` paths are not universally
compatible with `WebGPURenderer`.

## QR correctness contract

`QRMatrix.cells` includes only the symbol plus its explicit light quiet zone.
The scene may use raised geometry and color variation in Garden mode, but the
scan endpoint is always a square orthographic projection with no decorative
objects over the modules. Export uses a separate crisp canvas/SVG renderer so
lighting cannot alter the pixels that a scanner reads.

## Determinism contract

`hashString(content + ':' + worldSeed)` produces a 32-bit seed. Every procedural
placement consumes only `seededRandom(seed)`; `Math.random()` is not used for
scene generation. The user-facing Randomize action changes the explicit
`worldSeed`, and the same content + seed pair always regenerates the same
bloom canopy.

## Deployment

Vite emits `dist/` with relative asset paths (`base: './'`). The same output can
be served by Vercel, Cloudflare Pages, Netlify, or GitHub Pages. No server
environment variables are required.
