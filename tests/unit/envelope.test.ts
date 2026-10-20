import { describe, expect, it } from 'vitest';
import { LIMITS, createSiteConfig } from '../../src/core/model';
import { makeEnvelope, parseEnvelope } from '../../src/core/storage/envelope';
import { BUILTIN_THEMES } from '../../src/core/theme/builtins';

const userTheme = {
  ...BUILTIN_THEMES[0]!,
  id: 'custom:test',
  name: 'Test',
  mode: 'custom' as const,
  builtin: false,
};

describe('export envelope', () => {
  it('round trips valid data', () => {
    const envelope = makeEnvelope({
      themes: [userTheme],
      sites: { 'example.com': createSiteConfig('example.com') },
    });
    const result = parseEnvelope(JSON.stringify(envelope));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.themes).toHaveLength(1);
      expect(result.value.sites['example.com']?.siteId).toBe('example.com');
    }
  });

  it('rejects malformed JSON', () => {
    const result = parseEnvelope('{ nope');
    expect(result.ok).toBe(false);
  });

  it('rejects a file over the size limit before parsing', () => {
    const result = parseEnvelope('x'.repeat(LIMITS.importBytes + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/larger than/i);
  });

  it('rejects the wrong kind', () => {
    const envelope = { ...makeEnvelope({ themes: [], sites: {} }), kind: 'other' };
    expect(parseEnvelope(JSON.stringify(envelope)).ok).toBe(false);
  });

  it('rejects a theme with a script-ish color', () => {
    const envelope = makeEnvelope({
      themes: [{ ...userTheme, colors: { ...userTheme.colors, text: 'url(https://evil.example)' } }],
      sites: {},
    });
    const result = parseEnvelope(JSON.stringify(envelope));
    expect(result.ok).toBe(false);
  });

  it('rejects too many themes', () => {
    const themes = Array.from({ length: LIMITS.themes + 1 }, (_, index) => ({
      ...userTheme,
      id: `custom:${index}`,
      name: `T${index}`,
    }));
    const result = parseEnvelope(JSON.stringify(makeEnvelope({ themes, sites: {} })));
    expect(result.ok).toBe(false);
  });

  it('rejects too many sites', () => {
    const sites: Record<string, ReturnType<typeof createSiteConfig>> = {};
    for (let index = 0; index < LIMITS.sites + 1; index += 1) {
      const id = `site${index}.example`;
      sites[id] = createSiteConfig(id);
    }
    const result = parseEnvelope(JSON.stringify(makeEnvelope({ themes: [], sites })));
    expect(result.ok).toBe(false);
  });
});
