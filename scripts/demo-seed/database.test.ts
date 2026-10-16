import { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { computeBalance, toCents } from '../../src/lib/ledger/core';

describe('seeded database audit', () => {
  const verify = process.env.DEMO_SEED_VERIFY === '1' ? it : it.skip;
  verify('has non-overlapping terms, settled balances, snapshots, and fake contacts', async () => {
    const db = new PrismaClient();
    try {
      const organizationId = 'seed-rocket-rental';
      const [properties, units, leases, tenants, applications, documents] = await Promise.all([
        db.property.findMany({ where: { organizationId } }),
        db.unit.findMany({ where: { organizationId } }),
        db.lease.findMany({ where: { organizationId }, include: { charges: true, payments: true } }),
        db.tenant.findMany({ where: { organizationId } }),
        db.application.findMany({ where: { organizationId } }),
        db.document.findMany({ where: { organizationId, kind: 'PHOTO' } }),
      ]);
      expect(properties).toHaveLength(8);
      expect(units).toHaveLength(69);
      expect(leases.length).toBeGreaterThan(350);
      expect(documents.length).toBeGreaterThan(30);
      const [lateFees, returned, refunds, reports, maintenance] = await Promise.all([
        db.charge.count({ where: { organizationId, kind: 'LATE_FEE' } }),
        db.payment.count({ where: { organizationId, status: 'FAILED' } }),
        db.payment.count({ where: { organizationId, status: 'REFUNDED' } }),
        db.screeningReport.findMany({ where: { organizationId }, select: { status: true } }),
        db.maintenanceRequest.findMany({ where: { organizationId }, select: { unitId: true } }),
      ]);
      expect(lateFees).toBeGreaterThan(0);
      expect(returned).toBeGreaterThan(0);
      expect(refunds).toBeGreaterThan(0);
      expect(new Set(reports.map((report) => report.status))).toEqual(new Set(['invited', 'in_progress', 'completed', 'archived']));
      for (const unit of units) expect(maintenance.filter((request) => request.unitId === unit.id).length).toBeGreaterThanOrEqual(10);
      const byUnit = new Map<string, typeof leases>();
      for (const lease of leases) {
        byUnit.set(lease.unitId, [...(byUnit.get(lease.unitId) ?? []), lease]);
        if (lease.status !== 'DRAFT') {
          expect([1, 2]).toContain(lease.templateVersion);
          expect(lease.termsSnapshot).toBeTruthy();
          const snapshot = lease.termsSnapshot as { template?: { version?: number } } | null;
          expect(snapshot?.template?.version).toBe(lease.templateVersion);
        }
        const charges = lease.charges.map((row) => ({ leaseId: row.leaseId, kind: row.kind,
          amountCents: toCents(row.amount), dueDate: row.dueDate, description: row.description }));
        const payments = lease.payments.map((row) => ({ leaseId: row.leaseId,
          amountCents: toCents(row.amount), status: row.status, paidAt: row.paidAt }));
        const balance = computeBalance(charges, payments);
        expect(balance.chargedCents).toBe(balance.paidCents + balance.outstandingCents);
        expect(balance.creditCents).toBeGreaterThanOrEqual(0);
      }
      for (const rows of byUnit.values()) {
        rows.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
        for (let index = 1; index < rows.length; index++) {
          expect(rows[index]!.startDate.getTime()).toBeGreaterThan(rows[index - 1]!.endDate.getTime());
        }
      }
      expect(tenants.every((tenant) => tenant.email?.endsWith('@example.com') && /555-01\d\d/.test(tenant.phone ?? ''))).toBe(true);
      expect(applications.every((application) => application.applicantEmail.endsWith('@example.com'))).toBe(true);
      const applicantCounts = new Map<string, number>();
      for (const application of applications) applicantCounts.set(application.unitId, (applicantCounts.get(application.unitId) ?? 0) + 1);
      expect([...applicantCounts.values()].every((count) => count >= 1 && count <= 3)).toBe(true);
      for (const unit of units.filter((candidate) => candidate.status === 'VACANT')) {
        expect(applicantCounts.get(unit.id)).toBeGreaterThanOrEqual(1);
      }
      for (const property of properties) {
        expect(documents.filter((document) => document.propertyId === property.id).length).toBeLessThanOrEqual(20);
      }
      for (const unit of units) {
        expect(documents.filter((document) => document.unitId === unit.id && !document.id.startsWith('demo-maintenance-photo')).length).toBeLessThanOrEqual(10);
      }
    } finally {
      await db.$disconnect();
    }
  });
});
