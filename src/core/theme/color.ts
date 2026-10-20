export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_RE = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)$/i;
const HSL_RE =
  /^hsla?\(\s*(\d{1,3}(?:\.\d+)?)\s*(?:deg)?\s*[, ]\s*(\d{1,3}(?:\.\d+)?)%\s*[, ]\s*(\d{1,3}(?:\.\d+)?)%\s*\)$/i;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toByte(value: number): number {
  return Math.round(clamp(value, 0, 255));
}

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value);
}

/** Parses #rgb, #rrggbb, rgb(), and hsl() into bytes. Alpha is rejected. */
export function parseColor(input: string): Rgb | null {
  const value = input.trim();

  const hex = HEX_RE.exec(value);
  if (hex) {
    let body = hex[1] ?? '';
    if (body.length === 3) {
      body = body
        .split('')
        .map((char) => char + char)
        .join('');
    }
    return {
      r: parseInt(body.slice(0, 2), 16),
      g: parseInt(body.slice(2, 4), 16),
      b: parseInt(body.slice(4, 6), 16),
    };
  }

  const rgb = RGB_RE.exec(value);
  if (rgb) {
    return {
      r: toByte(Number(rgb[1])),
      g: toByte(Number(rgb[2])),
      b: toByte(Number(rgb[3])),
    };
  }

  const hsl = HSL_RE.exec(value);
  if (hsl) {
    const h = Number(hsl[1]);
    const s = Number(hsl[2]);
    const l = Number(hsl[3]);
    if (h > 360 || s > 100 || l > 100) return null;
    return hslToRgb({ h: h % 360, s: s / 100, l: l / 100 });
  }

  return null;
}

export function toHex(rgb: Rgb): string {
  const hex = (value: number) => toByte(value).toString(16).padStart(2, '0');
  return `#${hex(rgb.r)}${hex(rgb.g)}${hex(rgb.b)}`;
}

/** Returns a normalized #rrggbb string, or null when the input is not a color. */
export function normalizeColor(input: string): string | null {
  const parsed = parseColor(input);
  return parsed ? toHex(parsed) : null;
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const light = clamp(l, 0, 1);

  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return {
    r: toByte((r + m) * 255),
    g: toByte((g + m) * 255),
    b: toByte((b + m) * 255),
  };
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = clamp(r, 0, 255) / 255;
  const gn = clamp(g, 0, 255) / 255;
  const bn = clamp(b, 0, 255) / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));

  let h: number;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;

  h *= 60;
  if (h < 0) h += 360;

  return { h, s, l };
}

function linearize(channel: number): number {
  const c = clamp(channel, 0, 255) / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b)
  );
}

/** WCAG 2.x contrast ratio, 1..21. Accepts colors as strings or Rgb objects. */
export function contrastRatio(a: Rgb | string, b: Rgb | string): number {
  const first = typeof a === 'string' ? parseColor(a) : a;
  const second = typeof b === 'string' ? parseColor(b) : b;
  if (!first || !second) return 1;

  const la = relativeLuminance(first);
  const lb = relativeLuminance(second);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(1)}:1`;
}

/** Picks black or white, whichever reads better on the given background. */
export function readableInk(background: string): string {
  return contrastRatio('#000000', background) >= contrastRatio('#ffffff', background)
    ? '#000000'
    : '#ffffff';
}
