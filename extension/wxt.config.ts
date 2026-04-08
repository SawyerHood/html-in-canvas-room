import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Shader Overlay',
    description:
      'Apply real-time WebGL shader effects to any website using the HTML-in-Canvas API',
    version: '1.0.0',
    permissions: ['activeTab', 'storage'],
  },
});
