import { defineBackground } from 'wxt/utils/define-background';
import { applyOp, type CollectionOp } from '@/utils/collection';
import { COLLECTION_MESSAGE, collectionItem } from '@/utils/store';

export default defineBackground(() => {
  // The toolbar button is only useful on ClickUp: grey it out everywhere else
  // and enable it on app.clickup.com pages.
  browser.runtime.onInstalled.addListener(() => {
    void browser.action.disable();

    const { declarativeContent } = browser;
    declarativeContent.onPageChanged.removeRules(undefined, () => {
      declarativeContent.onPageChanged.addRules([
        {
          conditions: [
            new declarativeContent.PageStateMatcher({
              pageUrl: { hostEquals: 'app.clickup.com', schemes: ['https'] },
            }),
          ],
          actions: [new declarativeContent.ShowAction()],
        },
      ]);
    });
  });

  // All list edits from every ClickUp tab and the popup run here, one after another,
  // so two quick edits can't read the same old list and overwrite each other.
  let queue: Promise<unknown> = Promise.resolve();

  browser.runtime.onMessage.addListener((msg: { type?: string; op?: CollectionOp }, _sender, sendResponse) => {
    if (msg?.type !== COLLECTION_MESSAGE || !msg.op) return;
    const op = msg.op;
    queue = queue
      .then(async () => {
        const list = await collectionItem.getValue();
        const { list: next, result } = applyOp(list, op);
        if (next !== list) await collectionItem.setValue(next);
        sendResponse(result);
      })
      .catch((err: unknown) => sendResponse({ error: String(err) }));
    return true; // respond asynchronously
  });
});
