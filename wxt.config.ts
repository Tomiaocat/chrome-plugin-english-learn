import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: false,
  hooks: {
    'build:manifestGenerated'(_wxt, manifest) {
      manifest.options_ui = { page: 'options.html', open_in_tab: true };
    },
  },
  manifest: {
    name: '词间 · English in Context',
    description: '在中文阅读中遇见英语：语境词卡、单词本与轻量复习。',
    version: '0.3.0',
    permissions: ['storage', 'scripting', 'activeTab'],
    host_permissions: ['https://*/*', 'http://*/*'],
    action: { default_title: '词间 · 阅读中学英语' },
  },
});
