import { t } from '../i18n';
import type { DetectedSection } from './detect';
import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  moveAmong,
  moveAmongTo,
  redo,
  setWidth,
  toggleHidden,
  undo,
  type LayoutDraft,
  type LayoutHistory,
} from './editor';

/**
 * The in-page edit bar (spec 6.9). Open shadow DOM, namespaced attributes, all
 * chrome inside one host element (ADR-2). The page keeps working underneath:
 * no node is ever moved or removed (ADR-6).
 */

export const EDIT_HOST_ATTR = 'data-joevix-edit';

export type EditSessionHandle = {
  destroy(): void;
  setStatus(text: string, kind?: 'info' | 'error'): void;
};

export type EditSessionOptions = {
  doc: Document;
  sections: DetectedSection[];
  /** Keys that CSS `order` can actually move on this page. */
  movable: string[];
  draft: LayoutDraft;
  /** Adapter defaults: Reset returns here. */
  defaultDraft: LayoutDraft;
  onChange: (draft: LayoutDraft) => void;
  onDone: (draft: LayoutDraft) => void;
  onCancel: () => void;
};

const CSS = `
:host {
  all: initial;
  position: fixed;
  inset: auto 0 16px 0;
  margin: 0 auto;
  width: min(560px, calc(100vw - 20px));
  z-index: 2147483647;
  color-scheme: light dark;
  --jv-bg: #ffffff;
  --jv-text: #1b1a17;
  --jv-muted: #6b6a66;
  --jv-border: #d9d7d0;
  --jv-accent: #2f6f4f;
  --jv-surface: #f4f3ef;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  line-height: 1.4;
}
@media (prefers-color-scheme: dark) {
  :host {
    --jv-bg: #1c1b19;
    --jv-text: #ededea;
    --jv-muted: #a5a29a;
    --jv-border: #3a3833;
    --jv-accent: #8fd0ab;
    --jv-surface: #262521;
  }
}
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: var(--jv-bg);
  color: var(--jv-text);
  border: 1px solid var(--jv-border);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.22);
}
.title { font-weight: 600; margin-right: 4px; }
.spacer { flex: 1; }
button {
  font: inherit;
  color: inherit;
  background: var(--jv-surface);
  border: 1px solid var(--jv-border);
  border-radius: 8px;
  padding: 5px 9px;
  cursor: pointer;
}
button:disabled { opacity: 0.45; cursor: default; }
button[aria-pressed='true'] { border-color: var(--jv-accent); }
.status { color: var(--jv-muted); font-size: 12px; }
.status-error { color: #b3261e; }
.panel {
  margin-top: 6px;
  padding: 10px;
  background: var(--jv-bg);
  color: var(--jv-text);
  border: 1px solid var(--jv-border);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.22);
  max-height: 45vh;
  overflow: auto;
}
.hint { margin: 0 0 8px; color: var(--jv-muted); font-size: 12px; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 5px 6px;
  border: 1px solid var(--jv-border);
  border-radius: 8px;
  background: var(--jv-surface);
}
.row[data-draggable='true'] { cursor: grab; }
.row[data-drop='true'] { border-color: var(--jv-accent); }
.row-hidden .name { text-decoration: line-through; color: var(--jv-muted); }
.handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 20px;
  flex: none;
  color: var(--jv-muted);
}
button.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  flex: none;
}
.name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.missing { color: var(--jv-muted); font-size: 12px; font-style: italic; }
.width { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.width input { flex: 1; }
.chips { position: fixed; inset: 0; overflow: hidden; pointer-events: none; }
.chip {
  position: absolute;
  top: 0;
  left: 0;
  padding: 1px 6px;
  background: var(--jv-accent);
  color: var(--jv-bg);
  border-radius: 999px;
  font-size: 11px;
  opacity: 0.9;
}
@media (prefers-reduced-motion: no-preference) {
  .panel { transition: opacity 120ms ease, transform 120ms ease; }
}
`;

function create<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = doc.createElement(tag);
  if (className) element.className = className;
  return element;
}

function button(doc: Document, action: string, label: string): HTMLButtonElement {
  const element = create(doc, 'button');
  element.type = 'button';
  element.textContent = label;
  element.setAttribute('data-jv', action);
  return element;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

type IconName = 'up' | 'down' | 'hide' | 'show' | 'grip';

/** Icons are inline SVG, 20px box, one visual weight (spec 6.7). */
function icon(doc: Document, name: IconName): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.style.display = 'block';

  const path = (d: string, evenOdd = false): void => {
    const node = doc.createElementNS(SVG_NS, 'path');
    node.setAttribute('d', d);
    node.setAttribute('fill', 'currentColor');
    if (evenOdd) node.setAttribute('fill-rule', 'evenodd');
    svg.append(node);
  };

  if (name === 'up') path('M10 4l6 6h-4v6H8v-6H4z');
  if (name === 'down') path('M10 16l-6-6h4V4h4v6h4z');
  if (name === 'hide') {
    path(
      'M10 5c-4.5 0-8 3.2-9 5 1 1.8 4.5 5 9 5s8-3.2 9-5c-1-1.8-4.5-5-9-5zm0 8a3 3 0 110-6 3 3 0 010 6z',
      true,
    );
  }
  if (name === 'show') {
    path(
      'M10 5c-4.5 0-8 3.2-9 5 1 1.8 4.5 5 9 5s8-3.2 9-5c-1-1.8-4.5-5-9-5zm0 8a3 3 0 110-6 3 3 0 010 6z',
      true,
    );
    const slash = doc.createElementNS(SVG_NS, 'path');
    slash.setAttribute('d', 'M3 3l14 14');
    slash.setAttribute('fill', 'none');
    slash.setAttribute('stroke', 'currentColor');
    slash.setAttribute('stroke-width', '2');
    slash.setAttribute('stroke-linecap', 'round');
    svg.append(slash);
  }
  if (name === 'grip') {
    for (const [cx, cy] of [
      [7, 5],
      [13, 5],
      [7, 10],
      [13, 10],
      [7, 15],
      [13, 15],
    ] as const) {
      const dot = doc.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('cx', String(cx));
      dot.setAttribute('cy', String(cy));
      dot.setAttribute('r', '1.5');
      dot.setAttribute('fill', 'currentColor');
      svg.append(dot);
    }
  }

  return svg;
}

function iconButton(
  doc: Document,
  action: string,
  label: string,
  name: IconName,
): HTMLButtonElement {
  const element = button(doc, action, '');
  element.classList.add('icon');
  element.setAttribute('aria-label', label);
  element.title = label;
  element.append(icon(doc, name));
  return element;
}

export function startEditSession(options: EditSessionOptions): EditSessionHandle {
  const { doc } = options;
  let history: LayoutHistory = createHistory(options.draft);
  let label = options.draft;
  let destroyed = false;
  let dragKey: string | null = null;
  let widthBaseline: LayoutDraft | null = null;
  let rafId = 0;

  const host = create(doc, 'div');
  host.setAttribute(EDIT_HOST_ATTR, 'on');
  const shadow = host.attachShadow({ mode: 'open' });

  const style = create(doc, 'style');
  style.textContent = CSS;
  let adopted: CSSStyleSheet | null = null;
  try {
    if (typeof CSSStyleSheet === 'function' && 'adoptedStyleSheets' in shadow) {
      adopted = new CSSStyleSheet();
      adopted.replaceSync(CSS);
      shadow.adoptedStyleSheets = [adopted];
      // Some engines expose the property but ignore the assignment.
      if (!Array.from(shadow.adoptedStyleSheets).includes(adopted)) adopted = null;
    }
  } catch {
    adopted = null;
  }

  const chips = create(doc, 'div', 'chips');

  const bar = create(doc, 'div', 'bar');
  const title = create(doc, 'span', 'title');
  title.textContent = t('editTitle');
  const status = create(doc, 'span', 'status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const done = button(doc, 'done', t('editDone'));
  const undoButton = button(doc, 'undo', t('editUndo'));
  const redoButton = button(doc, 'redo', t('editRedo'));
  const resetButton = button(doc, 'reset', t('editReset'));
  const sectionsButton = button(doc, 'sections', t('editSections'));
  sectionsButton.setAttribute('aria-expanded', 'false');

  const spacer = create(doc, 'span', 'spacer');
  bar.append(title, status, spacer, undoButton, redoButton, resetButton, sectionsButton, done);

  const panel = create(doc, 'div', 'panel');
  panel.hidden = true;
  const hint = create(doc, 'p', 'hint');
  hint.textContent = t('editHint');
  const cannotMove = create(doc, 'p', 'hint');
  cannotMove.textContent = t('editCannotMove');
  cannotMove.hidden = options.movable.length >= 2;
  const list = create(doc, 'ul', 'list');
  list.setAttribute('aria-label', t('editSections'));
  const widthRow = create(doc, 'label', 'width');
  const widthText = create(doc, 'span');
  widthText.textContent = t('editWidth');
  const widthInput = create(doc, 'input');
  widthInput.type = 'range';
  widthInput.min = '480';
  widthInput.max = '1200';
  widthInput.step = '20';
  const widthValue = create(doc, 'span');
  widthRow.append(widthText, widthInput, widthValue);
  panel.append(hint, cannotMove, list, widthRow);

  shadow.append(chips, bar, panel);
  if (!adopted) shadow.append(style);
  (doc.body ?? doc.documentElement).append(host);

  let popoverShown = false;
  if (typeof host.showPopover === 'function') {
    host.setAttribute('popover', 'manual');
    try {
      host.showPopover();
      popoverShown = true;
    } catch {
      // Leave the fixed-position fallback visible if the top layer refuses.
      host.removeAttribute('popover');
      popoverShown = false;
    }
  }

  const chipByKey = new Map<string, HTMLElement>();
  for (const section of options.sections) {
    if (section.elements.length === 0) continue;
    const chip = create(doc, 'span', 'chip');
    chip.textContent = section.label;
    chips.append(chip);
    chipByKey.set(section.key, chip);
  }

  function paintChips(): void {
    rafId = 0;
    for (const section of options.sections) {
      const chip = chipByKey.get(section.key);
      const first = section.elements[0];
      if (!chip || !first) continue;
      const rect = first.getBoundingClientRect();
      chip.hidden = rect.width === 0 && rect.height === 0;
      chip.style.transform = `translate(${Math.round(rect.left)}px, ${Math.round(rect.top)}px)`;
    }
  }

  function scheduleChips(): void {
    if (destroyed || rafId !== 0) return;
    if (typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame(paintChips);
    } else {
      rafId = -1;
      window.setTimeout(() => {
        if (!destroyed) paintChips();
      }, 16);
    }
  }

  function render(): void {
    if (destroyed) return;
    const active = shadow.activeElement;
    const activeRow = active instanceof Element ? active.closest('[data-jv-key]') : null;
    const focusKey = activeRow?.getAttribute('data-jv-key') ?? null;
    const focusAction = active instanceof Element ? active.getAttribute('data-jv') : null;

    undoButton.disabled = !canUndo(history);
    redoButton.disabled = !canRedo(history);
    widthInput.value = String(history.present.widthPx);
    widthValue.textContent = `${history.present.widthPx}px`;

    list.replaceChildren();
    for (const key of history.present.order) {
      const section = options.sections.find((item) => item.key === key);
      if (!section) continue;
      const hidden = history.present.hidden.includes(key);
      const movable = options.movable.includes(key);
      const index = options.movable.indexOf(key);
      const row = create(doc, 'li', 'row');
      row.setAttribute('data-jv-key', key);
      row.setAttribute('data-draggable', String(movable));
      if (hidden) row.classList.add('row-hidden');
      if (section.elements.length === 0) row.classList.add('row-missing');

      const handle = create(doc, 'span', 'handle');
      handle.setAttribute('aria-hidden', 'true');
      handle.style.opacity = movable ? '1' : '0.25';
      handle.append(icon(doc, 'grip'));
      const name = create(doc, 'span', 'name');
      name.textContent = section.label;
      if (section.elements.length === 0) {
        const missing = create(doc, 'span', 'missing');
        missing.textContent = t('editNotFound');
        name.append(' ', missing);
      }

      const up = iconButton(doc, 'up', `${t('editMoveUp')}: ${section.label}`, 'up');
      up.disabled = !movable || index <= 0;
      if (!movable) up.title = t('editCannotMove');
      up.addEventListener('click', () => apply(moveAmong(history.present, key, options.movable, -1)));

      const down = iconButton(doc, 'down', `${t('editMoveDown')}: ${section.label}`, 'down');
      down.disabled = !movable || index === options.movable.length - 1;
      if (!movable) down.title = t('editCannotMove');
      down.addEventListener('click', () => apply(moveAmong(history.present, key, options.movable, 1)));

      const toggle = iconButton(
        doc,
        hidden ? 'show' : 'hide',
        `${hidden ? t('editShow') : t('editHide')}: ${section.label}`,
        hidden ? 'show' : 'hide',
      );
      toggle.addEventListener('click', () => apply(toggleHidden(history.present, key)));

      if (movable) {
        row.draggable = true;
        row.addEventListener('dragstart', (event) => {
          dragKey = key;
          event.dataTransfer?.setData('text/plain', key);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        });
        row.addEventListener('dragover', (event) => {
          if (!dragKey || dragKey === key) return;
          event.preventDefault();
          row.setAttribute('data-drop', 'true');
        });
        row.addEventListener('dragleave', () => row.removeAttribute('data-drop'));
        row.addEventListener('drop', (event) => {
          event.preventDefault();
          row.removeAttribute('data-drop');
          if (dragKey) apply(moveAmongTo(history.present, dragKey, key, options.movable));
          dragKey = null;
        });
        row.addEventListener('dragend', () => {
          dragKey = null;
        });
      }

      row.append(handle, name, up, down, toggle);
      list.append(row);
    }

    for (const [key, chip] of chipByKey) {
      chip.style.opacity = history.present.hidden.includes(key) ? '0.35' : '0.9';
    }

    // Rebuilds replace the rows; return focus so keyboard reordering can continue.
    if (focusKey) {
      const rows = list.querySelectorAll<HTMLElement>('[data-jv-key]');
      const targetRow = Array.from(rows).find(
        (row) => row.getAttribute('data-jv-key') === focusKey,
      );
      if (targetRow) {
        const buttons = Array.from(targetRow.querySelectorAll<HTMLButtonElement>('button'));
        const preferred = buttons.find((button) => button.getAttribute('data-jv') === focusAction);
        const target = [preferred, ...buttons].find((button) => button && !button.disabled);
        target?.focus();
      }
    }

    scheduleChips();
  }

  function apply(next: LayoutDraft): void {
    if (destroyed) return;
    history = commit(history, next);
    label = history.present;
    options.onChange(history.present);
    render();
  }

  function step(direction: -1 | 1): void {
    history = direction < 0 ? undo(history) : redo(history);
    options.onChange(history.present);
    render();
  }

  done.addEventListener('click', () => {
    if (!destroyed) options.onDone(label);
  });
  undoButton.addEventListener('click', () => step(-1));
  redoButton.addEventListener('click', () => step(1));
  resetButton.addEventListener('click', () => apply(options.defaultDraft));
  sectionsButton.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    sectionsButton.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) scheduleChips();
  });

  widthInput.addEventListener('input', () => {
    const value = Number(widthInput.value);
    if (widthBaseline === null) widthBaseline = history.present;
    label = setWidth(widthBaseline, value);
    widthValue.textContent = `${label.widthPx}px`;
    options.onChange(label);
  });
  widthInput.addEventListener('change', () => {
    const value = Number(widthInput.value);
    const baseline = widthBaseline ?? history.present;
    widthBaseline = null;
    history = { ...history, present: baseline };
    apply(setWidth(baseline, value));
  });

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    if (dragKey) {
      dragKey = null;
      render();
      return;
    }
    options.onCancel();
  }

  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('scroll', scheduleChips, true);
  window.addEventListener('resize', scheduleChips);

  render();

  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      if (rafId !== 0) {
        if (rafId > 0 && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
        rafId = 0;
      }
      doc.removeEventListener('keydown', onKeyDown, true);
      doc.removeEventListener('scroll', scheduleChips, true);
      window.removeEventListener('resize', scheduleChips);
      if (popoverShown && typeof host.hidePopover === 'function') {
        try {
          host.hidePopover();
        } catch {
          /* the element may already be gone */
        }
      }
      host.remove();
    },
    setStatus(text: string, kind: 'info' | 'error' = 'info'): void {
      if (destroyed) return;
      status.textContent = text;
      status.classList.toggle('status-error', kind === 'error');
    },
  };
}
