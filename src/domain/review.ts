import type { Vocabulary } from './model';

const day = 86_400_000;
const intervals = [1, 3, 7, 14, 30];
export function scheduleReview(
  item: Vocabulary,
  remembered: boolean,
  now: number,
): Vocabulary {
  const streak = remembered ? Math.min(item.streak + 1, intervals.length) : 0;
  const delay = remembered ? (intervals[streak - 1] ?? 1) * day : 10 * 60_000;
  return {
    ...item,
    streak,
    dueAt: now + delay,
    updatedAt: now,
    revision: item.revision + 1,
  };
}
