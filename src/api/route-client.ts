import {
  CheckConsistencyResponseSchema,
  ErrorResponseSchema,
  GenerateBrandsResponseSchema,
  RefineBrandResponseSchema,
  type Brand,
  type FounderData,
  type Messaging,
} from '@/lib/contracts';
import { readPreviewState } from '@/api/preview-state';
import type { ApiClient } from '@/api/types';
import { z } from 'zod';

async function post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const previewState = readPreviewState();
  if (previewState === 'loading') await new Promise((resolve) => window.setTimeout(resolve, 1200));
  if (previewState === 'error') throw new Error('Sample preview error. Switch the preview state to Data to continue.');

  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsedError = ErrorResponseSchema.safeParse(payload);
    throw new Error(parsedError.success ? parsedError.data.error.message : 'The request failed. Please retry.');
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error('The server response did not match the brand-kit contract. Please retry.');
  return parsed.data;
}

export const routeClient: ApiClient = {
  generateBrands: (founderData: FounderData) => post('/api/generate-brands', { founderData }, GenerateBrandsResponseSchema),
  refineBrand: (founderData: FounderData, selectedBrand: Brand) => post('/api/refine-brand', { founderData, selectedBrand }, RefineBrandResponseSchema),
  checkConsistency: (founderData: FounderData, selectedBrand: Brand, messaging: Messaging) => post('/api/check-consistency', { founderData, selectedBrand, messaging }, CheckConsistencyResponseSchema),
};
