import { icons } from '@/utils/icons';
import type { FormatOptions } from '@/utils/format';
import { renderPreviewList } from '@/utils/preview-list';
import { ALT_KEY, COPY_ALL_SHORTCUT, linkCount } from '@/utils/store';
import type { StoredTask } from '@/utils/task';

export interface TrayHandlers {
  onCopyAll(): void;
  onClear(): void;
  onCopyOne(task: StoredTask, button: HTMLButtonElement): void;
  onRemove(id: string): void;
  onReorder(ids: string[]): void;
  onIncludeIdChange(includeId: boolean): void;
}

export interface ToastOptions {
  error?: boolean;
  action?: { label: string; run(): void };
  duration?: number;
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, html?: string) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html != null) el.innerHTML = html;
  return el;
};

/**
 * Floating dock: a bar with the list count and "Copy N links", which expands
 * into a preview of exactly what will be pasted. Also hosts toasts and tooltips.
 */
export class Tray {
  private dock = h('div', 'dock');
  private shell = h('div', 'shell');
  private summary = h('button', 'summary');
  private copyBtn = h('button', 'primary');
  private itemsEl = h('ul', 'items');
  private toastEl = h('div', 'toast');
  private tipEl = h('div', 'tip');
  private idSwitch = h('button', 'switch');
  private toastTimer = 0;
  private copyResetTimer = 0;
  private count = 0;
  private tasks: StoredTask[] = [];
  private format: FormatOptions = { includeId: true };

  constructor(
    root: HTMLElement,
    private handlers: TrayHandlers,
  ) {
    // Preview panel
    const head = h('div', 'panel-head');
    head.append(h('span', 'head-label', 'Pastes as'));

    // Quick toggle for the "[APP-123]" prefix; same setting as in the popup.
    this.idSwitch.setAttribute('role', 'switch');
    this.idSwitch.innerHTML = '<span class="track"><span class="thumb"></span></span><span>Task IDs</span>';
    this.idSwitch.title = 'Put the task ID before each title';
    this.idSwitch.addEventListener('click', () => this.handlers.onIncludeIdChange(!this.format.includeId));
    head.append(this.idSwitch);

    const close = h('button', 'icon-btn', icons.x(15));
    close.title = 'Collapse (Esc)';
    close.setAttribute('aria-label', 'Collapse list');
    close.style.cssText = 'width:26px;height:26px';
    close.addEventListener('click', () => this.setOpen(false));
    head.append(close);

    this.itemsEl.setAttribute('aria-label', 'Tasks in your list');
    const help = h(
      'p',
      'help',
      `Hold <kbd>${ALT_KEY}</kbd> and click tasks to add or remove them. Drag to reorder. <kbd>${COPY_ALL_SHORTCUT}</kbd> copies the list.`,
    );

    const panelInner = h('div', 'panel-inner');
    panelInner.append(head, this.itemsEl, help);
    const panel = h('div', 'panel');
    panel.append(panelInner);

    // Bar
    this.summary.setAttribute('aria-expanded', 'false');
    this.summary.addEventListener('click', () => this.setOpen(!this.isOpen));

    this.copyBtn.title = `Copy list (${COPY_ALL_SHORTCUT})`;
    this.copyBtn.addEventListener('click', () => this.handlers.onCopyAll());

    const clear = h('button', 'icon-btn danger', icons.trash(16));
    clear.title = 'Clear list';
    clear.setAttribute('aria-label', 'Clear list');
    clear.addEventListener('click', () => this.handlers.onClear());

    const bar = h('div', 'bar');
    bar.append(this.summary, h('span', 'spacer'), this.copyBtn, clear);

    this.shell.append(panel, bar);
    this.dock.append(this.shell);
    this.dock.setAttribute('role', 'region');
    this.dock.setAttribute('aria-label', 'ClickUp link list');

    this.toastEl.setAttribute('role', 'status');
    this.toastEl.setAttribute('aria-live', 'polite');
    this.tipEl.setAttribute('role', 'tooltip');
    root.append(this.dock, this.toastEl, this.tipEl);

    // Keep toasts just above the dock whatever its height.
    new ResizeObserver(() => {
      this.toastEl.style.setProperty('--dock-h', `${this.shell.offsetHeight}px`);
    }).observe(this.shell);
  }

  get isOpen() {
    return this.dock.classList.contains('open');
  }

  setOpen(open: boolean) {
    const next = open && this.count > 0;
    this.dock.classList.toggle('open', next);
    this.summary.setAttribute('aria-expanded', String(next));
    this.summary.title = next ? 'Hide preview' : 'Preview what will be pasted';
  }

  /** Keeps the preview identical to what will be pasted when settings change. */
  setFormat(format: FormatOptions) {
    this.format = format;
    this.idSwitch.setAttribute('aria-checked', String(format.includeId));
    this.render(this.tasks);
  }

  render(tasks: StoredTask[]) {
    this.tasks = tasks;
    this.count = tasks.length;
    const visible = tasks.length > 0;
    this.dock.classList.toggle('visible', visible);
    this.toastEl.classList.toggle('dock-hidden', !visible);
    if (!visible) this.setOpen(false);

    this.summary.innerHTML =
      `<span><span class="n">${tasks.length}</span> in list</span>` + `<span class="chev">${icons.chevronUp(14)}</span>`;
    if (!this.copyBtn.classList.contains('done')) this.resetCopyLabel();

    renderPreviewList(
      this.itemsEl,
      tasks,
      {
        onCopy: (task, btn) => this.handlers.onCopyOne(task, btn),
        onRemove: (id) => this.handlers.onRemove(id),
        onReorder: (ids) => this.handlers.onReorder(ids),
      },
      this.format,
    );
  }

  markCopied(n: number) {
    this.copyBtn.classList.add('done');
    this.copyBtn.innerHTML = `${icons.check(16)}<span>Copied ${linkCount(n)}</span>`;
    clearTimeout(this.copyResetTimer);
    this.copyResetTimer = window.setTimeout(() => {
      this.copyBtn.classList.remove('done');
      this.resetCopyLabel();
    }, 1600);
  }

  private resetCopyLabel() {
    this.copyBtn.innerHTML = `${icons.copy(15)}<span>Copy ${linkCount(this.count)}</span>`;
  }

  /** Tooltip rendered in the shadow root so it's never clipped by ClickUp's scroll containers. */
  showTip(text: string, anchor: DOMRect) {
    if (!text) return;
    this.tipEl.textContent = text;
    this.tipEl.classList.add('visible');
    const { width, height } = this.tipEl.getBoundingClientRect();
    const x = Math.min(Math.max(8, anchor.left + anchor.width / 2 - width / 2), innerWidth - width - 8);
    const above = anchor.top - height - 8;
    const y = above > 8 ? above : anchor.bottom + 8;
    this.tipEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  hideTip() {
    this.tipEl.classList.remove('visible');
  }

  toast(message: string, opts: ToastOptions = {}) {
    const mark = h('span', 'mark', opts.error ? icons.x(16) : icons.check(16));
    const msg = h('span', 'msg', message);
    const children: HTMLElement[] = [mark, msg];
    if (opts.action) {
      const { label, run } = opts.action;
      const btn = h('button', 'action');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        run();
        this.hideToast();
      });
      children.push(btn);
    }
    this.toastEl.replaceChildren(...children);
    this.toastEl.classList.toggle('error', !!opts.error);
    this.toastEl.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.hideToast(), opts.duration ?? (opts.action ? 5000 : 2200));
  }

  private hideToast() {
    this.toastEl.classList.remove('visible');
  }
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
