import { describe, expect, it } from 'vitest';
import { BUILTIN_THEMES, getBuiltinTheme, isBuiltinId, systemTheme } from '../../src/core/theme/builtins';
import { ThemeSchema } from '../../src/core/model';
import { COLOR_ROLES } from '../../src/core/theme/roles';

describe('built-in themes', () => {
  it('ships four themes with unique ids', () => {
    expect(BUILTIN_THEMES).toHaveLength(4);
    expect(new Set(BUILTIN_THEMES.map((theme) => theme.id)).size).toBe(4);
  });

  it.each(BUILTIN_THEMES.map((theme) => [theme.name, theme] as const))(
    '%s has all six color roles as valid hex',
    (_name, theme) => {
      for (const role of COLOR_ROLES) {
        expect(theme.colors[role]).toMatch(/^#[0-9a-f]{6}$/);
      }
      expect(() => ThemeSchema.parse(theme)).not.toThrow();
    },
  );

  it('keeps font values in range', () => {
    for (const theme of BUILTIN_THEMES) {
      expect(theme.font.sizePx).toBeGreaterThanOrEqual(12);
      expect(theme.font.sizePx).toBeLessThanOrEqual(40);
      expect(theme.font.lineHeight).toBeGreaterThanOrEqual(1.2);
      expect(theme.font.lineHeight).toBeLessThanOrEqual(2.2);
    }
  });

  it('resolves ids', () => {
    expect(isBuiltinId('builtin:dark')).toBe(true);
    expect(isBuiltinId('custom:abc')).toBe(false);
    expect(getBuiltinTheme('builtin:nope')).toBeNull();
  });

  it('maps system to light and dark', () => {
    expect(systemTheme('light').mode).toBe('light');
    expect(systemTheme('dark').mode).toBe('dark');
  });
});
