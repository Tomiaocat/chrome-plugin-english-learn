import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { gradeDifficulty } from '../../src/domain/difficulty';
import { PackagedDictionary } from '../../src/infrastructure/dictionary/packaged';
import metadata from '../../src/infrastructure/dictionary/metadata.json';

const rawFile = await readFile('public/dictionaries/core.json', 'utf8');
const raw: unknown = JSON.parse(rawFile);
const setup = () => {
  const load = vi.fn(async () => raw);
  return { dictionary: new PackagedDictionary(load), load };
};

describe('frequency bands', () => {
  it('handles threshold edges, prefers frq, and identifies the fallback', () => {
    for (const [rank, level] of [
      [1, 1],
      [2000, 1],
      [2001, 2],
      [5000, 2],
      [5001, 3],
    ]) {
      expect(gradeDifficulty(rank!, 1).level).toBe(level);
    }
    expect(gradeDifficulty(0, 2400)).toMatchObject({
      level: 2,
      levelReason: expect.stringContaining('bnc'),
    });
    expect(gradeDifficulty(-1, Number.NaN, 1)).toMatchObject({
      level: 1,
      levelReason: expect.stringContaining('人工'),
    });
    expect(gradeDifficulty(0, 0).levelReason).toContain('非 CEFR');
    expect(gradeDifficulty(0, 0).levelReason).toContain('暂按高阶');
  });
});

describe('offline dictionary', () => {
  it('ships the exact generated data with its pinned source and MIT license', async () => {
    expect(createHash('sha256').update(rawFile).digest('hex')).toBe(
      metadata.dataSha256,
    );
    expect(metadata.entries).toBeGreaterThan(15_000);
    expect(metadata.frequencyCoverage).toBe(metadata.curatedHeadwords);
    expect(await readFile('public/licenses/ECDICT-MIT.txt', 'utf8')).toContain(
      'Copyright (c) 2025 Linwei',
    );
  });
  it('keeps full dictionary data lazy and caches concurrent reads', async () => {
    const { dictionary, load } = setup();
    expect(dictionary.list()).toHaveLength(170);
    expect(load).not.toHaveBeenCalled();
    expect(
      dictionary
        .list()
        .filter((word) => word.levelReason?.includes('词频排名')),
    ).toHaveLength(169);
    expect(
      dictionary.list().find((word) => word.english === 'plugin')?.levelReason,
    ).toContain('人工');
    expect(
      dictionary.list().filter((word) => Boolean(word.phonetic)),
    ).toHaveLength(167);
    const [first, second] = await Promise.all([
      dictionary.search('abandon'),
      dictionary.get('ecdict:abandon'),
    ]);
    expect(first.words[0]?.english).toBe('abandon');
    expect(second).toMatchObject({
      id: 'ecdict:abandon',
      source: 'ecdict',
      example: '',
      usage: '',
    });
    expect(load).toHaveBeenCalledOnce();
    expect(dictionary.list().some((word) => word.english === 'abandon')).toBe(
      false,
    );
  });
  it('ranks exact matches, deduplicates curated headwords and bounds broad results', async () => {
    const { dictionary } = setup();
    const team = await dictionary.search(' TEAM ');
    expect(team.words[0]).toMatchObject({
      id: 'team:noun:1',
      source: 'curated',
    });
    expect(team.words.filter((word) => word.english === 'team')).toHaveLength(
      1,
    );
    expect(
      (await dictionary.search('咖啡')).words.some(
        (word) => word.english === 'coffee',
      ),
    ).toBe(true);
    const broad = await dictionary.search('a');
    expect(broad.total).toBeGreaterThan(30);
    expect(broad.words).toHaveLength(30);
    expect(await dictionary.search('zzzznonexistent')).toEqual({
      total: 0,
      words: [],
    });
    expect(await dictionary.get('ecdict:../../secret')).toBeUndefined();
  });
  it('retries a failed local read without caching the failure', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValue(raw);
    const dictionary = new PackagedDictionary(load);
    await expect(dictionary.search('team')).rejects.toThrow('unavailable');
    expect((await dictionary.search('team')).words[0]?.english).toBe('team');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
