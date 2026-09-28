import { ApiErrorCodeSchema, type ApiErrorCode } from '@/lib/contracts';
import { z } from 'zod';

export class AppError extends Error {
  constructor(readonly code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export async function readRequest<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Send a valid JSON request body.');
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'The request is missing required or valid fields.');
  }
  return parsed.data;
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: statusFor(error.code) });
  }
  if (error instanceof z.ZodError) {
    return Response.json({
      error: { code: 'INCOMPLETE_OUTPUT', message: 'The provider returned incomplete or invalid structured output.' },
    }, { status: 502 });
  }
  return Response.json({
    error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed. Please retry.' },
  }, { status: 500 });
}

function statusFor(code: ApiErrorCode): number {
  if (code === 'VALIDATION_ERROR') return 400;
  if (code === 'PROVIDER_CONFIGURATION_ERROR') return 503;
  if (code === 'PROVIDER_TIMEOUT') return 504;
  if (code === 'PROVIDER_ERROR' || code === 'PROVIDER_REFUSAL' || code === 'INCOMPLETE_OUTPUT') return 502;
  return 500;
}

export function assertApiErrorCode(value: unknown): value is ApiErrorCode {
  return ApiErrorCodeSchema.safeParse(value).success;
}
