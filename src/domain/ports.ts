import type {
  Provider,
  ReviewEvent,
  Settings,
  Vocabulary,
  Word,
  Replacement,
  Segment,
  DictionaryInfo,
  DictionarySearch,
} from './model';

export interface SettingsStore {
  get(): Promise<Settings>;
  set(value: Settings): Promise<void>;
}
export interface LearningRepository {
  list(): Promise<Vocabulary[]>;
  put(item: Vocabulary): Promise<void>;
  review(item: Vocabulary, event: ReviewEvent): Promise<void>;
  importNew(items: Vocabulary[]): Promise<number>;
}
export interface ProviderStore {
  list(): Promise<Provider[]>;
  save(value: Provider): Promise<void>;
  getKey(id: string): Promise<string | undefined>;
  setKey(id: string, key: string, remember: boolean): Promise<void>;
  remove(id: string): Promise<void>;
}
export interface DictionaryPort {
  /** Only reviewed Chinese-to-English senses may be used for page replacement. */
  list(): readonly Word[];
  get?(id: string): Promise<Word | undefined>;
  search?(query: string): Promise<DictionarySearch>;
  info?(): DictionaryInfo;
}
export interface TextBoundaryPort {
  boundaries(text: string): ReadonlySet<number>;
}
export interface AiPort {
  analyze(
    provider: Provider,
    key: string,
    segments: Segment[],
    candidates: Replacement[],
  ): Promise<Replacement[]>;
  models(provider: Provider, key: string): Promise<string[]>;
  test(provider: Provider, key: string): Promise<void>;
}
export interface Runtime {
  now(): number;
  id(): string;
}
