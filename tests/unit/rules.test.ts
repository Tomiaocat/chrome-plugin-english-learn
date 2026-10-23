import { describe, expect, it } from 'vitest';
import {
  findCandidates,
  selectReplacements,
  validateReplacements,
} from '../../src/domain/replacement';
import { defaultSettings, type Vocabulary } from '../../src/domain/model';
import { starterWords } from '../../src/infrastructure/dictionary/starter';
import { scheduleReview } from '../../src/domain/review';

const segments = [{ id: 'a', text: '团队的目标是提高效率，控制成本。' }];
const team = starterWords.find((w) => w.english === 'team')!;
const vocabulary: Vocabulary = {
  id: team.id,
  word: team,
  familiarity: 'learning',
  context: '',
  source: '',
  createdAt: 0,
  updatedAt: 0,
  dueAt: 0,
  streak: 0,
  revision: 1,
};
describe('replacement rules', () => {
  it('keeps advanced words out of the basic level', () => {
    expect(
      findCandidates(segments, starterWords, defaultSettings, []).map(
        (c) => c.word.english,
      ),
    ).not.toContain('efficiency');
    expect(
      findCandidates(
        segments,
        starterWords,
        { ...defaultSettings, level: 2 },
        [],
      ).map((c) => c.word.english),
    ).toContain('efficiency');
  });
  it('skips mastered and ignored senses', () => {
    for (const familiarity of ['mastered', 'ignored'] as const)
      expect(
        findCandidates(segments, starterWords, defaultSettings, [
          { ...vocabulary, familiarity },
        ]).some((c) => c.word.id === team.id),
      ).toBe(false);
  });
  it('prioritizes learning words while enforcing segment and page budgets', () => {
    const candidates = findCandidates(
      segments,
      starterWords,
      defaultSettings,
      [],
    );
    const chosen = selectReplacements(
      candidates,
      { ...defaultSettings, perPage: 1, perSegment: 1 },
      [vocabulary],
    );
    expect(chosen).toHaveLength(1);
    expect(chosen[0]?.word.english).toBe('team');
    expect(
      selectReplacements(
        candidates,
        { ...defaultSettings, perPage: 1 },
        [],
        ['unrelated'],
      ),
    ).toHaveLength(0);
  });
  it('rejects forged offsets and unknown senses from model results', () => {
    const candidates = findCandidates(
      segments,
      starterWords,
      defaultSettings,
      [],
    );
    const first = candidates[0]!;
    expect(
      validateReplacements(
        segments,
        [
          { ...first, start: 100 },
          { ...first, word: { ...first.word, id: 'forged' } },
        ],
        candidates,
      ),
    ).toEqual([]);
  });
  it('uses longest matching phrases without overlapping spans', () => {
    const phrase = { ...team, id: 'long', chinese: '团队目标' };
    const result = findCandidates(
      [{ id: 'a', text: '团队目标很明确' }],
      [team, phrase],
      defaultSettings,
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.word.id).toBe('long');
  });
});
describe('review scheduling', () => {
  it('uses ten minutes after forgetting and a day after first recall', () => {
    expect(scheduleReview(vocabulary, false, 100).dueAt).toBe(600_100);
    const result = scheduleReview(vocabulary, true, 100);
    expect(result.dueAt).toBe(86_400_100);
    expect(result.revision).toBe(2);
    expect(result.familiarity).toBe('learning');
  });
});
