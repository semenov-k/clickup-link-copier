import { defineConfig } from 'wxt';

// Version and description come from package.json.
export default defineConfig({
  manifest: {
    name: 'ClickUp Link Copier',
    homepage_url: 'https://semenov-k.github.io/clickup-link-copier/',
    permissions: ['storage', 'clipboardWrite', 'declarativeContent'],
    host_permissions: ['https://app.clickup.com/*'],
    action: { default_title: 'ClickUp Link Copier' },
  },
});
