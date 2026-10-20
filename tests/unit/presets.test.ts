import { describe, expect, it } from 'vitest';
import { failingChecks } from '../../src/core/theme/contrast';
import { COLOR_PRESETS } from '../../src/core/theme/presets';
import { ThemeSchema } from '../../src/core/model';
import { BUILTIN_THEMES } from '../../src/core/theme/builtins';

describe('color presets', () => {
  it('ships the six curated sets from the spec', () => {
    expect(COLOR_PRESETS.map((preset) => preset.name)).toEqual([
      'Bone',
      'Slate',
      'Forest',
      'Plum',
      'Sand',
      'Ink',
    ]);
    expect(new Set(COLOR_PRESETS.map((preset) => preset.id)).size).toBe(COLOR_PRESETS.length);
  });

  it.each(COLOR_PRESETS.map((preset) => [preset.name, preset] as const))(
    '%s meets AA on every text pair',
    (_name, preset) => {
      const theme = ThemeSchema.parse({
        ...BUILTIN_THEMES[0]!,
        colors: preset.colors,
      });
      expect(failingChecks(theme).map((check) => check.id)).toEqual([]);
    },
  );
});
