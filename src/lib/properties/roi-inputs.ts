import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import {
  DraftInputSchema,
  OptionsSchema,
  financialInputPaths,
  type DraftInput,
} from '../analysis/contract';

const sections = ['purchase', 'financing', 'income', 'expenses', 'appreciationExit'] as const;
export type PropertyRoiInputs = {
  version: 1;
  input: Pick<DraftInput, (typeof sections)[number]>;
  options: Partial<z.infer<typeof OptionsSchema>>;
  /** Explicit unknowns also suppress automatic source fallbacks for a new analysis. */
  cleared?: string[];
};
const Schema = z
  .object({
    version: z.literal(1),
    input: DraftInputSchema.refine(
      (v) => Object.keys(v).every((key) => sections.includes(key as (typeof sections)[number])),
      'Only financial sections are supported',
    ),
    options: OptionsSchema.partial(),
    cleared: z
      .array(
        z
          .string()
          .refine(
            (path) => financialInputPaths.includes(path),
            'Choose a financial field to clear',
          ),
      )
      .max(100)
      .optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    for (const path of v.cleared ?? []) {
      if (valueAt(v, path) !== undefined)
        ctx.addIssue({
          code: 'custom',
          path: path.split('.'),
          message: 'Enter a value or clear it, not both',
        });
    }
    const walk = (value: unknown, path: (string | number)[]) => {
      if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > 1e10))
        ctx.addIssue({
          code: 'custom',
          path,
          message: 'Finite value within +/-10 billion required',
        });
      if (value && typeof value === 'object')
        for (const [key, child] of Object.entries(value)) walk(child, [...path, key]);
    };
    walk(v, []);
    for (const [section, field] of [
      ['purchase', 'purchasePrice'],
      ['financing', 'loanAmount'],
    ] as const) {
      const amount = (v.input[section] as Record<string, unknown> | undefined)?.[field];
      if (
        typeof amount === 'number' &&
        (amount > 9999999999.99 || Number(amount.toFixed(2)) !== amount)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['input', section, field],
          message: 'Use currency with at most two decimal places and up to 9,999,999,999.99',
        });
    }
  });

/** One JSON FormData field, or a typed object. Blank/omitted means no change. */
export function parseRoiInputs(
  raw: unknown,
):
  | { success: true; data: PropertyRoiInputs | undefined }
  | { success: false; errors: Record<string, string> } {
  if (raw == null || raw === '') return { success: true, data: undefined };
  try {
    const parsed = Schema.safeParse(typeof raw === 'string' ? JSON.parse(raw) : raw);
    if (!parsed.success)
      return {
        success: false,
        errors: Object.fromEntries(
          parsed.error.issues.map((i) => [`roiInputs.${i.path.join('.')}`, i.message]),
        ),
      };
    return { success: true, data: parsed.data };
  } catch {
    return { success: false, errors: { roiInputs: 'Expected ROI input JSON' } };
  }
}

export function mergeRoiInputs(existing: unknown, patch: PropertyRoiInputs): PropertyRoiInputs {
  const parsed = parseRoiInputs(existing);
  const prior = parsed.success ? parsed.data : undefined;
  const input = { ...prior?.input };
  for (const key of sections)
    if (patch.input[key]) Object.assign(input, { [key]: { ...input[key], ...patch.input[key] } });
  const merged: PropertyRoiInputs = {
    version: 1,
    input,
    options: { ...prior?.options, ...patch.options },
  };
  const cleared = new Set(prior?.cleared);
  for (const path of financialInputPaths) {
    if (valueAt(patch, path) !== undefined) cleared.delete(path);
  }
  for (const path of patch.cleared ?? []) cleared.add(path);
  for (const path of cleared) clearRoiPath(merged, path);
  if (cleared.size) merged.cleared = [...cleared].sort();
  return merged;
}

function valueAt(object: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
      object,
    );
}

/** Only admitted leaf paths can be deleted; never traverse arbitrary object keys. */
export function clearRoiPath(object: unknown, path: string) {
  if (!financialInputPaths.includes(path)) return;
  const keys = path.split('.');
  const parent = valueAt(object, keys.slice(0, -1).join('.'));
  if (parent && typeof parent === 'object')
    delete (parent as Record<string, unknown>)[keys.at(-1)!];
}

/** Price/debt have one authoritative storage location; never retain stale duplicates. */
export function roiStorage(existing: unknown, patch?: PropertyRoiInputs) {
  if (!patch) return {};
  const merged = mergeRoiInputs(existing, patch);
  const purchasePrice = patch.input.purchase?.purchasePrice;
  const loanAmount = patch.input.financing?.loanAmount;
  if (merged.input.purchase) delete merged.input.purchase.purchasePrice;
  if (merged.input.financing) delete merged.input.financing.loanAmount;
  return {
    roiInputs: JSON.parse(JSON.stringify(merged)) as Prisma.InputJsonValue,
    ...(purchasePrice !== undefined
      ? { purchasePrice }
      : patch.cleared?.includes('input.purchase.purchasePrice')
        ? { purchasePrice: null }
        : {}),
    ...(loanAmount !== undefined
      ? { loanAmount }
      : patch.cleared?.includes('input.financing.loanAmount')
        ? { loanAmount: null }
        : {}),
  };
}

export function readPropertyRoiInputs(row: {
  roiInputs?: unknown;
  purchasePrice: unknown;
  loanAmount: unknown;
}): PropertyRoiInputs {
  const parsed = parseRoiInputs(row.roiInputs);
  const stored = parsed.success ? parsed.data : undefined;
  return {
    version: 1,
    input: {
      ...stored?.input,
      purchase: {
        ...stored?.input.purchase,
        ...(row.purchasePrice != null ? { purchasePrice: Number(row.purchasePrice) } : {}),
      },
      financing: {
        ...stored?.input.financing,
        ...(row.loanAmount != null ? { loanAmount: Number(row.loanAmount) } : {}),
      },
    },
    options: stored?.options ?? {},
    ...(stored?.cleared?.length ? { cleared: stored.cleared } : {}),
  };
}
