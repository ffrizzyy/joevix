import { browser } from 'wxt/browser';
import { t } from '../i18n';
import {
  LIMITS,
  STORAGE_KEYS,
  type Settings,
  type SiteConfig,
  type Store,
  type Theme,
} from '../model';
import { migrate } from './migrate';

export class StorageFullError extends Error {
  constructor() {
    super(t('storageFull'));
    this.name = 'StorageFullError';
  }
}

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /quota/i.test(message);
}

async function write(items: Record<string, unknown>): Promise<void> {
  try {
    await browser.storage.local.set(items);
  } catch (error) {
    if (isQuotaError(error)) throw new StorageFullError();
    throw error;
  }
}

export async function readStore(): Promise<Store> {
  const raw = (await browser.storage.local.get([
    STORAGE_KEYS.meta,
    STORAGE_KEYS.settings,
    STORAGE_KEYS.themes,
    STORAGE_KEYS.sites,
  ])) as Record<string, unknown>;

  return migrate(raw).store;
}

export async function writeSettings(settings: Settings): Promise<void> {
  await write({ [STORAGE_KEYS.settings]: settings });
}

export async function writeThemes(themes: Theme[]): Promise<void> {
  if (themes.length > LIMITS.themes) throw new StorageFullError();
  await write({ [STORAGE_KEYS.themes]: themes });
}

export async function putSite(config: SiteConfig): Promise<void> {
  const store = await readStore();
  if (!store.sites[config.siteId] && Object.keys(store.sites).length >= LIMITS.sites) {
    throw new StorageFullError();
  }
  await write({ [STORAGE_KEYS.sites]: { ...store.sites, [config.siteId]: config } });
}

export async function writeSites(sites: Store['sites']): Promise<void> {
  if (Object.keys(sites).length > LIMITS.sites) throw new StorageFullError();
  await write({ [STORAGE_KEYS.sites]: sites });
}

export async function deleteSite(siteId: string): Promise<void> {
  const store = await readStore();
  const sites = { ...store.sites };
  delete sites[siteId];
  await write({ [STORAGE_KEYS.sites]: sites });
}

/**
 * Deleting a theme detaches it from every site instead of leaving dangling
 * references (FR-08, FR-51).
 */
export async function deleteTheme(themeId: string): Promise<void> {
  const store = await readStore();
  const themes = store.themes.filter((theme) => theme.id !== themeId);
  const sites = { ...store.sites };
  for (const [key, config] of Object.entries(sites)) {
    if (config.themeId === themeId) {
      sites[key] = { ...config, themeId: 'system', updatedAt: Date.now() };
    }
  }
  await write({ [STORAGE_KEYS.themes]: themes, [STORAGE_KEYS.sites]: sites });
}

export async function writeMetaSchema(version: number): Promise<void> {
  await write({ [STORAGE_KEYS.meta]: { schemaVersion: version } });
}

export async function clearAll(): Promise<void> {
  await browser.storage.local.clear();
}

export function onStoreChanged(listener: () => void): () => void {
  const handler = (
    changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
    area: string,
  ) => {
    if (area !== 'local') return;
    if (Object.keys(changes).some((key) => key.startsWith('joevix:'))) listener();
  };
  browser.storage.onChanged.addListener(handler);
  return () => browser.storage.onChanged.removeListener(handler);
}
