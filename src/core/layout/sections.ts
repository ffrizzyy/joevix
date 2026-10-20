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
export function resolveOrder(
  availableKeys: readonly string[],
  savedOrder: readonly string[],
): string[] {
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
  /** Prefix every rule with this scope, e.g. `html[data-joevix="on"]`. */
  scope?: string;
  /** Per-site reading width (FR-25); ignored when the container is unsafe or absent. */
  contentWidthPx?: number;
};

const WIDTH_MIN = 480;
const WIDTH_MAX = 1200;

/**
 * Layout is CSS only (ADR-6). Anything unsupported is skipped rather than
 * approximated with DOM moves.
 */
export function buildLayoutCss(input: LayoutInput): string {
  const scope = input.scope ? `${input.scope} ` : '';
  const blocks: string[] = [];
  const container =
    input.containerSelector && isSafeSelector(input.containerSelector)
      ? input.containerSelector
      : null;

  // Never restyle the container itself: `order` already works in any flex or
  // grid parent, and turning a block into flex can break a site's layout.
  if (container && input.contentWidthPx !== undefined) {
    const width = Math.round(input.contentWidthPx);
    if (Number.isFinite(width) && width >= WIDTH_MIN && width <= WIDTH_MAX) {
      blocks.push(
        `${container} { max-width: ${width}px !important; margin-left: auto !important; margin-right: auto !important; }`,
      );
    }
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

  return blocks.map((block) => `${scope}${block}`).join('\n');
}
