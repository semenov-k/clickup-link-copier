import '@/utils/preview-list.css';
import './style.css';
import { copyTasks } from '@/utils/clipboard';
import type { PlainFormat } from '@/utils/format';
import { icons } from '@/utils/icons';
import { flashCopied, renderPreviewList } from '@/utils/preview-list';
import {
  ALT_KEY,
  COPY_ALL_SHORTCUT,
  collectionItem,
  getSettings,
  linkCount,
  removeTask,
  reorderTasks,
  setCollection,
  settingsItem,
  updateSettings,
} from '@/utils/store';
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

/** Last cleared list, so "Clear list" can turn into "Undo". */
let undo: StoredTask[] | null = null;
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
      onRemove: (id) => void removeTask(id),
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
    undo = list;
    await setCollection([]);
  }
});

clearBtn.addEventListener('click', async () => {
  const list = await collectionItem.getValue();
  if (!list.length && undo) {
    const restore = undo;
    undo = null;
    await setCollection(restore);
    return;
  }
  undo = list;
  await setCollection([]);
});

formatSel.addEventListener('change', () => void updateSettings({ plainFormat: formatSel.value as PlainFormat }));
clearAfter.addEventListener('change', () => void updateSettings({ clearAfterCopy: clearAfter.checked }));
includeId.addEventListener('change', () => void updateSettings({ includeId: includeId.checked }));
settingsItem.watch(
  () =>
    void getSettings().then((s) => {
      format = { includeId: s.includeId };
      render(current);
    }),
);

void (async () => {
  const settings = await getSettings();
  formatSel.value = settings.plainFormat;
  clearAfter.checked = settings.clearAfterCopy;
  includeId.checked = settings.includeId;
  format = { includeId: settings.includeId };
  render(await collectionItem.getValue());
})();
collectionItem.watch((list) => render(list ?? []));
