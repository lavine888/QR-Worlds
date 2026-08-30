# QR Worlds V3 visual audit

This audit defines the rewrite boundary for the V3 visual system. It compares
the public V2 deployment at `https://qr-worlds.vercel.app/` with source commit
`7c92864` on `main`. The `v3-visual-rewrite` branch also inherited an
uncommitted square-canopy experiment; that experiment is treated as an
intermediate study, not as the V3 architecture.

## Executive finding

V2 is functionally credible but visually communicates the wrong relationship:
it reads as a QR board with a small decorative object placed on top. The desired
experience is the inverse: a self-sufficient living artwork should be the first
read, and its botanical matter should later reveal that it was carrying a real
QR matrix all along.

The problem cannot be fixed by adding more flowers or polishing colors. The QR
surface currently controls the composition, generator, camera, and silhouette.
V3 must decouple the garden artwork from the matrix while preserving a strict,
deterministic mapping back to every dark QR module.

## Evidence and current-demo problems

The public build was checked at 1440 × 900 and 390 × 844. The following issues
are visible in both layouts and are confirmed by the V2 source.

### 1. The QR is exposed before the reveal

- `QRTerrain` creates one tile for every light and dark matrix cell in Garden
  mode. Even with low color contrast, their square spacing exposes the entire
  QR plane.
- The board, perimeter planting, and isometric camera make the matrix boundary
  the strongest silhouette in the composition.
- At 1440 × 900, the pale diamond-shaped board occupies most of the artwork
  while the bloom is a small cluster near the center. At 390 × 844, the board
  still dominates and is cropped more aggressively.

Garden mode must not show a full module grid, finder-pattern silhouette, square
quiet-zone board, or planted perimeter that traces the QR bounds.

### 2. The generator grows from QR samples, not as a coherent tree

- `generateQRGrowthData` iterates dark modules and places many independent
  stems or blocks.
- Branches start at unrelated QR roots instead of sharing a biological
  hierarchy.
- There is no trunk → primary branch → secondary branch → terminal-cluster
  contract, so the eye cannot follow weight, taper, or growth direction.
- Matrix size leaks into crown radius, tree height, and object count. A denser
  payload therefore changes art direction rather than only the hidden mapping.

The inherited branch experiment improves centralization but still packs the
canopy with boxes and derives its scale from `matrix.size`. It does not resolve
the architectural problem.

### 3. Botanical geometry reads as voxels

- V2 uses `boxGeometry` for stems, branches, leaves, blossoms, bloom tiles,
  grass, and flowers.
- Identical square profiles and regular spacing make the canopy read as a
  particle cube or Minecraft-like pile, not a premium generative tree.
- The QR-compatible square is visible too early because the same primitive is
  expected to be both a flower and a module.

V3 needs curved/tapered woody geometry, asymmetric pointed leaves, layered
petal geometry, clustered density, and restrained per-instance variation.
Square module proportions should emerge only near the scan endpoint.

### 4. The morph is movement between layouts, not a visual revelation

- One shared progress value exists, which is a sound foundation.
- A complete independent QR terrain is already present throughout the
  transition, so the eye watches decoration leave while the board remains.
- Details and particles historically used near-end visibility switches; the
  inherited experiment softens some switches but still leaves the board.
- Branches collapse toward arbitrary dark-cell anchors instead of contributing
  to a planned depth-to-plane sequence.
- Finder patterns have no timing priority, so QR identity has no intentional
  visual rhythm.

The rewrite must use one continuous progress and one scene graph: canopy matter
travels to QR targets, rotates from organic orientation to the scan plane,
compresses in depth, converges in color, and establishes finder patterns early.
No Tree/QRCode display swap is acceptable.

### 5. Camera framing follows the QR, not the artwork

- `CameraRig` calculates Garden framing from `worldSize`, the padded matrix
  size, so the tree becomes proportionally smaller as QR versions grow.
- The isometric view spends most of the frame showing an empty tiled board.
- The target and zoom are not based on tree bounds, canopy width, or viewport
  aspect.

V3 Garden framing uses fixed art-space bounds and responsive composition:
roughly 45–65% of the artwork width and 55–75% of its height, with a calm
three-quarter view. Scan framing alone uses matrix-space bounds.

### 6. Lighting and atmosphere flatten the focal object

- High ambient contribution, pale ground tiles, thousands of edge details, and
  low-contrast materials distribute attention across the entire board.
- The canopy lacks readable branch occlusion, interior shadow, rim separation,
  and a grounded contact shadow.
- Particles fill matrix-sized space rather than supporting the tree silhouette.

V3 uses a warm key, cool soft fill, restrained ambient, soft contact shadow,
subtle crown-local particles, and a quiet background gradient. Motion remains
nearly still until interaction.

### 7. The interface explains the surprise before it happens

Persistent UI currently includes mode labels, matrix dimensions, error
correction and quiet-zone pills, duplicated scene-toggle affordances, and a
dashboard-style control dock with equal visual weight for every utility.

V3 removes persistent mode and matrix metadata, keeps the artwork as the main
interaction surface, introduces “Every link hides a little world.” and “Turn
any link into a living, scannable world.”, and shows “Tap the world” only after
two seconds on a user's first visit. The hint disappears permanently after the
first interaction.

## UI deletions and reductions

The following V2 presentation is removed rather than restyled:

- the mode pill over the artwork;
- the module-count / EC / quiet-zone overlay;
- the bordered QR-board frame and perimeter grass fence;
- the permanent Scan/Garden dashboard button when the artwork already performs
  the same action;
- technical privacy copy in the primary hierarchy;
- heavy card-within-card styling and excessive control labels.

QR status, download, sharing, palette, season, and randomization remain in a
compact utility rail below the artwork. Reliability information stays
accessible but does not compete with the artwork.

## Functional features preserved

V3 is a visual-system rewrite, not a product reset. It preserves:

- real byte-mode QR generation at error-correction level H;
- an explicit quiet zone of at least four modules;
- hidden in-browser ZXing verification and quiet-zone recovery;
- the last valid matrix after an oversized or invalid payload;
- crisp 1024 × 1024 QR PNG and SVG exports and Garden PNG export;
- Spring, Summer, Autumn, Winter and all six palettes;
- deterministic seeds, Randomize, and share URLs containing `data`, `season`,
  `palette`, and `seed`;
- keyboard activation, reduced-motion handling, responsive layouts, WebGL
  compatibility, and client-only processing.

## V3 architecture

```text
QR content
  └─ QRMatrix (H + quiet zone + validation)
       ├─ matrix-space targets
       │    └─ morphMapper
       │         ├─ one botanical carrier for every dark module
       │         ├─ finder-pattern priority groups
       │         └─ deterministic delay / target / rotation / scale
       └─ content + worldSeed
            └─ treeGenerator
                 ├─ curved trunk spline
                 ├─ 8–14 primary branches
                 ├─ 2–5 secondary branches per primary
                 └─ 12–28 terminal canopy clusters
                      └─ botanicalGenerator
                           ├─ 1,500–3,000 instanced pointed leaves
                           ├─ layered five-petal blossoms
                           └─ QR carrier assignment

one transition progress (0 Garden → 1 QR)
  ├─ CameraRig: three-quarter artwork framing → top-down framing
  ├─ LivingTree: depth scatter → planar assembly
  ├─ BranchLayer: taper, retract, and hand mass to carriers
  ├─ Ground: organic contact patch → clean quiet-zone plane
  ├─ Atmosphere: continuous opacity/scale reduction
  └─ Materials: botanical palette → high-contrast scan palette
```

### Source boundaries

- `treeGenerator.ts` owns deterministic biological structure and art-space
  bounds. It does not know QR coordinates.
- `botanicalGenerator.ts` owns canopy sampling and leaf/flower attributes. It
  does not own animation state.
- `morphMapper.ts` owns deterministic assignment from botanical carriers to
  dark modules, including finder priority and scan transforms.
- Scene components own shared geometry/material instances and consume the same
  progress; they do not create independent transition clocks.
- QR encoding, validation, exports, URL state, and controls remain independent
  of Three.js.

### Transition phases

The reversible interaction lasts 1,200–1,800 ms:

1. **Settle (0–18%)** — idle motion damps, camera begins to rise, and clusters
   tighten without revealing a square board.
2. **Gather (12–62%)** — leaves and flowers follow staggered curved paths while
   depth compresses and organic rotations align.
3. **Recognize (48–82%)** — finder regions resolve before general data modules.
4. **Lock (72–100%)** — every dark target is occupied, contrast reaches the scan
   palette, the light plane and quiet zone resolve, and the camera reaches a
   square top-down projection.

Reverse playback makes the QR visibly bloom back into the same tree.

## Acceptance criteria

- Garden mode reads as a flowering tree before a QR at desktop and mobile; no
  full QR plane or finder pattern is visible at rest.
- The tree has one readable trunk, hierarchical tapered branches, clustered
  mass, non-box leaves, and recognizable blossoms.
- Every dark module has a deterministic botanical carrier at progress 1;
  finder carriers begin locking before ordinary data carriers.
- One progress controls camera, geometry, ground, atmosphere, and color, with
  no display swap or late hard cut.
- The endpoint preserves the full quiet zone and the canonical QR validates for
  representative URLs, short text, Chinese text, and a long in-capacity value.
- The artwork fits 1440 × 900, 390 × 844, and 360 × 800 without clipping its
  tree, QR, controls, or primary actions.
- Production build succeeds without placeholders and browser checks complete
  without uncaught page or console errors.

## Remaining non-code risk

Hidden-canvas decoding validates the canonical export, not every physical
camera/display combination. It cannot prove scan performance under glare, low
brightness, poor focus, or unusual viewing distance. Physical-device scans
remain a release-level manual check.
