import { browser } from 'wxt/browser';
import type { Result, UiCommand } from '../core/messaging';

export async function send<T>(command: UiCommand): Promise<Result<T>> {
  try {
    const response = (await browser.runtime.sendMessage(command)) as Result<T> | undefined;
    if (!response) return { ok: false, error: 'Joevix is not responding.' };
    return response;
  } catch {
    return { ok: false, error: 'Joevix is not responding.' };
  }
}

export async function activeTab(): Promise<{ id?: number; url?: string }> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return { id: tab?.id, url: tab?.url };
  } catch {
    return {};
  }
}

export async function openOptions(hash = ''): Promise<void> {
  const url = browser.runtime.getURL('/options.html');
  await browser.tabs.create({ url: hash ? `${url}#${hash}` : url });
  window.close();
}

export function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
