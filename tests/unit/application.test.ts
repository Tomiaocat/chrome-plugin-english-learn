import { describe, expect, it, vi } from 'vitest';
import { LearningService } from '../../src/application/learning-service';
import {
  defaultSettings,
  type Provider,
  type Vocabulary,
} from '../../src/domain/model';
import type {
  AiPort,
  DictionaryPort,
  LearningRepository,
  ProviderStore,
  SettingsStore,
} from '../../src/domain/ports';
import { starterDictionary } from '../../src/infrastructure/dictionary/starter';

function setup(dictionary: DictionaryPort = starterDictionary) {
  let settings = { ...defaultSettings, sites: ['https://example.com'] };
  const items = new Map<string, Vocabulary>();
  const provider: Provider = {
    id: 'p',
    name: 'test',
    protocol: 'openai-chat',
    baseUrl: 'https://example.net/v1',
    model: 'm',
    rememberKey: false,
  };
  const store: SettingsStore = {
    get: async () => settings,
    set: async (v) => {
      settings = v;
    },
  };
  const repo: LearningRepository = {
    list: async () => [...items.values()],
    put: async (v) => {
      items.set(v.id, v);
    },
    review: async (v) => {
      items.set(v.id, v);
    },
    importNew: async (values) => {
      let count = 0;
      for (const item of values)
        if (!items.has(item.id)) {
          items.set(item.id, item);
          count++;
        }
      return count;
    },
  };
  const providers: ProviderStore = {
    list: async () => [provider],
    save: async () => {},
    getKey: async () => 'test-key',
    setKey: async () => {},
    remove: async () => {},
  };
  const ai: AiPort = {
    analyze: vi.fn().mockRejectedValue(new Error('offline')),
    models: async () => [],
    test: async () => {},
  };
  const service = new LearningService(store, repo, providers, dictionary, ai, {
    now: () => 100,
    id: () => 'id',
  });
  return { service, store, ai };
}
describe('learning use cases', () => {
  it('does not send text to AI without site-specific consent', async () => {
    const { service, store, ai } = setup();
    await store.set({
      ...(await store.get()),
      aiEnabled: true,
      activeProviderId: 'p',
    });
    const result = await service.analyze(
      [{ id: 'a', text: '这个团队很好' }],
      'https://example.com',
      [],
    );
    expect(result.mode).toBe('local');
    expect(ai.analyze).not.toHaveBeenCalled();
    expect(result.replacements[0]?.word.english).toBe('team');
  });
  it('falls back to the local dictionary when the selected AI fails', async () => {
    const { service, store, ai } = setup();
    await store.set({
      ...(await store.get()),
      aiEnabled: true,
      aiSites: ['https://example.com'],
      activeProviderId: 'p',
    });
    const result = await service.analyze(
      [{ id: 'a', text: '这个团队很好' }],
      'https://example.com',
      [],
    );
    expect(ai.analyze).toHaveBeenCalledOnce();
    expect(result.mode).toBe('local');
    expect(result.replacements).toHaveLength(1);
  });
  it('stops replacement on disabled or unapproved sites', async () => {
    const { service } = setup();
    expect(
      await service.analyze(
        [{ id: 'a', text: '这个团队很好' }],
        'https://unapproved.com',
        [],
      ),
    ).toMatchObject({ active: false, replacements: [] });
  });
  it('saves the original encounter once and schedules its review', async () => {
    const { service } = setup();
    await service.saveWord(
      'team:noun:1',
      '这个团队很好',
      'https://example.com',
    );
    await service.saveWord('team:noun:1', '另一个句子', 'https://example.org');
    const { vocabulary } = await service.snapshot();
    expect(vocabulary).toHaveLength(1);
    expect(vocabulary[0]?.context).toBe('这个团队很好');
    await service.review('team:noun:1', 'event', true);
    expect((await service.snapshot()).vocabulary[0]?.dueAt).toBe(86_400_100);
  });
  it('collects dictionary-only entries, reviews them and canonically restores their backup', async () => {
    const canonical = {
      ...starterDictionary.list()[0]!,
      id: 'ecdict:abandon',
      english: 'abandon',
      chinese: '放弃',
      meaning: '放弃；舍弃',
      example: '',
      exampleZh: '',
      usage: '',
    };
    const dictionary: DictionaryPort = {
      list: () => [],
      get: async (id) => (id === canonical.id ? canonical : undefined),
    };
    const first = setup(dictionary);
    await first.service.saveWord(canonical.id, '离线查词：abandon', '');
    await first.service.review(canonical.id, 'event', true);
    const saved = (await first.service.snapshot()).vocabulary[0]!;
    const second = setup(dictionary);
    expect(
      await second.service.importBackup([
        { ...saved, word: { ...canonical, meaning: '篡改的备份释义' } },
      ]),
    ).toBe(1);
    expect((await second.service.snapshot()).vocabulary[0]).toMatchObject({
      word: canonical,
      dueAt: saved.dueAt,
    });
    expect(await second.service.importBackup([saved])).toBe(0);
    await expect(
      second.service.importBackup([
        { ...saved, word: { ...canonical, id: 'unknown' } },
      ]),
    ).rejects.toThrow('不支持');
  });
});
