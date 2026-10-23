import { z } from 'zod';
import type { DictionaryPort } from '../../domain/ports';
import type { DictionarySearch, Word } from '../../domain/model';
import { gradeDifficulty } from '../../domain/difficulty';
import { curatedWords } from './curated';
import metadata from './metadata.json';
import frequencies from './frequencies.json';

const entrySchema = z.tuple([
  z.string().regex(/^[a-z][a-z-]{1,39}$/),
  z.string().max(98),
  z.string().min(1).max(1000),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
]);
type Entry = z.infer<typeof entrySchema>;
const packSchema = z.array(entrySchema).max(30_000);
const frequencyMap = z
  .record(z.string(), z.tuple([z.number(), z.number(), z.string()]))
  .parse(frequencies);
const phoneticText = (value: string) =>
  value ? `/${value.replace(/^\/|\/$/g, '')}/` : '';

export class PackagedDictionary implements DictionaryPort {
  private readonly words: readonly Word[] = Object.freeze(
    curatedWords.map((word) => {
      const data = frequencyMap[word.english];
      return Object.freeze({
        ...word,
        ...gradeDifficulty(data?.[0] ?? 0, data?.[1] ?? 0, word.level),
        phonetic: word.phonetic || phoneticText(data?.[2] ?? ''),
        source: 'curated' as const,
      });
    }),
  );
  private readonly curatedById = new Map(
    this.words.map((word) => [word.id, word]),
  );
  private readonly curatedEnglish = new Set(
    this.words.map((word) => word.english),
  );
  private loading?: Promise<Map<string, Entry>>;

  constructor(private readonly load: () => Promise<unknown>) {}

  list() {
    return this.words;
  }
  info() {
    return {
      entries: metadata.entries,
      replacements: this.words.length,
      version: metadata.version,
      source: metadata.source,
    };
  }
  private entries() {
    if (!this.loading) {
      this.loading = this.load()
        .then((raw) => {
          const entries = packSchema.parse(raw);
          if (
            entries.length !== metadata.entries ||
            new Set(entries.map(([english]) => english)).size !== entries.length
          )
            throw new Error('离线词典文件不完整，请重新加载扩展');
          return new Map(entries.map((entry) => [entry[0], entry]));
        })
        .catch((error: unknown) => {
          this.loading = undefined;
          throw error;
        });
    }
    return this.loading;
  }
  private toWord([english, phonetic, meaning, frq, bnc]: Entry): Word {
    return {
      id: `ecdict:${english}`,
      english,
      chinese:
        meaning
          .replace(/^[^\p{Script=Han}]*/u, '')
          .split(/[\n；;,，]/)[0]!
          .slice(0, 100) || english,
      meaning,
      phonetic: phoneticText(phonetic),
      pos: meaning.match(/^([a-z.]+)\s/i)?.[1]?.slice(0, 20) ?? '',
      ...gradeDifficulty(frq, bnc),
      example: '',
      exampleZh: '',
      usage: '',
      source: 'ecdict',
    };
  }
  async get(id: string): Promise<Word | undefined> {
    const curated = this.curatedById.get(id);
    if (curated) return curated;
    if (!/^ecdict:[a-z][a-z-]{1,39}$/.test(id)) return undefined;
    const entry = (await this.entries()).get(id.slice(7));
    return entry ? this.toWord(entry) : undefined;
  }
  async search(query: string): Promise<DictionarySearch> {
    const text = query.trim().toLowerCase();
    if (!text || text.length > 80) return { words: [], total: 0 };
    const candidates: { word: Word; rank: number }[] = [];
    const rank = (english: string, meaning: string) =>
      english === text
        ? 0
        : english.startsWith(text)
          ? 1
          : meaning.includes(text)
            ? 2
            : -1;
    for (const word of this.words) {
      const order = rank(word.english, `${word.chinese} ${word.meaning}`);
      if (order >= 0) candidates.push({ word, rank: order });
    }
    for (const entry of (await this.entries()).values()) {
      if (this.curatedEnglish.has(entry[0])) continue;
      const order = rank(entry[0], entry[2]);
      if (order >= 0)
        candidates.push({ word: this.toWord(entry), rank: order });
    }
    candidates.sort(
      (a, b) => a.rank - b.rank || a.word.english.localeCompare(b.word.english),
    );
    return {
      words: candidates.slice(0, 30).map(({ word }) => word),
      total: candidates.length,
    };
  }
}
