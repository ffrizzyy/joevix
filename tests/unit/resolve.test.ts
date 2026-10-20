import { describe, expect, it } from 'vitest';
import { nextThemeId } from '../../src/core/theme/resolve';

describe('theme shortcut cycle (FR-47)', () => {
  const ids = ['builtin:light', 'builtin:dark', 'custom:one'];

  it('starts with system and walks every theme', () => {
    expect(nextThemeId('system', ids)).toBe('builtin:light');
    expect(nextThemeId('builtin:light', ids)).toBe('builtin:dark');
    expect(nextThemeId('builtin:dark', ids)).toBe('custom:one');
  });

  it('wraps to system and recovers from a deleted theme', () => {
    expect(nextThemeId('custom:one', ids)).toBe('system');
    expect(nextThemeId('custom:deleted', ids)).toBe('system');
    expect(nextThemeId('system', [])).toBe('system');
  });
});
