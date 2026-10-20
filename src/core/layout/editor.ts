/**
 * Layout editing is a small state machine: a draft (order, hidden, width), an
 * undo/redo history, and a handful of pure transitions. Everything here is
 * free of DOM and storage so the rules are unit-testable (FR-21, 22, 23, 26).
 */

/** FR-26: 20-step history; `Done` clears it (ADR-10). */
export const HISTORY_CAP = 20;

export const WIDTH_MIN = 480;
export const WIDTH_MAX = 1200;
export const WIDTH_DEFAULT = 720;

export type LayoutDraft = {
  order: string[];
  hidden: string[];
  widthPx: number;
};

export type LayoutHistory = {
  past: LayoutDraft[];
  present: LayoutDraft;
  future: LayoutDraft[];
};

export function cloneDraft(draft: LayoutDraft): LayoutDraft {
  return { order: [...draft.order], hidden: [...draft.hidden], widthPx: draft.widthPx };
}

export function draftsEqual(a: LayoutDraft, b: LayoutDraft): boolean {
  return (
    a.widthPx === b.widthPx &&
    a.hidden.length === b.hidden.length &&
    a.order.length === b.order.length &&
    a.order.every((key, index) => key === b.order[index]) &&
    a.hidden.every((key, index) => key === b.hidden[index])
  );
}

export function clampWidth(value: number): number {
  if (!Number.isFinite(value)) return WIDTH_DEFAULT;
  return Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.round(value)));
}

export function createHistory(present: LayoutDraft): LayoutHistory {
  return { past: [], present: cloneDraft(present), future: [] };
}

export function canUndo(history: LayoutHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: LayoutHistory): boolean {
  return history.future.length > 0;
}

/** Records a new present. Identical drafts do not create history entries. */
export function commit(history: LayoutHistory, next: LayoutDraft): LayoutHistory {
  if (draftsEqual(history.present, next)) return history;
  const past = [...history.past, cloneDraft(history.present)];
  if (past.length > HISTORY_CAP) past.splice(0, past.length - HISTORY_CAP);
  return { past, present: cloneDraft(next), future: [] };
}

export function undo(history: LayoutHistory): LayoutHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: cloneDraft(previous),
    future: [cloneDraft(history.present), ...history.future],
  };
}

export function redo(history: LayoutHistory): LayoutHistory {
  const [next, ...rest] = history.future;
  if (!next) return history;
  return {
    past: [...history.past, cloneDraft(history.present)],
    present: cloneDraft(next),
    future: rest,
  };
}

/**
 * Swaps a key with the nearest movable neighbour. Non-movable keys are skipped
 * so the visual result always matches the button the user pressed (FR-22).
 */
export function moveAmong(
  draft: LayoutDraft,
  key: string,
  movable: readonly string[],
  delta: -1 | 1,
): LayoutDraft {
  const from = draft.order.indexOf(key);
  if (from < 0 || !movable.includes(key)) return draft;

  let to = from + delta;
  while (to >= 0 && to < draft.order.length && !movable.includes(draft.order[to] ?? '')) {
    to += delta;
  }
  if (to < 0 || to >= draft.order.length) return draft;

  const order = [...draft.order];
  const moved = order[from];
  const replaced = order[to];
  if (moved === undefined || replaced === undefined) return draft;
  order[from] = replaced;
  order[to] = moved;
  return { ...draft, order };
}

/** Drag-and-drop equivalent of `moveAmong`: place `key` where `target` is. */
export function moveAmongTo(
  draft: LayoutDraft,
  key: string,
  target: string,
  movable: readonly string[],
): LayoutDraft {
  if (key === target) return draft;
  if (!movable.includes(key) || !movable.includes(target)) return draft;
  const order = draft.order.filter((item) => item !== key);
  const targetIndex = order.indexOf(target);
  if (targetIndex < 0) return draft;
  order.splice(targetIndex, 0, key);
  return { ...draft, order };
}

export function toggleHidden(draft: LayoutDraft, key: string): LayoutDraft {
  if (!draft.order.includes(key)) return draft;
  const hidden = draft.hidden.includes(key)
    ? draft.hidden.filter((item) => item !== key)
    : [...draft.hidden, key];
  return { ...draft, hidden };
}

export function setWidth(draft: LayoutDraft, widthPx: number): LayoutDraft {
  const next = clampWidth(widthPx);
  if (next === draft.widthPx) return draft;
  return { ...draft, widthPx: next };
}
