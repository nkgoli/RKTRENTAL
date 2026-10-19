import { Prisma, type PrismaClient } from '@prisma/client';
import type { AuthSession } from '../auth/session';
import { z } from 'zod';
import {
  ENGINE_ID,
  IdSchema,
  PayloadSchema,
  calculatePayload,
  issues,
  missingData,
  type AnalysisPayload,
  type AssumptionEvidence,
  type ValidationIssue,
} from './contract';

type Manager = Pick<AuthSession, 'organizationId' | 'role'>;
export type AnalysisFailure = {
  ok: false;
  code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID' | 'MISSING_DATA' | 'CONFLICT' | 'UNSUPPORTED_VERSION';
  issues?: ValidationIssue[];
  currentRevision?: number;
};
export type SavedAnalysis = {
  propertyId: string;
  revision: number;
  status: 'DRAFT' | 'READY';
  payload: AnalysisPayload;
  missing: ValidationIssue[];
  createdAt: string;
  updatedAt: string;
};
export type AnalysisResult<T> = { ok: true; data: T } | AnalysisFailure;
const fail = (code: AnalysisFailure['code']): AnalysisFailure => ({ ok: false, code });
const money = (v: Prisma.Decimal | null): number | undefined =>
  v === null ? undefined : Number(v.toString());
const SaveSchema = z
  .object({
    propertyId: IdSchema,
    expectedRevision: z.number().int().min(0).max(2147483646),
    status: z.enum(['DRAFT', 'READY']),
    payload: PayloadSchema,
  })
  .strict();
export type SaveAnalysisRequest = z.infer<typeof SaveSchema>;

/** Trusted server session only. Never accept organizationId/role from a client body. */
export function analysisService(session: Manager, db: PrismaClient) {
  const organizationId = session.organizationId;
  const allowed = session.role === 'MANAGER' && !!organizationId.trim();
  const propertyWhere = (id: string) => ({ id, organizationId, archivedAt: null });
  async function authorized(id: string) {
    return (
      allowed &&
      IdSchema.safeParse(id).success &&
      !!(await db.property.findFirst({ where: propertyWhere(id), select: { id: true } }))
    );
  }
  async function selection() {
    if (!allowed) return fail('FORBIDDEN');
    const properties = await db.property.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        street: true,
        city: true,
        state: true,
        postalCode: true,
        units: {
          where: { organizationId, status: { not: 'ARCHIVED' } },
          orderBy: { number: 'asc' },
          select: {
            id: true,
            number: true,
            bedrooms: true,
            bathrooms: true,
            squareFeet: true,
            status: true,
            listedRent: true,
            marketRent: true,
          },
        },
      },
    });
    return {
      ok: true as const,
      data: properties.map((p) => ({
        ...p,
        units: p.units.map((u) => ({
          ...u,
          bathrooms: money(u.bathrooms) ?? null,
          listedRent: money(u.listedRent) ?? null,
          marketRent: money(u.marketRent) ?? null,
        })),
      })),
    };
  }
  async function loadDraft(
    propertyId: string,
    observedAt = new Date(),
  ): Promise<
    AnalysisResult<{
      payload: AnalysisPayload;
      missing: ValidationIssue[];
      facts: {
        downPayment: number | null;
        annualDebtService: number;
        scheduledMonthlyRent: number | null;
        expenses: { id: string; category: string; amount: number; occurredOn: string }[];
        expenseHistoryTruncated: boolean;
      };
    }>
  > {
    if (!allowed) return fail('FORBIDDEN');
    if (!IdSchema.safeParse(propertyId).success) return fail('INVALID');
    const observedDay = new Date(observedAt.toISOString().slice(0, 10));
    const p = await db.property.findFirst({
      where: propertyWhere(propertyId),
      include: {
        units: {
          where: { organizationId, status: { not: 'ARCHIVED' } },
          include: {
            leases: {
              where: {
                organizationId,
                status: 'ACTIVE',
                startDate: { lte: observedDay },
                endDate: { gte: observedDay },
              },
              select: { id: true, monthlyRent: true },
            },
          },
        },
        expenses: {
          where: { organizationId },
          orderBy: [{ occurredOn: 'desc' }, { id: 'asc' }],
          take: 1001,
        },
      },
    });
    if (!p) return fail('NOT_FOUND');
    const evidence: AssumptionEvidence[] = [];
    const note = (
      path: string,
      sourceId: string,
      source: AssumptionEvidence['source'],
      message: string,
    ) =>
      evidence.push({
        path,
        sourceId,
        source,
        observedAt: observedAt.toISOString(),
        note: message,
      });
    const purchasePrice = money(p.purchasePrice),
      loanAmount = money(p.loanAmount);
    if (purchasePrice !== undefined)
      note(
        'input.purchase.purchasePrice',
        p.id,
        'property',
        'Recorded acquisition price; confirm forecast basis. Currency units, not cents.',
      );
    if (loanAmount !== undefined)
      note(
        'input.financing.loanAmount',
        p.id,
        'property',
        'Recorded loan amount; confirm modeled acquisition debt. No terms inferred.',
      );
    // Only a complete current lease schedule maps to rent. Vacancies/list prices need manager confirmation.
    const completeRent = p.units.length > 0 && p.units.every((u) => u.leases.length === 1);
    const scheduledMonthlyRent = completeRent
      ? p.units.reduce((sum, u) => sum + Number(u.leases[0].monthlyRent.toString()), 0)
      : null;
    if (completeRent)
      for (const u of p.units)
        note(
          'input.income.monthlyRent',
          u.leases[0].id,
          'lease',
          'Current ACTIVE scheduled monthly rent contribution; not collected payments.',
        );
    const payload: AnalysisPayload = {
      version: 1,
      engineId: ENGINE_ID,
      propertyId,
      input: {
        propertyId,
        schemaVersion: 1,
        propertyInfo: {
          name: p.name,
          address: p.street,
          city: p.city,
          state: p.state,
          zipCode: p.postalCode,
        },
        purchase: purchasePrice === undefined ? {} : { purchasePrice },
        financing: loanAmount === undefined ? {} : { loanAmount },
        income: scheduledMonthlyRent === null ? {} : { monthlyRent: scheduledMonthlyRent },
      },
      options: {},
      evidence,
      scenarios: [],
      benchmarks: [],
    };
    return {
      ok: true,
      data: {
        payload,
        missing: missingData(payload),
        facts: {
          downPayment: money(p.downPayment) ?? null,
          annualDebtService: Number(p.annualDebtService.toString()),
          scheduledMonthlyRent,
          expenseHistoryTruncated: p.expenses.length > 1000,
          expenses: p.expenses.slice(0, 1000).map((e) => ({
            id: e.id,
            category: e.category,
            amount: Number(e.amount.toString()),
            occurredOn: e.occurredOn.toISOString(),
          })),
        },
      },
    };
  }
  function decode(row: {
    propertyId: string;
    revision: number;
    version: number;
    status: string;
    payload: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }): AnalysisResult<SavedAnalysis> {
    if (row.version !== 1) return fail('UNSUPPORTED_VERSION');
    const parsed = PayloadSchema.safeParse(row.payload);
    if (
      !parsed.success ||
      parsed.data.propertyId !== row.propertyId ||
      !['DRAFT', 'READY'].includes(row.status)
    )
      return fail('INVALID');
    try {
      if (row.status === 'READY') calculatePayload(parsed.data);
      return {
        ok: true,
        data: {
          propertyId: row.propertyId,
          revision: row.revision,
          status: row.status as 'DRAFT' | 'READY',
          payload: parsed.data,
          missing: missingData(parsed.data),
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        },
      };
    } catch (error) {
      return { ...fail('INVALID'), issues: issues(error) };
    }
  }
  async function loadSaved(propertyId: string): Promise<AnalysisResult<SavedAnalysis | null>> {
    if (!allowed) return fail('FORBIDDEN');
    if (!(await authorized(propertyId))) return fail('NOT_FOUND');
    const row = await db.roiAnalysisState.findUnique({
      where: { organizationId_propertyId: { organizationId, propertyId } },
    });
    return row ? decode(row) : { ok: true, data: null };
  }
  async function save(request: unknown): Promise<AnalysisResult<SavedAnalysis>> {
    if (!allowed) return fail('FORBIDDEN');
    const parsed = SaveSchema.safeParse(request);
    if (!parsed.success) return { ...fail('INVALID'), issues: issues(parsed.error) };
    const { propertyId, expectedRevision, status, payload } = parsed.data;
    if (payload.propertyId !== propertyId)
      return {
        ...fail('INVALID'),
        issues: [{ path: 'payload.propertyId', message: 'Property mismatch' }],
      };
    if (!(await authorized(propertyId))) return fail('NOT_FOUND');
    const missing = missingData(payload);
    if (status === 'READY' && missing.length) return { ...fail('MISSING_DATA'), issues: missing };
    try {
      // Full merged validation also prevents invalid scenario overrides from being stored as calculable state.
      if (!missing.length)
        calculatePayload(status === 'DRAFT' ? { ...payload, benchmarks: [] } : payload);
    } catch (error) {
      return { ...fail('INVALID'), issues: issues(error) };
    }
    const data = {
      status,
      version: 1,
      payload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
    };
    try {
      return await db.$transaction(async (tx) => {
        if (
          !(await tx.property.findFirst({ where: propertyWhere(propertyId), select: { id: true } }))
        )
          return fail('NOT_FOUND');
        if (expectedRevision === 0) {
          return decode(
            await tx.roiAnalysisState.create({ data: { ...data, organizationId, propertyId } }),
          );
        }
        const updated = await tx.roiAnalysisState.updateMany({
          where: { organizationId, propertyId, revision: expectedRevision },
          data: { ...data, revision: { increment: 1 } },
        });
        if (!updated.count) {
          const current = await tx.roiAnalysisState.findUnique({
            where: { organizationId_propertyId: { organizationId, propertyId } },
            select: { revision: true },
          });
          return { ...fail('CONFLICT'), currentRevision: current?.revision ?? 0 };
        }
        return decode(
          await tx.roiAnalysisState.findUniqueOrThrow({
            where: { organizationId_propertyId: { organizationId, propertyId } },
          }),
        );
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const current = await db.roiAnalysisState.findUnique({
          where: { organizationId_propertyId: { organizationId, propertyId } },
          select: { revision: true },
        });
        return { ...fail('CONFLICT'), currentRevision: current?.revision ?? 0 };
      }
      throw error;
    }
  }
  return { selection, loadDraft, loadSaved, save };
}
export type PropertySelectionResult = Awaited<
  ReturnType<ReturnType<typeof analysisService>['selection']>
>;
export type RoiDraftResult = Awaited<ReturnType<ReturnType<typeof analysisService>['loadDraft']>>;
