# ClickUp Link Copier

Chrome extension that copies ClickUp tasks as **clickable title links**, so pasting into Slack, Notion, Google Docs, Gmail etc. gives you this:

- [Onboarding] Add progress bar to signup steps
- [API] Return 404 for archived projects
- Fix date picker in dark mode

Built with [WXT](https://wxt.dev) + TypeScript (Manifest V3).

## Features

| Where | What |
| --- | --- |
| **List view** rows | Hover a row → 🔗 copy link, ☰+ add to list |
| **Board view** cards | Same buttons in the card's bottom-right corner |
| **Task detail** (page or modal) | `Copy link` and `Add to list` buttons above the title |
| **Anywhere** | `⌥ Option` / `Alt` + click a task row, card or task link → add / remove it from the list |
| **Dock** (bottom center) | Appears when the list isn't empty: count, **Copy N links**, Clear (with Undo). Expands into a preview of exactly what will paste: drag rows (or `Alt+↑/↓`) to reorder, ⧉ to copy just that task, ✕ to remove |
| **Shortcut** | `⌥⇧C` / `Alt+Shift+C` → copy all collected tasks |
| **Toolbar popup** | Same paste preview + Copy / Clear, and paste settings |

- One task copies as an inline link; several copy as a bulleted list.
- Titles are prefixed with the task ID by default: `[APP-7766] Title`. The custom task ID is used wherever the space has custom IDs enabled (ClickUp's regular ID otherwise). It's optional: flip the **Task IDs** switch in the dock's preview, or the checkbox under **Paste settings** in the popup (same setting).
- The clipboard gets both `text/html` (rich links) and `text/plain`. The plain-text format is configurable in the popup: Markdown `[Title](url)` (default), `Title — url`, or URL only.
- The collected list is stored in `chrome.storage.local`, so it's shared across ClickUp tabs and survives reloads.
- Optional "Clear the list after Copy all".

## Develop

```bash
pnpm install
pnpm dev        # opens Chrome with the extension loaded + hot reload
pnpm build      # production build → .output/chrome-mv3
pnpm zip        # zip for the Chrome Web Store
pnpm compile    # type-check
```

## Install the build manually

1. `pnpm build`
2. Open `chrome://extensions`, enable **Developer mode**
3. **Load unpacked** → select `.output/chrome-mv3`

## Project layout

```
entrypoints/
  content/
    index.ts      # content script: injects buttons, Alt+click, shortcuts
    surfaces.ts   # ClickUp DOM selectors (update here if ClickUp changes markup)
    tray.ts/.css  # floating dock, toasts, tooltips (shadow DOM)
    page.css      # styles for injected buttons / selection highlight
  popup/          # toolbar popup
utils/
  clipboard.ts    # rich clipboard write (+ execCommand fallback)
  format.ts       # HTML / plain-text formatting
  store.ts        # collection + settings in chrome.storage
  task.ts         # task URL parsing
```

If ClickUp ships a UI change and buttons stop showing, the selectors in `entrypoints/content/surfaces.ts` are the place to look.
