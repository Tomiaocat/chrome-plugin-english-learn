import { describe, expect, it, vi } from 'vitest';
import {
  ProviderAdapter,
  endpoint,
} from '../../src/infrastructure/ai/provider-adapter';
import type { Provider } from '../../src/domain/model';
import { starterWords } from '../../src/infrastructure/dictionary/starter';

const provider: Provider = {
  id: 'p',
  name: 'test',
  protocol: 'openai-chat',
  baseUrl: 'https://api.example.com/v1/',
  model: 'test-model',
  rememberKey: false,
};
const candidates = [
  {
    segmentId: 'a',
    start: 0,
    end: 2,
    original: '团队',
    word: starterWords.find((w) => w.english === 'team')!,
  },
];
describe('provider protocol contract', () => {
  it.each(['openai-chat', 'openai-responses', 'anthropic'] as const)(
    'normalizes %s request and response',
    async (protocol) => {
      const selected = '{"selected":[0]}';
      const json =
        protocol === 'openai-chat'
          ? { choices: [{ message: { content: selected } }] }
          : protocol === 'anthropic'
            ? { content: [{ type: 'text', text: selected }] }
            : {
                output: [
                  { type: 'reasoning' },
                  {
                    type: 'message',
                    content: [{ type: 'output_text', text: selected }],
                  },
                ],
              };
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify(json)));
      const result = await new ProviderAdapter(fetcher).analyze(
        { ...provider, protocol },
        'not-a-real-key',
        [{ id: 'a', text: '团队很棒' }],
        candidates,
      );
      expect(result).toEqual(candidates);
      const [url, init] = fetcher.mock.calls[0]!;
      expect(url).toBe(
        `https://api.example.com/v1/${protocol === 'anthropic' ? 'messages' : protocol === 'openai-responses' ? 'responses' : 'chat/completions'}`,
      );
      expect(init?.redirect).toBe('error');
      const headers = init?.headers as Record<string, string>;
      expect(
        protocol === 'anthropic' ? headers['x-api-key'] : headers.Authorization,
      ).toContain('not-a-real-key');
    },
  );
  it('rejects out-of-range model selections', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"selected":[99]}' } }],
        }),
      ),
    );
    await expect(
      new ProviderAdapter(fetcher).analyze(provider, 'key', [], candidates),
    ).rejects.toMatchObject({ code: 'BAD_MODEL_OUTPUT' });
  });
  it('maps auth failure without exposing upstream response or credentials', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('secret content', { status: 401 }));
    await expect(
      new ProviderAdapter(fetcher).models(provider, 'secret'),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID' });
  });
  it('permits an empty selection and manual model IDs', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"selected":[]}' } }],
        }),
      ),
    );
    expect(
      await new ProviderAdapter(fetcher).analyze(
        provider,
        'key',
        [],
        candidates,
      ),
    ).toEqual([]);
    expect(endpoint(provider, 'models')).toBe(
      'https://api.example.com/v1/models',
    );
  });
});
