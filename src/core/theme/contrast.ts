import type { Theme } from '../model';
import { contrastRatio, formatRatio, hslToRgb, normalizeColor, rgbToHsl, toHex } from './color';

export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;

export type ContrastCheck = {
  id: string;
  label: string;
  foreground: string;
  background: string;
  ratio: number;
  display: string;
  minimum: number;
  passes: boolean;
};

function check(
  id: string,
  label: string,
  foreground: string,
  background: string,
  minimum: number = AA_NORMAL,
): ContrastCheck {
  const ratio = contrastRatio(foreground, background);
  return {
    id,
    label,
    foreground,
    background,
    ratio,
    display: formatRatio(ratio),
    minimum,
    passes: ratio >= minimum,
  };
}

/**
 * Evaluates every text pair the page actually renders (spec 6.6). Text on the
 * canvas alone is not enough: muted text and links sit on it too. The border
 * role is decorative on the page (spec 6.2), so it is not an AA text pair.
 */
export function auditTheme(theme: Theme): ContrastCheck[] {
  const { colors } = theme;
  return [
    check('text-on-background', 'Text on background', colors.text, colors.background),
    check('text-on-surface', 'Text on cards', colors.text, colors.surface),
    check('muted-on-background', 'Secondary text', colors.muted, colors.background),
    check('accent-on-background', 'Links', colors.accent, colors.background),
  ];
}

export function failingChecks(theme: Theme): ContrastCheck[] {
  return auditTheme(theme).filter((item) => !item.passes);
}

export function worstCheck(theme: Theme): ContrastCheck {
  const checks = auditTheme(theme);
  return checks.reduce((worst, item) => (item.ratio < worst.ratio ? item : worst), checks[0]!);
}

/**
 * Moves lightness toward the pole with more headroom until the color passes
 * against every surface. Hue and saturation are preserved (ADR-9).
 *
 * Text sits on both the page background and cards, so it must clear both at
 * once; checking them one at a time can satisfy the second while breaking the
 * first. Returns the best attainable color when no step clears every surface.
 */
export function fixOnSurfaces(
  foreground: string,
  surfaces: readonly string[],
  minimum: number = AA_NORMAL,
): string {
  const fg = normalizeColor(foreground);
  const backgrounds = surfaces
    .map((surface) => normalizeColor(surface))
    .filter((surface): surface is string => surface !== null);
  if (!fg || backgrounds.length === 0) return foreground;

  const minRatio = (color: string) =>
    Math.min(...backgrounds.map((background) => contrastRatio(color, background)));
  if (minRatio(fg) >= minimum) return fg;

  const hsl = rgbToHsl(parseHex(fg));
  const headroom = (pole: string) =>
    backgrounds.reduce((total, background) => total + contrastRatio(pole, background), 0);
  const towardWhite = headroom('#ffffff') >= headroom('#000000');
  const step = 0.01;

  let best = fg;
  let bestRatio = minRatio(fg);

  for (let i = 1; i <= 100; i += 1) {
    const lightness = towardWhite ? hsl.l + i * step : hsl.l - i * step;
    if (lightness < 0 || lightness > 1) break;
    const candidate = toHex(hslToRgb({ h: hsl.h, s: hsl.s, l: lightness }));
    const ratio = minRatio(candidate);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
    if (ratio >= minimum) return candidate;
  }

  return best;
}

/** Fixes one foreground against one background. */
export function fixContrast(
  foreground: string,
  background: string,
  minimum: number = AA_NORMAL,
): string {
  return fixOnSurfaces(foreground, [background], minimum);
}

function parseHex(value: string) {
  const clean = value.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/** Fixes every failing pair, mutating a copy of the theme's colors. */
export function fixThemeContrast(theme: Theme): Theme {
  const colors = { ...theme.colors };
  colors.text = fixOnSurfaces(colors.text, [colors.background, colors.surface]);
  colors.muted = fixOnSurfaces(colors.muted, [colors.background]);
  colors.accent = fixOnSurfaces(colors.accent, [colors.background]);
  return { ...theme, colors };
}
