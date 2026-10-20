import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  formatRatio,
  hslToRgb,
  normalizeColor,
  parseColor,
  readableInk,
  rgbToHsl,
  toHex,
} from '../../src/core/theme/color';

describe('parseColor', () => {
  it('parses #rrggbb', () => {
    expect(parseColor('#1F6C9F')).toEqual({ r: 31, g: 108, b: 159 });
  });

  it('expands #rgb', () => {
    expect(parseColor('#abc')).toEqual({ r: 170, g: 187, b: 204 });
  });

  it('parses rgb() with commas and spaces', () => {
    expect(parseColor('rgb(255, 0, 10)')).toEqual({ r: 255, g: 0, b: 10 });
    expect(parseColor('rgb(255 0 10)')).toEqual({ r: 255, g: 0, b: 10 });
  });

  it('parses hsl()', () => {
    const rgb = parseColor('hsl(210, 100%, 50%)');
    expect(rgb).toEqual({ r: 0, g: 128, b: 255 });
  });

  it('rejects alpha and junk', () => {
    expect(parseColor('#11223344')).toBeNull();
    expect(parseColor('rgba(0,0,0,0.5)')).toBeNull();
    expect(parseColor('red')).toBeNull();
    expect(parseColor('url(https://example.com)')).toBeNull();
    expect(parseColor('hsl(400, 10%, 10%)')).toBeNull();
  });
});

describe('normalizeColor', () => {
  it('lowercases and normalizes', () => {
    expect(normalizeColor('#ABCDEF')).toBe('#abcdef');
    expect(normalizeColor('rgb(0,0,0)')).toBe('#000000');
  });
});

describe('hsl round trip', () => {
  it('preserves color within rounding', () => {
    const original = { r: 31, g: 108, b: 159 };
    const round = hslToRgb(rgbToHsl(original));
    expect(Math.abs(round.r - original.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(round.g - original.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(round.b - original.b)).toBeLessThanOrEqual(1);
    expect(toHex(round)).toBe('#1f6c9f');
  });
});

describe('contrastRatio', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#111111', '#fbfbfa')).toBeCloseTo(18.24, 1);
    expect(contrastRatio('#726f6c', '#fbfbfa')).toBeCloseTo(4.82, 1);
    expect(contrastRatio('#787774', '#fbfbfa')).toBeCloseTo(4.32, 1);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#123456', '#abcdef')).toBeCloseTo(
      contrastRatio('#abcdef', '#123456'),
      6,
    );
  });

  it('returns 1 for invalid colors', () => {
    expect(contrastRatio('nope', '#ffffff')).toBe(1);
  });

  it('formats to one decimal', () => {
    expect(formatRatio(4.456)).toBe('4.5:1');
  });

  it('picks readable ink', () => {
    expect(readableInk('#ffffff')).toBe('#000000');
    expect(readableInk('#000000')).toBe('#ffffff');
  });
});
