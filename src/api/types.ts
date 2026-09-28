import type { Brand, CheckConsistencyResponse, FounderData, Messaging, RefineBrandResponse, GenerateBrandsResponse } from '@/lib/contracts';

export interface ApiClient {
  generateBrands(founderData: FounderData): Promise<GenerateBrandsResponse>;
  refineBrand(founderData: FounderData, selectedBrand: Brand): Promise<RefineBrandResponse>;
  checkConsistency(founderData: FounderData, selectedBrand: Brand, messaging: Messaging): Promise<CheckConsistencyResponse>;
}

export type PreviewDataState = 'data' | 'loading' | 'empty' | 'error';
