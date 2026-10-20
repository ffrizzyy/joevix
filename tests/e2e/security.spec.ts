import { expect, test } from '@playwright/test';
import {
  command,
  enableSite,
  launchExtension,
  openCommands,
  openFixture,
  PAGE_URL,
  waitForTheme,
  type Session,
} from './helpers';

const theme = {
  schemaVersion: 1,
  id: 'custom:security-test',
  name: 'Security test',
  mode: 'custom',
  builtin: false,
  colors: {
    background: '#ffffff',
    surface: '#ffffff',
    text: '#111111',
    muted: '#666666',
    accent: '#0055aa',
    border: '#dddddd',
  },
  font: {
    family: 'system',
    sizePx: 18,
    lineHeight: 1.7,
    letterSpacingEm: 0,
    align: 'start',
  },
};

test.describe('security hardening (spec 8.6)', () => {
  let session: Session;

  test.beforeEach(async () => {
    session = await launchExtension();
  });

  test.afterEach(async () => {
    await session.dispose();
  });

  test('a hostile page cannot reach the extension runtime', async () => {
    const fixture = await openFixture(session.context);
    const commands = await openCommands(session.context, session.extensionId);
    await enableSite(commands, session.worker);
    await waitForTheme(fixture);

    const exposure = await fixture.evaluate(() => {
      const pageChrome = (
        globalThis as unknown as { chrome?: { runtime?: { sendMessage?: unknown } } }
      ).chrome;
      return {
        sendMessage: typeof pageChrome?.runtime?.sendMessage,
        editHost: document.querySelectorAll('[data-joevix-edit]').length,
      };
    });

    expect(exposure.sendMessage).toBe('undefined');
    expect(exposure.editHost).toBe(0);
  });

  test('rejects oversized and CSS-injecting imports without changing data', async () => {
    const fixture = await openFixture(session.context);
    const commands = await openCommands(session.context, session.extensionId);
    await enableSite(commands, session.worker);
    await waitForTheme(fixture);

    const oversized = await command(commands, {
      type: 'import-data',
      json: 'x'.repeat(300_001),
      mode: 'replace',
    });
    expect(oversized.ok).toBe(false);

    const savedTheme = await command(commands, { type: 'save-theme', theme });
    expect(savedTheme.ok).toBe(true);

    const exported = await command(commands, { type: 'export-data' });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const envelope = JSON.parse((exported.data as { json: string }).json);
    const target = envelope.themes.find(
      (item: { id: string }) => item.id === 'custom:security-test',
    );
    if (!target) throw new Error('Exported test theme is missing.');
    target.colors.text = 'url(https://evil.example/leak)';

    const injected = await command(commands, {
      type: 'import-data',
      json: JSON.stringify(envelope),
      mode: 'replace',
    });
    expect(injected.ok).toBe(false);

    const themes = await command(commands, { type: 'get-themes' });
    expect(themes.ok).toBe(true);
    if (themes.ok) {
      const data = themes.data as { themes: Array<{ id: string; colors: { text: string } }> };
      const kept = data.themes.find((item) => item.id === 'custom:security-test');
      expect(kept?.colors.text).toBe('#111111');
    }

    const site = await command(commands, { type: 'get-site-state', url: PAGE_URL });
    expect(site.ok).toBe(true);
    if (site.ok) {
      expect((site.data as { config: { enabled: boolean } }).config.enabled).toBe(true);
    }
  });

  test('the edit host exposes adapter labels, never page text', async () => {
    const fixture = await openFixture(session.context);
    const commands = await openCommands(session.context, session.extensionId);
    const tabId = await enableSite(commands, session.worker);
    await waitForTheme(fixture);

    const edit = await command(commands, { type: 'start-edit', url: PAGE_URL, tabId });
    expect(edit.ok).toBe(true);
    await fixture.waitForSelector('[data-joevix-edit="on"]');

    const hostText = await fixture.evaluate(() => {
      const host = document.querySelector('[data-joevix-edit="on"]');
      return host?.shadowRoot?.textContent ?? '';
    });
    expect(hostText).toContain('Lyrics');
    expect(hostText).not.toContain('Is this the real life?');
  });

  test('reset removes styling and unregisters the dynamic content script', async () => {
    const fixture = await openFixture(session.context);
    const commands = await openCommands(session.context, session.extensionId);

    const unregistered = await commands.evaluate(async () => {
      const chromeApi = (
        globalThis as unknown as {
          chrome: {
            scripting: { getRegisteredContentScripts: () => Promise<Array<{ id: string }>> };
          };
        }
      ).chrome;
      return (await chromeApi.scripting.getRegisteredContentScripts()).map((item) => item.id);
    });
    expect(unregistered.some((id) => id.startsWith('joevix-'))).toBe(false);

    const tabId = await enableSite(commands, session.worker);
    await waitForTheme(fixture);

    const before = await commands.evaluate(async () => {
      const chromeApi = (
        globalThis as unknown as {
          chrome: {
            scripting: { getRegisteredContentScripts: () => Promise<Array<{ id: string }>> };
          };
        }
      ).chrome;
      return (await chromeApi.scripting.getRegisteredContentScripts()).map((item) => item.id);
    });
    expect(before.some((id) => id.startsWith('joevix-'))).toBe(true);

    const reset = await command(commands, { type: 'reset-site', url: PAGE_URL, tabId });
    expect(reset.ok).toBe(true);
    await waitForTheme(fixture, false);

    const after = await commands.evaluate(async () => {
      const chromeApi = (
        globalThis as unknown as {
          chrome: {
            scripting: { getRegisteredContentScripts: () => Promise<Array<{ id: string }>> };
          };
        }
      ).chrome;
      return (await chromeApi.scripting.getRegisteredContentScripts()).map((item) => item.id);
    });
    expect(after.some((id) => id.startsWith('joevix-'))).toBe(false);

    const sheets = await fixture.evaluate(() => document.adoptedStyleSheets.length);
    expect(sheets).toBe(0);
  });

  test('delete all clears storage, styling, and registrations', async () => {
    const fixture = await openFixture(session.context);
    const commands = await openCommands(session.context, session.extensionId);
    await enableSite(commands, session.worker);
    await waitForTheme(fixture);

    const deleted = await command(commands, { type: 'delete-all' });
    expect(deleted.ok).toBe(true);
    await waitForTheme(fixture, false);

    const keys = await commands.evaluate(async () => {
      const chromeApi = (
        globalThis as unknown as {
          chrome: { storage: { local: { get: (keys: null) => Promise<Record<string, unknown>> } } };
        }
      ).chrome;
      return Object.keys(await chromeApi.storage.local.get(null));
    });
    expect(keys.filter((key) => key.startsWith('joevix:'))).toEqual([]);

    const scripts = await commands.evaluate(async () => {
      const chromeApi = (
        globalThis as unknown as {
          chrome: {
            scripting: { getRegisteredContentScripts: () => Promise<Array<{ id: string }>> };
          };
        }
      ).chrome;
      return (await chromeApi.scripting.getRegisteredContentScripts()).map((item) => item.id);
    });
    expect(scripts).toEqual([]);
  });

  test('re-applies the theme when a site rewrites the html attributes', async () => {
    const fixture = await openFixture(session.context);
    const commands = await openCommands(session.context, session.extensionId);
    await enableSite(commands, session.worker);
    await waitForTheme(fixture);

    await fixture.evaluate(() => {
      document.documentElement.removeAttribute('data-joevix');
    });
    await waitForTheme(fixture);

    await fixture.evaluate(() => {
      const main = document.querySelector('main');
      main?.replaceWith(main.cloneNode(true));
    });
    await expect
      .poll(() =>
        fixture.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--jx-bg').trim(),
        ),
      )
      .toBe('#fbfbfa');
  });
});
