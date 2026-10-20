import { en, type MessageKey } from '../locales/en';
import { id } from '../locales/id';

export type { MessageKey };
export type Locale = 'en' | 'id';

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, id };

/**
 * The extension UI follows the browser language (NFR-09). Only `en` and `id`
 * ship; every other language falls back to English.
 */
export function localeFor(language: string | null | undefined): Locale {
  const base = language?.toLowerCase().split(/[-_]/)[0];
  return base === 'id' ? 'id' : 'en';
}

function detectLanguage(): string | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.language;
}

const current: Locale = localeFor(detectLanguage());

export function currentLocale(): Locale {
  return current;
}

export function t(key: MessageKey): string {
  return catalogs[current][key];
}
