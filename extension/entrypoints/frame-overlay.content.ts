import { defineContentScript } from 'wxt/utils/define-content-script';

// This runs at document_start — before the page or main content script loads.
// It shows the last saved CRT frame as a static overlay to prevent flicker
// during page navigations. The main content script hides it once the 3D scene
// is ready.

const OVERLAY_ID = '__crt-frame-overlay';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',

  main() {
    chrome.storage.local.get(['crtState', 'crtLastFrame'], (result) => {
      if (!result.crtState?.active || !result.crtLastFrame) return;

      // Show saved frame immediately
      const img = document.createElement('img');
      img.id = OVERLAY_ID;
      img.src = result.crtLastFrame;
      img.style.cssText =
        'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;object-fit:cover;pointer-events:none;';

      // Inject as soon as body exists
      if (document.body) {
        document.body.appendChild(img);
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          document.body.appendChild(img);
        }, { once: true });
      }
    });
  },
});
