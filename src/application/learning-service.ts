import type {
  AiPort,
  DictionaryPort,
  LearningRepository,
  ProviderStore,
  Runtime,
  SettingsStore,
  TextBoundaryPort,
} from '../domain/ports';
import type {
  Analysis,
  Familiarity,
  Provider,
  Segment,
  Settings,
  Vocabulary,
} from '../domain/model';
import {
  findCandidates,
  selectReplacements,
  validateReplacements,
} from '../domain/replacement';
import { scheduleReview } from '../domain/review';

export class LearningService {
  constructor(
    private settings: SettingsStore,
    private learning: LearningRepository,
    private providers: ProviderStore,
    private dictionary: DictionaryPort,
    private ai: AiPort,
    private runtime: Runtime,
    private textBoundary?: TextBoundaryPort,
  ) {}

  async snapshot() {
    const [settings, vocabulary, profiles] = await Promise.all([
      this.settings.get(),
      this.learning.list(),
      this.providers.list(),
    ]);
    const providers = await Promise.all(
      profiles.map(async (p) => ({
        ...p,
        hasKey: Boolean(await this.providers.getKey(p.id)),
      })),
    );
    const dictionary = this.dictionary.info?.() ?? {
      entries: this.dictionary.list().length,
      replacements: this.dictionary.list().length,
      version: 'starter-v1',
      source: '原创学习词条',
    };
    return { settings, vocabulary, providers, dictionary };
  }
  async searchDictionary(query: string) {
    if (this.dictionary.search) return this.dictionary.search(query);
    const words = this.dictionary
      .list()
      .filter((w) =>
        `${w.english} ${w.chinese}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      );
    return { words: words.slice(0, 30), total: words.length };
  }
  async analyze(
    segments: Segment[],
    origin: string,
    encountered: string[],
  ): Promise<Analysis> {
    const settings = await this.settings.get();
    if (!settings.enabled || settings.excludedSites.includes(origin))
      return { replacements: [], mode: 'local', active: false };
    const vocabulary = await this.learning.list();
    const candidates = findCandidates(
      segments,
      this.dictionary.list(),
      settings,
      vocabulary,
      this.textBoundary,
    );
    const fallback = selectReplacements(
      candidates,
      settings,
      vocabulary,
      encountered,
    );
    if (
      !settings.aiEnabled ||
      !settings.aiSites.includes(origin) ||
      !candidates.length
    )
      return { replacements: fallback, mode: 'local' };
    const provider = (await this.providers.list()).find(
      (p) => p.id === settings.activeProviderId,
    );
    const key = provider && (await this.providers.getKey(provider.id));
    if (!provider || !key)
      return {
        replacements: fallback,
        mode: 'local',
        notice: 'AI 未配置完整，已使用本地词库',
      };
    try {
      const proposed = await this.ai.analyze(
        provider,
        key,
        segments,
        candidates,
      );
      return {
        replacements: selectReplacements(
          validateReplacements(segments, proposed, candidates),
          settings,
          vocabulary,
          encountered,
        ),
        mode: 'ai',
      };
    } catch {
      return {
        replacements: fallback,
        mode: 'local',
        notice: 'AI 暂不可用，已回退本地词库',
      };
    }
  }
  async saveWord(wordId: string, context: string, source: string) {
    const word = await this.getWord(wordId);
    if (!word) throw new Error('词条不存在');
    const current = (await this.learning.list()).find(
      (v) => v.word.id === wordId,
    );
    if (current) return current;
    const now = this.runtime.now();
    const item = {
      id: wordId,
      word,
      context,
      source,
      familiarity: 'learning' as const,
      createdAt: now,
      updatedAt: now,
      dueAt: now,
      streak: 0,
      revision: 1,
    };
    await this.learning.put(item);
    return item;
  }
  async familiarity(id: string, value: Familiarity) {
    const item = (await this.learning.list()).find((v) => v.id === id);
    if (!item) throw new Error('词条不存在');
    await this.learning.put({
      ...item,
      familiarity: value,
      updatedAt: this.runtime.now(),
      revision: item.revision + 1,
    });
  }
  async review(id: string, eventId: string, remembered: boolean) {
    const item = (await this.learning.list()).find((v) => v.id === id);
    if (!item || item.familiarity !== 'learning')
      throw new Error('该词不在学习队列');
    const now = this.runtime.now();
    await this.learning.review(scheduleReview(item, remembered, now), {
      id: eventId,
      vocabularyId: id,
      remembered,
      reviewedAt: now,
      algorithmVersion: 1,
    });
  }
  async saveSettings(settings: Settings) {
    await this.settings.set(settings);
  }
  async importBackup(items: Vocabulary[]) {
    const words = await Promise.all(items.map((v) => this.getWord(v.word.id)));
    if (words.some((word) => !word))
      throw new Error('备份中包含当前词库不支持的词条');
    return this.learning.importNew(
      items.map((v, index) => ({ ...v, word: words[index]! })),
    );
  }
  private async getWord(id: string) {
    return (
      this.dictionary.list().find((w) => w.id === id) ??
      (await this.dictionary.get?.(id))
    );
  }
  async saveProvider(provider: Provider, key: string) {
    if (key.trim())
      await this.providers.setKey(
        provider.id,
        key.trim(),
        provider.rememberKey,
      );
    else {
      const existing = await this.providers.getKey(provider.id);
      if (existing)
        await this.providers.setKey(
          provider.id,
          existing,
          provider.rememberKey,
        );
    }
    await this.providers.save(provider);
  }
  async deleteProvider(id: string) {
    await this.providers.remove(id);
    const settings = await this.settings.get();
    if (settings.activeProviderId === id)
      await this.settings.set({
        ...settings,
        activeProviderId: null,
        aiEnabled: false,
      });
  }
  async models(provider: Provider, key: string) {
    return this.ai.models(
      provider,
      key || (await this.providers.getKey(provider.id)) || '',
    );
  }
  async test(provider: Provider, key: string) {
    await this.ai.test(
      provider,
      key || (await this.providers.getKey(provider.id)) || '',
    );
  }
}
