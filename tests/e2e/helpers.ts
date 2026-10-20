import { chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const EXTENSION_PATH = resolve('.output/e2e-chrome');
export const PAGE_URL = 'https://genius.com/Queen-bohemian-rhapsody-lyrics';
export const FIXTURE_HTML = readFileSync(resolve('tests/e2e/fixture-lyrics.html'), 'utf8');

type ChromeTab = { id?: number; url?: string };
type ChromeApi = {
  runtime: {
    sendMessage: (
      message: unknown,
    ) => Promise<{ ok: true; data: unknown } | { ok: false; error: string } | undefined>;
  };
  tabs: {
    query: (query: unknown) => Promise<ChromeTab[]>;
    update: (tabId: number, properties: unknown) => Promise<unknown>;
    create: (properties: unknown) => Promise<ChromeTab>;
  };
};

export type Session = {
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  dispose: () => Promise<void>;
};

export async function launchExtension(): Promise<Session> {
  const userDataDir = mkdtempSync(join(tmpdir(), 'joevix-e2e-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1000, height: 800 },
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
    ],
  });

  await context.route('https://genius.com/**', async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: FIXTURE_HTML });
    } else {
      await route.fulfill({ status: 204, body: '' });
    }
  });

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
  const extensionId = new URL(worker.url()).host;

  return {
    context,
    worker,
    extensionId,
    async dispose() {
      await context.close();
      rmSync(userDataDir, { recursive: true, force: true });
    },
  };
}

export async function openFixture(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(PAGE_URL);
  await page.waitForSelector('main');
  return page;
}

export async function getTabId(worker: Worker, url: string): Promise<number> {
  const tabId = await worker.evaluate(async (target) => {
    const chromeApi = (globalThis as unknown as { chrome: ChromeApi }).chrome;
    const tabs = await chromeApi.tabs.query({});
    return tabs.find((tab) => tab.url === target)?.id;
  }, url);
  if (tabId === undefined) throw new Error(`No tab found for ${url}`);
  return tabId;
}

export async function openCommands(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.waitForSelector('h1');
  return page;
}

export async function command(
  page: Page,
  message: unknown,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const result = await page.evaluate(async (payload) => {
    const chromeApi = (globalThis as unknown as { chrome: ChromeApi }).chrome;
    return chromeApi.runtime.sendMessage(payload);
  }, message);
  if (!result) throw new Error('The service worker did not respond.');
  return result;
}

export async function enableSite(commands: Page, worker: Worker): Promise<number> {
  const tabId = await getTabId(worker, PAGE_URL);
  const result = await command(commands, {
    type: 'set-enabled',
    url: PAGE_URL,
    enabled: true,
    tabId,
  });
  if (!result.ok) throw new Error(result.error);
  return tabId;
}

export async function waitForTheme(page: Page, on = true): Promise<void> {
  await page.waitForFunction(
    (expected) => document.documentElement.getAttribute('data-joevix') === (expected ? 'on' : null),
    on,
  );
}

export async function openInactivePopup(session: Session, tabId: number): Promise<Page> {
  const popupUrl = `chrome-extension://${session.extensionId}/popup.html`;
  await session.worker.evaluate(async (fixtureTabId) => {
    const chromeApi = (globalThis as unknown as { chrome: ChromeApi }).chrome;
    await chromeApi.tabs.update(fixtureTabId, { active: true });
  }, tabId);
  await session.worker.evaluate(async (url) => {
    const chromeApi = (globalThis as unknown as { chrome: ChromeApi }).chrome;
    await chromeApi.tabs.create({ url, active: false });
  }, popupUrl);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const page = session.context.pages().find((candidate) => candidate.url().startsWith(popupUrl));
    if (page) {
      await page.waitForSelector('.host');
      return page;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error('Popup page did not open.');
}

const axeRequire = createRequire(createRequire(import.meta.url).resolve('@axe-core/playwright'));
export const AXE_SOURCE = readFileSync(axeRequire.resolve('axe-core/axe.min.js'), 'utf8');

export type AxeViolation = {
  id: string;
  impact: string | null;
  nodes: string[];
};

export async function runAxe(page: Page): Promise<AxeViolation[]> {
  await page.addInitScript({ content: AXE_SOURCE });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(300);
  const violations = await page.evaluate(async () => {
    type Result = {
      violations: Array<{ id: string; impact: string | null; nodes: Array<{ target: string[] }> }>;
    };
    const axe = (
      globalThis as unknown as {
        axe: { run: (context: Document) => Promise<Result> };
      }
    ).axe;
    const result = await axe.run(document);
    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(' ')),
    }));
  });
  return violations;
}
