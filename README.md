# QR Worlds

> Turn any QR code into a tiny, living garden.

QR Worlds is a client-only generative art experiment. It turns a real,
error-corrected QR matrix into a small 3D diorama, then morphs that same
surface into a clean scan view. Type a URL or text, choose a season and
palette, and tap the scene to move between the garden and the QR.

## Included

- Real QR generation in byte mode with error correction level H.
- An explicit four-module quiet zone, with automatic recovery up to eight
  modules when hidden validation needs more room.
- Hidden-canvas validation through @zxing/browser; the interface reports
  verified, recovering, or unavailable instead of silently claiming success.
- One shared transition progress for the orthographic camera, tile height and
  spacing, contrast, QR-rooted square bloom, grass, wind, and seasonal
  particles.
- Deterministic growth rooted in the QR's dark modules. Each selected dark
  module becomes a square flower tile that rises into a central bloom canopy;
  selected roots also grow restrained stems and foliage. A shareable world
  seed controls the variation.
- Spring, Summer, Autumn, and Winter controls.
- Pink, Green, Gold, Blue, White, and Lavender palettes.
- Instanced QR modules, square bloom tiles, branches, leaves, blossoms, grass,
  and flowers, plus a bounded point-particle layer.
- A crisp 1024 x 1024 QR PNG, SVG export, and a Garden PNG from the WebGL
  drawing buffer.
- Share links containing data, season, palette, and seed.
- Responsive controls, keyboard-accessible scene toggling, and a WebGL path
  that does not require WebGPU.

The QR PNG and the scan endpoint are intentionally plain black-and-white. The
decorative garden is allowed to be expressive; the export remains scanner
friendly.

## Stack

- React 19 + TypeScript + Vite
- Three.js + React Three Fiber
- qrcode-generator
- @zxing/browser

## Run locally

~~~bash
npm install
npm run dev
~~~

Production build:

~~~bash
npm run build
npm run preview
~~~

The Vite output directory is dist/.

## Deploy

QR Worlds is a static site and can be deployed to Vercel, Cloudflare Pages,
Netlify, or GitHub Pages.

- Build command: npm run build
- Output directory: dist
- Required environment variables: none

The Vercel project dashboard supplied for the current deployment is
[lavine/qr-worlds](https://vercel.com/lavine/qr-worlds). The public deployment
hostname is environment-specific, so this repository does not hard-code an
unverified URL.

## Architecture

~~~text
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
│   ├── hash.ts
│   ├── random.ts
│   └── worldGenerator.ts
├── qr/
│   ├── downloadQR.ts
│   ├── generateQR.ts
│   ├── matrix.ts
│   └── validateQR.ts
├── scene/
│   ├── CameraRig.tsx
│   ├── GroundDetails.tsx
│   ├── Particles.tsx
│   ├── ProceduralBloom.tsx
│   ├── QRTerrain.tsx
│   ├── WorldCanvas.tsx
│   ├── themes.ts
│   └── wind.ts
├── App.tsx
├── main.tsx
└── styles.css
~~~

ARCHITECTURE.md defines the data flow, renderer policy, transition contract,
determinism boundary, and deployment assumptions. REFERENCE_ANALYSIS.md
records the public creative-coding reference that informed the interaction
model and the independent implementation boundary.

## Privacy and limitations

All content stays in the browser. QR generation, validation, scene generation,
sharing, and export do not call an application server. A very long payload can
exceed the H-level QR capacity; in that case the last usable QR remains visible
and the input receives an actionable error.

Physical-camera scan quality still depends on the device, display brightness,
focus, and viewing distance. The hidden decoder verifies the plain QR export;
it cannot replace acceptance testing with the camera hardware that will be
used in production.

## License

MIT
