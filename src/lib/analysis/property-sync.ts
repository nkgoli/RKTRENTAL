import type { Prisma } from '@prisma/client';
import type { PropertyRoiInputs } from '../properties/roi-inputs';
import {
  PayloadSchema,
  calculatePayload,
  financialInputPaths,
  missingData,
  type AnalysisPayload,
} from './contract';

/** Leaf assumptions the Edit Property form can set. The tax option object is analysis-only. */
const leafPaths = financialInputPaths.filter((path) => path !== 'options.tax');

function valueAt(object: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
      object,
    );
}

/** The baseline paths an explicit property save supplied or cleared. */
export function patchedPaths(patch: PropertyRoiInputs) {
  return {
    set: leafPaths.filter((path) => valueAt(patch, path) !== undefined),
    cleared: leafPaths.filter((path) => patch.cleared?.includes(path)),
  };
}

/**
 * Applies exactly the supplied/cleared baseline paths of a property save to a saved analysis.
 * Every other baseline value, scenario override, benchmark and option is kept as saved.
 * Returns null when the save changed no baseline assumption.
 */
export function applyPropertyPatch(
  payload: AnalysisPayload,
  patch: PropertyRoiInputs,
  observedAt: Date,
): AnalysisPayload | null {
  const { set, cleared } = patchedPaths(patch);
  if (!set.length && !cleared.length) return null;
  const next = structuredClone(payload);
  for (const path of [...set, ...cleared]) {
    const keys = path.split('.');
    let parent = next as unknown as Record<string, unknown>;
    for (const key of keys.slice(0, -1)) {
      parent[key] ??= {};
      parent = parent[key] as Record<string, unknown>;
    }
    if (set.includes(path)) parent[keys.at(-1)!] = valueAt(patch, path);
    else delete parent[keys.at(-1)!];
  }
  const changed = new Set([...set, ...cleared]);
  next.evidence = [
    ...next.evidence.filter((e) => !changed.has(e.path)),
    ...set.map((path) => ({
      path,
      source: 'property' as const,
      sourceId: payload.propertyId,
      observedAt: observedAt.toISOString(),
      note: 'Saved from Edit Property; replaces the analysis baseline for this assumption.',
    })),
  ];
  return next;
}

/**
 * Keeps one property's saved ROI analysis in step with an explicit Edit Property save, inside
 * the caller's transaction. Only the paths that save supplied or cleared change; a READY
 * analysis the change leaves incomplete or incalculable becomes a DRAFT so it still loads.
 * Unreadable or foreign rows are never rewritten.
 */
export async function syncSavedAnalysis(
  tx: Prisma.TransactionClient,
  organizationId: string,
  propertyId: string,
  patch: PropertyRoiInputs,
  observedAt = new Date(),
): Promise<{ revision: number; status: 'DRAFT' | 'READY' } | null> {
  // Hold the row so a concurrent ROI save cannot slip between this read and the write.
  await tx.$queryRaw`SELECT id FROM "RoiAnalysisState" WHERE "organizationId" = ${organizationId} AND "propertyId" = ${propertyId} FOR UPDATE`;
  const row = await tx.roiAnalysisState.findUnique({
    where: { organizationId_propertyId: { organizationId, propertyId } },
  });
  if (!row || row.version !== 1) return null;
  const saved = PayloadSchema.safeParse(row.payload);
  if (!saved.success || saved.data.propertyId !== propertyId) return null;
  const changed = applyPropertyPatch(saved.data, patch, observedAt);
  if (!changed) return null;
  const next = PayloadSchema.safeParse(changed);
  if (!next.success) return null;
  let status: 'DRAFT' | 'READY' = row.status === 'READY' ? 'READY' : 'DRAFT';
  if (status === 'READY') {
    try {
      if (missingData(next.data).length) status = 'DRAFT';
      else calculatePayload(next.data);
    } catch {
      status = 'DRAFT';
    }
  }
  const updated = await tx.roiAnalysisState.updateMany({
    where: { organizationId, propertyId, revision: row.revision },
    data: {
      status,
      payload: JSON.parse(JSON.stringify(next.data)) as Prisma.InputJsonValue,
      revision: { increment: 1 },
    },
  });
  return updated.count ? { revision: row.revision + 1, status } : null;
}
