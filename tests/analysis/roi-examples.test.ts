import { describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { roiExamples, loadRoiExamples, demoOrganizationId } from '../../prisma/roi-examples';
import { calculatePayload, missingData } from '../../src/lib/analysis/contract';
import { analysisService } from '../../src/lib/analysis/service';

it('reconciles fictional whole-property budgets and annuity payments independently', () => {
  const results = roiExamples().map((p) => {
    expect(missingData(p)).toEqual([]);
    expect(p.input.propertyInfo!.name).toContain('Fictional Demo');
    const m = calculatePayload(p).base.summaryMetrics;
    const rent = p.input.income!.monthlyRent!;
    const income = (rent + 50) * 12 * 0.95;
    const operating = 2400 + 1200 + 600 + 300 + 200 + rent * 12 * 0.05 + income * 0.08;
    const loan = p.input.financing!.loanAmount!;
    const rate = p.input.financing!.interestRate! / 1200;
    const payment =
      loan === 0 ? 0 : Math.round(((loan * rate) / (1 - (1 + rate) ** -360)) * 100) / 100;
    expect(m.noi).toBeCloseTo(income - operating, 2);
    expect(m.monthlyDebtService).toBe(payment);
    expect(m.annualCashFlow).toBeCloseTo(income - operating - payment * 12 - rent * 12 * 0.05, 2);
    expect(m.totalCashRequired).toBe(
      p.input.purchase!.purchasePrice! - loan + p.input.purchase!.closingCosts! + 5000,
    );
    return m;
  });
  expect(results[0].annualCashFlow).toBeGreaterThan(0);
  expect(results[1].annualDebtService).toBe(0);
  expect(results[2].annualCashFlow).toBeLessThan(0);
});

describe.skipIf(process.env.RUN_ROI_DEMO_DB !== '1')('dedicated synthetic demo database', () => {
  it('preserves all existing data and edited analyses across repeated loads; selects and resumes', async () => {
    if (!process.env.DATABASE_URL?.includes(':55579/fictional_roi_demo'))
      throw Error('Dedicated demo runtime required');
    const db = new PrismaClient();
    try {
      const service = analysisService({ organizationId: demoOrganizationId, role: 'MANAGER' }, db);
      const original = await db.property.findMany({ orderBy: { id: 'asc' } });
      const otherRecords = () =>
        Promise.all([
          db.unit.findMany({ orderBy: { id: 'asc' } }),
          db.lease.findMany({ orderBy: { id: 'asc' } }),
          db.payment.findMany({ orderBy: { id: 'asc' } }),
          db.expense.findMany({ orderBy: { id: 'asc' } }),
        ]);
      const unrelated = await otherRecords();
      const p = roiExamples()[0];
      const saved = await service.loadSaved(p.propertyId);
      if (!saved.ok || !saved.data) throw Error('Missing example');
      const edited = structuredClone(saved.data.payload);
      edited.input.income!.monthlyRent = 2250;
      const update = await service.save({
        propertyId: p.propertyId,
        expectedRevision: saved.data.revision,
        status: 'READY',
        payload: edited,
      });
      expect(update.ok).toBe(true);
      const before = await db.roiAnalysisState.findMany({ orderBy: { id: 'asc' } });
      await loadRoiExamples(db);
      await loadRoiExamples(db);
      expect(await db.property.findMany({ orderBy: { id: 'asc' } })).toEqual(original);
      expect(await db.roiAnalysisState.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
      expect(await otherRecords()).toEqual(unrelated);
      const selection = await service.selection();
      if (!selection.ok) throw Error(selection.code);
      for (const fixture of roiExamples()) {
        expect(selection.data.some((row) => row.id === fixture.propertyId)).toBe(true);
        const resumed = await service.loadSaved(fixture.propertyId);
        if (!resumed.ok || !resumed.data) throw Error('Resume failed');
        expect(resumed.data.missing).toEqual([]);
        calculatePayload(resumed.data.payload);
      }
      // Restore the deliberately edited synthetic example through the ordinary revision API.
      if (update.ok)
        expect(
          (
            await service.save({
              propertyId: p.propertyId,
              expectedRevision: update.data.revision,
              status: 'READY',
              payload: saved.data.payload,
            })
          ).ok,
        ).toBe(true);
    } finally {
      await db.$disconnect();
    }
  });
});
