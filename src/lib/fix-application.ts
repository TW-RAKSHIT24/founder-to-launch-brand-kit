import { FixPathSchema, type Brand, type ConsistencyFix, type Messaging } from '@/lib/contracts';

export type FixApplication = { brand: Brand; messaging: Messaging };

export function currentFixValue(fix: ConsistencyFix, brand: Brand, messaging: Messaging): string | null {
  if (!FixPathSchema.safeParse(fix.path).success) return null;
  switch (fix.path) {
    case 'tagline': return brand.tagline;
    case 'positioning': return brand.positioning;
    case 'voice': return brand.voice;
    case 'valueProposition': return messaging.valueProposition;
    case 'elevatorPitch': return messaging.elevatorPitch;
  }
}

export function applyConsistencyFix(
  fix: ConsistencyFix,
  brand: Brand,
  messaging: Messaging,
): FixApplication | null {
  if (currentFixValue(fix, brand, messaging) !== fix.currentValue) return null;
  switch (fix.path) {
    case 'tagline': return { brand: { ...brand, tagline: fix.proposedValue }, messaging };
    case 'positioning': return { brand: { ...brand, positioning: fix.proposedValue }, messaging };
    case 'voice': return { brand: { ...brand, voice: fix.proposedValue }, messaging };
    case 'valueProposition': return {
      brand: { ...brand, valueProposition: fix.proposedValue },
      messaging: { ...messaging, valueProposition: fix.proposedValue },
    };
    case 'elevatorPitch': return {
      brand: { ...brand, elevatorPitch: fix.proposedValue },
      messaging: { ...messaging, elevatorPitch: fix.proposedValue },
    };
  }
}
