import { describe, expect, it } from 'vitest';
import { authorize } from '../../src/infrastructure/messaging/security';
import {
  envelopeSchema,
  providerSchema,
  settingsSchema,
} from '../../src/contracts/schema';
import { defaultSettings } from '../../src/domain/model';

describe('message trust boundary', () => {
  it('migrates earlier settings without losing preferences or AI consent', () => {
    const { excludedSites: _excluded, ...legacy } = defaultSettings;
    void _excluded;
    const migrated = settingsSchema.parse({
      ...legacy,
      sites: ['https://old-site.com'],
      perPage: 7,
      aiSites: ['https://consented.com'],
    });
    expect(migrated).toMatchObject({
      excludedSites: [],
      perPage: 7,
      aiSites: ['https://consented.com'],
    });
    expect(migrated).not.toHaveProperty('sites');
  });
  const page = {
    id: 'extension',
    url: 'https://example.com/a',
    frameId: 0,
    tab: { id: 4 },
  };
  it('does not let content scripts read settings or provider metadata', () => {
    expect(
      authorize(
        { type: 'dictionary-search', query: 'team' },
        page,
        'extension',
      ),
    ).toBe(false);
    expect(authorize({ type: 'snapshot' }, page, 'extension')).toBe(false);
    expect(
      authorize(
        { type: 'analyze', segments: [], encountered: [] },
        page,
        'extension',
      ),
    ).toBe(true);
  });
  it('rejects external extensions, frames and pages impersonating the options page', () => {
    const message = { type: 'snapshot' as const };
    expect(
      authorize(
        message,
        { ...page, url: 'https://example.com/options.html' },
        'extension',
      ),
    ).toBe(false);
    expect(
      authorize(
        message,
        { id: 'extension', url: 'chrome-extension://extension/options.html' },
        'extension',
      ),
    ).toBe(true);
    expect(
      authorize(
        message,
        { id: 'other', url: 'chrome-extension://extension/options.html' },
        'extension',
      ),
    ).toBe(false);
    expect(
      authorize(
        { type: 'analyze', segments: [], encountered: [] },
        { ...page, frameId: 2 },
        'extension',
      ),
    ).toBe(false);
  });
  it('requires versioned, bounded messages', () => {
    expect(
      envelopeSchema.safeParse({
        version: 2,
        requestId: crypto.randomUUID(),
        request: { type: 'snapshot' },
      }).success,
    ).toBe(false);
    expect(
      envelopeSchema.safeParse({
        version: 1,
        requestId: crypto.randomUUID(),
        request: {
          type: 'analyze',
          segments: [{ id: 'a', text: 'x'.repeat(2001) }],
          encountered: [],
        },
      }).success,
    ).toBe(false);
  });
  it('rejects credentials and query strings embedded in a provider URL', () => {
    const base = {
      id: 'p',
      name: 'test',
      protocol: 'openai-chat',
      model: 'm',
      rememberKey: false,
    };
    for (const baseUrl of [
      'http://example.com',
      'https://user:pass@example.com',
      'https://example.com?key=secret',
    ])
      expect(providerSchema.safeParse({ ...base, baseUrl }).success).toBe(
        false,
      );
  });
});
