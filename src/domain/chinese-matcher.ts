import type { Word } from './model';

interface TrieNode {
  children: Map<string, TrieNode>;
  terminals: number[];
}

export interface DictionaryMatch {
  start: number;
  end: number;
  wordIndex: number;
}

function node(): TrieNode {
  return { children: new Map(), terminals: [] };
}

/** Offsets are UTF-16 indices, the same units used by DOM Text and String.slice. */
class PhraseTrie {
  private readonly root = node();

  constructor(phrases: readonly string[]) {
    for (const [index, phrase] of phrases.entries()) {
      if (!phrase) continue;
      let current = this.root;
      for (let position = 0; position < phrase.length; position++) {
        const character = phrase[position]!;
        let next = current.children.get(character);
        if (!next) {
          next = node();
          current.children.set(character, next);
        }
        current = next;
      }
      current.terminals.push(index);
    }
  }

  find(text: string): DictionaryMatch[] {
    const matches: DictionaryMatch[] = [];
    for (let start = 0; start < text.length; start++) {
      let current: TrieNode | undefined = this.root;
      for (let position = start; position < text.length; position++) {
        current = current.children.get(text[position]!);
        if (!current) break;
        for (const wordIndex of current.terminals)
          matches.push({ start, end: position + 1, wordIndex });
      }
    }
    return matches;
  }
}

// A segmentation engine can split these established compounds into smaller
// tokens (for example 时间 + 戳). Preserve a compound unless a candidate covers
// all of it. This deliberately small list supplements injected word boundaries;
// it is not a claim to perform general Chinese word-sense disambiguation.
export const protectedCompounds: readonly string[] = Object.freeze([
  '时间戳',
  '时间表',
  '时间轴',
  '时间线',
  '时间差',
  '时间段',
  '项目经理',
  '项目管理',
  '项目组',
  '目标函数',
  '目标值',
  '目标价',
  '目标群体',
  '成本价',
  '成本核算',
  '机会成本',
  '质量保证',
  '质量控制',
  '资源管理器',
  '资源库',
  '信息化',
  '信息量',
  '信息论',
  '环境变量',
  '环境保护',
  '方法论',
  '结果集',
  '责任制',
  '责任人',
  '反馈回路',
]);

const compoundTrie = new PhraseTrie(protectedCompounds);

export function findProtectedCompounds(text: string): DictionaryMatch[] {
  return compoundTrie.find(text);
}

export interface DictionaryMatcher {
  find(text: string): DictionaryMatch[];
}

const matcherCache = new WeakMap<readonly Word[], DictionaryMatcher>();

/** Dictionary snapshots must be immutable; replace the array to update them. */
export function getDictionaryMatcher(
  words: readonly Word[],
): DictionaryMatcher {
  let matcher = matcherCache.get(words);
  if (!matcher) {
    matcher = new PhraseTrie(words.map((word) => word.chinese));
    matcherCache.set(words, matcher);
  }
  return matcher;
}
