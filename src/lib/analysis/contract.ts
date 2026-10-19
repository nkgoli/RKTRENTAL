import { z } from 'zod';
import {
  analyze,
  analyzeWithScenario,
  compareWithBenchmarks,
  DealInputSchema,
  SOURCE_COMMIT,
  type AnalysisOptions,
  type DealInput,
  type ScenarioOverrides,
} from '../roi';

export const ENGINE_ID = `rocketrental-roi-v1:${SOURCE_COMMIT}`;
const text = z.string().trim().min(1).max(200);
export const IdSchema = text;
const iso = z
  .string()
  .datetime({ offset: true })
  .refine((v) => {
    const d = new Date(v);
    return Number.isFinite(d.getTime()) && d.getUTCFullYear() >= 1900 && d.getUTCFullYear() <= 2100;
  }, 'Expected ISO timestamp in 1900–2100');
const purchase = DealInputSchema.shape.purchase.extend({ acquisitionDate: iso.optional() });
export type DraftInput = {
  propertyId?: string;
  schemaVersion?: 1;
  propertyInfo?: Partial<DealInput['propertyInfo']>;
  purchase?: Partial<Omit<DealInput['purchase'], 'acquisitionDate'>> & { acquisitionDate?: string };
  financing?: Partial<DealInput['financing']>;
  income?: Partial<DealInput['income']>;
  expenses?: Partial<DealInput['expenses']>;
  appreciationExit?: Partial<DealInput['appreciationExit']>;
};
const DraftInputObjectSchema = DealInputSchema.omit({ taxes: true })
  .extend({
    schemaVersion: z.literal(1).optional(),
    purchase: purchase.partial().optional(),
    financing: DealInputSchema.shape.financing
      .extend({
        loanTermYears: z.number().int().min(1).max(50),
        amortizationYears: z.number().int().min(1).max(50).optional(),
      })
      .partial()
      .optional(),
    income: DealInputSchema.shape.income.partial().optional(),
    expenses: DealInputSchema.shape.expenses.partial().optional(),
    appreciationExit: DealInputSchema.shape.appreciationExit.partial().optional(),
  })
  .partial()
  .strict();
export const DraftInputSchema = DraftInputObjectSchema as z.ZodType<DraftInput>;
const rate = z.number().finite().min(0).max(100);
const tax = z
  .object({
    marginalTaxRate: rate,
    stateTaxRate: rate,
    capitalGainsTaxRate: rate,
    recaptureTaxRate: rate,
    depreciationEnabled: z.boolean(),
    depreciationYears: z.number().finite().min(1).max(50),
    landValuePercent: rate,
    allowImmediateLossBenefit: z.boolean(),
  })
  .strict()
  .refine((t) => t.marginalTaxRate + t.stateTaxRate <= 100);
export const OptionsSchema = z
  .object({
    startDate: iso,
    discountRate: z.number().finite().min(-0.99).max(10),
    tax: tax.optional(),
  })
  .strict();
export const EvidenceSchema = z
  .object({
    path: text,
    source: z.enum(['property', 'lease', 'expense', 'manager']),
    sourceId: text.optional(),
    observedAt: iso,
    note: z.string().min(1).max(2000),
  })
  .strict();
const ScenarioSchema = z
  .object({
    id: text,
    name: text,
    overrides: DraftInputObjectSchema.omit({
      propertyId: true,
      propertyInfo: true,
      schemaVersion: true,
    }) as z.ZodType<Omit<DraftInput, 'propertyId' | 'propertyInfo' | 'schemaVersion'>>,
    options: OptionsSchema.optional(),
  })
  .strict();
const BenchmarkSchema = z
  .object({
    type: z.enum(['sp500', 'nasdaq100', 'bonds', 'reits', 'savings', 'custom']),
    name: text,
    description: z.string().max(2000),
    historicalCAGR: z.number().finite().min(-100).max(100),
    averageYield: rate,
    volatility: rate,
    source: text,
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .strict();
export const PayloadSchema = z
  .object({
    version: z.literal(1),
    engineId: z.literal(ENGINE_ID),
    propertyId: IdSchema,
    input: DraftInputSchema,
    options: OptionsSchema.partial(),
    evidence: z.array(EvidenceSchema).max(5000),
    scenarios: z
      .array(ScenarioSchema)
      .max(20)
      .refine((s) => new Set(s.map((x) => x.id)).size === s.length, 'Scenario IDs must be unique'),
    benchmarks: z
      .array(BenchmarkSchema)
      .max(2)
      .refine(
        (b) => new Set(b.map((x) => x.type)).size === b.length,
        'Benchmark types must be unique',
      ),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.input.propertyId !== undefined && p.input.propertyId !== p.propertyId)
      ctx.addIssue({ code: 'custom', path: ['input', 'propertyId'], message: 'Property mismatch' });
    const walk = (v: unknown, path: (string | number)[]) => {
      if (typeof v === 'number' && (!Number.isFinite(v) || Math.abs(v) > 1e10))
        ctx.addIssue({
          code: 'custom',
          path,
          message: 'Finite number within +/-10 billion required',
        });
      if (v && typeof v === 'object')
        for (const [k, child] of Object.entries(v)) walk(child, [...path, k]);
    };
    walk(p, []);
  });
export type AnalysisPayload = z.infer<typeof PayloadSchema>;
export type AssumptionEvidence = z.infer<typeof EvidenceSchema>;
export type ValidationIssue = { path: string; message: string };
export function issues(error: unknown): ValidationIssue[] {
  return error instanceof z.ZodError
    ? error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
    : [{ path: '', message: error instanceof Error ? error.message : 'Invalid analysis' }];
}
export function rehydrateInput(input: DraftInput): ScenarioOverrides {
  const { purchase, ...rest } = input;
  if (!purchase) return rest;
  const { acquisitionDate, ...fields } = purchase;
  return {
    ...rest,
    purchase: {
      ...fields,
      ...(acquisitionDate ? { acquisitionDate: new Date(acquisitionDate) } : {}),
    },
  };
}
export function calculatePayload(payload: AnalysisPayload) {
  const input = DealInputSchema.parse(rehydrateInput(payload.input)) as DealInput;
  // Identity is enforced by the persistence envelope. The numerical pipeline's
  // internal source schema still requires UUIDs despite the facade accepting CUIDs.
  // Omit irrelevant property identity rather than fabricate an alternate ID.
  delete input.propertyId;
  const serialized = OptionsSchema.parse(payload.options);
  const options: AnalysisOptions = { ...serialized, startDate: new Date(serialized.startDate) };
  const base = analyze(input, options);
  const scenarios = payload.scenarios.map((s) => ({
    id: s.id,
    name: s.name,
    result: analyzeWithScenario(
      input,
      rehydrateInput(s.overrides),
      s.options ? { ...s.options, startDate: new Date(s.options.startDate) } : options,
    ),
  }));
  const comparison = payload.benchmarks.length
    ? compareWithBenchmarks(base, payload.benchmarks)
    : null;
  return { base, scenarios, comparison };
}
export function missingData(payload: AnalysisPayload): ValidationIssue[] {
  const input = DealInputSchema.safeParse(rehydrateInput(payload.input));
  const options = OptionsSchema.safeParse(payload.options);
  return [
    ...(input.success ? [] : issues(input.error).map((i) => ({ ...i, path: `input.${i.path}` }))),
    ...(options.success
      ? []
      : issues(options.error).map((i) => ({ ...i, path: `options.${i.path}` }))),
  ];
}
