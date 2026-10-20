import { z } from 'zod';

/** Bump when the stored shape changes. One migration per step (spec 5.4). */
export const SCHEMA_VERSION = 1;

export const LIMITS = {
  themes: 100,
  sites: 500,
  importBytes: 256 * 1024,
  totalSerializedBytes: 200 * 1024,
  themeNameChars: 40,
  sections: 100,
  orderEntries: 100,
} as const;

export const STORAGE_KEYS = {
  meta: 'joevix:meta',
  settings: 'joevix:settings',
  themes: 'joevix:themes',
  sites: 'joevix:sites',
} as const;

export const BUILTIN_THEME_IDS = [
  'builtin:light',
  'builtin:dark',
  'builtin:sepia',
  'builtin:contrast',
] as const;

export type BuiltinThemeId = (typeof BUILTIN_THEME_IDS)[number];

/** Colors are always normalized to lowercase #rrggbb, never raw user input. */
export const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected #rrggbb')
  .transform((value) => value.toLowerCase());

export const FontFamilySchema = z.enum(['system', 'serif', 'mono']);
export const TextAlignSchema = z.enum(['start', 'center']);

export const ThemeIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9:_-]+$/, 'Invalid theme id');

export const SiteIdSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(/^[a-z0-9.-]+$/, 'Invalid site id');

export const ThemeFontSchema = z.object({
  family: FontFamilySchema.default('system'),
  sizePx: z.number().int().min(12).max(40).default(18),
  lineHeight: z.number().min(1.2).max(2.2).default(1.7),
  letterSpacingEm: z.number().min(-0.02).max(0.1).default(0),
  align: TextAlignSchema.default('start'),
});

export const ThemeColorsSchema = z.object({
  background: HexColorSchema,
  surface: HexColorSchema,
  text: HexColorSchema,
  muted: HexColorSchema,
  accent: HexColorSchema,
  border: HexColorSchema,
});

export const ThemeSchema = z.object({
  schemaVersion: z.number().int().min(1).max(1000).default(SCHEMA_VERSION),
  id: ThemeIdSchema,
  name: z.string().trim().min(1).max(LIMITS.themeNameChars),
  mode: z.enum(['light', 'dark', 'sepia', 'contrast', 'custom']),
  builtin: z.boolean().default(false),
  colors: ThemeColorsSchema,
  font: ThemeFontSchema,
});

export type Theme = z.infer<typeof ThemeSchema>;
export type ThemeColors = z.infer<typeof ThemeColorsSchema>;
export type ThemeFont = z.infer<typeof ThemeFontSchema>;
export type ColorRole = keyof ThemeColors;

export const SiteConfigSchema = z.object({
  schemaVersion: z.number().int().min(1).max(1000).default(SCHEMA_VERSION),
  siteId: SiteIdSchema,
  enabled: z.boolean().default(true),
  /** "system" is a sentinel; it is not a Theme.mode value. */
  themeId: z.union([z.literal('system'), ThemeIdSchema]).default('system'),
  order: z.array(z.string().min(1).max(64)).max(LIMITS.orderEntries).default([]),
  hidden: z.array(z.string().min(1).max(64)).max(LIMITS.orderEntries).default([]),
  layout: z.enum(['single', 'two', 'focus']).default('single'),
  contentWidthPx: z.number().int().min(480).max(1200).default(720),
  /** Per-site size override; null means "use the theme's size" (FR-07). */
  fontSizePx: z.number().int().min(12).max(40).nullable().default(null),
  adapterId: z.string().min(1).max(64).nullable().default(null),
  adapterVersion: z.number().int().min(1).max(1000).nullable().default(null),
  updatedAt: z.number().int().nonnegative().default(0),
});

export type SiteConfig = z.infer<typeof SiteConfigSchema>;

export const SettingsSchema = z.object({
  schemaVersion: z.number().int().min(1).max(1000).default(SCHEMA_VERSION),
  enabledEverywhere: z.boolean().default(true),
  onboarded: z.boolean().default(false),
  defaultThemeId: z.union([z.literal('system'), ThemeIdSchema]).default('system'),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const MetaSchema = z.object({
  schemaVersion: z.number().int().min(1).max(1000).default(SCHEMA_VERSION),
});

export type Meta = z.infer<typeof MetaSchema>;

export const ThemesArraySchema = z.array(ThemeSchema).max(LIMITS.themes);
export const SitesRecordSchema = z.record(SiteIdSchema, SiteConfigSchema);

export type SitesRecord = z.infer<typeof SitesRecordSchema>;

export type Store = {
  meta: Meta;
  settings: Settings;
  themes: Theme[];
  sites: SitesRecord;
};

export function defaultSettings(): Settings {
  return SettingsSchema.parse({});
}

export function createSiteConfig(
  siteId: string,
  overrides: Partial<SiteConfig> = {},
): SiteConfig {
  return SiteConfigSchema.parse({ siteId, updatedAt: Date.now(), ...overrides });
}

export function isBuiltinThemeId(id: string): id is BuiltinThemeId {
  return (BUILTIN_THEME_IDS as readonly string[]).includes(id);
}

/** Counts sites and themes without loading them into a UI. */
export function serializeStore(store: Store): string {
  return JSON.stringify(store);
}
