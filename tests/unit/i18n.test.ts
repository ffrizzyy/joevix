import { describe, expect, it } from 'vitest';
import { localeFor } from '../../src/core/i18n';
import { en } from '../../src/locales/en';
import { id } from '../../src/locales/id';

describe('locales (NFR-09)', () => {
  it('ships every English key in Indonesian', () => {
    expect(Object.keys(id).sort()).toEqual(Object.keys(en).sort());
  });

  it('has no empty strings', () => {
    for (const [key, value] of Object.entries(id)) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('maps browser languages to a supported catalog', () => {
    expect(localeFor('id')).toBe('id');
    expect(localeFor('id-ID')).toBe('id');
    expect(localeFor('ID_id')).toBe('id');
    expect(localeFor('en-US')).toBe('en');
    expect(localeFor('de-DE')).toBe('en');
    expect(localeFor(undefined)).toBe('en');
    expect(localeFor('')).toBe('en');
  });
});
