import { z } from 'zod';

const ShortText = z.string().trim().min(1).max(240);

export const FounderDataSchema = z.object({
  startupName: z.string().trim().min(2).max(80),
  customer: z.string().trim().min(2).max(240),
  problem: z.string().trim().min(2).max(500),
  personality: z.string().trim().min(2).max(240),
  inspirations: z.array(z.string().trim().min(1).max(120)).max(3).default([]),
});

export const BrandSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  descriptor: ShortText,
  audience: ShortText,
  positioning: z.string().trim().min(8).max(500),
  voice: ShortText,
  tagline: z.string().trim().min(4).max(120),
  mission: z.string().trim().min(8).max(500),
  story: z.string().trim().min(8).max(800),
  valueProposition: z.string().trim().min(8).max(500),
  elevatorPitch: z.string().trim().min(15).max(900),
  messagePillars: z.array(ShortText).length(3),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).length(3),
  wordsToAvoid: z.array(ShortText).min(3).max(8),
});

export const MessagingSchema = z.object({
  valueProposition: z.string().trim().min(8).max(500),
  elevatorPitch: z.string().trim().min(15).max(900),
  messagePillars: z.array(ShortText).length(3),
});

export const GenericPhraseFindingSchema = z.object({
  phrase: ShortText,
  count: z.number().int().positive(),
  replacement: ShortText,
});

export const CheckDimensionSchema = z.enum([
  'audience',
  'tone',
  'positioning',
  'tagline-personality',
]);

export const ConsistencyCheckSchema = z.object({
  dimension: CheckDimensionSchema,
  status: z.enum(['pass', 'warning']),
  finding: z.string().trim().min(8).max(500),
  suggestion: z.string().trim().min(8).max(500),
});

export const FixPathSchema = z.enum([
  'tagline',
  'positioning',
  'voice',
  'valueProposition',
  'elevatorPitch',
]);

export const ConsistencyFixSchema = z.object({
  id: z.string().min(1),
  path: FixPathSchema,
  currentValue: z.string().min(1).max(900),
  proposedValue: z.string().trim().min(1).max(900),
  reason: z.string().trim().min(8).max(300),
});

export const GenerateBrandsRequestSchema = z.object({ founderData: FounderDataSchema });
export const GenerateBrandsResponseSchema = z.object({
  brands: z.array(BrandSchema).length(3),
  mode: z.enum(['mock', 'live']),
});

export const RefineBrandRequestSchema = z.object({
  founderData: FounderDataSchema,
  selectedBrand: BrandSchema,
});
export const RefineBrandResponseSchema = z.object({
  messaging: MessagingSchema,
  genericPhrasesFound: z.array(GenericPhraseFindingSchema),
  mode: z.enum(['mock', 'live']),
});

export const CheckConsistencyRequestSchema = z.object({
  founderData: FounderDataSchema,
  selectedBrand: BrandSchema,
  messaging: MessagingSchema,
});
export const CheckConsistencyResponseSchema = z.object({
  checks: z.array(ConsistencyCheckSchema).length(4),
  fixes: z.array(ConsistencyFixSchema).max(8),
  mode: z.enum(['mock', 'live']),
});

export const ApiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'PROVIDER_CONFIGURATION_ERROR',
  'PROVIDER_TIMEOUT',
  'PROVIDER_REFUSAL',
  'PROVIDER_ERROR',
  'INCOMPLETE_OUTPUT',
  'INTERNAL_ERROR',
]);

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string().min(1),
  }),
});

export type FounderData = z.infer<typeof FounderDataSchema>;
export type Brand = z.infer<typeof BrandSchema>;
export type Messaging = z.infer<typeof MessagingSchema>;
export type GenericPhraseFinding = z.infer<typeof GenericPhraseFindingSchema>;
export type ConsistencyCheck = z.infer<typeof ConsistencyCheckSchema>;
export type ConsistencyFix = z.infer<typeof ConsistencyFixSchema>;
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type GenerateBrandsResponse = z.infer<typeof GenerateBrandsResponseSchema>;
export type RefineBrandResponse = z.infer<typeof RefineBrandResponseSchema>;
export type CheckConsistencyResponse = z.infer<typeof CheckConsistencyResponseSchema>;
