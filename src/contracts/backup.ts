import { z } from 'zod';

const word = z.object({
  id: z.string().min(1).max(100),
  chinese: z.string().min(1).max(100),
  english: z.string().min(1).max(100),
  pos: z.string().max(20),
  phonetic: z.string().max(100),
  meaning: z.string().max(1000),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  example: z.string().max(2000),
  exampleZh: z.string().max(2000),
  usage: z.string().max(1000),
  levelReason: z.string().max(200).optional(),
  source: z.enum(['curated', 'ecdict']).optional(),
});
export const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().max(100),
  vocabulary: z
    .array(
      z
        .object({
          id: z.string().min(1).max(100),
          word,
          familiarity: z.enum(['learning', 'mastered', 'ignored']),
          context: z.string().max(2000),
          source: z.string().max(2000),
          createdAt: z.number().nonnegative().finite(),
          updatedAt: z.number().nonnegative().finite(),
          dueAt: z.number().nonnegative().finite(),
          streak: z.number().int().min(0).max(5),
          revision: z.number().int().min(1),
        })
        .refine((item) => item.id === item.word.id, '词条标识不一致'),
    )
    .max(5000),
});
