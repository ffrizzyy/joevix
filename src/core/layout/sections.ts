import { z } from 'zod';

export const AdapterSectionSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
  label: z.string().min(1).max(60),
  selector: z.string().min(1).max(300),
  defaultHidden: z.boolean().optional(),
});

export const AdapterSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  schemaVersion: z.number().int().min(1).max(1000),
  match: z.array(z.string().min(1).max(300)).min(1).max(20),
  container: z.string().min(1).max(300),
  sections: z.array(AdapterSectionSchema).max(100),
});

export type Adapter = z.infer<typeof AdapterSchema>;
export type AdapterSection = z.infer<typeof AdapterSectionSchema>;

const FORBIDDEN_SELECTOR_TOKENS = [
  ':has(',
  'attr(',
  'url(',
  '@',
  '{',
  '}',
  ';',
  '<',
  ':checked',
  ':target',
  'password',
  'input',
  'textarea',
  '[value',
];

/**
 * Adapters are bundled and reviewed, but a selector still reaches the page.
 * This conservative allowlist keeps out CSS exfiltration and form probing
 * (spec 8.3). It is intentionally stricter than CSS itself.
 */
export function isSafeSelector(selector: string): boolean {
  if (!selector || selector.length > 300) return false;
  if (!/^[\w\s.#:+~*\[\]="'()_,>\-]+$/.test(selector)) return false;
  const lower = selector.toLowerCase();
  return !FORBIDDEN_SELECTOR_TOKENS.some((token) => lower.includes(token));
}

/** Removes unknown keys and duplicates, then appends missing adapter keys. */
export function resolveOrder(availableKeys: readonly string[], savedOrder: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const key of savedOrder) {
    if (availableKeys.includes(key) && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  for (const key of availableKeys) {
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

export function resolveHidden(order: readonly string[], hidden: readonly string[]): string[] {
  const allowed = new Set(order);
  return [...new Set(hidden)].filter((key) => allowed.has(key));
}

export type LayoutInput = {
  order: readonly string[];
  hidden: readonly string[];
  selectors: Readonly<Record<string, string>>;
  /** CSS order only works when the container lays its children out in a flex/grid format. */
  containerSupportsOrder: boolean;
  containerSelector?: string;
};

/**
 * Layout is CSS only (ADR-6). Anything unsupported is skipped rather than
 * approximated with DOM moves.
 */
export function buildLayoutCss(input: LayoutInput): string {
  const blocks: string[] = [];

  if (input.containerSupportsOrder && input.containerSelector && isSafeSelector(input.containerSelector)) {
    blocks.push(`${input.containerSelector} { display: flex !important; flex-direction: column !important; }`);
  }

  input.order.forEach((key, index) => {
    if (!input.containerSupportsOrder) return;
    const selector = input.selectors[key];
    if (!selector || !isSafeSelector(selector)) return;
    if (input.hidden.includes(key)) return;
    blocks.push(`${selector} { order: ${index} !important; }`);
  });

  for (const key of input.hidden) {
    const selector = input.selectors[key];
    if (!selector || !isSafeSelector(selector)) continue;
    blocks.push(`${selector} { display: none !important; }`);
  }

  return blocks.join('\n');
}
