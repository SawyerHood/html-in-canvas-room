import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground({
  main() {
    chrome.action.onClicked.addListener(async (tab) => {
      if (!tab.id) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'toggle' });
      } catch {
        // Content script not ready on this page
      }
    });
  },
});
