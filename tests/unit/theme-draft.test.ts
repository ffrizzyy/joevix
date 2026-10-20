import { describe, expect, it } from 'vitest';
import { getBuiltinTheme } from '../../src/core/theme/builtins';
import { draftFromTheme, draftToTheme } from '../../src/entrypoints/options/theme-editor';

const dark = getBuiltinTheme('builtin:dark')!;

describe('theme drafts', () => {
  it('turns a built-in into an unsaved, copied draft', () => {
    const draft = draftFromTheme(dark);
    expect(draft.id).toBeNull();
    expect(draft.name).toBe(`${dark.name} copy`);
    expect(draft.colors).toEqual(dark.colors);
    expect(draft.colors).not.toBe(dark.colors);
    expect(draft.font).not.toBe(dark.font);
  });

  it('keeps the id of a saved custom theme', () => {
    const custom = { ...dark, id: 'custom:abc', builtin: false, name: 'Mine' };
    expect(draftFromTheme(custom).id).toBe('custom:abc');
    expect(draftFromTheme(custom).name).toBe('Mine');
  });

  it('duplicates a custom theme under a new id', () => {
    const custom = { ...dark, id: 'custom:abc', builtin: false, name: 'Mine' };
    const copy = draftFromTheme(custom, true);
    expect(copy.id).toBeNull();
    expect(copy.name).toBe('Mine copy');
  });

  it('converts a draft back into a custom theme', () => {
    const theme = draftToTheme(
      { id: null, name: '  Night bus  ', colors: dark.colors, font: dark.font },
      'custom:new',
    );
    expect(theme).toMatchObject({
      id: 'custom:new',
      name: 'Night bus',
      mode: 'custom',
      builtin: false,
      schemaVersion: 1,
    });
  });

  it('does not mutate the source theme', () => {
    const draft = draftFromTheme(dark);
    draft.colors.background = '#123456';
    expect(dark.colors.background).not.toBe('#123456');
  });
});
