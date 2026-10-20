import {
  MetaSchema,
  SCHEMA_VERSION,
  SettingsSchema,
  SiteConfigSchema,
  STORAGE_KEYS,
  ThemeSchema,
  defaultSettings,
  type Meta,
  type Settings,
  type SitesRecord,
  type Store,
  type Theme,
} from '../model';

export type RawStore = Record<string, unknown>;

export type MigrationResult = {
  store: Store;
  migrated: boolean;
  /** Stored data is newer than this build; the UI should stay read-only. */
  downgraded: boolean;
};

function parseThemes(value: unknown): Theme[] {
  if (!Array.isArray(value)) return [];
  const themes: Theme[] = [];
  for (const item of value) {
    const parsed = ThemeSchema.safeParse(item);
    if (parsed.success) themes.push({ ...parsed.data, builtin: false });
  }
  return themes;
}

function parseSites(value: unknown): SitesRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const sites: SitesRecord = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const parsed = SiteConfigSchema.safeParse({ ...(item as Record<string, unknown>), siteId: key });
    if (parsed.success) sites[key] = parsed.data;
  }
  return sites;
}

/**
 * v1 is the first schema, so migration is validation plus defaults. The shape
 * is kept so later versions add one function per step (spec 5.4).
 */
export function migrate(raw: RawStore): MigrationResult {
  const metaParsed = MetaSchema.safeParse(raw[STORAGE_KEYS.meta]);
  const settingsParsed = SettingsSchema.safeParse(raw[STORAGE_KEYS.settings]);

  const storedVersion = metaParsed.success ? metaParsed.data.schemaVersion : 0;
  const meta: Meta = { schemaVersion: Math.max(storedVersion, SCHEMA_VERSION) };

  const settings: Settings = settingsParsed.success ? settingsParsed.data : defaultSettings();

  return {
    store: {
      meta,
      settings: { ...settings, schemaVersion: SCHEMA_VERSION },
      themes: parseThemes(raw[STORAGE_KEYS.themes]),
      sites: parseSites(raw[STORAGE_KEYS.sites]),
    },
    migrated: storedVersion !== SCHEMA_VERSION,
    downgraded: storedVersion > SCHEMA_VERSION,
  };
}
