import genius from './genius.json';
import { findAdapter, parseAdapters, type Adapter } from '../core/layout/adapter';

/**
 * Bundled, reviewed adapters (ADR-7). Adding one means adding a JSON file and
 * listing it here; `parseAdapters` rejects unsafe selectors at load time and
 * the adapter tests run the same schema in CI.
 */
export const ADAPTERS: readonly Adapter[] = parseAdapters([genius]);

export function adapterForUrl(url: string | undefined | null): Adapter | null {
  if (!url) return null;
  return findAdapter(ADAPTERS, url);
}
