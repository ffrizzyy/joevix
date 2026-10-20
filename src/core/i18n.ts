import { en, type MessageKey } from '../locales/en';

export type { MessageKey };

export function t(key: MessageKey): string {
  return en[key];
}
