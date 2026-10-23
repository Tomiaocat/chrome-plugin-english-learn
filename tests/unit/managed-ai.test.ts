import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ManagedAi } from '../../src/infrastructure/ai/managed-ai';
import { LearningDatabase } from '../../src/infrastructure/storage/database';
import { defaultSettings, type Provider } from '../../src/domain/model';
import { starterWords } from '../../src/infrastructure/dictionary/starter';
import type { AiPort } from '../../src/domain/ports';

const databases: LearningDatabase[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});
const provider: Provider = {
  id: 'p',
  name: 'test',
  protocol: 'openai-chat',
  baseUrl: 'https://example.com',
  model: 'm',
  rememberKey: false,
};
describe('AI budget and cache', () => {
  function setup() {
    const db = new LearningDatabase(crypto.randomUUID());
    databases.push(db);
    const adapter: AiPort = {
      analyze: vi.fn(async (_p, _k, _s, candidates) => candidates),
      models: async () => [],
      test: vi.fn(async () => {}),
    };
    const ai = new ManagedAi(adapter, db, {
      get: async () => ({ ...defaultSettings, dailyAiLimit: 1 }),
      set: async () => {},
    });
    return { ai, db, adapter };
  }
  it('reuses normalized analysis after document segment IDs change', async () => {
    const { ai, adapter } = setup();
    const candidate = {
      segmentId: 'first',
      start: 0,
      end: 2,
      original: '团队',
      word: starterWords.find((w) => w.english === 'team')!,
    };
    await ai.analyze(
      provider,
      'key',
      [{ id: 'first', text: '团队很好' }],
      [candidate],
    );
    const changed = { ...candidate, segmentId: 'second' };
    expect(
      await ai.analyze(
        provider,
        'key',
        [{ id: 'second', text: '团队很好' }],
        [changed],
      ),
    ).toEqual([changed]);
    expect(adapter.analyze).toHaveBeenCalledOnce();
  });
  it('enforces persisted budget even after recreating the adapter', async () => {
    const { ai, db, adapter } = setup();
    await ai.test(provider, 'key');
    const restarted = new ManagedAi(adapter, db, {
      get: async () => ({ ...defaultSettings, dailyAiLimit: 1 }),
      set: async () => {},
    });
    await expect(restarted.test(provider, 'key')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    expect(adapter.test).toHaveBeenCalledOnce();
  });
});
