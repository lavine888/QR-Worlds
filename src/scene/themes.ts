export type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter';
export type PaletteName = 'pink' | 'green' | 'gold' | 'blue' | 'white' | 'lavender';

export type WorldTheme = {
  name: string;
  season: SeasonName;
  palette: PaletteName;
  label: string;
  seasonLabel: string;
  paletteLabel: string;
  accent: string;
  darkTile: string;
  lightTile: string;
  trunk: string;
  leaf: string;
  blossom: string;
  flower: string;
  ground: string;
  sky: string;
  particle: string;
  particleKind: 'petal' | 'pollen' | 'leaf' | 'snow';
};

export const seasons: Array<{ name: SeasonName; label: string; glyph: string }> = [
  { name: 'spring', label: 'Spring', glyph: '✿' },
  { name: 'summer', label: 'Summer', glyph: '☀' },
  { name: 'autumn', label: 'Autumn', glyph: '◒' },
  { name: 'winter', label: 'Winter', glyph: '✧' },
];

export const palettes: Array<{ name: PaletteName; label: string; color: string }> = [
  { name: 'pink', label: 'Cherry', color: '#9b3151' },
  { name: 'green', label: 'Forest', color: '#356b3a' },
  { name: 'gold', label: 'Amber', color: '#b8782f' },
  { name: 'blue', label: 'Blue', color: '#477c9e' },
  { name: 'white', label: 'White', color: '#bfc7c5' },
  { name: 'lavender', label: 'Lavender', color: '#80649d' },
];

const basePalettes: Record<PaletteName, Omit<WorldTheme, 'name' | 'season' | 'palette' | 'label' | 'seasonLabel' | 'paletteLabel' | 'particleKind'>> = {
  pink: {
    accent: '#9b3151',
    darkTile: '#111111',
    lightTile: '#f8f0df',
    trunk: '#5b301c',
    leaf: '#2e652d',
    blossom: '#9b3151',
    flower: '#701f3c',
    ground: '#f8f0df',
    sky: '#f7f7f7',
    particle: '#b74665',
  },
  green: {
    accent: '#356b3a',
    darkTile: '#132d1a',
    lightTile: '#f2efe2',
    trunk: '#57351f',
    leaf: '#2f6434',
    blossom: '#6d8d48',
    flower: '#496b31',
    ground: '#f2efe2',
    sky: '#f7f7f7',
    particle: '#7a9957',
  },
  gold: {
    accent: '#b8782f',
    darkTile: '#3b2718',
    lightTile: '#f6edd9',
    trunk: '#57301d',
    leaf: '#744b22',
    blossom: '#bd7a2e',
    flower: '#8f501f',
    ground: '#f6edd9',
    sky: '#f7f7f7',
    particle: '#c98a3f',
  },
  blue: {
    accent: '#477c9e',
    darkTile: '#163244',
    lightTile: '#eef3f2',
    trunk: '#55443a',
    leaf: '#315d68',
    blossom: '#5f8fa8',
    flower: '#345f79',
    ground: '#eef3f2',
    sky: '#f7f7f7',
    particle: '#7aa3b8',
  },
  white: {
    accent: '#7d8987',
    darkTile: '#28302f',
    lightTile: '#f5f4ee',
    trunk: '#5a5046',
    leaf: '#687a72',
    blossom: '#c6ceca',
    flower: '#98a8a1',
    ground: '#f5f4ee',
    sky: '#f7f7f7',
    particle: '#d9ddda',
  },
  lavender: {
    accent: '#80649d',
    darkTile: '#2e2338',
    lightTile: '#f2eef3',
    trunk: '#594033',
    leaf: '#4e5f52',
    blossom: '#8b6ea6',
    flower: '#624879',
    ground: '#f2eef3',
    sky: '#f7f7f7',
    particle: '#a88dbd',
  },
};

const seasonAdjustments: Record<SeasonName, {
  particleKind: WorldTheme['particleKind'];
  groundTint: string;
}> = {
  spring: { particleKind: 'petal', groundTint: '#f8f0df' },
  summer: { particleKind: 'pollen', groundTint: '#f1efdf' },
  autumn: { particleKind: 'leaf', groundTint: '#f3e7d2' },
  winter: { particleKind: 'snow', groundTint: '#edf1f1' },
};

export function getWorldTheme(season: SeasonName, palette: PaletteName): WorldTheme {
  const base = basePalettes[palette];
  const adjustment = seasonAdjustments[season];
  const seasonLabel = seasons.find((item) => item.name === season)?.label ?? season;
  const paletteLabel = palettes.find((item) => item.name === palette)?.label ?? palette;

  const leaf = season === 'autumn'
    ? palette === 'pink' ? '#5e4a25' : base.flower
    : season === 'winter'
      ? '#59615e'
      : base.leaf;
  const blossom = season === 'autumn'
    ? base.flower
    : season === 'winter'
      ? '#c7d0ce'
      : base.blossom;
  const flower = season === 'winter' ? base.darkTile : base.flower;

  return {
    ...base,
    name: `${season}-${palette}`,
    season,
    palette,
    label: `${seasonLabel} · ${paletteLabel}`,
    seasonLabel,
    paletteLabel,
    ground: adjustment.groundTint,
    particleKind: adjustment.particleKind,
    leaf,
    blossom,
    flower,
  };
}
