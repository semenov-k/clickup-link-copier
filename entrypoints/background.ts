import { defineBackground } from 'wxt/utils/define-background';

/**
 * The toolbar button is only useful on ClickUp: grey it out everywhere else
 * and enable it on app.clickup.com pages.
 */
export default defineBackground(() => {
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
});
