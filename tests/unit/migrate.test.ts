import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS, createSiteConfig } from '../../src/core/model';
import { migrate } from '../../src/core/storage/migrate';
import { BUILTIN_THEMES } from '../../src/core/theme/builtins';

const validSite = createSiteConfig('example.com');
const validTheme = {
  ...BUILTIN_THEMES[0]!,
  id: 'custom:kept',
  name: 'Kept',
  mode: 'custom' as const,
  builtin: false,
};

describe('migrate', () => {
  it('fills defaults for an empty store and flags a migration', () => {
    const result = migrate({});
    expect(result.store.meta.schemaVersion).toBe(1);
    expect(result.store.themes).toEqual([]);
    expect(result.store.sites).toEqual({});
    expect(result.store.settings.enabledEverywhere).toBe(true);
    expect(result.migrated).toBe(true);
    expect(result.downgraded).toBe(false);
  });

  it('preserves valid stored data', () => {
    const result = migrate({
      [STORAGE_KEYS.meta]: { schemaVersion: 1 },
      [STORAGE_KEYS.themes]: [validTheme],
      [STORAGE_KEYS.sites]: { 'example.com': validSite },
      [STORAGE_KEYS.settings]: { enabledEverywhere: false, onboarded: true, defaultThemeId: 'system' },
    });
    expect(result.migrated).toBe(false);
    expect(result.store.themes).toHaveLength(1);
    expect(result.store.sites['example.com']?.siteId).toBe('example.com');
    expect(result.store.settings.enabledEverywhere).toBe(false);
  });

  it('drops invalid records without losing valid ones', () => {
    const result = migrate({
      [STORAGE_KEYS.themes]: [validTheme, { ...validTheme, id: 'custom:bad', colors: {} }],
      [STORAGE_KEYS.sites]: {
        'example.com': validSite,
        'bad site': { siteId: 'bad site' },
      },
    });
    expect(result.store.themes.map((theme) => theme.id)).toEqual(['custom:kept']);
    expect(Object.keys(result.store.sites)).toEqual(['example.com']);
  });

  it('forces stored themes to be non-builtin', () => {
    const result = migrate({
      [STORAGE_KEYS.themes]: [{ ...validTheme, builtin: true }],
    });
    expect(result.store.themes[0]?.builtin).toBe(false);
  });

  it('flags a downgrade from a newer schema', () => {
    const result = migrate({ [STORAGE_KEYS.meta]: { schemaVersion: 99 } });
    expect(result.downgraded).toBe(true);
  });
});
