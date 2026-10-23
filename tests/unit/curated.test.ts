import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/domain/model';
import { findCandidates } from '../../src/domain/replacement';
import { curatedWords } from '../../src/infrastructure/dictionary/curated';
import { starterWords } from '../../src/infrastructure/dictionary/starter';

describe('curated learning material', () => {
  it('preserves every original sense and its stored vocabulary identifier', () => {
    for (const original of starterWords) {
      expect(curatedWords.find((word) => word.id === original.id)).toEqual(
        original,
      );
    }
    expect(curatedWords.length).toBeGreaterThanOrEqual(150);
  });

  it('has distinct Chinese triggers and sense IDs with usable explanations', () => {
    expect(new Set(curatedWords.map((word) => word.id)).size).toBe(
      curatedWords.length,
    );
    expect(new Set(curatedWords.map((word) => word.chinese)).size).toBe(
      curatedWords.length,
    );
    expect(new Set(curatedWords.map((word) => word.english)).size).toBe(
      curatedWords.length,
    );
    for (const word of curatedWords) {
      expect(word.chinese.length, word.id).toBeGreaterThanOrEqual(2);
      expect(word.id, word.id).toMatch(/^[a-z]+:(noun|adjective|verb):\d+$/);
      expect(word.meaning.trim().length, word.id).toBeGreaterThanOrEqual(2);
      expect(word.example, word.id).toMatch(
        new RegExp(`\\b${word.english}\\b`, 'i'),
      );
      expect(word.exampleZh, word.id).toMatch(/[\u4e00-\u9fff]/);
      expect(word.usage, word.id).toMatch(/[a-z].*·.*[\u4e00-\u9fff]/i);
      expect([1, 2, 3], word.id).toContain(word.level);
    }
    expect(curatedWords.some((word) => word.pos === 'adj.')).toBe(true);
    expect(curatedWords.some((word) => word.pos === 'v.')).toBe(true);
  });

  it('finds concrete work and daily-life vocabulary without splitting longer triggers', () => {
    const candidates = findCandidates(
      [
        {
          id: 'sample',
          text: '会议后保存文件夹中的报告，午餐前去超市买水果。',
        },
      ],
      curatedWords,
      { ...defaultSettings, level: 3 },
      [],
    );
    const english = candidates.map((candidate) => candidate.word.english);
    expect(english).toEqual(
      expect.arrayContaining([
        'meeting',
        'save',
        'folder',
        'report',
        'lunch',
        'supermarket',
        'fruit',
      ]),
    );
    expect(english).not.toContain('file');
    expect(
      candidates.every(
        (candidate) => candidate.original === candidate.word.chinese,
      ),
    ).toBe(true);
  });
});
