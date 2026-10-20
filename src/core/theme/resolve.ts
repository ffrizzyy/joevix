import type { Theme } from '../model';
import { BUILTIN_THEMES, getBuiltinTheme, systemTheme } from './builtins';

export function allThemes(userThemes: readonly Theme[]): Theme[] {
  return [...BUILTIN_THEMES, ...userThemes.filter((theme) => !theme.builtin)];
}

export function findTheme(id: string, userThemes: readonly Theme[]): Theme | null {
  return getBuiltinTheme(id) ?? userThemes.find((theme) => theme.id === id) ?? null;
}

/** FR-47: System, then every theme in display order, wrapping around. */
export function nextThemeId(currentId: string, themeIds: readonly string[]): string {
  const ids = ['system', ...themeIds];
  const index = ids.indexOf(currentId);
  return ids[(index + 1) % ids.length] ?? 'system';
}

/**
 * A site whose theme was deleted falls back to Light rather than breaking
 * (spec 5.2, FR-51). Returns the fallback plus whether a fallback happened.
 */
export function resolveTheme(
  themeId: string,
  userThemes: readonly Theme[],
  scheme: 'light' | 'dark',
): { theme: Theme; missing: boolean } {
  if (themeId === 'system') return { theme: systemTheme(scheme), missing: false };
  const found = findTheme(themeId, userThemes);
  if (found) return { theme: found, missing: false };
  return { theme: getBuiltinTheme('builtin:light')!, missing: true };
}
