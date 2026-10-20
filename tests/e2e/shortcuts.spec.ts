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

test.describe('keyboard shortcuts (FR-47)', () => {
  test('registers the action, edit, and theme commands', async () => {
    const session: Session = await launchExtension();
    try {
      const commands = await openCommands(session.context, session.extensionId);
      const registered = await commands.evaluate(async () => {
        const chromeApi = (
          globalThis as unknown as {
            chrome: { commands: { getAll: () => Promise<Array<{ name: string }>> } };
          }
        ).chrome;
        return (await chromeApi.commands.getAll()).map((item) => item.name);
      });
      expect(registered).toEqual(
        expect.arrayContaining(['_execute_action', 'toggle-edit', 'cycle-theme']),
      );
    } finally {
      await session.dispose();
    }
  });

  test('edit-toggle starts and cancels a session', async () => {
    const session = await launchExtension();
    try {
      const fixture = await openFixture(session.context);
      const commands = await openCommands(session.context, session.extensionId);
      const tabId = await enableSite(commands, session.worker);
      await waitForTheme(fixture);

      const start = await command(commands, { type: 'start-edit', url: PAGE_URL, tabId });
      expect(start.ok).toBe(true);
      await fixture.waitForSelector('[data-joevix-edit="on"]');

      await commands.evaluate(async (id) => {
        const chromeApi = (
          globalThis as unknown as {
            chrome: {
              tabs: { sendMessage: (tabId: number, message: unknown) => Promise<unknown> };
            };
          }
        ).chrome;
        await chromeApi.tabs.sendMessage(id, { type: 'edit-toggle' });
      }, tabId);
      await fixture.waitForSelector('[data-joevix-edit="on"]', { state: 'detached' });

      await commands.evaluate(async (id) => {
        const chromeApi = (
          globalThis as unknown as {
            chrome: {
              tabs: { sendMessage: (tabId: number, message: unknown) => Promise<unknown> };
            };
          }
        ).chrome;
        await chromeApi.tabs.sendMessage(id, { type: 'edit-toggle' });
      }, tabId);
      await fixture.waitForSelector('[data-joevix-edit="on"]');
    } finally {
      await session.dispose();
    }
  });
});
