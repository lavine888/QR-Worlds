# QR Worlds

**A QR code that grows into a tiny voxel world.**

[Try the live demo →](https://qr-worlds.vercel.app/)

```text
isometric world  →  tap  →  top-down QR
```

The trick is simple: the world is not decoration placed on top of a QR code. The QR matrix *is* the world. Dark modules become cherry-blossom canopy, trunk, or grass; light modules become a warm path. Change the camera angle and the same cube field reveals the original code.

## One QR. Two perspectives.

**World view**

A deterministic voxel sculpture generated directly from the QR matrix. One primitive, one grid, one visual rule.

**Scan view**

The camera moves to a clean orthographic top-down view while the module colors converge to black and white for maximum contrast.

## V4 — Voxel Native

- QR-native voxel generation instead of a separate botanical scene + morph target.
- One cube geometry language for ground, grass, trunk, and blossom canopy.
- Fast perspective reveal rather than a long particle-style morph.
- Cream / cherry / bark / grass default palette with restrained block shading.
- Minimal scene-first UI; URL input is the only primary control.
- Seasons, palettes, download, share, and randomize stay available behind the `•••` menu.
- Real QR generation with error correction level H and a four-module quiet zone.
- Browser-side QR verification with `@zxing/browser`.
- PNG/SVG QR export, garden PNG export, and shareable URL state.
- Deterministic worlds from content + seed.
- Client-only: no account, backend, upload, analytics, or database.
- A small hidden interaction for people who poke around.

## Why voxel-native?

Earlier versions built a detailed procedural flowering tree and then mapped thousands of leaves and flowers back into QR targets. It worked, but the world and the code felt like two different systems.

V4 reverses that decision. Each QR module owns a voxel column. The 3D sculpture and the scannable code are two views of the same data, which makes the reveal feel less like an animation trick and more like discovering what was already there.

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

## Core architecture

```text
QR input
  ↓
generateQRMatrix()
  ↓
generateVoxelWorld()
  ↓
Instanced cube field
  ↓
CameraRig
  ├─ isometric world
  └─ orthographic QR
```

Key files:

```text
src/
├── procedural/
│   └── voxelWorldGenerator.ts
├── qr/
│   ├── generateQR.ts
│   ├── validateQR.ts
│   └── downloadQR.ts
├── scene/
│   ├── CameraRig.tsx
│   ├── VoxelWorld.tsx
│   ├── VoxelBee.tsx
│   ├── WorldCanvas.tsx
│   └── themes.ts
├── components/
│   └── ControlDock.tsx
└── App.tsx
```

## QR reliability

Exports use a separate crisp renderer, so 3D lighting never affects downloaded QR pixels. The interactive top-down view also converges to high-contrast black/white modules and keeps the full quiet zone. Physical scanning can still vary with camera focus, glare, display brightness, and viewing distance.

## License

MIT
