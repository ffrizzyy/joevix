import { ThemeSchema, type BuiltinThemeId, type Theme } from '../model';

const baseFont = {
  family: 'system',
  sizePx: 18,
  lineHeight: 1.7,
  letterSpacingEm: 0,
  align: 'start',
} as const;

const raw: Theme[] = [
  {
    schemaVersion: 1,
    id: 'builtin:light',
    name: 'Light',
    mode: 'light',
    builtin: true,
    colors: {
      background: '#fbfbfa',
      surface: '#ffffff',
      text: '#111111',
      muted: '#6b6865',
      accent: '#1f6c9f',
      border: '#e4e3e0',
    },
    font: { ...baseFont },
  },
  {
    schemaVersion: 1,
    id: 'builtin:dark',
    name: 'Dark',
    mode: 'dark',
    builtin: true,
    colors: {
      background: '#191919',
      surface: '#202020',
      text: '#ededeb',
      muted: '#9b9a97',
      accent: '#8fb8dc',
      border: '#333333',
    },
    font: { ...baseFont },
  },
  {
    schemaVersion: 1,
    id: 'builtin:sepia',
    name: 'Sepia',
    mode: 'sepia',
    builtin: true,
    colors: {
      background: '#f4ecd8',
      surface: '#fbf6ea',
      text: '#352c1f',
      muted: '#6a5b45',
      accent: '#7a4a16',
      border: '#dfd0b4',
    },
    font: { ...baseFont },
  },
  {
    schemaVersion: 1,
    id: 'builtin:contrast',
    name: 'High contrast',
    mode: 'contrast',
    builtin: true,
    colors: {
      background: '#000000',
      surface: '#0b0b0b',
      text: '#ffffff',
      muted: '#e0e0e0',
      accent: '#ffd400',
      border: '#767676',
    },
    font: { ...baseFont },
  },
];

/** Parsed once at module load so invalid built-ins fail loudly in tests, not at runtime. */
export const BUILTIN_THEMES: readonly Theme[] = Object.freeze(
  raw.map((theme) => ThemeSchema.parse(theme)),
);

export function getBuiltinTheme(id: string): Theme | null {
  return BUILTIN_THEMES.find((theme) => theme.id === id) ?? null;
}

export function isBuiltinId(id: string): id is BuiltinThemeId {
  return BUILTIN_THEMES.some((theme) => theme.id === id);
}

/** v1 maps System to the built-in Light/Dark pair (ADR-3 in the popup, spec 6.6). */
export function systemTheme(scheme: 'light' | 'dark'): Theme {
  return getBuiltinTheme(scheme === 'dark' ? 'builtin:dark' : 'builtin:light')!;
}
