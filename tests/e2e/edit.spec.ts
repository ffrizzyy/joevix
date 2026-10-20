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

const hostSelector = '[data-joevix-edit="on"]';
const info = '[data-testid="song-header"]';
const comments = '.SongCommentsWithAds__Container-test';

test.describe('layout edit mode', () => {
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

  async function startEdit(): Promise<void> {
    const result = await command(commands, { type: 'start-edit', url: PAGE_URL, tabId });
    expect(result.ok).toBe(true);
    await fixture.waitForSelector(hostSelector);
  }

  test('reorders, hides, saves width, and persists after reload', async () => {
    await startEdit();
    await fixture.locator('[data-jv="sections"]').click();

    await fixture.locator('[data-jv-key="lyrics"] [data-jv="up"]').click();
    await expect(fixture.locator('.status')).toHaveText('Section moved to position 1');
    await expect
      .poll(() => fixture.locator(info).evaluate((element) => getComputedStyle(element).order))
      .toBe('1');

    await fixture.locator(`[data-jv-key="comments"] [data-jv="hide"]`).click();
    await expect
      .poll(() =>
        fixture.locator(comments).evaluate((element) => getComputedStyle(element).display),
      )
      .toBe('none');

    await fixture.locator('input[type="range"]').evaluate((element) => {
      const input = element as HTMLInputElement;
      input.value = '900';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await fixture.locator('[data-jv="done"]').click();
    await fixture.waitForSelector(hostSelector, { state: 'detached' });

    await expect
      .poll(() => fixture.locator('main').evaluate((element) => getComputedStyle(element).maxWidth))
      .toBe('900px');
    await expect
      .poll(() =>
        fixture.locator(comments).evaluate((element) => getComputedStyle(element).display),
      )
      .toBe('none');

    await fixture.reload();
    await waitForTheme(fixture);
    await expect
      .poll(() => fixture.locator(info).evaluate((element) => getComputedStyle(element).order))
      .toBe('1');
    await expect
      .poll(() =>
        fixture.locator(comments).evaluate((element) => getComputedStyle(element).display),
      )
      .toBe('none');
    await expect
      .poll(() => fixture.locator('main').evaluate((element) => getComputedStyle(element).maxWidth))
      .toBe('900px');
  });

  test('Escape cancels unsaved changes and restores the saved layout', async () => {
    await startEdit();
    await fixture.locator('[data-jv="sections"]').click();

    await fixture.locator('[data-jv-key="info"] [data-jv="hide"]').click();
    await expect
      .poll(() => fixture.locator(info).evaluate((element) => getComputedStyle(element).display))
      .toBe('none');

    await fixture.keyboard.press('Escape');
    await fixture.waitForSelector(hostSelector, { state: 'detached' });
    await expect
      .poll(() => fixture.locator(info).evaluate((element) => getComputedStyle(element).display))
      .not.toBe('none');

    const state = await command(commands, { type: 'get-site-state', url: PAGE_URL, tabId });
    expect(state.ok).toBe(true);
    if (state.ok) {
      const data = state.data as { config: { hidden: string[] } };
      expect(data.config.hidden).not.toContain('info');
    }
  });
});
