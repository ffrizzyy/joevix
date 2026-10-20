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
