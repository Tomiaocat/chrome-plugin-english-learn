import type { Replacement, Segment, Settings, Vocabulary, Word } from './model';
import {
  findProtectedCompounds,
  getDictionaryMatcher,
} from './chinese-matcher';

export interface CandidateOptions {
  /** Pure adapter returning UTF-16 word boundaries, including 0 and text.length. */
  boundaries?: (text: string) => ReadonlySet<number>;
}

export function findCandidates(
  segments: Segment[],
  words: readonly Word[],
  settings: Settings,
  vocabulary: Vocabulary[],
  options: CandidateOptions = {},
): Replacement[] {
  if (!settings.enabled) return [];
  const states = new Map(vocabulary.map((v) => [v.word.id, v.familiarity]));
  const matcher = getDictionaryMatcher(words);
  const result: Replacement[] = [];
  for (const segment of segments) {
    const boundaries = options.boundaries?.(segment.text);
    const protectedBoundaries = new Uint8Array(segment.text.length + 1);
    for (const compound of findProtectedCompounds(segment.text))
      protectedBoundaries.fill(1, compound.start + 1, compound.end);
    const occupied = new Uint8Array(segment.text.length);
    const previousEnd = new Map<number, number>();
    const matches = matcher
      .find(segment.text)
      .sort(
        (a, b) =>
          b.end - b.start - (a.end - a.start) ||
          a.wordIndex - b.wordIndex ||
          a.start - b.start,
      );
    for (const { start, end, wordIndex } of matches) {
      // Preserve the previous indexOf(..., end) behavior for repeated patterns.
      if (start < (previousEnd.get(wordIndex) ?? 0)) continue;
      previousEnd.set(wordIndex, end);
      const word = words[wordIndex]!;
      if (
        word.level > settings.level ||
        ['mastered', 'ignored'].includes(states.get(word.id) ?? '') ||
        (boundaries && (!boundaries.has(start) || !boundaries.has(end))) ||
        protectedBoundaries[start] ||
        protectedBoundaries[end]
      )
        continue;
      let overlaps = false;
      for (let position = start; position < end; position++)
        if (occupied[position]) {
          overlaps = true;
          break;
        }
      if (overlaps) continue;
      occupied.fill(1, start, end);
      result.push({
        segmentId: segment.id,
        start,
        end,
        original: word.chinese,
        word,
      });
    }
  }
  return result;
}

export function selectReplacements(
  candidates: Replacement[],
  settings: Settings,
  vocabulary: Vocabulary[],
  encountered: string[] = [],
): Replacement[] {
  const learning = new Set(
    vocabulary
      .filter((v) => v.familiarity === 'learning')
      .map((v) => v.word.id),
  );
  const sorted = candidates.toSorted(
    (a, b) =>
      Number(learning.has(b.word.id)) - Number(learning.has(a.word.id)) ||
      a.start - b.start,
  );
  const selected: Replacement[] = [];
  const pageWords = new Set(encountered);
  const perSegment = new Map<string, number>();
  for (const item of sorted) {
    if (pageWords.size >= settings.perPage && !pageWords.has(item.word.id))
      continue;
    if ((perSegment.get(item.segmentId) ?? 0) >= settings.perSegment) continue;
    if (
      selected.some(
        (v) =>
          v.segmentId === item.segmentId &&
          item.start < v.end &&
          item.end > v.start,
      )
    )
      continue;
    selected.push(item);
    pageWords.add(item.word.id);
    perSegment.set(item.segmentId, (perSegment.get(item.segmentId) ?? 0) + 1);
  }
  return selected;
}

export function validateReplacements(
  segments: Segment[],
  proposed: Replacement[],
  candidates: Replacement[],
): Replacement[] {
  return proposed.filter((item) => {
    const text = segments.find((s) => s.id === item.segmentId)?.text;
    return (
      text !== undefined &&
      text.slice(item.start, item.end) === item.original &&
      candidates.some(
        (c) =>
          c.segmentId === item.segmentId &&
          c.start === item.start &&
          c.end === item.end &&
          c.word.id === item.word.id,
      )
    );
  });
}
