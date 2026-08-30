# QR Worlds

> Turn any link into a living, scannable world.

QR Worlds is a client-only generative artwork that hides a real QR code inside
a flowering 3D tree. The first frame is a garden, not a decorated QR board.
Tap the world and the same leaves and blossoms gather into a clean, scannable
matrix; tap again and the code blooms back into the same deterministic tree.

[Open the live demo](https://qr-worlds.vercel.app/)

## Garden → Morph → QR

### Garden

One curved trunk grows into primary and secondary branches. Thousands of
pointed leaves and five-petal blossoms form overlapping canopy clusters, with
seasonal color, restrained atmosphere, and a stable art-directed silhouette.
The QR plane, finder patterns, module grid, and quiet-zone boundary are not
rendered in this state.

### Morph

There is no Tree/QRCode visibility swap. One reversible progress value drives
the camera, botanical transforms, branch retraction, ground shape, atmosphere,
geometry profile, and material contrast over 1.55 seconds. Botanical carriers
assigned to the three finder regions settle first; data modules follow. Extra
canopy matter folds toward the tree core instead of exploding off-screen.

### QR

Every dark module is occupied by a mapped botanical carrier whose pointed or
petaled profile has continuously flattened into a square. The ground patch has
become the white scan surface, including the full quiet zone, and the camera is
orthographic and top-down. PNG and SVG exports use a separate crisp renderer so
lighting can never affect exported QR pixels.

## Features

- Real byte-mode QR generation with error correction level H.
- Explicit four-module quiet zone, with automatic recovery up to eight modules
  when in-browser verification needs more room.
- Hidden-canvas verification with `@zxing/browser`; failures are surfaced rather
  than silently treated as success.
- Deterministic tree structure, canopy, and morph mapping from content + seed.
- A hierarchical trunk, 10–13 primary branches, 2–5 secondary branches per
  primary, and 20–26 terminal canopy clusters.
- Typically 2,200 instanced botanical carriers, increasing only when a dense QR
  needs one carrier per dark module.
- Custom leaf and five-petal fan geometries whose silhouettes continuously become square QR
  modules at the scan endpoint.
- Finder-pattern-first morph timing and reversible mid-transition interaction.
- Spring, Summer, Autumn, and Winter seasons.
- Pink, Green, Gold, Blue, White, and Lavender palettes.
- Share links containing content, season, palette, and world seed.
- 1024 × 1024 QR PNG, SVG, and WebGL Garden PNG downloads.
- Responsive desktop/mobile framing, keyboard activation, reduced-motion
  handling, and a WebGL path that does not require WebGPU.
- No accounts, API, upload, analytics, database, or environment variables.

## Stack

- React 19 + TypeScript + Vite
- Three.js + React Three Fiber
- `qrcode-generator`
- `@zxing/browser`

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

Vite writes the static site to `dist/`.

## Architecture

```text
src/
├── components/
│   ├── ControlDock.tsx
│   ├── Controls.tsx
│   ├── PalettePicker.tsx
│   ├── QRInput.tsx
│   └── SeasonPicker.tsx
├── hooks/
│   ├── useQR.ts
│   └── useScene.ts
├── procedural/
│   ├── botanicalGenerator.ts
│   ├── hash.ts
│   ├── morphMapper.ts
│   ├── random.ts
│   └── treeGenerator.ts
├── qr/
│   ├── downloadQR.ts
│   ├── generateQR.ts
│   ├── matrix.ts
│   └── validateQR.ts
├── scene/
│   ├── CameraRig.tsx
│   ├── LivingGround.tsx
│   ├── LivingTree.tsx
│   ├── morphGeometry.ts
│   ├── Particles.tsx
│   ├── themes.ts
│   └── WorldCanvas.tsx
├── App.tsx
├── main.tsx
└── styles.css
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for boundaries, transition phases,
correctness contracts, and performance policy. [V3_VISUAL_AUDIT.md](./V3_VISUAL_AUDIT.md)
records the evidence and decisions behind the visual rewrite.

## Deploy

QR Worlds is a static site suitable for Vercel, Cloudflare Pages, Netlify, or
GitHub Pages.

- Build command: `npm run build`
- Output directory: `dist`
- Required environment variables: none

## Privacy and scan reliability

QR generation, validation, scene generation, sharing, and export all happen in
the browser. Links and text are never sent to an application server. If an input
exceeds the H-level encoder capacity, the last valid world remains visible and
the interface asks for shorter content.

Software decoding validates the canonical QR output. Physical scan quality can
still vary with camera focus, display brightness, glare, and viewing distance.

## License

MIT
