import type { ThemeColors } from '../model';

export type ColorPreset = {
  id: string;
  name: string;
  colors: ThemeColors;
};

/**
 * Curated starting points (spec 6.6). Each set passes the AA text pairs on its
 * own, so picking one never starts the editor from a failing theme.
 */
export const COLOR_PRESETS: readonly ColorPreset[] = [
  {
    id: 'bone',
    name: 'Bone',
    colors: {
      background: '#FBFAF6',
      surface: '#FFFFFF',
      text: '#1B1A17',
      muted: '#6E6A63',
      accent: '#7A4B12',
      border: '#E4E0D8',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    colors: {
      background: '#1B1F24',
      surface: '#232930',
      text: '#E8EAED',
      muted: '#A6ADB5',
      accent: '#8AB4F8',
      border: '#39414A',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      background: '#F3F6F1',
      surface: '#FFFFFF',
      text: '#16241A',
      muted: '#5C6B5F',
      accent: '#2F6B3A',
      border: '#D8E0D5',
    },
  },
  {
    id: 'plum',
    name: 'Plum',
    colors: {
      background: '#211A24',
      surface: '#2B2130',
      text: '#F2E9F5',
      muted: '#B9A9C0',
      accent: '#D0A9E0',
      border: '#443449',
    },
  },
  {
    id: 'sand',
    name: 'Sand',
    colors: {
      background: '#F7F1E6',
      surface: '#FFFCF6',
      text: '#2A231A',
      muted: '#6F6252',
      accent: '#8A5A24',
      border: '#E5DAC7',
    },
  },
  {
    id: 'ink',
    name: 'Ink',
    colors: {
      background: '#101216',
      surface: '#171A20',
      text: '#E6E9EF',
      muted: '#9AA3B0',
      accent: '#6FB7FF',
      border: '#323844',
    },
  },
];
