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
  { name: 'pink', label: 'Pink', color: '#db83a4' },
  { name: 'green', label: 'Green', color: '#4e8d68' },
  { name: 'gold', label: 'Gold', color: '#c09243' },
  { name: 'blue', label: 'Blue', color: '#6e9bc0' },
  { name: 'white', label: 'White', color: '#dbe4e4' },
  { name: 'lavender', label: 'Lavender', color: '#9a80c5' },
];

const basePalettes: Record<PaletteName, Omit<WorldTheme, 'name' | 'season' | 'palette' | 'label' | 'seasonLabel' | 'paletteLabel' | 'particleKind'>> = {
  pink: {
    accent: '#d8749b',
    darkTile: '#24493a',
    lightTile: '#f0f2ec',
    trunk: '#76513d',
    leaf: '#5d8f61',
    blossom: '#f0a9c3',
    flower: '#d96891',
    ground: '#f2efe8',
    sky: '#faf9f5',
    particle: '#efb1c5',
  },
  green: {
    accent: '#4e8d68',
    darkTile: '#173c2c',
    lightTile: '#e9f0e8',
    trunk: '#6c5239',
    leaf: '#3f794f',
    blossom: '#b9d4a5',
    flower: '#7aa66a',
    ground: '#edf2eb',
    sky: '#f8faf6',
    particle: '#b8d89f',
  },
  gold: {
    accent: '#c09243',
    darkTile: '#4b3827',
    lightTile: '#f5edde',
    trunk: '#69432f',
    leaf: '#a8682c',
    blossom: '#e5ad4c',
    flower: '#c6822e',
    ground: '#f3ebdf',
    sky: '#fcf8f0',
    particle: '#e1a33f',
  },
  blue: {
    accent: '#6e9bc0',
    darkTile: '#1c4156',
    lightTile: '#edf5f8',
    trunk: '#625850',
    leaf: '#4f7e92',
    blossom: '#bcd9ed',
    flower: '#6d9fc0',
    ground: '#edf3f5',
    sky: '#f8fbfc',
    particle: '#b6d8ec',
  },
  white: {
    accent: '#9aa9ac',
    darkTile: '#2d3a3e',
    lightTile: '#f6f7f4',
    trunk: '#6c665e',
    leaf: '#9eaaa6',
    blossom: '#ffffff',
    flower: '#cbd8d4',
    ground: '#f1f4f1',
    sky: '#fbfcfa',
    particle: '#ffffff',
  },
  lavender: {
    accent: '#9a80c5',
    darkTile: '#30284c',
    lightTile: '#f1eff7',
    trunk: '#665044',
    leaf: '#69629a',
    blossom: '#cfbee8',
    flower: '#9a78c0',
    ground: '#f0edf5',
    sky: '#fbf9fd',
    particle: '#d8c8ec',
  },
};

const seasonAdjustments: Record<SeasonName, {
  leafFactor: number;
  blossomFactor: number;
  particleKind: WorldTheme['particleKind'];
  groundTint: string;
}> = {
  spring: { leafFactor: 1, blossomFactor: 1, particleKind: 'petal', groundTint: '#f2efe8' },
  summer: { leafFactor: 0.86, blossomFactor: 0.78, particleKind: 'pollen', groundTint: '#f0f0df' },
  autumn: { leafFactor: 0.72, blossomFactor: 1.12, particleKind: 'leaf', groundTint: '#f2e8d8' },
  winter: { leafFactor: 0.42, blossomFactor: 1.42, particleKind: 'snow', groundTint: '#edf3f5' },
};

export function getWorldTheme(season: SeasonName, palette: PaletteName): WorldTheme {
  const base = basePalettes[palette];
  const adjustment = seasonAdjustments[season];
  const seasonLabel = seasons.find((item) => item.name === season)?.label ?? season;
  const paletteLabel = palettes.find((item) => item.name === palette)?.label ?? palette;
  const leaf = season === 'autumn' || season === 'winter' ? base.blossom : base.leaf;
  const blossom = season === 'autumn' ? base.flower : season === 'winter' ? '#ffffff' : base.blossom;
  const flower = season === 'winter' ? base.lightTile : base.flower;
  return {
    ...base,
    name: season + '-' + palette,
    season,
    palette,
    label: seasonLabel + ' · ' + paletteLabel,
    seasonLabel,
    paletteLabel,
    ground: adjustment.groundTint,
    particleKind: adjustment.particleKind,
    leaf,
    blossom,
    flower,
  };
}
