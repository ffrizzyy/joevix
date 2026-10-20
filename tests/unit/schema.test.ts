import { describe, expect, it } from 'vitest';
import { ContentCommandSchema, LayoutSaveSchema, UiCommandSchema } from '../../src/core/messaging';
import {
  LIMITS,
  SettingsSchema,
  SiteConfigSchema,
  ThemeSchema,
  createSiteConfig,
  defaultSettings,
} from '../../src/core/model';

const validTheme = {
  id: 'custom:one',
  name: 'Mine',
  mode: 'custom',
  colors: {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#111111',
    muted: '#666666',
    accent: '#0055AA',
    border: '#DDDDDD',
  },
  font: { family: 'serif', sizePx: 20, lineHeight: 1.8, letterSpacingEm: 0.01, align: 'start' },
};

describe('ThemeSchema', () => {
  it('normalizes colors to lowercase and fills version defaults', () => {
    const theme = ThemeSchema.parse(validTheme);
    expect(theme.colors.background).toBe('#ffffff');
    expect(theme.schemaVersion).toBe(1);
    expect(theme.builtin).toBe(false);
  });

  it('rejects non-hex colors', () => {
    const broken = { ...validTheme, colors: { ...validTheme.colors, text: 'red' } };
    expect(ThemeSchema.safeParse(broken).success).toBe(false);
  });

  it('rejects out-of-range font values', () => {
    const broken = { ...validTheme, font: { ...validTheme.font, sizePx: 11 } };
    expect(ThemeSchema.safeParse(broken).success).toBe(false);
  });

  it('rejects long names and odd ids', () => {
    expect(ThemeSchema.safeParse({ ...validTheme, name: 'x'.repeat(41) }).success).toBe(false);
    expect(ThemeSchema.safeParse({ ...validTheme, id: 'has space' }).success).toBe(false);
  });
});

describe('SiteConfigSchema', () => {
  it('applies defaults', () => {
    const config = SiteConfigSchema.parse({ siteId: 'example.com' });
    expect(config.enabled).toBe(true);
    expect(config.themeId).toBe('system');
    expect(config.layout).toBe('single');
    expect(config.contentWidthPx).toBe(720);
    expect(config.fontSizePx).toBeNull();
    expect(config.order).toEqual([]);
    expect(config.hidden).toEqual([]);
  });

  it('rejects invalid site ids and oversized orders', () => {
    expect(SiteConfigSchema.safeParse({ siteId: 'not a host' }).success).toBe(false);
    const many = Array.from({ length: LIMITS.orderEntries + 1 }, (_, index) => `s${index}`);
    expect(SiteConfigSchema.safeParse({ siteId: 'example.com', order: many }).success).toBe(false);
  });

  it('creates a config with a timestamp', () => {
    const before = Date.now();
    const config = createSiteConfig('example.com', { enabled: false });
    expect(config.siteId).toBe('example.com');
    expect(config.enabled).toBe(false);
    expect(config.updatedAt).toBeGreaterThanOrEqual(before);
  });
});

describe('SettingsSchema', () => {
  it('rounds out defaults', () => {
    const settings = defaultSettings();
    expect(settings.enabledEverywhere).toBe(true);
    expect(settings.onboarded).toBe(false);
    expect(settings.defaultThemeId).toBe('system');
  });

  it('keeps an explicit default theme id', () => {
    const settings = SettingsSchema.parse({ defaultThemeId: 'builtin:dark' });
    expect(settings.defaultThemeId).toBe('builtin:dark');
  });
});

describe('edit-mode messages', () => {
  it('accepts the start-edit UI command and edit-start content command', () => {
    expect(
      UiCommandSchema.safeParse({ type: 'start-edit', url: 'https://example.com/', tabId: 3 })
        .success,
    ).toBe(true);
    expect(ContentCommandSchema.safeParse({ type: 'edit-start' }).success).toBe(true);
  });

  it('bounds the layout-save payload', () => {
    const valid = {
      type: 'layout-save',
      order: ['lyrics', 'comments'],
      hidden: ['comments'],
      contentWidthPx: 720,
    };
    expect(LayoutSaveSchema.safeParse(valid).success).toBe(true);
    expect(LayoutSaveSchema.safeParse({ ...valid, contentWidthPx: 300 }).success).toBe(false);
    expect(LayoutSaveSchema.safeParse({ ...valid, order: ['x'.repeat(65)] }).success).toBe(false);
  });
});
