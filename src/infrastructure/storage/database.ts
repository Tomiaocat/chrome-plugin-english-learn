import Dexie, { type EntityTable } from 'dexie';
import type { LearningRepository } from '../../domain/ports';
import type { ReviewEvent, Vocabulary } from '../../domain/model';

export class LearningDatabase extends Dexie {
  vocabulary!: EntityTable<Vocabulary, 'id'>;
  reviews!: EntityTable<ReviewEvent, 'id'>;
  aiCache!: EntityTable<
    { id: string; indexes: number[]; expiresAt: number },
    'id'
  >;
  usage!: EntityTable<{ id: string; count: number }, 'id'>;
  constructor(name = 'english-in-context-v1') {
    super(name);
    this.version(1).stores({
      vocabulary: 'id, &word.id, familiarity, dueAt, updatedAt, createdAt',
      reviews: 'id, vocabularyId, reviewedAt',
      aiCache: 'id, expiresAt',
      usage: 'id',
    });
  }
}
export class DexieLearningRepository implements LearningRepository {
  constructor(private db: LearningDatabase) {}
  async list() {
    return this.db.vocabulary.orderBy('createdAt').toArray();
  }
  async put(item: Vocabulary) {
    await this.db.transaction('rw', this.db.vocabulary, async () => {
      const current = await this.db.vocabulary.get(item.id);
      if (!current || item.revision > current.revision)
        await this.db.vocabulary.put(item);
    });
  }
  async review(item: Vocabulary, event: ReviewEvent) {
    await this.db.transaction(
      'rw',
      this.db.vocabulary,
      this.db.reviews,
      async () => {
        if (await this.db.reviews.get(event.id)) return;
        const current = await this.db.vocabulary.get(item.id);
        if (!current || current.revision !== item.revision - 1)
          throw new Error('词条已更新，请刷新后重试');
        await this.db.reviews.add(event);
        await this.db.vocabulary.put(item);
      },
    );
  }
  async importNew(items: Vocabulary[]) {
    return this.db.transaction('rw', this.db.vocabulary, async () => {
      let added = 0;
      for (const item of items)
        if (!(await this.db.vocabulary.get(item.id))) {
          await this.db.vocabulary.add(item);
          added++;
        }
      return added;
    });
  }
}
