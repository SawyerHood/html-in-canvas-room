import { defineBackground } from 'wxt/utils/define-background';
import { DEFAULT_STATE } from '@/utils/messages';

export default defineBackground({
  main() {
    chrome.runtime.onInstalled.addListener(() => {
      chrome.storage.local.get('shaderState', (result) => {
        if (!result.shaderState) {
          chrome.storage.local.set({ shaderState: DEFAULT_STATE });
        }
      });
    });
  },
});
