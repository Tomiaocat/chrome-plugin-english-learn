import { z } from 'zod';
import { backupSchema } from './backup';

export const settingsSchema = z.object({
  enabled: z.boolean(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  perPage: z.number().int().min(1).max(30),
  perSegment: z.number().int().min(1).max(5),
  aiEnabled: z.boolean(),
  dailyAiLimit: z.number().int().min(1).max(500),
  aiSites: z.array(z.url()).max(200),
  sites: z.array(z.url()).max(200),
  activeProviderId: z.string().max(100).nullable(),
});
export const providerSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(80),
  protocol: z.enum(['openai-chat', 'openai-responses', 'anthropic']),
  baseUrl: z
    .url()
    .max(500)
    .refine((s) => {
      const url = new URL(s);
      return (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
      );
    }, '接口地址必须是 HTTPS，不包含凭证、查询参数或片段'),
  model: z.string().min(1).max(200),
  rememberKey: z.boolean(),
});
const segmentSchema = z.object({
  id: z.string().max(100),
  text: z.string().max(2000),
});
export const requestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('snapshot') }),
  z.object({
    type: z.literal('dictionary-search'),
    query: z.string().trim().min(1).max(80),
  }),
  z.object({ type: z.literal('import-backup'), backup: backupSchema }),
  z.object({
    type: z.literal('analyze'),
    segments: z.array(segmentSchema).max(30),
    encountered: z.array(z.string()).max(100),
  }),
  z.object({
    type: z.literal('save-word'),
    wordId: z.string().max(100),
    context: z.string().max(2000),
    source: z.string().max(2000),
  }),
  z.object({
    type: z.literal('know-word'),
    wordId: z.string().max(100),
    context: z.string().max(2000),
    source: z.string().max(2000),
  }),
  z.object({
    type: z.literal('familiarity'),
    id: z.string().max(100),
    value: z.enum(['learning', 'mastered', 'ignored']),
  }),
  z.object({
    type: z.literal('review'),
    id: z.string().max(100),
    eventId: z.string().uuid(),
    remembered: z.boolean(),
  }),
  z.object({ type: z.literal('settings'), settings: settingsSchema }),
  z.object({
    type: z.literal('save-provider'),
    provider: providerSchema,
    key: z.string().max(1000),
  }),
  z.object({ type: z.literal('delete-provider'), id: z.string().max(100) }),
  z.object({
    type: z.literal('models'),
    provider: providerSchema,
    key: z.string().max(1000),
  }),
  z.object({
    type: z.literal('test-provider'),
    provider: providerSchema,
    key: z.string().max(1000),
  }),
]);
export type Request = z.infer<typeof requestSchema>;
export const envelopeSchema = z.object({
  version: z.literal(1),
  requestId: z.string().uuid(),
  request: requestSchema,
});
export type ErrorCode =
  | 'INVALID_INPUT'
  | 'FORBIDDEN'
  | 'PERMISSION_REQUIRED'
  | 'AUTH_INVALID'
  | 'MODEL_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'BAD_MODEL_OUTPUT'
  | 'STORAGE_FAILED'
  | 'NETWORK_FAILED';
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}
export type Response<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } };
