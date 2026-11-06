import { storage } from 'wxt/utils/storage';
import type { PlainFormat } from './format';
import type { CollectionOp, OpResult, RemovedTask } from './collection';
import type { StoredTask, Task } from './task';

export interface Settings {
  /** What gets pasted where rich text isn't supported. */
  plainFormat: PlainFormat;
  /** Empty the collected list after "Copy all". */
  clearAfterCopy: boolean;
  /** Prefix copied titles with "[task id]". */
  includeId: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  plainFormat: 'markdown',
  clearAfterCopy: false,
  includeId: true,
};

/** Shared across all ClickUp tabs and the popup. */
export const collectionItem = storage.defineItem<StoredTask[]>('local:collection', { fallback: [] });
export const settingsItem = storage.defineItem<Settings>('local:settings', { fallback: DEFAULT_SETTINGS });

export const withDefaults = (s: Partial<Settings> | null | undefined): Settings => ({ ...DEFAULT_SETTINGS, ...s });

export async function getSettings(): Promise<Settings> {
  return withDefaults(await settingsItem.getValue());
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await settingsItem.setValue({ ...(await getSettings()), ...patch });
}

export const COLLECTION_MESSAGE = 'cuh:collection';

/**
 * Changes to the list go through the background worker, which applies them one
 * at a time. Reading, editing and writing storage directly from each tab and the
 * popup would let overlapping edits overwrite each other.
 */
async function mutate(op: CollectionOp): Promise<OpResult> {
  const res: OpResult | { error: string } = await browser.runtime.sendMessage({ type: COLLECTION_MESSAGE, op });
  if (!res || 'error' in res) throw new Error(res?.error ?? 'No response from the background worker');
  return res;
}

/** Adds the task if missing, removes it otherwise. */
export const toggleTask = (task: Task) => mutate({ type: 'toggle', task });
export const removeTasks = (ids: string[]) => mutate({ type: 'remove', ids });
export const clearTasks = () => mutate({ type: 'clear' });
export const reorderTasks = (ids: string[]) => mutate({ type: 'reorder', ids });
/** Undo: puts removed tasks back where they were, skipping any that were added again since. */
export const restoreTasks = (removed: RemovedTask[]) => mutate({ type: 'restore', removed });

export const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
export const ALT_KEY = isMac ? '⌥' : 'Alt';
export const SHIFT_KEY = isMac ? '⇧' : 'Shift';
/** Alt/Option without Cmd/Ctrl: the collect modifier. */
export const onlyAlt = (e: { altKey: boolean; metaKey: boolean; ctrlKey: boolean }) =>
  e.altKey && !e.metaKey && !e.ctrlKey;
export const COPY_ALL_SHORTCUT = isMac ? '⌥⇧C' : 'Alt+Shift+C';

export const linkCount = (n: number) => `${n} ${n === 1 ? 'link' : 'links'}`;
