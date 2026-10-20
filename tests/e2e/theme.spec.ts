import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
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

test.describe('theme application', () => {
  let session: Session;
  let fixture: Page;
  let commands: Page;
  let tabId: number;

  test.beforeEach(async () => {
    session = await launchExtension();
    fixture = await openFixture(session.context);
    commands = await openCommands(session.context, session.extensionId);
    tabId = await enableSite(commands, session.worker);
  });

  test.afterEach(async () => {
    await session.dispose();
  });

  test('applies the default theme and survives a reload', async () => {
    await waitForTheme(fixture);
    await expect
      .poll(() =>
        fixture.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--jx-bg').trim(),
        ),
      )
      .toBe('#fbfbfa');

    const dark = await command(commands, {
      type: 'set-theme',
      url: PAGE_URL,
      themeId: 'builtin:dark',
      tabId,
    });
    expect(dark.ok).toBe(true);
    await expect
      .poll(() =>
        fixture.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--jx-bg').trim(),
        ),
      )
      .toBe('#191919');

    await fixture.reload();
    await waitForTheme(fixture);
    await expect
      .poll(() =>
        fixture.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--jx-bg').trim(),
        ),
      )
      .toBe('#191919');
  });

  test('follows the system color scheme', async () => {
    const system = await command(commands, {
      type: 'set-theme',
      url: PAGE_URL,
      themeId: 'system',
      tabId,
    });
    expect(system.ok).toBe(true);

    await fixture.emulateMedia({ colorScheme: 'dark' });
    await expect
      .poll(() =>
        fixture.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--jx-bg').trim(),
        ),
      )
      .toBe('#191919');

    await fixture.emulateMedia({ colorScheme: 'light' });
    await expect
      .poll(() =>
        fixture.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--jx-bg').trim(),
        ),
      )
      .toBe('#fbfbfa');
  });

  test('syncs a theme change to another open tab', async () => {
    await waitForTheme(fixture);
    const second = await openFixture(session.context);
    await waitForTheme(second);

    const sepia = await command(commands, {
      type: 'set-theme',
      url: PAGE_URL,
      themeId: 'builtin:sepia',
      tabId,
    });
    expect(sepia.ok).toBe(true);

    for (const page of [fixture, second]) {
      await expect
        .poll(() =>
          page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--jx-bg').trim(),
          ),
        )
        .toBe('#f4ecd8');
    }
    await second.close();
  });

  test('global off clears every tab and restores when re-enabled', async () => {
    await waitForTheme(fixture);

    const off = await command(commands, { type: 'set-enabled-everywhere', enabled: false });
    expect(off.ok).toBe(true);
    await waitForTheme(fixture, false);

    const on = await command(commands, { type: 'set-enabled-everywhere', enabled: true });
    expect(on.ok).toBe(true);
    await waitForTheme(fixture);
  });

  test('font size persists after reload', async () => {
    await waitForTheme(fixture);
    const size = await command(commands, {
      type: 'set-font-size',
      url: PAGE_URL,
      sizePx: 24,
      tabId,
    });
    expect(size.ok).toBe(true);

    await expect
      .poll(() =>
        fixture.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--jx-size').trim(),
        ),
      )
      .toBe('24px');

    await fixture.reload();
    await waitForTheme(fixture);
    await expect
      .poll(() =>
        fixture.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--jx-size').trim(),
        ),
      )
      .toBe('24px');
  });

  test('reset removes the override without touching the page content', async () => {
    await waitForTheme(fixture);
    const reset = await command(commands, { type: 'reset-site', url: PAGE_URL, tabId });
    expect(reset.ok).toBe(true);
    await waitForTheme(fixture, false);
    await expect(fixture.locator('[data-lyrics-container="true"]')).toContainText(
      'First lyric line',
    );

    await fixture.reload();
    await waitForTheme(fixture, false);
  });

  test('makes no network requests outside the page origin', async () => {
    const external: string[] = [];
    session.context.on('request', (request) => {
      const url = request.url();
      if (/^https?:/.test(url) && !url.startsWith('https://genius.com')) external.push(url);
    });

    await waitForTheme(fixture);
    await command(commands, {
      type: 'set-theme',
      url: PAGE_URL,
      themeId: 'builtin:sepia',
      tabId,
    });
    await fixture.waitForTimeout(500);
    expect(external).toEqual([]);
  });
});
