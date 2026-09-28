import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError } from '@/lib/api-errors';
import { requestStructuredOutput } from '@/lib/provider';

const OutputSchema = z.object({ message: z.string() });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('live provider boundary', () => {
  it('uses JSON-object mode and validates the returned shape', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_BASE_URL', 'https://provider.example');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content: '{"message":"grounded output"}' } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestStructuredOutput('Return a message.', {}, OutputSchema)).resolves.toEqual({ message: 'grounded output' });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(init?.body))).toMatchObject({ response_format: { type: 'json_object' } });
  });

  it('surfaces provider refusals and malformed structured output without fallback', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'content_filter', message: { content: null, refusal: 'declined' } }],
    }), { status: 200 })));
    await expect(requestStructuredOutput('Return a message.', {}, OutputSchema)).rejects.toMatchObject({ code: 'PROVIDER_REFUSAL' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content: '{"unexpected":true}' } }],
    }), { status: 200 })));
    await expect(requestStructuredOutput('Return a message.', {}, OutputSchema)).rejects.toMatchObject({ code: 'INCOMPLETE_OUTPUT' });
  });

  it('classifies timeouts and missing live credentials as explicit errors', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout));
    await expect(requestStructuredOutput('Return a message.', {}, OutputSchema)).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' });

    vi.stubEnv('OPENAI_API_KEY', '');
    await expect(requestStructuredOutput('Return a message.', {}, OutputSchema)).rejects.toBeInstanceOf(AppError);
    await expect(requestStructuredOutput('Return a message.', {}, OutputSchema)).rejects.toMatchObject({ code: 'PROVIDER_CONFIGURATION_ERROR' });
  });
});
