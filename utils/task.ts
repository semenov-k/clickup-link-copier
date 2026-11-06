export interface Task {
  /** ClickUp task id (or custom id), used as the unique key. */
  id: string;
  title: string;
  url: string;
}

export interface StoredTask extends Task {
  addedAt: number;
}

/** Matches `/t/<id>` and `/t/<teamId>/<id>` (custom ids like `DEV-123` included). */
const TASK_PATH = /^\/t\/(?:(\d+)\/)?([A-Za-z0-9_-]+)\/?$/;

export function parseTaskUrl(href: string, base = location.origin): Pick<Task, 'id' | 'url'> | null {
  let u: URL;
  try {
    u = new URL(href, base);
  } catch {
    return null;
  }
  if (!/(^|\.)clickup\.com$/.test(u.hostname)) return null;
  const m = u.pathname.match(TASK_PATH);
  const [, team, id] = m ?? [];
  if (!id) return null;
  return { id, url: `${u.origin}/t/${team ? `${team}/` : ''}${id}` };
}

export function cleanTitle(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}
