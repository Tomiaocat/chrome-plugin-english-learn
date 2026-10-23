import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DexieLearningRepository,
  LearningDatabase,
} from '../../src/infrastructure/storage/database';
import { starterWords } from '../../src/infrastructure/dictionary/starter';
import type { Vocabulary } from '../../src/domain/model';

const databases: LearningDatabase[] = [];
function setup() {
  const db = new LearningDatabase(crypto.randomUUID());
  databases.push(db);
  return { db, repo: new DexieLearningRepository(db) };
}
const item: Vocabulary = {
  id: 'word',
  word: starterWords[0]!,
  familiarity: 'learning',
  context: 'context',
  source: '',
  createdAt: 10,
  updatedAt: 10,
  dueAt: 10,
  streak: 0,
  revision: 1,
};
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});
describe('learning transactions', () => {
  it('deduplicates concurrent first saves', async () => {
    const { repo } = setup();
    await Promise.all([repo.put(item), repo.put(item)]);
    expect(await repo.list()).toHaveLength(1);
  });
  it('commits review state and event once, even if the same event is retried', async () => {
    const { db, repo } = setup();
    await repo.put(item);
    const event = {
      id: crypto.randomUUID(),
      vocabularyId: item.id,
      remembered: true,
      reviewedAt: 100,
      algorithmVersion: 1 as const,
    };
    const next = { ...item, revision: 2, streak: 1 };
    await repo.review(next, event);
    await repo.review(next, event);
    expect(await db.reviews.count()).toBe(1);
    expect((await repo.list())[0]?.streak).toBe(1);
  });
  it('rolls back when a stale revision attempts to overwrite newer state', async () => {
    const { db, repo } = setup();
    await repo.put({ ...item, revision: 3 });
    await expect(
      repo.review(
        { ...item, revision: 2 },
        {
          id: 'event',
          vocabularyId: item.id,
          remembered: false,
          reviewedAt: 100,
          algorithmVersion: 1,
        },
      ),
    ).rejects.toThrow();
    expect(await db.reviews.count()).toBe(0);
    expect((await repo.list())[0]?.revision).toBe(3);
  });
  it('imports missing vocabulary without replacing existing progress', async () => {
    const { repo } = setup();
    await repo.put({ ...item, familiarity: 'mastered' });
    expect(
      await repo.importNew([
        item,
        { ...item, id: 'other', word: starterWords[1]! },
      ]),
    ).toBe(1);
    expect((await repo.list()).find((v) => v.id === 'word')?.familiarity).toBe(
      'mastered',
    );
  });
});
