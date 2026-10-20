import { browser } from 'wxt/browser';
import { t } from '../core/i18n';
import type { Result, UiCommand } from '../core/messaging';

export async function send<T>(command: UiCommand): Promise<Result<T>> {
  try {
    const response = (await browser.runtime.sendMessage(command)) as Result<T> | undefined;
    if (!response) return { ok: false, error: t('notResponding') };
    return response;
  } catch {
    return { ok: false, error: t('notResponding') };
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

/**
 * Clipboard writes need the document focused. The textarea fallback covers
 * browsers where the async API is unavailable; the copied text is local only.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection-based path.
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.setAttribute('aria-hidden', 'true');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    return copied;
  } catch {
    return false;
  }
}
