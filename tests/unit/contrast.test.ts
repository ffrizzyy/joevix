import { describe, expect, it } from 'vitest';
import { BUILTIN_THEMES } from '../../src/core/theme/builtins';
import {
  AA_NORMAL,
  auditTheme,
  failingChecks,
  fixContrast,
  fixThemeContrast,
  worstCheck,
} from '../../src/core/theme/contrast';
import { contrastRatio, hslToRgb, normalizeColor, toHex } from '../../src/core/theme/color';
import type { Theme } from '../../src/core/model';

describe('built-in themes', () => {
  it.each(BUILTIN_THEMES.map((theme) => [theme.name, theme] as const))(
    '%s meets AA on every rendered pair',
    (_name, theme) => {
      const failures = failingChecks(theme).map(
        (check) => `${check.id} ${check.display} < ${check.minimum}`,
      );
      expect(failures).toEqual([]);
    },
  );

  it('reports the worst pair', () => {
    const worst = worstCheck(BUILTIN_THEMES[0]!);
    expect(worst.ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('audits four text pairs', () => {
    expect(auditTheme(BUILTIN_THEMES[0]!).map((check) => check.id)).toEqual([
      'text-on-background',
      'text-on-surface',
      'muted-on-background',
      'accent-on-background',
    ]);
  });
});

describe('fixContrast', () => {
  it('returns the color unchanged when it already passes', () => {
    expect(fixContrast('#111111', '#ffffff')).toBe('#111111');
  });

  it('reaches 4.5:1 on a failing pair', () => {
    const fixed = fixContrast('#787774', '#ffffff');
    expect(contrastRatio(fixed, '#ffffff')).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('preserves hue by moving lightness only', () => {
    const fixed = fixContrast('#787774', '#ffffff');
    const originalHue = hueOf('#787774');
    const fixedHue = hueOf(fixed);
    expect(Math.abs(originalHue - fixedHue)).toBeLessThanOrEqual(2);
  });

  it('always reaches AA for 200 deterministic pairs', () => {
    let seed = 42;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed >>> 0;
    };
    const hex = () => `#${(next() % 0xffffff).toString(16).padStart(6, '0')}`;

    for (let index = 0; index < 200; index += 1) {
      const fg = hex();
      const bg = hex();
      const fixed = fixContrast(fg, bg);
      const ratio = contrastRatio(fixed, bg);
      // Only assert attainable targets: one pole always clears 4.5 for any bg.
      expect(ratio).toBeGreaterThanOrEqual(4.49);
    }
  });

  it('fixes a whole theme', () => {
    const broken: Theme = {
      ...BUILTIN_THEMES[0]!,
      colors: {
        ...BUILTIN_THEMES[0]!.colors,
        text: '#dddddd',
        muted: '#cccccc',
        accent: '#e0e0e0',
      },
    };
    const fixed = fixThemeContrast(broken);
    expect(failingChecks(fixed)).toEqual([]);
  });

  it('fixes text against background and cards at the same time', () => {
    let seed = 7;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed >>> 0;
    };
    const color = (lightness: number, saturation: number) =>
      toHex(hslToRgb({ h: next() % 360, s: saturation, l: lightness }));

    for (let index = 0; index < 300; index += 1) {
      // Neutral surfaces on one side of the light/dark crossover. When the two
      // surfaces straddle it, no single text color can clear both at 4.5:1;
      // that is a property of the chosen colors, not the fixer.
      const baseLightness =
        next() % 2 === 0 ? (next() % 36) / 100 : 0.64 + (next() % 37) / 100;
      const surfaceLightness = Math.min(1, Math.max(0, baseLightness + ((next() % 7) - 3) / 100));
      const broken: Theme = {
        ...BUILTIN_THEMES[0]!,
        colors: {
          background: color(baseLightness, 0),
          surface: color(surfaceLightness, 0),
          text: color((next() % 100) / 100, (next() % 100) / 100),
          muted: color((next() % 100) / 100, (next() % 100) / 100),
          accent: color((next() % 100) / 100, (next() % 100) / 100),
          border: '#8f8d89',
        },
      };

      const fixed = fixThemeContrast(broken);
      const failures = failingChecks(fixed).map((check) => check.id);
      expect(failures, `theme ${index}`).toEqual([]);
    }
  });
});

function hueOf(color: string): number {
  const normalized = normalizeColor(color)!;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}
