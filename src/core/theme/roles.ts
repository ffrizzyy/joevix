import type { ColorRole } from '../model';

/**
 * Zod-free list of color roles. The options page imports this, which keeps the
 * validation library out of the UI bundle (the schema lives in `model.ts`).
 */
export const COLOR_ROLES: readonly ColorRole[] = [
  'background',
  'surface',
  'text',
  'muted',
  'accent',
  'border',
];
