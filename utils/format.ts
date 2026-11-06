import type { Task } from './task';

export type PlainFormat = 'markdown' | 'title-url' | 'url';

export interface FormatOptions {
  /** Prefix titles with the task id: "[APP-123] Title" (custom id when the space has them). */
  includeId: boolean;
}

/** The text that becomes the link: the title, optionally prefixed with "[id]". */
export function linkText(t: Task, { includeId }: FormatOptions): string {
  if (!includeId) return t.title;
  const tag = `[${t.id}]`;
  return t.title.toLowerCase().startsWith(tag.toLowerCase()) ? t.title : `${tag} ${t.title}`;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Brackets are valid inside Markdown link text as long as they're balanced. */
function hasBalancedBrackets(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === '[') depth++;
    else if (ch === ']' && --depth < 0) return false;
  }
  return depth === 0;
}

/**
 * Keep titles like "[Copilot] New offering" untouched; only escape when the
 * brackets would actually break the link.
 */
const escapeMd = (s: string) => (hasBalancedBrackets(s) ? s : s.replace(/([[\]])/g, '\\$1'));

const anchor = (t: Task, o: FormatOptions) => `<a href="${escapeHtml(t.url)}">${escapeHtml(linkText(t, o))}</a>`;

/**
 * Rich-text version that apps like Slack, Notion, Google Docs and Gmail paste as
 * clickable titles. A single task is an inline link; several become a bullet list.
 */
export function toHtml(tasks: Task[], o: FormatOptions): string {
  const [only] = tasks;
  if (only && tasks.length === 1) return anchor(only, o);
  return `<ul>${tasks.map((t) => `<li>${anchor(t, o)}</li>`).join('')}</ul>`;
}

/** Plain-text fallback for editors that don't accept rich text (terminals, code editors…). */
export function toPlain(tasks: Task[], format: PlainFormat, o: FormatOptions): string {
  const line = (t: Task) => {
    switch (format) {
      case 'markdown':
        return `[${escapeMd(linkText(t, o))}](${t.url})`;
      case 'title-url':
        return `${linkText(t, o)} — ${t.url}`;
      case 'url':
        return t.url;
    }
  };
  const [only] = tasks;
  if (only && tasks.length === 1) return line(only);
  return tasks.map((t) => (format === 'url' ? line(t) : `- ${line(t)}`)).join('\n');
}
