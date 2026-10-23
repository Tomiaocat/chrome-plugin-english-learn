export type Level = 1 | 2 | 3;
export type Familiarity = 'learning' | 'mastered' | 'ignored';
export type Protocol = 'openai-chat' | 'openai-responses' | 'anthropic';

export interface Word {
  id: string;
  chinese: string;
  english: string;
  pos: string;
  phonetic: string;
  meaning: string;
  level: Level;
  example: string;
  exampleZh: string;
  usage: string;
  levelReason?: string;
  source?: 'curated' | 'ecdict';
}
export interface DictionaryInfo {
  entries: number;
  replacements: number;
  version: string;
  source: string;
}
export interface DictionarySearch {
  words: Word[];
  total: number;
}
export interface Vocabulary {
  id: string;
  word: Word;
  familiarity: Familiarity;
  context: string;
  source: string;
  createdAt: number;
  updatedAt: number;
  dueAt: number;
  streak: number;
  revision: number;
}
export interface ReviewEvent {
  id: string;
  vocabularyId: string;
  remembered: boolean;
  reviewedAt: number;
  algorithmVersion: 1;
}
export interface Settings {
  enabled: boolean;
  level: Level;
  perPage: number;
  perSegment: number;
  aiEnabled: boolean;
  dailyAiLimit: number;
  aiSites: string[];
  excludedSites: string[];
  activeProviderId: string | null;
}
export const defaultSettings: Settings = {
  enabled: true,
  level: 1,
  perPage: 5,
  perSegment: 2,
  aiEnabled: false,
  dailyAiLimit: 50,
  aiSites: [],
  excludedSites: [],
  activeProviderId: null,
};
export interface Provider {
  id: string;
  name: string;
  protocol: Protocol;
  baseUrl: string;
  model: string;
  rememberKey: boolean;
}
export interface ProviderSummary extends Provider {
  hasKey: boolean;
}
export interface Segment {
  id: string;
  text: string;
}
export interface Replacement {
  segmentId: string;
  start: number;
  end: number;
  original: string;
  word: Word;
}
export interface Analysis {
  replacements: Replacement[];
  mode: 'local' | 'ai';
  notice?: string;
  active?: boolean;
  retryAfterMs?: number;
}
export interface Snapshot {
  settings: Settings;
  vocabulary: Vocabulary[];
  providers: ProviderSummary[];
  dictionary: DictionaryInfo;
}
