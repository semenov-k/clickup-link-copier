import './style.css';
import { toHtml, toPlain } from '../../utils/format.ts';
import type { Task } from '../../utils/task.ts';

const REPO = 'https://github.com/semenov-k/clickup-link-copier';
// TODO: replace with the listing URL once the extension is published.
const STORE_URL = 'https://chromewebstore.google.com/search/ClickUp%20Link%20Copier';
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const FORMAT = { includeId: true };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

for (const a of document.querySelectorAll<HTMLAnchorElement>('a[data-repo]')) a.href = REPO;
for (const a of document.querySelectorAll<HTMLAnchorElement>('a[data-store]')) a.href = STORE_URL;
for (const a of document.querySelectorAll<HTMLAnchorElement>('a[data-issues]')) a.href = `${REPO}/issues`;
for (const a of document.querySelectorAll<HTMLAnchorElement>('a[data-license]')) a.href = `${REPO}/blob/main/LICENSE`;

// Header gets a border once the page scrolls under it.
const header = document.getElementById('site-header')!;
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- Demo data (made up) ----------

const STATUS = { done: '#30a46c', review: '#e5484d', progress: '#f5a623', todo: '#8b8d98' };
type DemoTask = Task & { status: keyof typeof STATUS };
const RAW: Omit<DemoTask, 'url'>[] = [
  { id: 'APP-412', title: 'Add progress bar to signup steps', status: 'done' },
  { id: 'APP-405', title: 'Return 404 for archived projects', status: 'done' },
  { id: 'APP-417', title: 'Fix date picker in dark mode', status: 'review' },
  { id: 'APP-421', title: 'Cache search results for repeat queries', status: 'progress' },
  { id: 'APP-423', title: 'Show who else is viewing a doc', status: 'progress' },
  { id: 'APP-430', title: 'Weekly digest email', status: 'todo' },
];
const TASKS: DemoTask[] = RAW.map((t) => ({ ...t, url: `https://app.clickup.com/t/1234567/${t.id}` }));

const ICON = {
  link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  add: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h12M3 12h12M3 18h8M18 15v6M15 18h6"/></svg>',
};

// ---------- Clipboard (same two formats as the extension) ----------

async function writeClipboard(tasks: Task[]) {
  const html = toHtml(tasks, FORMAT);
  const text = toPlain(tasks, 'markdown', FORMAT);
  if (window.ClipboardItem && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
  } else {
    await navigator.clipboard.writeText(text);
  }
  lastCopied = tasks;
}

let lastCopied: Task[] = [];

const toastEl = $('toast');
let toastTimer = 0;
function toast(message: string) {
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('visible'), 2400);
}

function flash(btn: HTMLElement, done: string, restore: string, ms = 1200) {
  btn.innerHTML = done;
  btn.classList.add('done');
  window.setTimeout(() => {
    btn.innerHTML = restore;
    btn.classList.remove('done');
  }, ms);
}

// ---------- Task list ----------

const collected: Task[] = [];
const tasksEl = $<HTMLUListElement>('tasks');
const composer = $('composer');

function isCollected(id: string) {
  return collected.some((t) => t.id === id);
}

function toggle(task: Task) {
  const i = collected.findIndex((t) => t.id === task.id);
  if (i >= 0) collected.splice(i, 1);
  else collected.push(task);
  render();
}

async function copy(tasks: Task[], btn: HTMLElement, restore: string) {
  try {
    await writeClipboard(tasks);
  } catch {
    toast('Your browser blocked the clipboard. Click the page once, then try again.');
    return;
  }
  const n = tasks.length;
  flash(btn, btn === dockCopy ? `Copied ${n} ${n === 1 ? 'link' : 'links'}` : ICON.check, restore);
  composer.classList.add('ready');
  toast(`Copied. Now paste into the message box, or into Slack.`);
}

function render() {
  tasksEl.replaceChildren(
    ...TASKS.map((task) => {
      const on = isCollected(task.id);
      const li = document.createElement('li');
      li.className = 'task';
      li.dataset.on = String(on);
      li.innerHTML = `
        <span class="status" style="color:${STATUS[task.status]}" aria-hidden="true"></span>
        <span class="task-title"></span>
        <span class="task-id">${task.id}</span>
        <span class="row-actions">
          <button type="button" class="row-btn copy" aria-label="Copy link">${ICON.link}</button>
          <button type="button" class="row-btn add" aria-pressed="${on}" aria-label="${on ? 'Remove from list' : 'Add to list'}">${ICON.add}</button>
        </span>`;
      li.querySelector('.task-title')!.textContent = task.title;
      const copyBtn = li.querySelector<HTMLButtonElement>('.copy')!;
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.altKey) toggle(task);
        else void copy([task], copyBtn, ICON.link);
      });
      li.querySelector('.add')!.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle(task);
      });
      li.addEventListener('click', (e) => {
        if (e.altKey) toggle(task);
      });
      return li;
    }),
  );

  const n = collected.length;
  dock.dataset.empty = String(n === 0);
  $('dock-n').textContent = String(n);
  if (!dockCopy.classList.contains('done')) dockCopy.textContent = `Copy ${n} ${n === 1 ? 'link' : 'links'}`;
}

const dock = $('dock');
const dockCopy = $<HTMLButtonElement>('dock-copy');
dockCopy.addEventListener('click', () => {
  const n = collected.length;
  void copy([...collected], dockCopy, `Copy ${n} ${n === 1 ? 'link' : 'links'}`);
});
$('dock-clear').addEventListener('click', () => {
  collected.length = 0;
  render();
});

// Holding Alt shows that clicking collects, like the extension.
const board = $('board');
const altMode = (e: KeyboardEvent | MouseEvent) => board.classList.toggle('alt-mode', e.altKey && !e.metaKey && !e.ctrlKey);
window.addEventListener('keydown', altMode);
window.addEventListener('keyup', altMode);
window.addEventListener('blur', () => board.classList.remove('alt-mode'));
board.addEventListener('mousemove', altMode);

// Alt+Shift+C copies the list, like the extension.
window.addEventListener('keydown', (e) => {
  const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.matches('input, textarea'));
  if (typing || !e.altKey || !e.shiftKey || e.metaKey || e.ctrlKey || e.code !== 'KeyC' || !collected.length) return;
  e.preventDefault();
  dockCopy.click();
});

render();

// ---------- Chat: paste lands as a message ----------

const messages = $('messages');

/** Rebuild the pasted links from our own data instead of trusting pasted HTML. */
function linksFromPaste(data: DataTransfer): Task[] {
  const html = data.getData('text/html');
  const text = data.getData('text/plain');
  const urls = new Set<string>();
  if (html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('a[href]').forEach((a) => urls.add(a.getAttribute('href')!));
  }
  for (const m of text.matchAll(/https?:\/\/\S+?(?=\)|\s|$)/g)) urls.add(m[0]);
  const known = [...urls].map((u) => TASKS.find((t) => t.url === u)).filter((t): t is DemoTask => !!t);
  return known.length ? known : [];
}

function postMessage(body: HTMLElement) {
  const msg = document.createElement('div');
  msg.className = 'msg msg-new';
  msg.innerHTML = `<span class="avatar bg-[var(--violet)]" aria-hidden="true">Y</span>
    <div class="min-w-0"><p class="msg-meta"><b>You</b> <span>now</span></p></div>`;
  msg.querySelector('.min-w-0')!.append(body);
  messages.append(msg);
  msg.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

composer.addEventListener('paste', (e) => {
  e.preventDefault();
  composer.classList.remove('ready');
  const tasks = e.clipboardData ? linksFromPaste(e.clipboardData) : [];
  const body = document.createElement('div');
  if (tasks.length) {
    // Same HTML the extension writes; built from our own task data, so it's safe to insert.
    body.innerHTML = toHtml(tasks, FORMAT);
  } else {
    const p = document.createElement('p');
    p.textContent = e.clipboardData?.getData('text/plain').slice(0, 280) || '';
    if (!p.textContent) return;
    body.append(p);
  }
  postMessage(body);
});

// Touch devices often can't paste into a fake box easily: offer a tap fallback.
composer.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = composer.textContent?.trim();
    if (!text) return;
    const p = document.createElement('p');
    p.textContent = text;
    postMessage(p);
    composer.textContent = '';
  }
});
composer.addEventListener('focus', () => {
  if (lastCopied.length && matchMedia('(hover: none)').matches) {
    const body = document.createElement('div');
    body.innerHTML = toHtml(lastCopied, FORMAT);
    postMessage(body);
    lastCopied = [];
    composer.classList.remove('ready');
    composer.blur();
  }
});

// ---------- Static samples, generated by the extension's formatter ----------

const sample = TASKS.slice(0, 2);
$('sample-rich').innerHTML = toHtml(sample, FORMAT).replace(/^<ul>|<\/ul>$/g, '');
$('sample-md').textContent = toPlain(sample, 'markdown', FORMAT);


// Show the right modifier names.
if (!isMac) {
  for (const k of document.querySelectorAll('kbd.key')) {
    if (k.textContent === '⌥') k.textContent = 'Alt';
    else if (k.textContent === '⇧') k.textContent = 'Shift';
  }
  composer.dataset.placeholder = 'Paste here with Ctrl+V';
}
