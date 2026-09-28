import { z } from 'zod';
import {
  BrandSchema,
  CheckConsistencyResponseSchema,
  FounderDataSchema,
  GenericPhraseFindingSchema,
  MessagingSchema,
} from '@/lib/contracts';

export const WORKFLOW_STORAGE_KEY = 'founder-brand-kit-workflow-v1';
export const WORKFLOW_VERSION = 1;

export const FounderDraftSchema = z.object({
  startupName: z.string().max(80),
  customer: z.string().max(240),
  problem: z.string().max(500),
  personality: z.string().max(240),
  inspirations: z.array(z.string().min(1).max(120)).max(3),
});

export const WorkflowStateSchema = z.object({
  version: z.literal(WORKFLOW_VERSION),
  step: z.number().int().min(0).max(5),
  sourceMode: z.enum(['mock', 'live']).nullable(),
  founderDraft: FounderDraftSchema,
  founderData: FounderDataSchema.nullable(),
  brands: z.array(BrandSchema).max(3),
  selectedBrandId: z.string().nullable(),
  messaging: MessagingSchema.nullable(),
  genericPhrasesFound: z.array(GenericPhraseFindingSchema),
  consistency: CheckConsistencyResponseSchema.omit({ mode: true }).nullable(),
  appliedFixIds: z.array(z.string()),
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

export function createInitialWorkflow(): WorkflowState {
  return {
    version: WORKFLOW_VERSION,
    step: 0,
    sourceMode: null,
    founderDraft: { startupName: '', customer: '', problem: '', personality: '', inspirations: [] },
    founderData: null,
    brands: [],
    selectedBrandId: null,
    messaging: null,
    genericPhrasesFound: [],
    consistency: null,
    appliedFixIds: [],
  };
}

export function parseSavedWorkflow(value: unknown): WorkflowState | null {
  const parsed = WorkflowStateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
