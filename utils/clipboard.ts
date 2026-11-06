import type { Task } from './task';
import { toHtml, toPlain } from './format';
import { getSettings } from './store';

/** Writes both `text/html` and `text/plain` so the paste target picks the best one. */
export async function writeRich(html: string, text: string): Promise<void> {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
    return;
  } catch {
    // Fall through: async clipboard can be blocked (no focus, permissions policy…).
  }

  const onCopy = (e: ClipboardEvent) => {
    e.clipboardData?.setData('text/html', html);
    e.clipboardData?.setData('text/plain', text);
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener('copy', onCopy, true);
  try {
    if (!document.execCommand('copy')) throw new Error('Clipboard is not available');
  } finally {
    window.removeEventListener('copy', onCopy, true);
  }
}

export async function copyTasks(tasks: Task[]): Promise<void> {
  if (!tasks.length) return;
  const { plainFormat, includeId } = await getSettings();
  await writeRich(toHtml(tasks, { includeId }), toPlain(tasks, plainFormat, { includeId }));
}
