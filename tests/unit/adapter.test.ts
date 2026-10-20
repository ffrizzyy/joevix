import { describe, expect, it } from 'vitest';
import {
  AdapterSchema,
  findAdapter,
  matchesUrl,
  parseAdapters,
  type Adapter,
} from '../../src/core/layout/adapter';
import { ADAPTERS, adapterForUrl } from '../../src/adapters';

const base = {
  id: 'example',
  schemaVersion: 1,
  match: ['https://example.com/*'],
  container: 'main',
  sections: [{ key: 'lyrics', label: 'Lyrics', selector: '.lyrics' }],
};

function parse(overrides: Record<string, unknown>): Adapter {
  return AdapterSchema.parse({ ...base, ...overrides });
}

describe('bundled adapters', () => {
  it('parses every shipped adapter', () => {
    expect(ADAPTERS.length).toBeGreaterThan(0);
    expect(ADAPTERS.map((adapter) => adapter.id)).toContain('genius');
  });

  it('points Genius at its structural hooks', () => {
    const genius = ADAPTERS.find((adapter) => adapter.id === 'genius')!;
    expect(genius.sections.map((section) => section.key)).toEqual([
      'info',
      'lyrics',
      'related',
      'comments',
    ]);
    expect(genius.sections.find((section) => section.key === 'lyrics')?.selector).toBe(
      '[data-lyrics-container="true"]',
    );
  });

  it('matches only lyric pages, including subdomains', () => {
    const genius = ADAPTERS.find((adapter) => adapter.id === 'genius')!;
    expect(matchesUrl(genius, 'https://genius.com/Queen-bohemian-rhapsody-lyrics')).toBe(true);
    expect(matchesUrl(genius, 'https://genius.com/Queen-bohemian-rhapsody-lyrics?text=1')).toBe(
      true,
    );
    expect(matchesUrl(genius, 'https://www.genius.com/Queen-bohemian-rhapsody-lyrics')).toBe(true);
    expect(matchesUrl(genius, 'https://genius.com/albums/Queen/A-night-at-the-opera')).toBe(false);
    expect(matchesUrl(genius, 'https://notgenius.com/x-lyrics')).toBe(false);
    expect(matchesUrl(genius, 'http://genius.com/x-lyrics')).toBe(false);
  });

  it('selects the adapter for a URL', () => {
    expect(adapterForUrl('https://genius.com/a-lyrics')?.id).toBe('genius');
    expect(adapterForUrl('https://example.org/')).toBeNull();
    expect(adapterForUrl(undefined)).toBeNull();
  });
});

describe('adapter schema', () => {
  it('accepts a normal adapter', () => {
    expect(parse({}).sections[0]?.key).toBe('lyrics');
  });

  it('rejects form and payment selectors', () => {
    for (const selector of [
      'input[type="password"]',
      'input[type="credit-card"]',
      'input',
      'textarea',
    ]) {
      expect(() => parse({ sections: [{ key: 'x', label: 'X', selector }] })).toThrow();
    }
  });

  it('rejects unsafe container selectors', () => {
    expect(() => parse({ container: 'main { color: red }' })).toThrow();
  });

  it('rejects duplicate section keys', () => {
    expect(() =>
      parse({
        sections: [
          { key: 'x', label: 'One', selector: '.a' },
          { key: 'x', label: 'Two', selector: '.b' },
        ],
      }),
    ).toThrow(/Duplicate/);
  });

  it('rejects match patterns outside https(s) host paths', () => {
    for (const pattern of [
      '*://example.com/*',
      'https://example.com',
      'https://*.example.com',
      'ftp://x/*',
    ]) {
      expect(() => parse({ match: [pattern] })).toThrow();
    }
  });

  it('rejects an empty section list', () => {
    expect(() => parse({ sections: [] })).toThrow();
  });

  it('rejects duplicate ids across a bundle', () => {
    expect(() => parseAdapters([base, base])).toThrow(/Duplicate adapter id/);
  });
});

describe('findAdapter', () => {
  it('returns the first matching adapter', () => {
    const a = parse({ id: 'a', match: ['https://a.example/*'] });
    const b = parse({ id: 'b', match: ['https://b.example/*'] });
    expect(findAdapter([a, b], 'https://b.example/x')?.id).toBe('b');
    expect(findAdapter([a, b], 'https://c.example/x')).toBeNull();
  });
});
