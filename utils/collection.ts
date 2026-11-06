import type { StoredTask, Task } from './task';

/** A task taken out of the list, with where it was, so Undo can put it back. */
export interface RemovedTask {
  task: StoredTask;
  index: number;
}

/** Every change to the collected list. Applied one at a time by the background worker. */
export type CollectionOp =
  | { type: 'toggle'; task: Task }
  | { type: 'remove'; ids: string[] }
  | { type: 'clear' }
  | { type: 'reorder'; ids: string[] }
  | { type: 'restore'; removed: RemovedTask[] };

export interface OpResult {
  /** For `toggle`: whether the task was added (false = removed). */
  added?: boolean;
  /** Tasks taken out by this op, for Undo. */
  removed: RemovedTask[];
  /** List length after the op. */
  size: number;
}

function take(list: StoredTask[], keep: (t: StoredTask) => boolean) {
  const next: StoredTask[] = [];
  const removed: RemovedTask[] = [];
  list.forEach((task, index) => (keep(task) ? next.push(task) : removed.push({ task, index })));
  return { next, removed };
}

/** Pure: returns the new list (the same array when nothing changed) and what happened. */
export function applyOp(list: StoredTask[], op: CollectionOp): { list: StoredTask[]; result: OpResult } {
  switch (op.type) {
    case 'toggle': {
      if (list.some((t) => t.id === op.task.id)) {
        const { next, removed } = take(list, (t) => t.id !== op.task.id);
        return { list: next, result: { added: false, removed, size: next.length } };
      }
      const next = [...list, { ...op.task, addedAt: Date.now() }];
      return { list: next, result: { added: true, removed: [], size: next.length } };
    }
    case 'remove':
    case 'clear': {
      const ids = op.type === 'remove' ? new Set(op.ids) : null;
      const { next, removed } = take(list, (t) => !!ids && !ids.has(t.id));
      return { list: removed.length ? next : list, result: { removed, size: next.length } };
    }
    case 'reorder': {
      // Unknown ids are ignored; tasks missing from `ids` keep their relative order at the end.
      const byId = new Map(list.map((t) => [t.id, t]));
      const ordered = op.ids.map((id) => byId.get(id)).filter((t): t is StoredTask => !!t);
      const placed = new Set(ordered.map((t) => t.id));
      const next = [...ordered, ...list.filter((t) => !placed.has(t.id))];
      return { list: next, result: { removed: [], size: next.length } };
    }
    case 'restore': {
      // Put back only tasks that aren't in the list again, at their old positions.
      const next = [...list];
      for (const { task, index } of [...op.removed].sort((a, b) => a.index - b.index)) {
        if (next.some((t) => t.id === task.id)) continue;
        next.splice(Math.min(index, next.length), 0, task);
      }
      return { list: next, result: { removed: [], size: next.length } };
    }
  }
}
