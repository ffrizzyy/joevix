import { t, type MessageKey } from '../core/i18n';

const BUILTIN_NAME_KEYS: Record<string, MessageKey> = {
  'builtin:light': 'builtinLight',
  'builtin:dark': 'builtinDark',
  'builtin:sepia': 'builtinSepia',
  'builtin:contrast': 'builtinContrast',
};

/** Built-in names follow the UI language; custom names are user data. */
export function themeLabel(theme: { id: string; name: string }): string {
  const key = BUILTIN_NAME_KEYS[theme.id];
  return key ? t(key) : theme.name;
}
