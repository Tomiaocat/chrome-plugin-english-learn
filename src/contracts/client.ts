import type {
  Provider,
  Settings,
  Snapshot,
  Analysis,
  Vocabulary,
  Familiarity,
  DictionarySearch,
} from '../domain/model';

export interface AppClient {
  snapshot(): Promise<Snapshot>;
  searchDictionary(query: string): Promise<DictionarySearch>;
  analyze(
    segments: { id: string; text: string }[],
    encountered: string[],
  ): Promise<Analysis>;
  saveWord(
    wordId: string,
    context: string,
    source: string,
  ): Promise<Vocabulary>;
  markKnown(wordId: string, context: string, source: string): Promise<void>;
  familiarity(id: string, value: Familiarity): Promise<void>;
  review(id: string, remembered: boolean): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  saveProvider(provider: Provider, key: string): Promise<void>;
  deleteProvider(id: string): Promise<void>;
  models(provider: Provider, key: string): Promise<string[]>;
  testProvider(provider: Provider, key: string): Promise<void>;
  grantOrigin(origin: string): Promise<boolean>;
  currentOrigin(): Promise<string | null>;
  openOptions(): Promise<void>;
  exportData(): Promise<void>;
  importData(text: string): Promise<number>;
}
