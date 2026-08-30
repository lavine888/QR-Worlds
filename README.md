# QR Worlds

> Turn any QR code into a tiny world.

QR Worlds is a client-side generative art experiment that transforms a real QR matrix into a miniature 3D diorama. The same QR modules form the terrain; tap the scene and the camera smoothly moves from an isometric world into a flat, high-contrast scan view.

## V1

- Paste any URL or short text and generate a real QR code with **error correction H**.
- 4-module quiet zone is preserved around the QR matrix.
- QR modules become instanced 3D tiles.
- Deterministic procedural tree: the same input always grows the same tree.
- Smooth **World ↔ Scan** transition driven by one shared progress value.
- Four visual worlds: Sakura, Forest, Autumn, Snow.
- Download a clean, scanner-friendly SVG QR.
- Shareable URL state (`?data=...&theme=...`).
- Everything runs locally in the browser; input is not sent to a server.
- Responsive desktop/mobile layout.

## Stack

- React + TypeScript + Vite
- Three.js + React Three Fiber
- `qrcode-generator`
- Instanced meshes for QR modules, leaves, blossoms, and ground details

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

## Architecture

```text
src/
├── components/
│   ├── ControlDock.tsx
│   └── ThemePicker.tsx
├── procedural/
│   ├── hash.ts
│   └── random.ts
├── qr/
│   ├── downloadQR.ts
│   └── generateQR.ts
├── scene/
│   ├── CameraRig.tsx
│   ├── GroundDetails.tsx
│   ├── ProceduralTree.tsx
│   ├── QRTerrain.tsx
│   ├── WorldCanvas.tsx
│   └── themes.ts
├── App.tsx
├── main.tsx
└── styles.css
```

### One progress value, one transformation

V1 intentionally avoids switching between an unrelated 3D scene and a separate QR UI. A shared transition progress controls camera position, camera up-vector, zoom, tile height, tile spacing, tile contrast, tree scale, and decorative ground details. This keeps the reveal feeling like one physical object changing state.

### Deterministic world generation

The input text is hashed into a seed. A seeded pseudo-random generator uses that seed to place branches, leaves, blossoms, and surrounding plants, so a shared link recreates the same tiny world.

## Deploy

The project is static and works on Vercel, Cloudflare Pages, Netlify, and GitHub Pages.

- Build command: `npm run build`
- Output directory: `dist`

## V1 scope / next steps

Planned directions for V2:

- Automatic in-browser QR decode verification
- PNG export for the 3D world
- Shader-driven wind and seasonal particles
- More world archetypes (island, castle, cyber city, mushroom, Minecraft-inspired voxel world)
- Better long-text capacity feedback
- Accessibility and reduced-motion scan transition

## Credits

The broader idea of transforming a QR code into a living generative scene has appeared in multiple creative coding experiments. QR Worlds' code and web implementation are independently written for this repository.

## License

MIT
