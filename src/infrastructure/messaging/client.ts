import { browser } from 'wxt/browser';
import type { AppClient } from '../../contracts/client';
import type { Request, Response } from '../../contracts/schema';
import { backupSchema } from '../../contracts/backup';

async function send<T>(request: Request): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      browser.runtime.sendMessage({
        version: 1,
        requestId: crypto.randomUUID(),
        request,
      }) as Promise<Response<T>>,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('后台响应超时，请刷新后重试')),
          25_000,
        );
      }),
    ]);
    if (!response?.ok)
      throw new Error(response?.error.message ?? '后台连接已中断，请刷新页面');
    return response.data;
  } finally {
    clearTimeout(timer);
  }
}
export const appClient: AppClient = {
  snapshot: () => send({ type: 'snapshot' }),
  searchDictionary: (query) => send({ type: 'dictionary-search', query }),
  analyze: (segments, encountered) =>
    send({ type: 'analyze', segments, encountered }),
  saveWord: (wordId, context, source) =>
    send({ type: 'save-word', wordId, context, source }),
  markKnown: (wordId, context, source) =>
    send({ type: 'know-word', wordId, context, source }),
  familiarity: (id, value) => send({ type: 'familiarity', id, value }),
  review: (id, remembered) =>
    send({ type: 'review', id, eventId: crypto.randomUUID(), remembered }),
  saveSettings: (settings) => send({ type: 'settings', settings }),
  saveProvider: (provider, key) =>
    send({ type: 'save-provider', provider, key }),
  deleteProvider: (id) => send({ type: 'delete-provider', id }),
  models: (provider, key) => send({ type: 'models', provider, key }),
  testProvider: (provider, key) =>
    send({ type: 'test-provider', provider, key }),
  grantOrigin: (origin) =>
    browser.permissions.request({ origins: [`${new URL(origin).origin}/*`] }),
  async currentOrigin() {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab?.url && /^https?:\/\//.test(tab.url)
      ? new URL(tab.url).origin
      : null;
  },
  openOptions: () => browser.runtime.openOptionsPage(),
  async importData(text) {
    if (text.length > 5_000_000) throw new Error('备份不得超过 5 MB');
    const parsed = backupSchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new Error('备份格式不正确或版本不受支持');
    return send<number>({ type: 'import-backup', backup: parsed.data });
  },
  async exportData() {
    const { vocabulary } = await appClient.snapshot();
    const blob = new Blob(
      [
        JSON.stringify(
          { version: 1, exportedAt: new Date().toISOString(), vocabulary },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `词间-单词本-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
