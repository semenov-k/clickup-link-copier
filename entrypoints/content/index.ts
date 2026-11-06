import './page.css';
import trayCss from './tray.css?inline';
import previewCss from '@/utils/preview-list.css?inline';
import { flashCopied } from '@/utils/preview-list';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { copyTasks } from '@/utils/clipboard';
import { icons } from '@/utils/icons';
import {
  ALT_KEY,
  COPY_ALL_SHORTCUT,
  collectionItem,
  clearTasks,
  getSettings,
  isMac,
  linkCount,
  onlyAlt,
  removeTasks,
  reorderTasks,
  restoreTasks,
  settingsItem,
  toggleTask,
  updateSettings,
  withDefaults,
} from '@/utils/store';
import { escapeHtml } from '@/utils/format';
import { parseTaskUrl, type Task } from '@/utils/task';
import { DETAIL, ROW_SURFACES, taskAtTarget, taskFromDetail, taskFromRow } from './surfaces';
import { Tray } from './tray';

const OWN_UI = '.cuh-actions, .cuh-detail';

export default defineContentScript({
  matches: ['https://app.clickup.com/*'],
  cssInjectionMode: 'manifest',

  async main(ctx) {
    let ids = new Set((await collectionItem.getValue()).map((t) => t.id));

    // ---------- Actions ----------

    const fail = (err: unknown) => {
      console.warn('[ClickUp Link Copier]', err);
      tray.toast('Couldn’t write to the clipboard. Click anywhere on the page, then try again.', { error: true });
    };

    async function copyOne(task: Task, btn?: HTMLElement): Promise<boolean> {
      try {
        await copyTasks([task]);
        tray.toast(`Copied link to <b>${escapeHtml(task.title)}</b>`);
        if (btn) flash(btn);
        return true;
      } catch (err) {
        fail(err);
        return false;
      }
    }

    async function toggle(task: Task) {
      const { added, removed, size } = await toggleTask(task);
      if (!added) {
        tray.toast(`Removed <b>${escapeHtml(task.title)}</b> from list`, {
          action: { label: 'Undo', run: () => void restoreTasks(removed) },
        });
      } else if (size === 1) {
        // First item: teach the shortcut once per batch.
        tray.toast(`Added to list. Keep ${ALT_KEY}-clicking tasks, then press <b>${COPY_ALL_SHORTCUT}</b> to copy them.`, { duration: 4000 });
      }
    }

    async function copyAll() {
      const list = await collectionItem.getValue();
      if (!list.length) {
        tray.toast(`Your list is empty. Hold ${ALT_KEY} and click tasks to add them.`, { error: true, duration: 3500 });
        return;
      }
      try {
        await copyTasks(list);
      } catch (err) {
        return fail(err);
      }
      tray.markCopied(list.length);
      const noun = linkCount(list.length);
      if ((await getSettings()).clearAfterCopy) {
        // Only remove what was copied; tasks added meanwhile stay.
        const { removed } = await removeTasks(list.map((t) => t.id));
        tray.toast(`Copied <b>${noun}</b>. List cleared.`, {
          action: { label: 'Undo', run: () => void restoreTasks(removed) },
        });
      }
      // Otherwise the dock's button itself turns into "Copied N links"; no toast needed.
    }

    async function clearAll() {
      const { removed } = await clearTasks();
      tray.toast(`List cleared`, {
        action: { label: 'Undo', run: () => void restoreTasks(removed) },
      });
    }

    // ---------- Floating tray ----------

    const ui = await createShadowRootUi(ctx, {
      name: 'cuh-tray',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      css: trayCss + previewCss,
      isolateEvents: true,
      onMount: (container) =>
        new Tray(container, {
          onCopyAll: () => void copyAll(),
          onClear: () => void clearAll(),
          onCopyOne: (task, btn) => void copyOne(task).then((ok) => ok && flashCopied(btn)),
          onRemove: (id) => void removeTasks([id]),
          onReorder: (ids) => void reorderTasks(ids),
          onIncludeIdChange: (includeId) => void updateSettings({ includeId }),
        }),
    });
    ui.mount();
    const tray = ui.mounted!;
    tray.render(await collectionItem.getValue());
    tray.setFormat({ includeId: (await getSettings()).includeId });
    settingsItem.watch((s) => tray.setFormat({ includeId: withDefaults(s).includeId }));

    collectionItem.watch((list) => {
      ids = new Set((list ?? []).map((t) => t.id));
      tray.render(list ?? []);
      scheduleScan();
    });

    // ---------- Injected buttons ----------

    const flashTimers = new WeakMap<HTMLElement, number>();

    /** Shows "Copied" on a button for a moment. Repeated clicks restart the timer. */
    function flash(btn: HTMLElement) {
      const iconSize = btn.classList.contains('cuh-pill') ? 15 : 14;
      const label = btn.querySelector('span');
      btn.classList.add('cuh-done');
      btn.querySelector('svg')!.outerHTML = icons.check(iconSize);
      if (label) label.textContent = 'Copied';
      clearTimeout(flashTimers.get(btn));
      flashTimers.set(
        btn,
        window.setTimeout(() => {
          btn.classList.remove('cuh-done');
          btn.querySelector('svg')!.outerHTML = btn.dataset.icon ?? '';
          if (label) label.textContent = btn.dataset.label ?? '';
        }, 1200),
      );
    }

    /** `tip` is read on hover, so toggles can reflect their current state. */
    function makeButton(className: string, icon: string, label: string | null, tip: string | (() => string)) {
      const tipText = () => (typeof tip === 'string' ? tip : tip());
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = className;
      btn.draggable = false;
      btn.dataset.icon = icon;
      if (label) btn.dataset.label = label;
      btn.innerHTML = icon + (label ? `<span>${label}</span>` : '');
      if (typeof tip === 'string') btn.setAttribute('aria-label', tip);
      btn.addEventListener('mouseenter', () => tray.showTip(tipText(), btn.getBoundingClientRect()));
      btn.addEventListener('mouseleave', () => tray.hideTip());
      btn.addEventListener('click', () => tray.hideTip());
      return btn;
    }

    /** Keeps ClickUp from opening the task / starting a drag when our buttons are used. */
    function shield(el: HTMLElement) {
      for (const type of ['pointerdown', 'mousedown', 'mouseup', 'pointerup', 'dblclick', 'dragstart']) {
        el.addEventListener(type, (e) => e.stopPropagation());
      }
    }

    function setToggleState(btn: HTMLElement, on: boolean, withLabel: boolean) {
      const state = String(on);
      if (btn.dataset.on === state) return; // avoid DOM churn → MutationObserver loops
      btn.dataset.on = state;
      const icon = on ? icons.listCheck(withLabel ? 15 : 14) : icons.listPlus(withLabel ? 15 : 14);
      btn.innerHTML = icon + (withLabel ? `<span>${on ? 'In list' : 'Add to list'}</span>` : '');
      const tip = on ? 'In list. Click to remove' : `Add to list (or ${ALT_KEY}-click the task)`;
      btn.setAttribute('aria-label', tip);
      btn.setAttribute('aria-pressed', state);
    }

    /** Copy + add/remove buttons: small icon buttons on rows and cards, labelled ones on the task page. */
    function createActions(kind: 'row' | 'detail', getTask: () => Task | null) {
      const detail = kind === 'detail';
      const group = document.createElement(detail ? 'div' : 'span');
      group.className = detail ? 'cuh-detail' : 'cuh-actions';
      shield(group);

      const base = detail ? 'cuh-pill' : 'cuh-btn';
      const copy = detail
        ? makeButton(`${base} cuh-copy`, icons.link(15), 'Copy link', 'Copy the task title as a link')
        : makeButton(`${base} cuh-copy`, icons.link(14), null, 'Copy link');
      const add = makeButton(`${base} cuh-toggle`, '', null, () => add.getAttribute('aria-label') ?? '');

      const onClick = (e: MouseEvent, toggleOnly: boolean) => {
        e.preventDefault();
        e.stopPropagation(); // rows: don't open the task
        const task = getTask();
        if (!task) return;
        if (toggleOnly || e.altKey || e.shiftKey) void toggle(task);
        else void copyOne(task, copy);
      };
      copy.addEventListener('click', (e) => onClick(e, false));
      add.addEventListener('click', (e) => onClick(e, true));

      group.append(copy, add);
      return group;
    }

    function scan() {
      for (const surface of ROW_SURFACES) {
        for (const row of document.querySelectorAll(surface.row)) {
          const link = row.querySelector<HTMLAnchorElement>(surface.link);
          const parsed = link && parseTaskUrl(link.href);
          if (!parsed) continue;
          const selected = ids.has(parsed.id);
          if (!row.classList.contains('cuh-row')) row.classList.add('cuh-row');
          if (row.classList.contains('cuh-selected') !== selected) row.classList.toggle('cuh-selected', selected);

          const mount = surface.mount ? row.querySelector(surface.mount) : row;
          if (!mount) continue;
          let group = mount.querySelector<HTMLElement>(':scope > .cuh-actions');
          if (!group) {
            group = createActions('row', () => taskFromRow(row, surface));
            mount.append(group);
          }
          setToggleState(group.querySelector('.cuh-toggle')!, selected, false);
        }
      }

      for (const mount of document.querySelectorAll(DETAIL.mount)) {
        const hero = mount.closest(DETAIL.hero);
        if (!hero) continue;
        let group = mount.querySelector<HTMLElement>(':scope > .cuh-detail');
        if (!group) {
          group = createActions('detail', () => taskFromDetail(hero));
          mount.append(group);
        }
        const id = taskFromDetail(hero)?.id;
        setToggleState(group.querySelector('.cuh-toggle')!, !!id && ids.has(id), true);
      }
    }

    let scanQueued = false;
    function scheduleScan() {
      if (scanQueued) return;
      scanQueued = true;
      requestAnimationFrame(() => {
        scanQueued = false;
        scan();
      });
    }

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
    ctx.addEventListener(window, 'wxt:locationchange', scheduleScan);
    scan();

    // ---------- Alt+click anywhere on a task to collect it ----------

    const isCollectGesture = (e: MouseEvent) => onlyAlt(e) && e.button === 0;

    const onPointer = (e: MouseEvent) => {
      if (!isCollectGesture(e)) return;
      const target = e.target as Element | null;
      if (!target?.closest || target.closest(OWN_UI)) return;
      if ((target as HTMLElement).isContentEditable) return;
      const hit = taskAtTarget(target);
      if (!hit) return;
      // Swallow the whole gesture so ClickUp doesn't open/drag the task
      // and Chrome doesn't treat ⌥+click on a link as "download".
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.type === 'click') void toggle(hit.task);
    };
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'] as const) {
      ctx.addEventListener(window, type, onPointer, { capture: true });
    }

    // Visual "collect mode" while the modifier is held.
    const root = document.documentElement;
    const setAltMode = (on: boolean) => {
      if (root.classList.contains('cuh-alt-mode') !== on) root.classList.toggle('cuh-alt-mode', on);
    };
    ctx.addEventListener(window, 'keydown', (e) => setAltMode(onlyAlt(e)), { capture: true });
    ctx.addEventListener(window, 'keyup', (e) => setAltMode(onlyAlt(e)), { capture: true });
    ctx.addEventListener(window, 'blur', () => setAltMode(false));
    ctx.addEventListener(window, 'pointermove', (e) => setAltMode(onlyAlt(e)), { passive: true });

    // ---------- Keyboard shortcuts ----------

    // macOS turns ⌥⇧C into "Ç", so match the physical key there; elsewhere match the typed letter.
    const isCopyAllShortcut = (e: KeyboardEvent) =>
      onlyAlt(e) && e.shiftKey && (isMac ? e.code === 'KeyC' : e.key.toLowerCase() === 'c');

    /** Typing in a field (comment, doc, title…) must not trigger the shortcut. */
    const isTyping = (e: KeyboardEvent) => {
      const el = e.composedPath()[0];
      return (
        el instanceof HTMLElement &&
        (el.isContentEditable || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ||
          (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(el.type)))
      );
    };

    ctx.addEventListener(
      window,
      'keydown',
      (e) => {
        if (isCopyAllShortcut(e) && !isTyping(e)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          void copyAll();
        } else if (e.key === 'Escape' && tray.isOpen) {
          e.stopImmediatePropagation();
          tray.setOpen(false);
        }
      },
      { capture: true },
    );

    console.info(`[ClickUp Link Copier] ready — ${ALT_KEY}+click tasks to collect, ${COPY_ALL_SHORTCUT} to copy all.`);
  },
});
