import { describe, expect, it } from 'vitest';
import {
  HISTORY_CAP,
  clampWidth,
  commit,
  createHistory,
  draftsEqual,
  moveAmong,
  moveAmongTo,
  redo,
  setWidth,
  toggleHidden,
  undo,
  type LayoutDraft,
} from '../../src/core/layout/editor';

const base: LayoutDraft = { order: ['a', 'b', 'c'], hidden: [], widthPx: 720 };

describe('history', () => {
  it('starts empty and clones the present', () => {
    const history = createHistory(base);
    history.present.order.push('ghost');
    expect(base.order).toEqual(['a', 'b', 'c']);
  });

  it('records commits and caps the past at 20', () => {
    let history = createHistory(base);
    for (let index = 0; index < 25; index += 1) {
      history = commit(history, { ...history.present, widthPx: 480 + index });
    }
    expect(history.past).toHaveLength(HISTORY_CAP);
    for (let index = 0; index < HISTORY_CAP; index += 1) history = undo(history);
    expect(history.past).toHaveLength(0);
    // The oldest retained state is 5 steps in, not the original.
    expect(history.present.widthPx).toBe(484);
    expect(undo(history)).toBe(history);
  });

  it('ignores identical drafts', () => {
    const history = createHistory(base);
    expect(commit(history, { ...base, order: [...base.order] })).toBe(history);
  });

  it('undo and redo preserve order', () => {
    let history = createHistory(base);
    history = commit(history, { ...base, order: ['b', 'a', 'c'] });
    history = commit(history, { ...history.present, hidden: ['a'] });

    history = undo(history);
    expect(history.present.hidden).toEqual([]);
    expect(history.present.order).toEqual(['b', 'a', 'c']);

    history = redo(history);
    expect(history.present.hidden).toEqual(['a']);

    history = undo(history);
    history = undo(history);
    expect(history.present).toEqual(base);
    expect(history.future).toHaveLength(2);
  });

  it('clears redo after a new commit', () => {
    let history = createHistory(base);
    history = commit(history, { ...base, widthPx: 600 });
    history = undo(history);
    expect(history.future).toHaveLength(1);
    history = commit(history, { ...base, widthPx: 500 });
    expect(history.future).toHaveLength(0);
  });

  it('compares drafts field by field', () => {
    expect(draftsEqual(base, { ...base, order: [...base.order] })).toBe(true);
    expect(draftsEqual(base, { ...base, hidden: ['a'] })).toBe(false);
  });
});

describe('moveAmong', () => {
  it('skips keys that CSS cannot move', () => {
    const moved = moveAmong(base, 'b', ['a', 'b'], -1);
    expect(moved.order).toEqual(['b', 'a', 'c']);
  });

  it('stops at the ends and ignores unknown keys', () => {
    expect(moveAmong(base, 'a', ['a', 'b'], -1)).toBe(base);
    expect(moveAmong(base, 'b', ['a', 'b'], 1)).toBe(base);
    expect(moveAmong(base, 'ghost', ['a', 'b'], 1)).toBe(base);
  });

  it('moves a key to a dragged target', () => {
    expect(moveAmongTo(base, 'c', 'a', ['a', 'c']).order).toEqual(['c', 'a', 'b']);
    expect(moveAmongTo(base, 'a', 'c', ['a', 'c']).order).toEqual(['b', 'a', 'c']);
    expect(moveAmongTo(base, 'b', 'a', ['a', 'c'])).toBe(base);
  });
});

describe('hide and width', () => {
  it('toggles hidden keys without duplicates', () => {
    const hidden = toggleHidden(base, 'a');
    expect(hidden.hidden).toEqual(['a']);
    expect(toggleHidden(hidden, 'a').hidden).toEqual([]);
    expect(toggleHidden(base, 'ghost')).toBe(base);
  });

  it('clamps and rounds the reading width', () => {
    expect(clampWidth(100)).toBe(480);
    expect(clampWidth(5000)).toBe(1200);
    expect(clampWidth(719.6)).toBe(720);
    expect(clampWidth(Number.NaN)).toBe(720);
    expect(setWidth(base, 900).widthPx).toBe(900);
    expect(setWidth(base, 720)).toBe(base);
  });
});
