import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { adapterForUrl } from '../adapters';
import { getBuiltinTheme, systemTheme } from '../core/theme/builtins';
import { allThemes, findTheme } from '../core/theme/resolve';
import {
  ContentHelloSchema,
  SectionReportSchema,
  UiCommandSchema,
  fail,
  ok,
  type ApplyPayload,
  type Diagnostics,
  type Result,
  type SectionReport,
  type SiteState,
  type UiCommand,
} from '../core/messaging';
import {
  SCHEMA_VERSION,
  STORAGE_KEYS,
  createSiteConfig,
  defaultSettings,
  type SiteConfig,
  type Store,
  type Theme,
} from '../core/model';
import { parseSiteUrl } from '../core/site';
import { makeEnvelope, parseEnvelope } from '../core/storage/envelope';
import {
  StorageFullError,
  clearAll,
  deleteSite,
  deleteTheme,
  onStoreChanged,
  putSite,
  readStore,
  writeSettings,
  writeSites,
  writeThemes,
} from '../core/storage/store';

const CONTENT_SCRIPT_FILE = 'inject.js';
/** Same file, in the form WXT's typed scripting API expects. */
const CONTENT_SCRIPT_PATH = '/inject.js';
const SCRIPT_ID_PREFIX = 'joevix-';

/**
 * Last section report per tab. Kept in memory: it is derived from the page and
 * cheap to rebuild on the next load, so it does not belong in storage.
 */
const sectionReports = new Map<number, { siteId: string; report: SectionReport }>();

function scriptId(siteId: string): string {
  return `${SCRIPT_ID_PREFIX}${siteId.replace(/[^a-z0-9]/g, '-')}`.slice(0, 64);
}

function toMessage(error: unknown): string {
  if (error instanceof StorageFullError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

function isExtensionPage(sender: Browser.runtime.MessageSender): boolean {
  if (sender.tab) return false;
  const url = sender.url ?? '';
  return sender.id === browser.runtime.id && url.startsWith(browser.runtime.getURL(''));
}

async function hasPermission(originPattern: string): Promise<boolean> {
  try {
    return await browser.permissions.contains({ origins: [originPattern] });
  } catch {
    return false;
  }
}

async function ensureRegistered(siteId: string, originPattern: string): Promise<void> {
  const id = scriptId(siteId);
  try {
    const existing = await browser.scripting.getRegisteredContentScripts();
    if (existing.some((script) => script.id === id)) return;
    await browser.scripting.registerContentScripts([
      {
        id,
        matches: [originPattern],
        js: [CONTENT_SCRIPT_FILE],
        runAt: 'document_start',
        allFrames: false,
        persistAcrossSessions: true,
      },
    ]);
  } catch (error) {
    // Registration is an optimization; injection still works without it.
    console.warn('[joevix] could not register content script', error);
  }
}

async function unregister(siteId: string): Promise<void> {
  try {
    const id = scriptId(siteId);
    const existing = await browser.scripting.getRegisteredContentScripts();
    if (existing.some((script) => script.id === id)) {
      await browser.scripting.unregisterContentScripts({ ids: [id] });
    }
  } catch {
    /* nothing to remove */
  }
}

async function unregisterAll(): Promise<void> {
  try {
    await browser.scripting.unregisterContentScripts();
  } catch {
    /* nothing to remove */
  }
}

async function inject(tabId: number): Promise<boolean> {
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT_PATH] });
    return true;
  } catch {
    return false;
  }
}

async function sendToTab(tabId: number | undefined, message: unknown): Promise<boolean> {
  if (tabId === undefined) return false;
  try {
    await browser.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    return false;
  }
}

function buildPayload(store: Store, config: SiteConfig, url: string): ApplyPayload | null {
  if (!config.enabled || !store.settings.enabledEverywhere) return null;

  const withFont = (theme: Theme): Theme =>
    config.fontSizePx === null
      ? theme
      : { ...theme, font: { ...theme.font, sizePx: config.fontSizePx } };

  const adapter = adapterForUrl(url);

  if (config.themeId === 'system') {
    return {
      config,
      theme: null,
      system: { light: withFont(systemTheme('light')), dark: withFont(systemTheme('dark')) },
      adapter,
    };
  }

  return {
    config,
    theme: withFont(findTheme(config.themeId, store.themes) ?? getBuiltinTheme('builtin:light')!),
    system: null,
    adapter,
  };
}

/** Applies the current state to one tab, injecting the content script if needed. */
async function syncTab(tabId: number | undefined, url: string): Promise<void> {
  if (tabId === undefined) return;
  const parsed = parseSiteUrl(url);
  if (!parsed) return;
  const store = await readStore();
  const config = store.sites[parsed.siteId];
  const allowed = await hasPermission(parsed.originPattern);

  if (!config || !config.enabled || !store.settings.enabledEverywhere || !allowed) {
    await sendToTab(tabId, { type: 'reset' });
    return;
  }

  const payload = buildPayload(store, config, url);
  if (!payload) {
    await sendToTab(tabId, { type: 'reset' });
    return;
  }

  const delivered = await sendToTab(tabId, { type: 'apply', payload });
  if (!delivered) {
    const injected = await inject(tabId);
    // The content script asks for its payload on boot (`content-hello`).
    if (!injected) return;
  }
}

async function syncAllTabs(): Promise<void> {
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    if (tab.id === undefined || !tab.url) continue;
    await syncTab(tab.id, tab.url);
  }
}

async function getOrCreateConfig(store: Store, siteId: string): Promise<SiteConfig> {
  return (
    store.sites[siteId] ??
    createSiteConfig(siteId, { enabled: false, themeId: store.settings.defaultThemeId })
  );
}

async function handleSiteState(
  command: Extract<UiCommand, { type: 'get-site-state' }>,
): Promise<Result<SiteState>> {
  const parsed = parseSiteUrl(command.url);
  if (!parsed) return fail('This page cannot be themed.');

  const store = await readStore();
  const config = await getOrCreateConfig(store, parsed.siteId);
  const themes = allThemes(store.themes);
  const missingTheme =
    config.themeId !== 'system' && !themes.some((theme) => theme.id === config.themeId);
  const adapter = adapterForUrl(command.url);
  const reported = command.tabId === undefined ? undefined : sectionReports.get(command.tabId);
  const report = reported?.siteId === parsed.siteId ? reported.report : null;

  return ok({
    siteId: parsed.siteId,
    originPattern: parsed.originPattern,
    supported: true,
    hasPermission: await hasPermission(parsed.originPattern),
    config,
    themes,
    settings: store.settings,
    missingTheme,
    adapterAvailable: adapter !== null,
    adapterId: adapter?.id ?? null,
    sections: report
      ? { found: report.found, missing: report.missing, reorderable: report.reorderable }
      : null,
  });
}

async function mutateSite(
  url: string,
  mutate: (config: SiteConfig) => SiteConfig,
  after?: (config: SiteConfig) => Promise<void>,
): Promise<Result<SiteConfig>> {
  const parsed = parseSiteUrl(url);
  if (!parsed) return fail('This page cannot be themed.');
  const store = await readStore();
  const existing = await getOrCreateConfig(store, parsed.siteId);
  const adapter = adapterForUrl(url);
  const next = {
    ...mutate(existing),
    adapterId: adapter?.id ?? null,
    adapterVersion: adapter?.schemaVersion ?? null,
    updatedAt: Date.now(),
  };
  await putSite(next);
  if (after) await after(next);
  return ok(next);
}

async function handleUi(
  command: UiCommand,
  _sender: Browser.runtime.MessageSender,
): Promise<Result<unknown>> {
  switch (command.type) {
    case 'get-site-state':
      return handleSiteState(command);

    case 'set-theme': {
      if (command.themeId !== 'system') {
        const store = await readStore();
        if (!findTheme(command.themeId, store.themes)) return fail('That theme no longer exists.');
      }
      return mutateSite(
        command.url,
        (config) => ({ ...config, themeId: command.themeId }),
        async () => syncTab(command.tabId, command.url),
      );
    }

    case 'set-font-size':
      return mutateSite(
        command.url,
        (config) => ({ ...config, fontSizePx: command.sizePx }),
        async () => syncTab(command.tabId, command.url),
      );

    case 'set-enabled': {
      const parsed = parseSiteUrl(command.url);
      if (!parsed) return fail('This page cannot be themed.');
      if (command.enabled && !(await hasPermission(parsed.originPattern))) {
        return fail('Joevix needs access to this site to change how it looks.');
      }

      const store = await readStore();
      const existing = await getOrCreateConfig(store, parsed.siteId);
      const next: SiteConfig = { ...existing, enabled: command.enabled, updatedAt: Date.now() };
      await putSite(next);

      if (command.enabled) {
        await ensureRegistered(parsed.siteId, parsed.originPattern);
        await syncTab(command.tabId, command.url);
      } else {
        await unregister(parsed.siteId);
        await sendToTab(command.tabId, { type: 'reset' });
      }
      return ok(next);
    }

    case 'reset-site': {
      const parsed = parseSiteUrl(command.url);
      if (!parsed) return fail('This page cannot be themed.');
      await deleteSite(parsed.siteId);
      await unregister(parsed.siteId);
      await sendToTab(command.tabId, { type: 'reset' });
      return ok({ reset: true });
    }

    case 'set-enabled-everywhere': {
      const store = await readStore();
      await writeSettings({ ...store.settings, enabledEverywhere: command.enabled });
      await syncAllTabs();
      return ok({ enabledEverywhere: command.enabled });
    }

    case 'get-themes': {
      const store = await readStore();
      return ok({ themes: allThemes(store.themes) });
    }

    case 'get-sites': {
      const store = await readStore();
      return ok({
        sites: Object.values(store.sites).sort((a, b) => a.siteId.localeCompare(b.siteId)),
      });
    }

    case 'get-settings': {
      const store = await readStore();
      return ok({ settings: store.settings });
    }

    case 'save-theme': {
      const store = await readStore();
      const themes = store.themes.filter((theme) => theme.id !== command.theme.id);
      themes.push({ ...command.theme, builtin: false, schemaVersion: SCHEMA_VERSION });
      await writeThemes(themes);
      // A theme that was just edited must repaint the sites already using it.
      await syncAllTabs();
      return ok({ saved: true });
    }

    case 'delete-theme': {
      await deleteTheme(command.themeId);
      await syncAllTabs();
      return ok({ deleted: true });
    }

    case 'preview-theme': {
      const store = await readStore();
      const tabs = await browser.tabs.query({});
      let previewed = 0;

      for (const tab of tabs) {
        if (tab.id === undefined || !tab.url) continue;
        const parsed = parseSiteUrl(tab.url);
        if (!parsed) continue;

        const config = store.sites[parsed.siteId];
        if (!config || !config.enabled || !store.settings.enabledEverywhere) continue;
        if (!(await hasPermission(parsed.originPattern))) continue;

        const payload: ApplyPayload = {
          config,
          theme: command.theme,
          system: null,
          adapter: adapterForUrl(tab.url),
        };
        let delivered = await sendToTab(tab.id, { type: 'apply', payload });
        if (!delivered) {
          const injected = await inject(tab.id);
          if (injected) delivered = await sendToTab(tab.id, { type: 'apply', payload });
        }
        if (delivered) previewed += 1;
      }

      return ok({ previewed });
    }

    case 'end-preview': {
      await syncAllTabs();
      return ok({ restored: true });
    }

    case 'delete-site': {
      await deleteSite(command.siteId);
      await unregister(command.siteId);
      await syncAllTabs();
      return ok({ deleted: true });
    }

    case 'export-data': {
      const store = await readStore();
      const json = JSON.stringify(
        makeEnvelope({ themes: store.themes, sites: store.sites, settings: store.settings }),
        null,
        2,
      );
      return ok({ json });
    }

    case 'import-data': {
      const parsed = parseEnvelope(command.json);
      if (!parsed.ok) return fail(parsed.error);

      const store = await readStore();
      const themes: Theme[] =
        command.mode === 'merge'
          ? [
              ...store.themes.filter((t) => !parsed.value.themes.some((i) => i.id === t.id)),
              ...parsed.value.themes,
            ]
          : parsed.value.themes;
      const sites =
        command.mode === 'merge' ? { ...store.sites, ...parsed.value.sites } : parsed.value.sites;

      await writeThemes(themes);
      await writeSites(sites);
      if (parsed.value.settings) await writeSettings(parsed.value.settings);
      await syncAllTabs();

      return ok({ themes: themes.length, sites: Object.keys(sites).length });
    }

    case 'delete-all': {
      const permissions = await browser.permissions.getAll();
      const origins = (permissions.origins ?? []).filter((origin) => origin.startsWith('http'));
      if (origins.length > 0) {
        await browser.permissions.remove({ origins });
      }
      await unregisterAll();
      await clearAll();
      await syncAllTabs();
      return ok({ deleted: true });
    }

    case 'get-diagnostics': {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const parsed = parseSiteUrl(tabs[0]?.url);
      return ok<Diagnostics>({
        version: browser.runtime.getManifest().version,
        siteId: parsed?.siteId ?? null,
        adapterId: adapterForUrl(tabs[0]?.url)?.id ?? null,
        createdAt: Date.now(),
      });
    }

    default:
      return fail('Unknown command.');
  }
}

async function handleHello(
  sender: Browser.runtime.MessageSender,
): Promise<Result<ApplyPayload | null>> {
  if (!sender.tab) return fail('Not a page.');
  const parsed = parseSiteUrl(sender.url);
  if (!parsed) return fail('This page cannot be themed.');

  const store = await readStore();
  const config = store.sites[parsed.siteId];
  if (!config) return ok(null);

  const allowed = await hasPermission(parsed.originPattern);
  if (!allowed) return ok(null);

  return ok(buildPayload(store, config, sender.url ?? ''));
}

async function seedIfNeeded(): Promise<void> {
  const raw = await browser.storage.local.get([STORAGE_KEYS.meta, STORAGE_KEYS.settings]);
  if (!raw[STORAGE_KEYS.meta]) {
    await browser.storage.local.set({
      [STORAGE_KEYS.meta]: { schemaVersion: SCHEMA_VERSION },
      [STORAGE_KEYS.settings]: raw[STORAGE_KEYS.settings] ?? defaultSettings(),
    });
  }
}

export default defineBackground(() => {
  void seedIfNeeded();

  browser.runtime.onInstalled.addListener(() => {
    void seedIfNeeded();
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (isExtensionPage(sender)) {
      const parsed = UiCommandSchema.safeParse(message);
      if (!parsed.success) {
        sendResponse(fail('Malformed command.'));
        return false;
      }
      void handleUi(parsed.data, sender)
        .then(sendResponse)
        .catch((error) => sendResponse(fail(toMessage(error))));
      return true;
    }

    const report = SectionReportSchema.safeParse(message);
    if (report.success) {
      const tabId = sender.tab?.id;
      const siteId = parseSiteUrl(sender.url)?.siteId;
      if (tabId !== undefined) {
        if (siteId && report.data.adapterId !== null) {
          sectionReports.set(tabId, { siteId, report: report.data });
        } else {
          sectionReports.delete(tabId);
        }
      }
      sendResponse(ok({ recorded: tabId !== undefined && siteId !== undefined }));
      return false;
    }

    const hello = ContentHelloSchema.safeParse(message);
    if (hello.success) {
      void handleHello(sender)
        .then(sendResponse)
        .catch(() => sendResponse(fail('Could not load settings.')));
      return true;
    }

    return false;
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    sectionReports.delete(tabId);
  });

  browser.permissions.onRemoved.addListener((removed) => {
    const origins = removed.origins ?? [];
    if (origins.length === 0) return;
    void (async () => {
      const tabs = await browser.tabs.query({});
      const registered = await browser.scripting.getRegisteredContentScripts().catch(() => []);
      for (const origin of origins) {
        const host = origin.replace(/^https?:\/\//, '').replace(/\/\*$/, '');

        for (const script of registered) {
          if (script.matches?.some((pattern) => pattern.includes(host))) {
            await browser.scripting
              .unregisterContentScripts({ ids: [script.id] })
              .catch(() => undefined);
          }
        }

        for (const tab of tabs) {
          if (tab.id === undefined || !tab.url) continue;
          let hostname: string;
          try {
            hostname = new URL(tab.url).hostname;
          } catch {
            continue;
          }
          if (hostname === host) {
            await sendToTab(tab.id, { type: 'reset' });
          }
        }
      }
    })();
  });

  // Cross-tab live sync (FR-37).
  let timer: ReturnType<typeof setTimeout> | undefined;
  onStoreChanged(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void syncAllTabs();
    }, 100);
  });
});
