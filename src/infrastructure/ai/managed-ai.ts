import type { AiPort, SettingsStore } from '../../domain/ports';
import type { Provider, Replacement, Segment } from '../../domain/model';
import type { LearningDatabase } from '../storage/database';
import { AppError } from '../../contracts/schema';

export class ManagedAi implements AiPort {
  constructor(
    private adapter: AiPort,
    private db: LearningDatabase,
    private settings: SettingsStore,
  ) {}
  private async reserve() {
    const limit = (await this.settings.get()).dailyAiLimit;
    const now = new Date();
    const id = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    await this.db.transaction('rw', this.db.usage, async () => {
      const usage = await this.db.usage.get(id);
      if ((usage?.count ?? 0) >= limit)
        throw new AppError(
          'RATE_LIMITED',
          '已达到今日 AI 请求上限，继续使用本地词库',
        );
      await this.db.usage.put({ id, count: (usage?.count ?? 0) + 1 });
    });
  }
  async analyze(
    provider: Provider,
    key: string,
    segments: Segment[],
    candidates: Replacement[],
  ) {
    const text = JSON.stringify({
      version: 1,
      provider: [
        provider.id,
        provider.baseUrl,
        provider.protocol,
        provider.model,
      ],
      texts: segments.map((s) => s.text),
      candidates: candidates.map((c) => [
        segments.findIndex((s) => s.id === c.segmentId),
        c.start,
        c.end,
        c.word.id,
      ]),
    });
    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(text),
    );
    const id = [...new Uint8Array(hash)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const cached = await this.db.aiCache.get(id);
    if (cached && cached.expiresAt > Date.now())
      return cached.indexes.flatMap((i) =>
        candidates[i] ? [candidates[i]!] : [],
      );
    await this.reserve();
    const result = await this.adapter.analyze(
      provider,
      key,
      segments,
      candidates,
    );
    await this.db.aiCache.put({
      id,
      indexes: result.map((c) => candidates.indexOf(c)),
      expiresAt: Date.now() + 7 * 86_400_000,
    });
    await this.db.aiCache.where('expiresAt').below(Date.now()).delete();
    const excess = (await this.db.aiCache.count()) - 100;
    if (excess > 0)
      await this.db.aiCache.bulkDelete(
        await this.db.aiCache.orderBy('expiresAt').limit(excess).primaryKeys(),
      );
    return result;
  }
  async models(provider: Provider, key: string) {
    return this.adapter.models(provider, key);
  }
  async test(provider: Provider, key: string) {
    await this.reserve();
    return this.adapter.test(provider, key);
  }
}
