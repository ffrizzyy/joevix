import { describe, expect, it } from 'vitest';
import { BUILTIN_THEMES } from '../../src/core/theme/builtins';
import { buildThemeCss, fontStack, scopeSelector, THEME_ATTR } from '../../src/core/theme/css';
import type { Theme } from '../../src/core/model';

const theme = BUILTIN_THEMES[1]!;

describe('buildThemeCss', () => {
  it('scopes everything under the attribute', () => {
    const css = buildThemeCss(theme);
    expect(css).toContain(`html[${THEME_ATTR}="on"]`);
    expect(scopeSelector()).toBe(`html[${THEME_ATTR}="on"]`);
  });

  it('emits every color variable', () => {
    const css = buildThemeCss(theme);
    for (const role of ['bg', 'surface', 'text', 'muted', 'accent', 'border']) {
      expect(css).toContain(`--jx-${role}:`);
    }
  });

  it('sets the color scheme for dark themes', () => {
    expect(buildThemeCss(theme)).toContain('color-scheme: dark');
    expect(buildThemeCss(BUILTIN_THEMES[0]!)).toContain('color-scheme: light');
  });

  it('cannot emit urls, imports, or attr()', () => {
    const css = buildThemeCss(theme).toLowerCase();
    expect(css).not.toContain('url(');
    expect(css).not.toContain('@import');
    expect(css).not.toContain('attr(');
    expect(css).not.toContain('expression(');
  });

  it('throws on an invalid color instead of writing it', () => {
    const broken = {
      ...theme,
      colors: { ...theme.colors, background: 'url(https://evil.example)' },
    } as unknown as Theme;
    expect(() => buildThemeCss(broken)).toThrow();
  });

  it('rejects out-of-range numbers', () => {
    const broken = { ...theme, font: { ...theme.font, sizePx: 9999 } } as Theme;
    expect(() => buildThemeCss(broken)).toThrow();
  });

  it('respects reduced motion and forced colors', () => {
    const css = buildThemeCss(theme);
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('forced-colors: active');
  });
});

describe('fontStack', () => {
  it('contains only system font names', () => {
    for (const family of ['system', 'serif', 'mono'] as const) {
      const stack = fontStack(family);
      expect(stack).not.toContain('url(');
      expect(stack.length).toBeGreaterThan(3);
    }
  });
});
