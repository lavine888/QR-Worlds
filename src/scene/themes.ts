export type ThemeName = 'sakura' | 'forest' | 'autumn' | 'snow';

export type WorldTheme = {
  name: ThemeName;
  label: string;
  accent: string;
  darkTile: string;
  lightTile: string;
  trunk: string;
  leaf: string;
  blossom: string;
  ground: string;
  sky: string;
};

export const themes: Record<ThemeName, WorldTheme> = {
  sakura: {
    name: 'sakura',
    label: 'Sakura',
    accent: '#d887a5',
    darkTile: '#274438',
    lightTile: '#edf0e9',
    trunk: '#755342',
    leaf: '#728f67',
    blossom: '#f3b8ca',
    ground: '#f2efe8',
    sky: '#f7f7f3',
  },
  forest: {
    name: 'forest',
    label: 'Forest',
    accent: '#3f7f5f',
    darkTile: '#173c2c',
    lightTile: '#e8efe7',
    trunk: '#6d5238',
    leaf: '#39724d',
    blossom: '#b8d5a8',
    ground: '#edf1ea',
    sky: '#f5f7f2',
  },
  autumn: {
    name: 'autumn',
    label: 'Autumn',
    accent: '#be6d3e',
    darkTile: '#533d2d',
    lightTile: '#f3eadb',
    trunk: '#624332',
    leaf: '#b96832',
    blossom: '#e2a442',
    ground: '#f2eadf',
    sky: '#faf6ef',
  },
  snow: {
    name: 'snow',
    label: 'Snow',
    accent: '#7196b0',
    darkTile: '#274252',
    lightTile: '#eef5f7',
    trunk: '#665b57',
    leaf: '#6c8792',
    blossom: '#ffffff',
    ground: '#eef3f4',
    sky: '#f6fafb',
  },
};
