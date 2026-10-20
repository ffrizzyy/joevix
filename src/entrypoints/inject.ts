import { browser } from 'wxt/browser';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { t } from '../core/i18n';
import {
  containerSupportsOrder,
  detectSections,
  summarizeDetection,
  type AdapterDetection,
} from '../core/layout/detect';
import { WIDTH_DEFAULT, type LayoutDraft } from '../core/layout/editor';
import { startEditSession, type EditSessionHandle } from '../core/layout/edit-ui';
import { buildLayoutCss, resolveHidden, resolveOrder } from '../core/layout/sections';
import type { ApplyPayload, LayoutSave, Result, SectionReport } from '../core/messaging';
import type { Theme } from '../core/model';
import { THEME_ATTR, buildThemeCss, scopeSelector } from '../core/theme/css';

type BootFlag = { __joevixBooted?: boolean };

const SECTION_ATTR = 'data-joevix-section';
const SECTION_LABEL_ATTR = 'data-joevix-section-label';

const EDIT_CSS = `
${scopeSelector()} [${SECTION_ATTR}] {
  outline: 1px dashed var(--jx-accent, #7a7a7a) !important;
  outline-offset: 2px !important;
}

@media (forced-colors: active) {
  ${scopeSelector()} [${SECTION_ATTR}] {
    outline: 1px dashed CanvasText !important;
  }
}
`;

let payload: ApplyPayload | null = null;
let detection: AdapterDetection | null = null;
let supportsOrder = false;
let movable: string[] = [];
let editSession: EditSessionHandle | null = null;
let pendingEdit = false;
let reportTimer: number | undefined;
let lastReport = '';
let observer: MutationObserver | null = null;
let systemMedia: MediaQueryList | null = null;
let systemHandler: (() => void) | null = null;

const sheets: Record<'theme' | 'layout' | 'edit', CSSStyleSheet | null> = {
  theme: null,
  layout: null,
  edit: null,
};

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

function attach(which: keyof typeof sheets, css: string): void {
  if (!('adoptedStyleSheets' in document)) return;
  let sheet = sheets[which];
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheets[which] = sheet;
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }
  sheet.replaceSync(css);
}

function detach(which: keyof typeof sheets): void {
  const sheet = sheets[which];
  if (!sheet) return;
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter((item) => item !== sheet);
  sheets[which] = null;
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

/** Rebuilds the section map for the current DOM (NFR-03: never throws). */
function refreshDetection(): void {
  const adapter = payload?.adapter ?? null;
  detection = adapter ? detectSections(adapter, document) : null;
  supportsOrder = detection ? containerSupportsOrder(detection.container) : false;
  movable = detection && supportsOrder ? [...detection.reorderable] : [];
}

function currentDraft(): LayoutDraft {
  const keys = detection?.sections.map((section) => section.key) ?? [];
  const order = resolveOrder(keys, payload?.config.order ?? []);
  return {
    order,
    hidden: resolveHidden(order, payload?.config.hidden ?? []),
    widthPx: payload?.config.contentWidthPx ?? WIDTH_DEFAULT,
  };
}

function defaultDraft(): LayoutDraft {
  const sections = detection?.sections ?? [];
  return {
    order: sections.map((section) => section.key),
    hidden: sections.filter((section) => section.defaultHidden).map((section) => section.key),
    widthPx: WIDTH_DEFAULT,
  };
}

/** Applies a draft through CSS only (ADR-6). */
function applyLayout(draft: LayoutDraft, withOrder: boolean): void {
  const adapter = payload?.adapter ?? null;
  if (!adapter || !detection) {
    detach('layout');
    return;
  }

  const selectors: Record<string, string> = {};
  for (const section of detection.sections) selectors[section.key] = section.selector;

  const css = buildLayoutCss({
    order: withOrder ? draft.order : [],
    hidden: draft.hidden,
    selectors,
    containerSupportsOrder: supportsOrder,
    containerSelector: adapter.container,
    scope: scopeSelector(),
    // 720 is the natural default: leave the page's own width alone until the
    // user actually picks a different reading width.
    contentWidthPx: draft.widthPx === WIDTH_DEFAULT ? undefined : draft.widthPx,
  });

  if (css) attach('layout', css);
  else detach('layout');
}

/** True once the draft order differs from the adapter's declared order. */
function orderChanged(draft: LayoutDraft): boolean {
  const natural = detection?.sections.map((section) => section.key) ?? [];
  return (
    draft.order.length !== natural.length ||
    draft.order.some((key, index) => key !== natural[index])
  );
}

function applySavedLayout(): void {
  if (editSession) return;
  if (!detection) refreshDetection();
  const savedOrder = payload?.config.order ?? [];
  applyLayout(currentDraft(), savedOrder.length > 0);
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
    attach('theme', buildThemeCss(theme));
    if (!payload.theme) listenForSchemeChange();
    else stopListening();
    applySavedLayout();
  } catch {
    // Never leave a half-styled page behind (NFR-03).
    clear();
  }
}

function unmarkSections(): void {
  const marked = document.querySelectorAll(`[${SECTION_ATTR}]`);
  for (const element of marked) {
    element.removeAttribute(SECTION_ATTR);
    element.removeAttribute(SECTION_LABEL_ATTR);
  }
}

function markSections(): void {
  unmarkSections();
  if (!detection) return;
  for (const section of detection.sections) {
    for (const element of section.elements) {
      element.setAttribute(SECTION_ATTR, section.key);
      element.setAttribute(SECTION_LABEL_ATTR, section.label);
    }
  }
}

function clear(): void {
  editSession?.destroy();
  editSession = null;
  pendingEdit = false;
  unmarkSections();
  detach('edit');
  detach('layout');
  payload = null;
  detection = null;
  supportsOrder = false;
  movable = [];
  stopListening();
  detach('theme');
  document.documentElement?.removeAttribute(THEME_ATTR);
}

function endEdit(): void {
  if (!editSession) return;
  editSession.destroy();
  editSession = null;
  unmarkSections();
  detach('edit');
  applySavedLayout();
}

async function finishEdit(draft: LayoutDraft): Promise<void> {
  const session = editSession;
  session?.setStatus(t('editSaving'));
  const message: LayoutSave = {
    type: 'layout-save',
    order: draft.order,
    hidden: draft.hidden,
    contentWidthPx: draft.widthPx,
  };

  let saved = false;
  try {
    const response = (await browser.runtime.sendMessage(message)) as Result<unknown> | undefined;
    saved = response?.ok === true;
  } catch {
    saved = false;
  }

  if (!saved) {
    session?.setStatus(t('editFailed'), 'error');
    return;
  }
  endEdit();
}

function startEdit(): boolean {
  if (editSession) return true;
  const adapter = payload?.adapter ?? null;
  if (!payload || !adapter) return false;
  if (document.readyState === 'loading') {
    // The content script runs at document_start; wait for the parser.
    pendingEdit = true;
    return true;
  }

  refreshDetection();
  if (!detection || !detection.container) return false;
  if (detection.sections.every((section) => section.elements.length === 0)) return false;

  const draft = currentDraft();

  try {
    markSections();
    attach('edit', EDIT_CSS);
    applyLayout(draft, (payload.config.order?.length ?? 0) > 0);
    editSession = startEditSession({
      doc: document,
      sections: detection.sections,
      movable,
      draft,
      defaultDraft: defaultDraft(),
      onChange: (next) => applyLayout(next, orderChanged(next)),
      onDone: (next) => void finishEdit(next),
      onCancel: () => endEdit(),
    });
  } catch {
    // A page that blocks the overlay still gets its saved layout back.
    editSession?.destroy();
    editSession = null;
    unmarkSections();
    detach('edit');
    applySavedLayout();
    return false;
  }

  return true;
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
    if (editSession) return;
    refreshDetection();
    if (pendingEdit) {
      pendingEdit = false;
      if (startEdit()) return;
    }
    applySavedLayout();
    reportSections();
  }, 100);
}

function reportSections(): void {
  const adapter = payload?.adapter ?? null;
  const summary = adapter && detection ? summarizeDetection(detection) : null;
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

    if (pendingEdit) {
      pendingEdit = false;
      startEdit();
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

    if (message.type === 'edit-start') {
      if (payload?.adapter) {
        sendResponse({ ok: startEdit() });
      } else {
        // The payload may still be in flight; start as soon as it lands.
        pendingEdit = true;
        sendResponse({ ok: true });
      }
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
