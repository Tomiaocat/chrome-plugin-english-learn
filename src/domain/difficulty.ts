import type { Level } from './model';

/** Version 1: a transparent frequency band, not a CEFR assessment. */
export function gradeDifficulty(
  frq: number,
  bnc: number,
  fallback?: Level,
): { level: Level; levelReason: string } {
  const valid = (value: number) => Number.isSafeInteger(value) && value > 0;
  const rank = valid(frq) ? frq : valid(bnc) ? bnc : undefined;
  if (rank === undefined)
    return {
      level: fallback ?? 3,
      levelReason:
        fallback === undefined
          ? '无有效词频，暂按高阶展示；非 CEFR 等级'
          : '无有效词频，采用人工档位；非 CEFR 等级',
    };
  return {
    level: rank <= 2000 ? 1 : rank <= 5000 ? 2 : 3,
    levelReason: `ECDICT ${valid(frq) ? 'frq' : 'bnc'} 词频排名 ${rank}；非 CEFR 等级`,
  };
}
