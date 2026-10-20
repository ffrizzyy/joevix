import { describe, expect, it } from 'vitest';
import {
  buildLayoutCss,
  isSafeSelector,
  resolveHidden,
  resolveOrder,
} from '../../src/core/layout/sections';

describe('isSafeSelector', () => {
  it('accepts ordinary structural selectors', () => {
    expect(isSafeSelector('main [data-lyrics]')).toBe(true);
    expect(isSafeSelector('.song-info')).toBe(true);
    expect(isSafeSelector('#content > div.lyrics')).toBe(true);
    expect(isSafeSelector('main > :nth-child(2)')).toBe(true);
  });

  it('rejects form and value probing', () => {
    expect(isSafeSelector('input')).toBe(false);
    expect(isSafeSelector('input[type="password"]')).toBe(false);
    expect(isSafeSelector('textarea')).toBe(false);
    expect(isSafeSelector('[value^="a"]')).toBe(false);
    expect(isSafeSelector(':checked')).toBe(false);
    expect(isSafeSelector(':has(input)')).toBe(false);
  });

  it('rejects exfiltration channels', () => {
    expect(isSafeSelector('div { background: url(https://evil.example) }')).toBe(false);
    expect(isSafeSelector('a[href^="https"]')).toBe(false);
    expect(isSafeSelector('@import "x"')).toBe(false);
    expect(isSafeSelector('div; color: red')).toBe(false);
  });

  it('rejects empty and oversized input', () => {
    expect(isSafeSelector('')).toBe(false);
    expect(isSafeSelector('a'.repeat(400))).toBe(false);
  });
});

describe('resolveOrder', () => {
  it('keeps known keys in saved order and appends the rest', () => {
    expect(resolveOrder(['a', 'b', 'c'], ['c', 'a'])).toEqual(['c', 'a', 'b']);
  });

  it('drops unknown and duplicate keys', () => {
    expect(resolveOrder(['a', 'b'], ['b', 'ghost', 'b', 'a'])).toEqual(['b', 'a']);
  });

  it('falls back to adapter order when nothing is saved', () => {
    expect(resolveOrder(['x', 'y'], [])).toEqual(['x', 'y']);
  });
});

describe('resolveHidden', () => {
  it('intersects with order and dedupes', () => {
    expect(resolveHidden(['a', 'b'], ['b', 'b', 'ghost'])).toEqual(['b']);
  });
});

describe('buildLayoutCss', () => {
  const selectors = { lyrics: '.lyrics', related: '.related' };

  it('hides sections with display none', () => {
    const css = buildLayoutCss({
      order: ['lyrics', 'related'],
      hidden: ['related'],
      selectors,
      containerSupportsOrder: false,
    });
    expect(css).toContain('.related { display: none !important; }');
    expect(css).not.toContain('order:');
  });

  it('applies order only when the container supports it', () => {
    const css = buildLayoutCss({
      order: ['related', 'lyrics'],
      hidden: [],
      selectors,
      containerSupportsOrder: true,
      containerSelector: 'main',
    });
    expect(css).toContain('main { display: flex !important; flex-direction: column !important; }');
    expect(css).toContain('.related { order: 0 !important; }');
    expect(css).toContain('.lyrics { order: 1 !important; }');
  });

  it('skips unsafe selectors instead of writing them', () => {
    const css = buildLayoutCss({
      order: ['bad'],
      hidden: ['bad'],
      selectors: { bad: 'div { color: red }' },
      containerSupportsOrder: true,
    });
    expect(css).toBe('');
  });
});
