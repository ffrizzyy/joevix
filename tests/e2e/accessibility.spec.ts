import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  command,
  enableSite,
  launchExtension,
  openCommands,
  openFixture,
  openInactivePopup,
  runAxe,
  waitForTheme,
  type Session,
} from './helpers';

test.describe('accessibility and first run', () => {
  let session: Session;
  let fixture: Page;
  let commands: Page;
  let tabId: number;

  test.beforeEach(async () => {
    session = await launchExtension();
    fixture = await openFixture(session.context);
    commands = await openCommands(session.context, session.extensionId);
    tabId = await enableSite(commands, session.worker);
    await waitForTheme(fixture);
  });

  test.afterEach(async () => {
    await session.dispose();
  });

  test('options page has no automated WCAG A/AA violations', async () => {
    const violations = await runAxe(commands);
    expect(violations).toEqual([]);
  });

  test('options tabs support arrow-key navigation and narrow viewports', async () => {
    await commands.locator('#tab-themes').focus();
    await commands.keyboard.press('ArrowRight');
    await expect(commands.locator('#tab-sites')).toBeFocused();
    await expect(commands.locator('#tab-sites')).toHaveAttribute('aria-selected', 'true');

    await commands.setViewportSize({ width: 320, height: 600 });
    const overflows = await commands.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows).toBe(false);

    await commands.locator('#tab-data').click();
    await commands.locator('input[type="file"]').focus();
    await expect(commands.locator('input[type="file"]')).toBeFocused();
  });

  test('welcome card appears once and the popup has no WCAG A/AA violations', async () => {
    await commands.close();
    let popup = await openInactivePopup(session, tabId);
    await expect(popup.locator('#welcome-title')).toHaveText('Choose how pages should look.');
    await popup.close();

    commands = await openCommands(session.context, session.extensionId);
    const welcome = await command(commands, {
      type: 'complete-welcome',
      themeId: 'builtin:dark',
    });
    expect(welcome.ok).toBe(true);
    await commands.close();

    popup = await openInactivePopup(session, tabId);
    await expect(popup.locator('.host')).toHaveText('genius.com');
    await expect(popup.locator('#theme-label')).toBeVisible();
    await popup.setViewportSize({ width: 320, height: 600 });
    const overflows = await popup.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows).toBe(false);

    const violations = await runAxe(popup);
    expect(violations).toEqual([]);
    await popup.close();
  });
});
