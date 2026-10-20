import type { Theme, ThemeFont } from '../model';
import { normalizeColor } from './color';

export const THEME_ATTR = 'data-joevix';

const FONT_STACKS: Record<ThemeFont['family'], string> = {
  system:
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  serif: "ui-serif, Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'Cascadia Mono', 'SF Mono', Consolas, monospace",
};

export function fontStack(family: ThemeFont['family']): string {
  return FONT_STACKS[family];
}

function hex(value: string, role: string): string {
  const normalized = normalizeColor(value);
  if (!normalized) throw new Error(`Invalid ${role} color`);
  return normalized;
}

function num(value: number, min: number, max: number, role: string): string {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid ${role}`);
  }
  return String(Number(value.toFixed(3)));
}

/**
 * Every value here is rebuilt from typed data (ADR-8). No user string ever
 * reaches the stylesheet, so url(), @import and attr() cannot be injected.
 */
export function themeVariables(theme: Theme): string[] {
  const c = theme.colors;
  return [
    `--jx-bg: ${hex(c.background, 'background')};`,
    `--jx-surface: ${hex(c.surface, 'surface')};`,
    `--jx-text: ${hex(c.text, 'text')};`,
    `--jx-muted: ${hex(c.muted, 'muted')};`,
    `--jx-accent: ${hex(c.accent, 'accent')};`,
    `--jx-border: ${hex(c.border, 'border')};`,
    `--jx-font-body: ${fontStack(theme.font.family)};`,
    `--jx-font-heading: ${theme.font.family === 'serif' ? fontStack('serif') : fontStack(theme.font.family)};`,
    `--jx-size: ${num(theme.font.sizePx, 12, 40, 'size')}px;`,
    `--jx-line: ${num(theme.font.lineHeight, 1.2, 2.2, 'line height')};`,
    `--jx-tracking: ${num(theme.font.letterSpacingEm, -0.02, 0.1, 'letter spacing')}em;`,
    `--jx-align: ${theme.font.align === 'center' ? 'center' : 'start'};`,
  ];
}

export function scopeSelector(attrValue = 'on'): string {
  return `html[${THEME_ATTR}="${attrValue}"]`;
}

/**
 * Full page theme. `!important` is limited to paint and type properties so the
 * site's own layout and behavior keep working.
 */
export function buildThemeCss(theme: Theme): string {
  const scope = scopeSelector();
  const vars = themeVariables(theme).map((line) => `  ${line}`).join('\n');

  return `${scope} {
${vars}
  color-scheme: ${theme.mode === 'dark' ? 'dark' : 'light'};
  background-color: var(--jx-bg) !important;
  color: var(--jx-text) !important;
}

${scope} body {
  background-color: var(--jx-bg) !important;
  color: var(--jx-text) !important;
  font-family: var(--jx-font-body) !important;
  font-size: var(--jx-size) !important;
  line-height: var(--jx-line) !important;
  letter-spacing: var(--jx-tracking) !important;
  text-align: var(--jx-align);
}

${scope} :is(h1, h2, h3, h4, h5, h6) {
  color: var(--jx-text) !important;
  font-family: var(--jx-font-heading) !important;
}

${scope} :is(p, li, dd, dt, td, th, blockquote, figcaption) {
  color: var(--jx-text);
}

${scope} a {
  color: var(--jx-accent) !important;
}

${scope} :is(blockquote, figcaption, small) {
  color: var(--jx-muted) !important;
}

${scope} :is(pre, code, kbd, samp) {
  background-color: var(--jx-surface) !important;
  color: var(--jx-text) !important;
  border-color: var(--jx-border) !important;
}

${scope} :is(hr, table, td, th, blockquote, pre, fieldset) {
  border-color: var(--jx-border) !important;
}

${scope} :is(input, textarea, select, button) {
  background-color: var(--jx-surface) !important;
  color: var(--jx-text) !important;
  border-color: var(--jx-border) !important;
}

${scope} ::selection {
  background-color: var(--jx-accent) !important;
  color: var(--jx-bg) !important;
}

@media (prefers-reduced-motion: no-preference) {
  ${scope}, ${scope} body {
    transition: background-color 150ms ease, color 150ms ease;
  }
}

@media (forced-colors: active) {
  ${scope}, ${scope} body {
    background-color: Canvas !important;
    color: CanvasText !important;
  }
  ${scope} a {
    color: LinkText !important;
  }
}
`;
}
