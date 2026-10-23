import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: false,
  hooks: {
    'build:manifestGenerated'(_wxt, manifest) {
      // WXT infers broad host permissions from runtime content-script matches.
      // Keep website and API access optional; request individual origins in the UI.
      delete manifest.host_permissions;
      manifest.options_ui = { page: 'options.html', open_in_tab: true };
    },
  },
  manifest: {
    name: '词间 · English in Context',
    description: '在中文阅读中遇见英语：语境词卡、单词本与轻量复习。',
    version: '0.2.0',
    permissions: ['storage', 'scripting', 'activeTab'],
    optional_host_permissions: ['https://*/*', 'http://*/*'],
    action: { default_title: '词间 · 阅读中学英语' },
  },
});
