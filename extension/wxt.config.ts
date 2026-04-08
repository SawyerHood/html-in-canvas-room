import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'CRT World',
    description: 'View any webpage on a 3D CRT monitor using HTML-in-Canvas',
    version: '1.0.0',
    permissions: ['activeTab', 'storage'],
    action: {},
  },
});
