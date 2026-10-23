import { browser } from 'wxt/browser';
import { LearningService } from '../application/learning-service';
import {
  AppError,
  envelopeSchema,
  type Request,
  type Response,
} from '../contracts/schema';
import {
  ChromeProviderStore,
  ChromeSettingsStore,
} from '../infrastructure/storage/chrome-store';
import {
  DexieLearningRepository,
  LearningDatabase,
} from '../infrastructure/storage/database';
import { PackagedDictionary } from '../infrastructure/dictionary/packaged';
import { chineseTextBoundary } from '../infrastructure/dictionary/text-boundary';
import { ProviderAdapter } from '../infrastructure/ai/provider-adapter';
import { ManagedAi } from '../infrastructure/ai/managed-ai';
import { authorize, type Sender } from '../infrastructure/messaging/security';

export function startBackground() {
  const db = new LearningDatabase();
  const settings = new ChromeSettingsStore();
  const providers = new ChromeProviderStore();
  const service = new LearningService(
    settings,
    new DexieLearningRepository(db),
    providers,
    new PackagedDictionary(async () => {
      const response = await fetch(
        browser.runtime.getURL('/dictionaries/core.json'),
      );
      if (!response.ok) throw new Error('无法读取离线词典');
      return response.json();
    }),
    new ManagedAi(new ProviderAdapter(), db, settings),
    { now: Date.now, id: () => crypto.randomUUID() },
    chineseTextBoundary,
  );
  const ready = Promise.all([
    browser.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
    browser.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
    db.open(),
  ]);
  let mutations: Promise<unknown> = Promise.resolve();
  const inFlight = new Set<number>();
  async function handle(request: Request, sender: Sender) {
    if (request.type === 'snapshot') return service.snapshot();
    if (request.type === 'dictionary-search')
      return service.searchDictionary(request.query);
    if (request.type === 'import-backup')
      return service.importBackup(request.backup.vocabulary);
    if (request.type === 'analyze') {
      const tabId = sender.tab?.id;
      if (tabId === undefined || !sender.url)
        throw new AppError('FORBIDDEN', '缺少网页来源');
      if (
        !(await browser.permissions.contains({
          origins: [`${new URL(sender.url).origin}/*`],
        }))
      )
        return { replacements: [], mode: 'local', active: false };
      if (inFlight.has(tabId) || inFlight.size >= 2)
        return { replacements: [], mode: 'local' };
      inFlight.add(tabId);
      try {
        return await service.analyze(
          request.segments,
          new URL(sender.url).origin,
          request.encountered,
        );
      } finally {
        inFlight.delete(tabId);
      }
    }
    if (request.type === 'save-word' || request.type === 'know-word') {
      const source = sender.tab ? (sender.url ?? '') : request.source;
      const item = await service.saveWord(
        request.wordId,
        request.context,
        source,
      );
      if (request.type === 'know-word') {
        await service.familiarity(item.id, 'mastered');
        await notifyPages();
        return;
      }
      return item;
    }
    if (request.type === 'familiarity') {
      await service.familiarity(request.id, request.value);
      await notifyPages();
      return;
    }
    if (request.type === 'review')
      return service.review(request.id, request.eventId, request.remembered);
    if (request.type === 'settings') {
      for (const site of request.settings.enabled
        ? request.settings.sites
        : []) {
        if (
          !(await browser.permissions.contains({
            origins: [`${new URL(site).origin}/*`],
          }))
        )
          throw new AppError('PERMISSION_REQUIRED', '请先授权该网站');
      }
      await service.saveSettings(request.settings);
      await syncScripts();
      await notifyPages();
      return;
    }
    if (request.type === 'delete-provider')
      return service.deleteProvider(request.id);
    if (request.type === 'save-provider') {
      const old = (await providers.list()).find(
        (p) => p.id === request.provider.id,
      );
      if (old && old.baseUrl !== request.provider.baseUrl && !request.key)
        throw new AppError(
          'INVALID_INPUT',
          '更改地址后请重新填写 Key，避免将旧 Key 发送到新服务',
        );
      return service.saveProvider(request.provider, request.key);
    }
    const { provider } = request;
    const previous = (await providers.list()).find((p) => p.id === provider.id);
    if (previous && previous.baseUrl !== provider.baseUrl && !request.key)
      throw new AppError('INVALID_INPUT', '地址已更改，请重新填写 Key');
    if (
      !(await browser.permissions.contains({
        origins: [`${new URL(provider.baseUrl).origin}/*`],
      }))
    )
      throw new AppError('PERMISSION_REQUIRED', '请先授权接口域名');
    if (request.type === 'models') return service.models(provider, request.key);
    return service.test(provider, request.key);
  }
  async function notifyPages() {
    const tabs = await browser.tabs.query({});
    await Promise.allSettled(
      tabs.flatMap((tab) =>
        tab.id
          ? [browser.tabs.sendMessage(tab.id, { type: 'settings-changed' })]
          : [],
      ),
    );
  }
  async function syncScripts() {
    const current = await settings.get();
    const registered = await browser.scripting.getRegisteredContentScripts();
    const ours = registered
      .filter((s) => s.id.startsWith('word-context-'))
      .map((s) => s.id);
    if (ours.length)
      await browser.scripting.unregisterContentScripts({ ids: ours });
    const allowed: string[] = [];
    if (current.enabled)
      for (const site of current.sites) {
        if (
          await browser.permissions.contains({
            origins: [`${new URL(site).origin}/*`],
          })
        )
          allowed.push(`${new URL(site).origin}/*`);
      }
    if (allowed.length) {
      await browser.scripting.registerContentScripts([
        {
          id: 'word-context-sites',
          js: ['content-scripts/content.js'],
          matches: allowed,
          runAt: 'document_idle',
        },
      ]);
      const tabs = await browser.tabs.query({});
      await Promise.allSettled(
        tabs
          .filter(
            (tab) =>
              tab.id &&
              tab.url &&
              allowed.some((origin) =>
                tab.url!.startsWith(origin.slice(0, -1)),
              ),
          )
          .map((tab) =>
            browser.scripting.executeScript({
              target: { tabId: tab.id! },
              files: ['/content-scripts/content.js'],
            }),
          ),
      );
    }
  }
  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const parsed = envelopeSchema.safeParse(raw);
    if (!parsed.success) {
      sendResponse({
        ok: false,
        error: { code: 'INVALID_INPUT', message: '消息格式不正确' },
      });
      return false;
    }
    const request = parsed.data.request;
    if (!authorize(request, sender, browser.runtime.id)) {
      sendResponse({
        ok: false,
        error: { code: 'FORBIDDEN', message: '来源无权执行此操作' },
      });
      return false;
    }
    const execute = async (): Promise<Response> => {
      try {
        await ready;
        return { ok: true, data: await handle(request, sender) };
      } catch (error) {
        if (error instanceof AppError)
          return {
            ok: false,
            error: { code: error.code, message: error.message },
          };
        return {
          ok: false,
          error: {
            code: 'STORAGE_FAILED',
            message: '操作未完成，请刷新后重试',
          },
        };
      }
    };
    if (
      [
        'analyze',
        'models',
        'test-provider',
        'snapshot',
        'dictionary-search',
      ].includes(request.type)
    )
      void execute().then(sendResponse);
    else {
      mutations = mutations.then(execute, execute);
      void mutations.then(sendResponse);
    }
    return true;
  });
  browser.runtime.onInstalled.addListener(() => {
    void ready.then(syncScripts);
  });
  browser.runtime.onStartup.addListener(() => {
    void ready.then(syncScripts);
  });
  browser.permissions.onRemoved.addListener(() => {
    void ready.then(syncScripts).then(notifyPages);
  });
}
