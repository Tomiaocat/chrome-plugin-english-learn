import { test, expect, chromium } from '@playwright/test';
import { cp, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { defaultSettings } from '../../src/domain/model';
declare const chrome: typeof import('wxt/browser').browser;

// The test owns its persistent extension context rather than Playwright's default page fixture.
// eslint-disable-next-line no-empty-pattern
test('real extension: replacement, card, vocabulary, review and restoring Chinese', async ({}, testInfo) => {
  const production = path.resolve('.output/chrome-mv3');
  const manifest = JSON.parse(
    await readFile(path.join(production, 'manifest.json'), 'utf8'),
  );
  expect(manifest.host_permissions).toEqual(['https://*/*', 'http://*/*']);
  expect(manifest.permissions).not.toContain('cookies');
  // Isolate the unpacked copy and browser data without changing production permissions.
  const extension = testInfo.outputPath('extension');
  await cp(production, extension, { recursive: true });
  const installedChrome = process.env.TEST_CHROME_CHANNEL === 'chrome';
  console.log('Starting isolated browser');
  const context = await chromium.launchPersistentContext(
    testInfo.outputPath('profile'),
    {
      channel: installedChrome ? 'chrome' : 'chromium',
      headless: true,
      viewport: { width: 1440, height: 1000 },
      ignoreDefaultArgs: ['--disable-extensions'],
      args: installedChrome
        ? ['--enable-unsafe-extension-debugging']
        : [
            `--disable-extensions-except=${extension}`,
            `--load-extension=${extension}`,
          ],
    },
  );
  console.log('Browser connected');
  context.setDefaultTimeout(5000);
  context.setDefaultNavigationTimeout(10000);
  try {
    let loadedId: string | undefined;
    if (installedChrome) {
      const session = await context.browser()!.newBrowserCDPSession();
      console.log('Loading extension through CDP');
      loadedId = (
        await session.send('Extensions.loadUnpacked', { path: extension })
      ).id;
      console.log('Extension loaded');
      await session.detach();
    }
    const extensionId =
      loadedId ??
      new URL(
        (
          context.serviceWorkers()[0] ??
          (await context.waitForEvent('serviceworker'))
        ).url(),
      ).host;
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    console.log('Options page opened');
    await options.screenshot({
      path: testInfo.outputPath('initial-options.png'),
    });
    const initialized = await options.evaluate(
      async (settings) =>
        Promise.race([
          chrome.storage.local.set({ settings }).then(() => 'stored'),
          new Promise<string>((resolve) =>
            setTimeout(() => resolve('storage timed out'), 5000),
          ),
        ]),
      { ...defaultSettings, perPage: 30 },
    );
    expect(initialized).toBe('stored');
    console.log('Initial settings stored');
    await options.reload();
    console.log('Options reloaded');
    await expect(options.getByText('让第一个词，自然地出现。')).toBeVisible();
    console.log('Snapshot loaded');
    const updateSettings = () =>
      options.evaluate(async () => {
        const { settings } = await chrome.storage.local.get('settings');
        return chrome.runtime.sendMessage({
          version: 1,
          requestId: crypto.randomUUID(),
          request: { type: 'settings', settings },
        });
      });
    expect(await updateSettings()).toMatchObject({ ok: true });
    console.log('Site script registered');
    const page = await context.newPage();
    console.log('Reading tab created');
    await page.goto('http://127.0.0.1:4173');
    console.log('Reading fixture opened');
    // Fresh websites work immediately without individual activation.
    await expect(
      page.getByRole('button', { name: '查看 team 的释义' }).first(),
    ).toBeVisible();
    const popup = await context.newPage();
    await options.evaluate(async () => {
      const [reading] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
      await chrome.tabs.update(reading!.id!, { active: true });
    });
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.getByLabel('当前网站状态')).toHaveText(
      '当前网站：默认开启',
    );
    await expect(popup.getByLabel('启用阅读替换')).toBeChecked();
    await popup
      .getByRole('button', { name: '在此网站停用', exact: true })
      .click();
    await expect(popup.getByLabel('当前网站状态')).toHaveText(
      '当前网站：已停用',
    );
    await expect(page.locator('[data-word-context=""]')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('word-context-card')).toHaveCount(0);
    await popup
      .getByRole('button', { name: '在此网站开启', exact: true })
      .click();
    await expect(popup.getByLabel('当前网站状态')).toHaveText(
      '当前网站：默认开启',
    );
    await expect(
      popup.getByRole('button', { name: '在此网站停用', exact: true }),
    ).toBeVisible();
    await popup.close();
    await expect(
      page.getByRole('button', { name: '查看 team 的释义' }).first(),
    ).toBeVisible();
    expect(await page.locator('textarea').inputValue()).toBe(
      '团队正在制定计划',
    );
    expect(await page.locator('code').textContent()).toBe(
      '团队的代码块，不应替换。',
    );
    await expect(page.locator('#compounds')).toHaveText(
      '项目经理查看时间戳和环境变量。',
    );
    await expect(page.locator('#compounds [data-word-context]')).toHaveCount(0);
    await page
      .getByRole('button', { name: '查看 team 的释义' })
      .first()
      .click();
    await expect(page.getByRole('region', { name: 'team 词卡' })).toBeVisible();
    await mkdir(path.resolve('docs/screenshots'), { recursive: true });
    await page.getByRole('region', { name: 'team 词卡' }).screenshot({
      path: path.resolve('docs/screenshots/word-card.png'),
    });
    await page.screenshot({
      path: testInfo.outputPath('word-card.png'),
      fullPage: true,
    });
    await page.getByRole('button', { name: '＋ 加入学习' }).click();
    await expect(page.getByText('已加入单词本')).toBeVisible();
    await page.getByRole('button', { name: '＋ 加入学习' }).click();
    await options.reload();
    await expect(
      options.locator('article').filter({
        has: options.getByRole('heading', { name: 'team', exact: true }),
      }),
    ).toHaveCount(1);
    await mkdir(path.resolve('docs/screenshots'), { recursive: true });
    await options.screenshot({
      path: path.resolve('docs/screenshots/vocabulary.png'),
      fullPage: true,
    });
    await options.getByRole('button', { name: /轻量复习/ }).click();
    await options
      .getByRole('button', { name: '查看释义', exact: true })
      .click();
    await expect(
      options.getByRole('heading', { name: '团队', exact: true }),
    ).toBeVisible();
    await options.getByRole('button', { name: '记得', exact: true }).click();
    await expect(options.getByText('现在没有需要复习的词。')).toBeVisible();
    // The complete dictionary is packaged locally and still works offline.
    await options.getByRole('button', { name: /离线词典/ }).click();
    await context.setOffline(true);
    await options.getByLabel('查询离线词典').fill('abandon');
    await options.getByRole('button', { name: '查词', exact: true }).click();
    const dictionaryEntry = options.getByRole('article', {
      name: 'abandon 词典条目',
      exact: true,
    });
    await expect(dictionaryEntry).toBeVisible();
    await expect(dictionaryEntry).toContainText('不自动用于网页替换');
    await dictionaryEntry
      .getByRole('button', { name: '加入学习', exact: true })
      .click();
    await expect(
      dictionaryEntry.getByRole('button', { name: '已在单词本', exact: true }),
    ).toBeVisible();
    await options.screenshot({
      path: path.resolve('docs/screenshots/dictionary.png'),
      fullPage: true,
    });
    await context.setOffline(false);
    await options.getByRole('button', { name: /轻量复习/ }).click();
    await expect(
      options.getByRole('heading', { name: 'abandon', exact: true }),
    ).toBeVisible();
    await options
      .getByRole('button', { name: '查看释义', exact: true })
      .click();
    await expect(options.getByText('这条词典释义尚无配套例句。')).toBeVisible();
    await options.getByRole('button', { name: '记得', exact: true }).click();
    await options.getByRole('button', { name: /AI 服务/ }).click();
    await expect(options.getByLabel('接口协议')).toHaveValue('openai-chat');
    await options.getByLabel('接口协议').selectOption('anthropic');
    await expect(options.getByLabel('接口协议')).toHaveValue('anthropic');
    await options.getByLabel('接口协议').selectOption('openai-chat');
    await options.screenshot({
      path: path.resolve('docs/screenshots/providers.png'),
      fullPage: true,
    });
    await options
      .getByLabel('API Key', { exact: true })
      .fill('test-secret-not-real');
    await options
      .getByRole('button', { name: '保存配置', exact: true })
      .click();
    await expect(
      options.getByText('服务配置已保存。请在上方选择当前服务。'),
    ).toBeVisible();
    const keyStorage = await options.evaluate(async () => {
      const local = await chrome.storage.local.get(null);
      const session = await chrome.storage.session.get(null);
      return { local: JSON.stringify(local), session: JSON.stringify(session) };
    });
    expect(keyStorage.local).not.toContain('test-secret-not-real');
    expect(keyStorage.session).toContain('test-secret-not-real');
    // Content scripts cannot request the privileged snapshot or steal provider data.
    const denied = await options.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
      const result = await chrome.scripting.executeScript({
        target: { tabId: tabs[0]!.id! },
        func: async () =>
          chrome.runtime.sendMessage({
            version: 1,
            requestId: crypto.randomUUID(),
            request: { type: 'snapshot' },
          }),
      });
      return result[0]?.result;
    });
    expect(denied).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    await options.getByRole('button', { name: /阅读偏好/ }).click();
    const downloadPromise = options.waitForEvent('download');
    await options
      .getByRole('button', { name: '导出学习数据', exact: true })
      .click();
    const download = await downloadPromise;
    const backupFile = await download.path();
    expect(backupFile).toBeTruthy();
    const backup = await readFile(backupFile!, 'utf8');
    expect(backup).toContain('team');
    expect(backup).toContain('ecdict:abandon');
    expect(backup).not.toContain('test-secret-not-real');
    await options.getByLabel('导入备份（JSON，最多 5 MB）').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backup),
    });
    await expect(
      options.getByText('已恢复 0 个词；已有词条保持不变。'),
    ).toBeVisible();
    await options.getByLabel('开启网页词汇替换').uncheck();
    await options.getByRole('button', { name: '保存阅读偏好' }).click();
    await expect(page.locator('[data-word-context=""]')).toHaveCount(0);
    await expect(page.locator('#reading')).toHaveText(
      '这个团队有一个清晰的目标。我们的项目有新的计划，也需要控制成本。',
    );
    await page.getByRole('button', { name: '更新已有文本' }).click();
    await options.getByLabel('开启网页词汇替换').check();
    await options.getByRole('button', { name: '保存阅读偏好' }).click();
    await expect(page.locator('#dynamic')).toContainText('problem');
    await page.screenshot({
      path: path.resolve('docs/screenshots/reading.png'),
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});
