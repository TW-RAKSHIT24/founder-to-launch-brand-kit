import 'server-only';
import { z } from 'zod';
import { AppError } from '@/lib/api-errors';
import type { ApiErrorCode } from '@/lib/contracts';

const ProviderEnvelopeSchema = z.object({
  choices: z.array(z.object({
    finish_reason: z.string().nullable().optional(),
    message: z.object({
      content: z.string().nullable().optional(),
      refusal: z.string().nullable().optional(),
    }),
  })).min(1),
});

export type ProviderMode = 'mock' | 'live';

export function getProviderMode(): ProviderMode {
  const configured = process.env.BRAND_KIT_MODE?.trim().toLowerCase();
  const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  if (configured === 'mock') return 'mock';
  if (configured === 'live' || (!configured && hasKey)) {
    if (!hasKey) throw new AppError('PROVIDER_CONFIGURATION_ERROR', 'Live mode requires OPENAI_API_KEY.');
    return 'live';
  }
  if (!configured) return 'mock';
  throw new AppError('PROVIDER_CONFIGURATION_ERROR', 'BRAND_KIT_MODE must be either "mock" or "live".');
}

export async function requestStructuredOutput<T>(
  task: string,
  input: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new AppError('PROVIDER_CONFIGURATION_ERROR', 'Live mode requires OPENAI_API_KEY.');
  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com').replace(/\/+$/, '');
  const timeoutValue = Number(process.env.PROVIDER_TIMEOUT_MS ?? 20000);
  const timeoutMs = Number.isFinite(timeoutValue) ? Math.min(Math.max(timeoutValue, 1000), 60000) : 20000;
  let response: Response;

  try {
    response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini',
        temperature: 0.35,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Return only a JSON object matching the requested shape. Preserve the founder\'s meaning and personality. Do not invent features, capabilities, statistics, guarantees, or testimonials.' },
          { role: 'user', content: `${task}\n\nInput:\n${JSON.stringify(input)}` },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new AppError('PROVIDER_TIMEOUT', 'The model request timed out. Please retry.');
    }
    throw new AppError('PROVIDER_ERROR', 'The model provider could not be reached. Please retry.');
  }

  if (!response.ok) throw new AppError('PROVIDER_ERROR', `The model provider returned HTTP ${response.status}.`);
  let envelope: z.infer<typeof ProviderEnvelopeSchema>;
  try {
    envelope = ProviderEnvelopeSchema.parse(await response.json());
  } catch {
    throw new AppError('INCOMPLETE_OUTPUT', 'The provider response was not valid structured output.');
  }

  const choice = envelope.choices[0];
  if (choice.message.refusal || choice.finish_reason === 'content_filter') {
    throw new AppError('PROVIDER_REFUSAL', 'The model declined to generate this brand output.');
  }
  if (choice.finish_reason === 'length' || !choice.message.content) {
    throw new AppError('INCOMPLETE_OUTPUT', 'The model response was incomplete. Please retry.');
  }

  let output: unknown;
  try {
    output = JSON.parse(choice.message.content);
  } catch {
    throw new AppError('INCOMPLETE_OUTPUT', 'The model did not return valid JSON. Please retry.');
  }
  const parsed = schema.safeParse(output);
  if (!parsed.success) throw new AppError('INCOMPLETE_OUTPUT', 'The model response did not match the required brand-kit contract.');
  return parsed.data;
}

export function toApiErrorCode(value: unknown): ApiErrorCode | null {
  if (value instanceof AppError) return value.code;
  return null;
}
