import { linkText, type FormatOptions } from './format';
import { icons } from './icons';
import type { StoredTask } from './task';

export interface PreviewListHandlers {
  /** Copy just this task. `button` is the clicked control, for inline feedback. */
  onCopy(task: StoredTask, button: HTMLButtonElement): void;
  onRemove(id: string): void;
  onReorder(ids: string[]): void;
}

function iconButton(className: string, icon: string, label: string, onClick: (btn: HTMLButtonElement) => void) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `row-btn ${className}`;
  btn.innerHTML = icon;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.addEventListener('click', () => onClick(btn));
  return btn;
}

/** Briefly swaps a row button's icon for a check. */
export function flashCopied(btn: HTMLButtonElement) {
  btn.classList.add('done');
  btn.innerHTML = icons.check(14);
  setTimeout(() => {
    btn.classList.remove('done');
    btn.innerHTML = icons.copy(14);
  }, 1200);
}

const wired = new WeakSet<HTMLUListElement>();

/**
 * Renders the collected tasks the way they will paste: a bulleted list of
 * underlined title links. Rows can be reordered by dragging, or with
 * Alt+↑ / Alt+↓ when a row has focus.
 */
export function renderPreviewList(
  ul: HTMLUListElement,
  tasks: StoredTask[],
  handlers: PreviewListHandlers,
  format: FormatOptions,
) {
  if (!wired.has(ul)) {
    wireReorder(ul, handlers);
    wired.add(ul);
  }

  const focusedId = (ul.getRootNode() as Document | ShadowRoot).activeElement?.closest?.('li')?.dataset.id;

  ul.replaceChildren(
    ...tasks.map((t) => {
      const li = document.createElement('li');
      li.className = 'item';
      li.dataset.id = t.id;

      const grip = document.createElement('span');
      grip.className = 'grip';
      grip.innerHTML = icons.grip(14);
      grip.title = 'Drag to reorder';

      const a = document.createElement('a');
      a.className = 'link';
      a.href = t.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.draggable = false;
      const text = linkText(t, format);
      a.textContent = text;
      a.title = `${text}\nAlt+↑ / Alt+↓ to reorder`;

      const copy = iconButton('copy', icons.copy(14), `Copy link to “${t.title}”`, (btn) => handlers.onCopy(t, btn));
      const rm = iconButton('remove', icons.x(14), `Remove “${t.title}” from list`, () => handlers.onRemove(t.id));

      li.append(grip, a, copy, rm);
      return li;
    }),
  );

  if (focusedId) ul.querySelector<HTMLElement>(`li[data-id="${CSS.escape(focusedId)}"] .link`)?.focus();
}

function currentIds(ul: HTMLUListElement) {
  return [...ul.querySelectorAll<HTMLLIElement>('li[data-id]')].map((li) => li.dataset.id!);
}

function wireReorder(ul: HTMLUListElement, handlers: PreviewListHandlers) {
  // Pointer-based (not HTML5 drag & drop) so ClickUp's own drop zones never react.
  const THRESHOLD = 4;
  let drag: { id: string; li: HTMLLIElement; startY: number; pointerId: number; active: boolean } | null = null;
  let target: { id: string; after: boolean } | null = null;
  let suppressClick = false;

  const clearMarks = () =>
    ul.querySelectorAll('.drop-before, .drop-after').forEach((el) => el.classList.remove('drop-before', 'drop-after'));

  const end = () => {
    if (drag) {
      drag.li.classList.remove('dragging');
      if (ul.hasPointerCapture(drag.pointerId)) ul.releasePointerCapture(drag.pointerId);
    }
    ul.classList.remove('sorting');
    clearMarks();
    drag = null;
    target = null;
  };

  ul.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const el = e.target as Element;
    if (el.closest('.row-btn')) return;
    const li = el.closest<HTMLLIElement>('li[data-id]');
    if (!li || ul.children.length < 2) return;
    drag = { id: li.dataset.id!, li, startY: e.clientY, pointerId: e.pointerId, active: false };
  });

  ul.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.active) {
      if (Math.abs(e.clientY - drag.startY) < THRESHOLD) return;
      drag.active = true;
      ul.setPointerCapture(e.pointerId);
      drag.li.classList.add('dragging');
      ul.classList.add('sorting');
    }
    e.preventDefault();
    // Find the row under the pointer (pointer capture retargets events to the list).
    const rows = [...ul.querySelectorAll<HTMLLIElement>('li[data-id]')].filter((li) => li !== drag!.li);
    let best: HTMLLIElement | null = null;
    let after = false;
    for (const li of rows) {
      const { top, height } = li.getBoundingClientRect();
      if (e.clientY < top + height / 2) {
        best = li;
        after = false;
        break;
      }
      best = li;
      after = true;
    }
    clearMarks();
    if (best) {
      target = { id: best.dataset.id!, after };
      best.classList.add(after ? 'drop-after' : 'drop-before');
    }
    // Keep long lists usable: scroll when dragging near the edges.
    const r = ul.getBoundingClientRect();
    if (e.clientY < r.top + 24) ul.scrollTop -= 8;
    else if (e.clientY > r.bottom - 24) ul.scrollTop += 8;
  });

  ul.addEventListener('pointerup', () => {
    if (!drag) return;
    if (drag.active) {
      suppressClick = true;
      if (target) {
        const ids = currentIds(ul).filter((id) => id !== drag!.id);
        const at = ids.indexOf(target.id) + (target.after ? 1 : 0);
        ids.splice(at, 0, drag.id);
        if (ids.join() !== currentIds(ul).join()) handlers.onReorder(ids);
      }
    }
    end();
  });

  ul.addEventListener('pointercancel', end);

  // A drag that ends over a link must not also open it.
  ul.addEventListener(
    'click',
    (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );

  ul.addEventListener('keydown', (e) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const li = (e.target as Element).closest?.('li');
    if (!li?.dataset.id) return;
    e.preventDefault();
    const ids = currentIds(ul);
    const i = ids.indexOf(li.dataset.id);
    const j = e.key === 'ArrowUp' ? i - 1 : i + 1;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    handlers.onReorder(ids);
  });
}
