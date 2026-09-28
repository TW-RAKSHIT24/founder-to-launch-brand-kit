import { beforeEach, describe, expect, it } from 'vitest';
import { POST as generatePost } from '@/app/api/generate-brands/route';
import { POST as refinePost } from '@/app/api/refine-brand/route';
import { POST as checkPost } from '@/app/api/check-consistency/route';
import {
  CheckConsistencyResponseSchema,
  FounderDataSchema,
  GenerateBrandsResponseSchema,
  RefineBrandResponseSchema,
} from '@/lib/contracts';

const founderData = FounderDataSchema.parse({
  startupName: 'Lecture Loop',
  customer: 'college students revisiting class notes',
  problem: 'turning fast lectures into useful notes',
  personality: 'curious, calm, and playful',
  inspirations: ['field guides'],
});

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('brand kit API routes in mock mode', () => {
  beforeEach(() => {
    process.env.BRAND_KIT_MODE = 'mock';
    delete process.env.OPENAI_API_KEY;
  });

  it('generates exactly three directions with three valid colors each', async () => {
    const response = await generatePost(makeRequest({ founderData }));
    expect(response.status).toBe(200);
    const result = GenerateBrandsResponseSchema.parse(await response.json());
    expect(result.mode).toBe('mock');
    expect(result.brands).toHaveLength(3);
    expect(result.brands[1].colors).toHaveLength(3);
    expect(result.brands[1].colors.every((color) => /^#[\da-f]{6}$/i.test(color))).toBe(true);
    expect(result.brands[1].name).toContain('Brightside');
  });

  it('rejects malformed requests with a stable validation error', async () => {
    const response = await generatePost(makeRequest({ founderData: { ...founderData, inspirations: ['a', 'b', 'c', 'd'] } }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: 'VALIDATION_ERROR', message: 'The request is missing required or valid fields.' } });
  });

  it('refines generic phrases with accurate counts and preserves a useful response shape', async () => {
    const generated = GenerateBrandsResponseSchema.parse(await (await generatePost(makeRequest({ founderData }))).json());
    const response = await refinePost(makeRequest({ founderData, selectedBrand: generated.brands[1] }));
    const result = RefineBrandResponseSchema.parse(await response.json());
    expect(result.mode).toBe('mock');
    expect(result.genericPhrasesFound.reduce((total, finding) => total + finding.count, 0)).toBe(4);
    expect(result.messaging.valueProposition).not.toContain('innovative solutions');
    expect(result.messaging.elevatorPitch).not.toContain('game-changing');
  });

  it('returns exactly the four required consistency checks', async () => {
    const generated = GenerateBrandsResponseSchema.parse(await (await generatePost(makeRequest({ founderData }))).json());
    const selectedBrand = generated.brands[1];
    const refined = RefineBrandResponseSchema.parse(await (await refinePost(makeRequest({ founderData, selectedBrand }))).json());
    const response = await checkPost(makeRequest({ founderData, selectedBrand, messaging: refined.messaging }));
    const result = CheckConsistencyResponseSchema.parse(await response.json());
    expect(result.checks.map((check) => check.dimension)).toEqual(['audience', 'tone', 'positioning', 'tagline-personality']);
  });
});
