import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Drunk Simulator',
    description: 'Chug beers and watch the web get wobbly',
    version: '1.0.0',
    permissions: ['activeTab', 'storage'],
    action: {},
  },
});
