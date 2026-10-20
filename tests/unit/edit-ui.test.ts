// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DetectedSection } from '../../src/core/layout/detect';
import { startEditSession, type EditSessionHandle } from '../../src/core/layout/edit-ui';

let handle: EditSessionHandle | null = null;

afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
  document.querySelectorAll('[data-joevix-edit]').forEach((element) => element.remove());
});

function section(key: string, label: string, element: Element): DetectedSection {
  return { key, label, selector: `.${key}`, defaultHidden: false, elements: [element] };
}

function setup() {
  const main = document.createElement('main');
  const a = document.createElement('div');
  const b = document.createElement('div');
  const c = document.createElement('div');
  a.textContent = 'A';
  b.textContent = 'B';
  c.textContent = 'C';
  main.append(a, b, c);
  document.body.append(main);

  const onChange = vi.fn();
  const onDone = vi.fn();
  const onCancel = vi.fn();
  const draft = { order: ['a', 'b', 'c'], hidden: [], widthPx: 720 };
  handle = startEditSession({
    doc: document,
    sections: [section('a', 'Alpha', a), section('b', 'Beta', b), section('c', 'Gamma', c)],
    movable: ['a', 'b'],
    draft,
    defaultDraft: { order: ['a', 'b', 'c'], hidden: [], widthPx: 720 },
    onChange,
    onDone,
    onCancel,
  });

  const host = document.querySelector<HTMLElement>('[data-joevix-edit="on"]');
  if (!host?.shadowRoot) throw new Error('edit host missing');
  return { host, shadow: host.shadowRoot, onChange, onDone, onCancel };
}

function click(shadow: ShadowRoot, action: string, key?: string): void {
  const selector = key ? `[data-jv-key="${key}"] [data-jv="${action}"]` : `[data-jv="${action}"]`;
  const button = shadow.querySelector<HTMLButtonElement>(selector);
  if (!button) throw new Error(`button ${action} ${key ?? ''} missing`);
  button.click();
}

function lastDraft(fn: ReturnType<typeof vi.fn>) {
  return fn.mock.calls.at(-1)?.[0];
}

describe('edit session', () => {
  it('renders one row per declared section', () => {
    const { shadow } = setup();
    expect(shadow.querySelectorAll('[data-jv-key]')).toHaveLength(3);
    expect(shadow.querySelector('[data-jv-key="a"] .name')?.textContent).toBe('Alpha');
    expect(shadow.querySelector('[data-jv-key="a"] svg')).not.toBeNull();
    expect(
      shadow.querySelector('[data-jv-key="a"] [data-jv="up"]')?.getAttribute('aria-label'),
    ).toBe('Move up: Alpha');
  });

  it('moves a section with the keyboard buttons and undoes it', () => {
    const { shadow, onChange } = setup();

    click(shadow, 'up', 'b');
    expect(lastDraft(onChange).order).toEqual(['b', 'a', 'c']);
    expect(shadow.querySelector('.status')?.textContent).toBe('Section moved to position 1');

    click(shadow, 'undo');
    expect(lastDraft(onChange).order).toEqual(['a', 'b', 'c']);

    click(shadow, 'redo');
    expect(lastDraft(onChange).order).toEqual(['b', 'a', 'c']);
  });

  it('only moves sections the page can reorder', () => {
    const { shadow } = setup();
    const up = shadow.querySelector<HTMLButtonElement>('[data-jv-key="c"] [data-jv="up"]');
    expect(up?.disabled).toBe(true);
  });

  it('keeps focus on the moved section for keyboard reordering', () => {
    const { shadow } = setup();
    click(shadow, 'sections');
    const up = shadow.querySelector<HTMLButtonElement>('[data-jv-key="b"] [data-jv="up"]');
    if (!up) throw new Error('up button missing');
    up.focus();
    up.click();
    const active = shadow.activeElement as HTMLElement | null;
    expect(active?.closest('[data-jv-key]')?.getAttribute('data-jv-key')).toBe('b');
  });

  it('hides and shows a section', () => {
    const { shadow, onChange } = setup();

    click(shadow, 'hide', 'a');
    expect(lastDraft(onChange).hidden).toEqual(['a']);
    expect(shadow.querySelector('[data-jv-key="a"] [data-jv="show"]')).not.toBeNull();

    click(shadow, 'show', 'a');
    expect(lastDraft(onChange).hidden).toEqual([]);
  });

  it('passes the working draft to Done', () => {
    const { shadow, onDone } = setup();
    click(shadow, 'up', 'b');
    click(shadow, 'done');
    expect(onDone).toHaveBeenCalledWith({ order: ['b', 'a', 'c'], hidden: [], widthPx: 720 });
  });

  it('cancels on Escape', () => {
    const { onCancel } = setup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('commits the width slider once, on change', () => {
    const { shadow, onChange, onDone } = setup();
    const input = shadow.querySelector<HTMLInputElement>('.width input');
    if (!input) throw new Error('width input missing');

    input.value = '900';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(lastDraft(onChange).widthPx).toBe(900);

    input.dispatchEvent(new Event('change', { bubbles: true }));
    click(shadow, 'done');
    expect(onDone).toHaveBeenCalledWith({ order: ['a', 'b', 'c'], hidden: [], widthPx: 900 });
  });

  it('removes its host on destroy', () => {
    const { host } = setup();
    handle?.destroy();
    handle = null;
    expect(host.isConnected).toBe(false);
  });
});
