import {
  BrandSchema,
  CheckConsistencyResponseSchema,
  type Brand,
  type CheckConsistencyResponse,
  type FounderData,
  type Messaging,
  type RefineBrandResponse,
} from '@/lib/contracts';
import { checkMockConsistency, generateMockBrands, refineMockMessaging } from '@/lib/mock-engine';
import { getProviderMode, requestStructuredOutput } from '@/lib/provider';
import { z } from 'zod';

const BrandListSchema = z.object({ brands: z.array(BrandSchema).length(3) });
export async function generateBrands(founderData: FounderData): Promise<{ brands: Brand[]; mode: 'mock' | 'live' }> {
  const mode = getProviderMode();
  const brands = mode === 'mock'
    ? generateMockBrands(founderData)
    : (await requestStructuredOutput('Return an object with a brands array containing exactly three distinct directions. Include all requested fields and exactly three valid hex colors per direction.', { founderData }, BrandListSchema)).brands;
  return { brands, mode };
}

export async function refineBrand(founderData: FounderData, selectedBrand: Brand): Promise<RefineBrandResponse> {
  const mode = getProviderMode();
  return { ...refineMockMessaging(founderData, selectedBrand), mode };
}

export async function checkConsistency(
  founderData: FounderData,
  selectedBrand: Brand,
  messaging: Messaging,
): Promise<CheckConsistencyResponse> {
  const mode = getProviderMode();
  const result = mode === 'mock'
    ? checkMockConsistency(founderData, selectedBrand, messaging)
    : await requestStructuredOutput('Check exactly four dimensions: audience, tone, positioning, and tagline-personality. Return pass/warning checks, concrete suggestions, and only safe fixes using paths tagline, positioning, voice, valueProposition, elevatorPitch. Every fix must include the current and proposed value.', { founderData, selectedBrand, messaging }, CheckConsistencyResponseSchema.omit({ mode: true }));
  return CheckConsistencyResponseSchema.parse({ ...result, mode });
}
