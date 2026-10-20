import type { Adapter } from './adapter';
import { isSafeSelector } from './sections';

export type DetectedSection = {
  key: string;
  label: string;
  selector: string;
  defaultHidden: boolean;
  /** Zero or more matches. A lyrics block can be split across containers. */
  elements: Element[];
};

export type AdapterDetection = {
  adapterId: string;
  container: Element | null;
  sections: DetectedSection[];
  /** Keys that did not match. They are skipped, never guessed at. */
  missing: string[];
  /**
   * Keys that CSS `order` can move: exactly one element, and that element is a
   * direct child of the adapter's container (ADR-6).
   */
  reorderable: string[];
};

function query(root: ParentNode, selector: string): Element | null {
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

function queryAll(root: ParentNode, selector: string): Element[] {
  try {
    return [...root.querySelectorAll(selector)];
  } catch {
    return [];
  }
}

/**
 * Resolves an adapter against a live document (or a fixture). A missing
 * container or selector yields `missing` instead of an exception, so a broken
 * adapter skips its section and never breaks the page (NFR-03).
 */
export function detectSections(
  adapter: Adapter,
  root: ParentNode,
  containerSelector: string = adapter.container,
): AdapterDetection {
  const container = isSafeSelector(containerSelector) ? query(root, containerSelector) : null;

  const sections = adapter.sections.map((section): DetectedSection => {
    const elements =
      container && isSafeSelector(section.selector) ? queryAll(container, section.selector) : [];
    return {
      key: section.key,
      label: section.label,
      selector: section.selector,
      defaultHidden: section.defaultHidden ?? false,
      elements,
    };
  });

  const missing = sections
    .filter((section) => section.elements.length === 0)
    .map((section) => section.key);
  const reorderable = sections
    .filter(
      (section) =>
        section.elements.length === 1 &&
        container !== null &&
        section.elements[0]?.parentElement === container,
    )
    .map((section) => section.key);

  return { adapterId: adapter.id, container, sections, missing, reorderable };
}

/** `order` works in flex and grid containers only. */
export function containerSupportsOrder(container: Element | null): boolean {
  if (!container) return false;
  const view = container.ownerDocument.defaultView;
  const display = view?.getComputedStyle(container).display ?? '';
  return display.includes('flex') || display.includes('grid');
}

export type DetectionSummary = {
  found: number;
  missing: number;
  reorderable: number;
};

export function summarizeDetection(detection: AdapterDetection): DetectionSummary {
  return {
    found: detection.sections.length - detection.missing.length,
    missing: detection.missing.length,
    reorderable: detection.reorderable.length,
  };
}
