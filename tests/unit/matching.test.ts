import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { defaultSettings, type Word } from '../../src/domain/model';
import { findCandidates } from '../../src/domain/replacement';
import { getDictionaryMatcher } from '../../src/domain/chinese-matcher';
import { starterWords } from '../../src/infrastructure/dictionary/starter';
import { chineseTextBoundary } from '../../src/infrastructure/dictionary/text-boundary';

describe('Chinese boundaries and dictionary scaling', () => {
  it('preserves compounds even when segmentation splits them into smaller words', () => {
    const text = '项目经理查看时间戳和环境变量，团队有时间讨论这个项目。';
    const found = findCandidates(
      [{ id: 'a', text }],
      starterWords,
      { ...defaultSettings, level: 3 },
      [],
      chineseTextBoundary,
    );
    expect(found.map((item) => item.original).sort()).toEqual(
      ['团队', '时间', '项目'].sort(),
    );
    expect(
      found.every((item) => text.slice(item.start, item.end) === item.original),
    ).toBe(true);
  });
  it('honors injected UTF-16 boundaries, including text after emoji', () => {
    const text = '🙂小团队';
    expect(
      findCandidates([{ id: 'a', text }], starterWords, defaultSettings, [], {
        boundaries: () => new Set([0, 2, 5]),
      }),
    ).toEqual([]);
    expect(
      findCandidates([{ id: 'a', text }], starterWords, defaultSettings, [], {
        boundaries: () => new Set([0, 2, 3, 5]),
      })[0],
    ).toMatchObject({ start: 3, end: 5, original: '团队' });
  });
  it('can match a whole compound while rejecting shorter internal candidates', () => {
    const word: Word = {
      ...starterWords[0]!,
      id: 'manager:noun:1',
      english: 'manager',
      chinese: '项目经理',
      level: 1,
    };
    expect(
      findCandidates(
        [{ id: 'a', text: '项目经理' }],
        [...starterWords, word],
        defaultSettings,
        [],
      ).map((item) => item.original),
    ).toEqual(['项目经理']);
  });
  it('reuses a trie for 10000 entries and returns only actual text matches', () => {
    const words: Word[] = Array.from({ length: 10_000 }, (_, index) => ({
      ...starterWords[0]!,
      id: `test:${index}`,
      chinese: `词条${String(index).padStart(5, '0')}`,
      level: 1,
    }));
    const started = performance.now();
    const matcher = getDictionaryMatcher(words);
    expect(getDictionaryMatcher(words)).toBe(matcher);
    const segments = Array.from({ length: 30 }, (_, index) => ({
      id: String(index),
      text:
        '这是一段没有候选词的中文阅读内容。'.repeat(50) +
        '词条09999与词条00001',
    }));
    const result = findCandidates(segments, words, defaultSettings, []);
    expect(result).toHaveLength(60);
    expect(new Set(result.map((item) => item.word.id))).toEqual(
      new Set(['test:9999', 'test:1']),
    );
    console.info(
      `10000-word trie, 30 segments: ${(performance.now() - started).toFixed(1)} ms (build + matching)`,
    );
  });
});
