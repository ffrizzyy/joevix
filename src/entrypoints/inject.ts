import { browser } from 'wxt/browser';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { detectSections, summarizeDetection } from '../core/layout/detect';
import type { ApplyPayload, Result, SectionReport } from '../core/messaging';
import type { Theme } from '../core/model';
import { THEME_ATTR, buildThemeCss } from '../core/theme/css';

type BootFlag = { __joevixBooted?: boolean };

let payload: ApplyPayload | null = null;
let sheet: CSSStyleSheet | null = null;
let systemMedia: MediaQueryList | null = null;
let systemHandler: (() => void) | null = null;
let observer: MutationObserver | null = null;
let reportTimer: number | undefined;
let lastReport = '';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApplyPayload(value: unknown): value is ApplyPayload {
  if (!isRecord(value)) return false;
  const config = value.config;
  const theme = value.theme;
  const system = value.system;
  const configOk =
    isRecord(config) && typeof config.enabled === 'boolean' && typeof config.siteId === 'string';
  const themeOk = theme === null || (isRecord(theme) && isRecord(theme.colors));
  const systemOk =
    system === null || (isRecord(system) && isRecord(system.light) && isRecord(system.dark));
  const adapter = value.adapter;
  const adapterOk =
    adapter === undefined ||
    adapter === null ||
    (isRecord(adapter) && typeof adapter.id === 'string' && Array.isArray(adapter.sections));
  return configOk && themeOk && systemOk && adapterOk;
}

function chosenTheme(value: ApplyPayload): Theme | null {
  if (value.theme) return value.theme;
  if (!value.system) return null;
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return dark ? value.system.dark : value.system.light;
}

function attachSheet(css: string): void {
  if (!('adoptedStyleSheets' in document)) return;
  if (!sheet) {
    sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }
  sheet.replaceSync(css);
}

function detachSheet(): void {
  if (!sheet) return;
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter((item) => item !== sheet);
  sheet = null;
}

function listenForSchemeChange(): void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  if (systemMedia === media) return;
  if (systemMedia && systemHandler) systemMedia.removeEventListener('change', systemHandler);
  systemMedia = media;
  systemHandler = () => render();
  media.addEventListener('change', systemHandler);
}

function stopListening(): void {
  if (systemMedia && systemHandler) systemMedia.removeEventListener('change', systemHandler);
  systemMedia = null;
  systemHandler = null;
}

function render(): void {
  if (!payload) return;
  const root = document.documentElement;
  if (!root) return;

  const theme = chosenTheme(payload);
  if (!theme) {
    clear();
    return;
  }

  try {
    root.setAttribute(THEME_ATTR, 'on');
    attachSheet(buildThemeCss(theme));
    if (!payload.theme) listenForSchemeChange();
    else stopListening();
  } catch {
    // Never leave a half-styled page behind (NFR-03).
    clear();
  }
}

function clear(): void {
  payload = null;
  stopListening();
  detachSheet();
  document.documentElement?.removeAttribute(THEME_ATTR);
}

/**
 * Detection needs a parsed DOM, and the content script runs at
 * `document_start`. Wait for DOMContentLoaded, then debounce once: no polling
 * and no observer work during the theme path (NFR-02).
 */
function scheduleReport(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleReport, { once: true });
    return;
  }
  if (reportTimer !== undefined) window.clearTimeout(reportTimer);
  reportTimer = window.setTimeout(() => {
    reportTimer = undefined;
    reportSections();
  }, 100);
}

function reportSections(): void {
  const adapter = payload?.adapter ?? null;
  const summary = adapter ? summarizeDetection(detectSections(adapter, document)) : null;
  const report: SectionReport = {
    type: 'section-report',
    adapterId: adapter?.id ?? null,
    found: summary?.found ?? 0,
    missing: summary?.missing ?? 0,
    reorderable: summary?.reorderable ?? 0,
  };

  const serialized = JSON.stringify(report);
  if (serialized === lastReport) return;
  lastReport = serialized;
  void browser.runtime.sendMessage(report).catch(() => undefined);
}

function ensureObserver(): void {
  if (observer || !document.documentElement) return;
  observer = new MutationObserver(() => {
    // Some sites rewrite the html element's attributes wholesale.
    if (payload && document.documentElement && !document.documentElement.hasAttribute(THEME_ATTR)) {
      document.documentElement.setAttribute(THEME_ATTR, 'on');
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [THEME_ATTR],
  });
}

async function hello(): Promise<void> {
  try {
    const result = (await browser.runtime.sendMessage({
      type: 'content-hello',
      url: location.href,
    })) as Result<ApplyPayload | null> | undefined;

    if (result?.ok && result.data && isApplyPayload(result.data)) {
      payload = result.data;
      render();
      scheduleReport();
    }
  } catch {
    // The service worker may be starting up; the next navigation retries.
  }
}

function boot(): void {
  const flags = globalThis as BootFlag;
  if (flags.__joevixBooted) return;
  flags.__joevixBooted = true;

  ensureObserver();

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isRecord(message) || typeof message.type !== 'string') return false;

    if (message.type === 'apply' && isApplyPayload(message.payload)) {
      payload = message.payload;
      render();
      scheduleReport();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === 'reset') {
      clear();
      if (reportTimer !== undefined) window.clearTimeout(reportTimer);
      reportTimer = undefined;
      reportSections();
      sendResponse({ ok: true });
      return false;
    }

    return false;
  });

  // Re-assert after bfcache restores, where adopted sheets can be dropped.
  window.addEventListener('pageshow', () => {
    if (payload) {
      render();
      scheduleReport();
    }
  });

  // Late-rendered sections (ads, recommendations) get one more look.
  window.addEventListener('load', scheduleReport, { once: true });

  void hello();
}

export default defineUnlistedScript({ main: boot });
