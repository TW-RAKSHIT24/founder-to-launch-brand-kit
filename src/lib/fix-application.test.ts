import { describe, expect, it } from 'vitest';
import { ConsistencyFixSchema, FounderDataSchema } from '@/lib/contracts';
import { applyConsistencyFix, currentFixValue } from '@/lib/fix-application';
import { generateMockBrands, refineMockMessaging } from '@/lib/mock-engine';

const founderData = FounderDataSchema.parse({
  startupName: 'Lecture Loop',
  customer: 'college students revisiting class notes',
  problem: 'turning fast lectures into useful notes',
  personality: 'curious, calm, and playful',
  inspirations: [],
});

const [brand] = generateMockBrands(founderData);
const { messaging } = refineMockMessaging(founderData, brand);

 describe('consistency fix application', () => {
  it('applies an allowlisted fix only when its recorded current value is still current', () => {
    const fix = ConsistencyFixSchema.parse({
      id: 'tagline-edit',
      path: 'tagline',
      currentValue: brand.tagline,
      proposedValue: 'A useful next step, made human.',
      reason: 'Connect the line more closely to the chosen personality.',
    });
    expect(currentFixValue(fix, brand, messaging)).toBe(brand.tagline);
    const applied = applyConsistencyFix(fix, brand, messaging);
    expect(applied?.brand.tagline).toBe(fix.proposedValue);
    expect(applyConsistencyFix({ ...fix, currentValue: 'an older value' }, brand, messaging)).toBeNull();
  });

  it('rejects paths outside the explicit allowlist', () => {
    const parsed = ConsistencyFixSchema.safeParse({
      id: 'unsafe',
      path: 'colors.0',
      currentValue: brand.colors[0],
      proposedValue: '#000000',
      reason: 'This path is intentionally not allowed.',
    });
    expect(parsed.success).toBe(false);
  });
});
