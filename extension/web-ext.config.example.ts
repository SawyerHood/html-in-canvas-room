import { resolve } from 'node:path';
import { defineWebExtConfig } from 'wxt';

export default defineWebExtConfig({
  chromiumProfile: resolve(__dirname, '.wxt/chrome-data'),
  keepProfileChanges: true,
  chromiumArgs: ['--disable-blink-features=AutomationControlled'],
});
