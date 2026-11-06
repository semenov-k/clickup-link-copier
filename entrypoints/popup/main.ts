import '@/utils/preview-list.css';
import './style.css';
import { copyTasks } from '@/utils/clipboard';
import type { PlainFormat } from '@/utils/format';
import { icons } from '@/utils/icons';
import { flashCopied, renderPreviewList } from '@/utils/preview-list';
import {
  ALT_KEY,
  COPY_ALL_SHORTCUT,
  clearTasks,
  collectionItem,
  getSettings,
  linkCount,
  removeTasks,
  reorderTasks,
  restoreTasks,
  settingsItem,
  updateSettings,
  withDefaults,
} from '@/utils/store';
import type { RemovedTask } from '@/utils/collection';
import type { StoredTask } from '@/utils/task';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const heading = $('heading');
const listView = $('list-view');
const itemsEl = $<HTMLUListElement>('items');
const emptyEl = $('empty');
const copyBtn = $<HTMLButtonElement>('copy');
const clearBtn = $<HTMLButtonElement>('clear');
const formatSel = $<HTMLSelectElement>('plain-format');
const clearAfter = $<HTMLInputElement>('clear-after');
const includeId = $<HTMLInputElement>('include-id');

document.querySelectorAll('kbd.alt').forEach((el) => (el.textContent = ALT_KEY));
$('copy-all-kbd').textContent = COPY_ALL_SHORTCUT;
$('add-icon').innerHTML = icons.listPlus(13);

/** Tasks taken out by the last clear, so "Clear list" can turn into "Undo clear". */
let undo: RemovedTask[] | null = null;
let copiedTimer = 0;
let current: StoredTask[] = [];
let format = { includeId: true };

function setCopyLabel(n: number) {
  copyBtn.innerHTML = `${icons.copy(15)}<span>${n ? `Copy ${linkCount(n)}` : 'Copy links'}</span>`;
}

function render(list: StoredTask[]) {
  current = list;
  const n = list.length;
  heading.textContent = n ? `${n} in list` : 'Your list is empty';
  listView.hidden = n === 0;
  emptyEl.hidden = n > 0;
  copyBtn.disabled = n === 0;
  clearBtn.hidden = n === 0 && !undo;
  clearBtn.textContent = n === 0 && undo ? 'Undo clear' : 'Clear list';
  if (!copyBtn.classList.contains('done')) setCopyLabel(n);

  renderPreviewList(
    itemsEl,
    list,
    {
      onCopy: (task, btn) =>
        void copyTasks([task]).then(
          () => flashCopied(btn),
          () => (btn.title = 'Couldn’t write to the clipboard. Try again.'),
        ),
      onRemove: (id) => void removeTasks([id]),
      onReorder: (ids) => void reorderTasks(ids),
    },
    format,
  );
}

copyBtn.addEventListener('click', async () => {
  const list = await collectionItem.getValue();
  try {
    await copyTasks(list);
  } catch {
    copyBtn.innerHTML = '<span>Couldn’t write to the clipboard. Try again.</span>';
    return;
  }
  copyBtn.classList.add('done');
  copyBtn.innerHTML = `${icons.check(15)}<span>Copied ${linkCount(list.length)}</span>`;
  clearTimeout(copiedTimer);
  copiedTimer = window.setTimeout(async () => {
    copyBtn.classList.remove('done');
    setCopyLabel((await collectionItem.getValue()).length);
  }, 1500);
  if ((await getSettings()).clearAfterCopy) {
    // Only remove what was copied; tasks added meanwhile stay.
    undo = (await removeTasks(list.map((t) => t.id))).removed;
    render(current); // the storage watcher may have rendered before `undo` was set
  }
});

clearBtn.addEventListener('click', async () => {
  if (!current.length && undo) {
    const removed = undo;
    undo = null;
    await restoreTasks(removed);
    return;
  }
  undo = (await clearTasks()).removed;
  render(current); // the storage watcher may have rendered before `undo` was set
});

formatSel.addEventListener('change', () => void updateSettings({ plainFormat: formatSel.value as PlainFormat }));
clearAfter.addEventListener('change', () => void updateSettings({ clearAfterCopy: clearAfter.checked }));
includeId.addEventListener('change', () => void updateSettings({ includeId: includeId.checked }));
settingsItem.watch((value) => {
  format = { includeId: withDefaults(value).includeId };
  render(current);
});

void (async () => {
  const settings = await getSettings();
  formatSel.value = settings.plainFormat;
  clearAfter.checked = settings.clearAfterCopy;
  includeId.checked = settings.includeId;
  format = { includeId: settings.includeId };
  render(await collectionItem.getValue());
})();
collectionItem.watch((list) => render(list ?? []));
