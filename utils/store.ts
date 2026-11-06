import { storage } from 'wxt/utils/storage';
import type { PlainFormat } from './format';
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

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await settingsItem.getValue()) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await settingsItem.setValue({ ...(await getSettings()), ...patch });
}

/** Adds the task if missing, removes it otherwise. Returns `true` when it was added. */
export async function toggleTask(task: Task): Promise<boolean> {
  const list = await collectionItem.getValue();
  const exists = list.some((t) => t.id === task.id);
  await collectionItem.setValue(
    exists ? list.filter((t) => t.id !== task.id) : [...list, { ...task, addedAt: Date.now() }],
  );
  return !exists;
}

export async function removeTask(id: string): Promise<void> {
  const list = await collectionItem.getValue();
  await collectionItem.setValue(list.filter((t) => t.id !== id));
}

/** Applies a new order (by id); unknown ids are ignored, missing ones keep their place at the end. */
export async function reorderTasks(ids: string[]): Promise<void> {
  const list = await collectionItem.getValue();
  const byId = new Map(list.map((t) => [t.id, t]));
  const ordered = ids.map((id) => byId.get(id)).filter((t): t is StoredTask => !!t);
  const rest = list.filter((t) => !ids.includes(t.id));
  await collectionItem.setValue([...ordered, ...rest]);
}

export async function setCollection(list: StoredTask[]): Promise<void> {
  await collectionItem.setValue(list);
}

export const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
export const ALT_KEY = isMac ? '⌥' : 'Alt';
export const SHIFT_KEY = isMac ? '⇧' : 'Shift';
export const COPY_ALL_SHORTCUT = isMac ? '⌥⇧C' : 'Alt+Shift+C';

export const linkCount = (n: number) => `${n} ${n === 1 ? 'link' : 'links'}`;
