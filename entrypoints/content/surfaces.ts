import { cleanTitle, parseTaskUrl, type Task } from '@/utils/task';

/**
 * A place in ClickUp's UI where tasks are rendered as rows/cards.
 * Selectors were taken from ClickUp's current Angular DOM; if ClickUp changes
 * its markup, this is the only file that needs updating.
 */
export interface RowSurface {
  kind: 'list' | 'board';
  /** Element representing one task (used for Alt+click and selection highlight). */
  row: string;
  /** Task link inside the row. */
  link: string;
  /** Optional element holding just the title text inside the link. */
  title?: string;
  /** Element inside the row where the hover buttons are appended (defaults to the row itself). */
  mount?: string;
}

export const ROW_SURFACES: RowSurface[] = [
  {
    kind: 'list',
    row: '.vgt-row',
    link: 'a.cu-task-row-main__link',
    title: '.cu-task-row-main__link-text-inner',
    mount: '.cu-task-name-cell__name-row',
  },
  {
    kind: 'board',
    row: '.board-task',
    link: 'a.board-task__name-link',
    // No mount: buttons are pinned to the card's bottom-right corner via CSS.
  },
];

export const DETAIL = {
  hero: 'cu-task-hero-section',
  mount: '.cu-task-hero-section__actions',
  title: '[data-test="task-title__title-overlay"], [data-test="task-hero-section__task-title"]',
  taskIdLabel: '[data-test="task-view-task-label__taskid-button"]',
};

/** Elements that hold only the task name, in order of preference. */
const TITLE_ONLY = ['.cu-task-row-main__link-text-inner'];

/**
 * Task links in ClickUp also contain badges with hidden labels
 * ("Description", "2 Attachments", "Cover image", tag names, "Edit tags"…).
 * Those must never leak into the copied title.
 */
const LINK_CLUTTER = [
  'svg',
  'img',
  'button',
  '[role="button"]',
  '[aria-hidden="true"]',
  '.cdk-visually-hidden',
  '[class*="visually-hidden"]',
  '[class*="sr-only"]',
  '[class*="badge"]',
  '[class*="icon"]',
  '[class*="tag"]',
  '[class*="attachment"]',
  '[class*="cover"]',
  '[class*="description"]',
].join(',');

function linkTitle(link: HTMLAnchorElement, titleSelector?: string): string {
  for (const sel of titleSelector ? [titleSelector, ...TITLE_ONLY] : TITLE_ONLY) {
    const text = cleanTitle(link.querySelector(sel)?.textContent);
    if (text) return text;
  }
  if (!link.children.length) return cleanTitle(link.textContent);
  const clone = link.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(LINK_CLUTTER).forEach((el) => el.remove());
  return cleanTitle(clone.textContent);
}

export function taskFromLink(link: HTMLAnchorElement, titleSelector?: string): Task | null {
  const parsed = parseTaskUrl(link.href);
  if (!parsed) return null;
  return { ...parsed, title: linkTitle(link, titleSelector) || parsed.id };
}

export function taskFromRow(row: Element, surface: RowSurface): Task | null {
  const link = row.querySelector<HTMLAnchorElement>(surface.link);
  return link ? taskFromLink(link, surface.title) : null;
}

/**
 * The task-id label belonging to this hero. It may sit outside the hero element,
 * so walk up — but stop before reaching a container that also holds another task
 * (e.g. a subtask modal over a full-page parent), whose label would be the wrong one.
 */
function taskIdLabel(hero: Element): Element | null {
  for (let el: Element | null = hero; el && el !== document.documentElement; el = el.parentElement) {
    if (el !== hero && el.querySelectorAll(DETAIL.hero).length > 1) return null;
    const label = el.querySelector(DETAIL.taskIdLabel);
    if (label) return label;
  }
  return null;
}

const TASK_ID = /^[A-Za-z0-9_-]+$/;

/**
 * The id ClickUp displays for the open task: the custom task id (e.g. "APP-7766")
 * when the space has them enabled, otherwise the regular id.
 * Read from the header's task-id button, or the tab title ("Name | APP-7766" / "Name | #86abc123x").
 * The tab title is only trusted when it names this task: ClickUp can render the
 * task before updating it (still "Sprint 12 | ClickUp").
 */
function displayedTaskId(hero: Element, title: string): string | null {
  const label = cleanTitle(taskIdLabel(hero)?.textContent).replace(/^#/, '');
  if (TASK_ID.test(label)) return label;
  const tab = document.title.match(/^(.*)\|\s*#?([A-Za-z0-9_-]+)\s*$/);
  if (tab && title && cleanTitle(tab[1]) === title) return tab[2] ?? null;
  return null;
}

/** The task currently open in the detail view / modal. */
export function taskFromDetail(hero: Element): Task | null {
  const parsed = parseTaskUrl(location.href);
  const title = cleanTitle(hero.querySelector(DETAIL.title)?.textContent);
  const shownId = displayedTaskId(hero, title);
  const id = shownId ?? parsed?.id;
  if (!id) return null;
  // Prefer the custom id as the identity, so the same task collected from a
  // list row (whose link already uses the custom id) isn't added twice.
  // Custom-id links only resolve with the workspace id: /t/<team>/APP-7766.
  const team = location.pathname.match(/^\/t\/(\d+)\//)?.[1] ?? location.pathname.match(/^\/(\d+)\//)?.[1];
  const url =
    shownId && shownId !== parsed?.id && team
      ? `${location.origin}/t/${team}/${shownId}`
      : (parsed?.url ?? `${location.origin}/t/${id}`);
  return { id, url, title: title || id };
}

/** Resolves the task under an arbitrary click target (for modifier+click collection). */
export function taskAtTarget(target: Element): { task: Task; row: Element | null } | null {
  for (const surface of ROW_SURFACES) {
    const row = target.closest(surface.row);
    if (!row) continue;
    const task = taskFromRow(row, surface);
    if (task) return { task, row };
  }
  // Any other task link (table view, subtasks, mentions, docs, …).
  const link = target.closest<HTMLAnchorElement>('a[href]');
  if (link) {
    const task = taskFromLink(link);
    if (task) return { task, row: null };
  }
  return null;
}
