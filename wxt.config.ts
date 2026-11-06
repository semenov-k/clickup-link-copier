import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'ClickUp Link Copier',
    description: 'Copy ClickUp tasks as clickable title links — one at a time, or collect many and copy them as a list.',
    permissions: ['storage', 'clipboardWrite', 'declarativeContent'],
    host_permissions: ['https://app.clickup.com/*'],
    action: { default_title: 'ClickUp Link Copier' },
  },
});
