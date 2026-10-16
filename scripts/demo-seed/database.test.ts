import { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { computeBalance, toCents } from '../../src/lib/ledger/core';
import { createStorageAdapter } from '../../src/lib/storage/config';
import { photoLimits } from '../../src/lib/storage/photo-limits';

describe('seeded database audit', () => {
  const verify = process.env.DEMO_SEED_VERIFY === '1' ? it : it.skip;
  verify('has non-overlapping terms, settled balances, snapshots, and fake contacts', async () => {
    const db = new PrismaClient();
    try {
      const organizationId = 'seed-rocket-rental';
      const [properties, units, leases, tenants, applications, documents] = await Promise.all([
        db.property.findMany({ where: { organizationId } }),
        db.unit.findMany({ where: { organizationId } }),
        db.lease.findMany({ where: { organizationId }, include: { charges: true, payments: true,
          tenants: { include: { tenant: true } } } }),
        db.tenant.findMany({ where: { organizationId } }),
        db.application.findMany({ where: { organizationId } }),
        db.document.findMany({ where: { organizationId } }),
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
        db.maintenanceRequest.findMany({ where: { organizationId },
          include: { photos: { include: { document: true } } } }),
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
      expect(new Set(applications.map((application) => application.status))).toEqual(
        new Set(['SUBMITTED', 'SCREENING', 'REVIEW', 'APPROVED', 'DECLINED']));
      const groupRows = await db.applicationGroup.findMany({ where: { organizationId } });
      const groups = new Map<string, typeof applications>();
      for (const application of applications) {
        expect(application.applicationGroupId).toBeTruthy();
        const key = application.applicationGroupId!;
        groups.set(key, [...(groups.get(key) ?? []), application]);
      }
      expect(groupRows.map((group) => group.id).sort()).toEqual([...groups.keys()].sort());
      for (const row of groupRows) {
        const members = groups.get(row.id)!;
        expect(row.unitId).toBe(members[0]!.unitId);
        expect(members.some((member) => member.status === row.status)).toBe(true);
      }
      expect(groupRows.some((row) => row.archivedAt)).toBe(true);
      expect(groupRows.some((row) => !row.archivedAt)).toBe(true);
      expect(groups.size).toBeGreaterThan(200);
      for (const members of groups.values()) {
        expect(members.length).toBeGreaterThanOrEqual(1);
        expect(members.length).toBeLessThanOrEqual(3);
        expect(new Set(members.map((member) => member.unitId)).size).toBe(1);
        expect(new Set(members.map((member) => member.appliedAt.getTime())).size).toBe(1);
      }
      const now = new Date();
      for (const rows of byUnit.values()) {
        for (const [index, lease] of rows.entries()) {
          const prior = rows[index - 1];
          if (prior && prior.tenants.map((member) => member.tenantId).join(',') ===
            lease.tenants.map((member) => member.tenantId).join(',')) continue;
          const approved = groups.get(`demo-group-${lease.id}-approved`);
          expect(approved, `Missing approved group for ${lease.id}`).toBeDefined();
          expect(approved?.every((member) => member.status === 'APPROVED')).toBe(true);
          expect(approved?.map((member) => member.applicantEmail).sort()).toEqual(
            lease.tenants.map((member) => member.tenant.email).sort());
          expect(approved?.map((member) => member.applicantName).sort()).toEqual(
            lease.tenants.map((member) => member.tenant.name).sort());
          if (lease.startDate >= new Date(now.getTime() - 730 * 86_400_000)) {
            expect(groups.get(`demo-group-${lease.id}-other`)).toBeDefined();
          }
        }
      }
      for (const unit of units.filter((candidate) => candidate.status === 'VACANT')) {
        const open = groups.get(`demo-group-${unit.id}-vacant`);
        expect(open?.length).toBeGreaterThanOrEqual(1);
        expect(open?.every((member) => member.status === 'SUBMITTED' || member.status === 'SCREENING')).toBe(true);
      }
      for (const lease of leases.filter((candidate) => candidate.status === 'ACTIVE' &&
        candidate.endDate <= new Date(now.getTime() + 90 * 86_400_000))) {
        const open = groups.get(`demo-group-${lease.id}-upcoming`);
        expect(open?.length).toBeGreaterThanOrEqual(1);
        expect(open?.every((member) => member.status === 'SUBMITTED' || member.status === 'SCREENING')).toBe(true);
      }
      const limits = photoLimits(process.env);
      for (const property of properties) {
        const gallery = documents.filter((document) => document.kind === 'PHOTO' && document.propertyId === property.id);
        expect(gallery.length).toBeGreaterThanOrEqual(4);
        expect(gallery.length).toBeLessThanOrEqual(7);
        expect(gallery.length).toBeLessThanOrEqual(limits.perProperty);
        expect(gallery.filter((photo) => photo.isCover)).toHaveLength(1);
        expect(gallery.map((photo) => photo.sortOrder).sort((a, b) => (a ?? 0) - (b ?? 0)))
          .toEqual(Array.from({ length: gallery.length }, (_, index) => index));
      }
      for (const unit of units) {
        const gallery = documents.filter((document) => document.kind === 'PHOTO' && document.unitId === unit.id);
        expect(gallery.length).toBeGreaterThanOrEqual(1);
        expect(gallery.length).toBeLessThanOrEqual(3);
        expect(gallery.length).toBeLessThanOrEqual(limits.perUnit);
        expect(gallery.filter((photo) => photo.isCover)).toHaveLength(1);
        expect(gallery.map((photo) => photo.sortOrder).sort((a, b) => (a ?? 0) - (b ?? 0)))
          .toEqual(Array.from({ length: gallery.length }, (_, index) => index));
      }
      const pictured = maintenance.filter((request) => request.photos.length > 0);
      expect(pictured.length / maintenance.length).toBeGreaterThanOrEqual(0.4);
      expect(pictured.length / maintenance.length).toBeLessThanOrEqual(0.6);
      expect(pictured.some((request) => request.tenantId)).toBe(true);
      for (const request of pictured) {
        expect(request.photos.length).toBeGreaterThanOrEqual(1);
        expect(request.photos.length).toBeLessThanOrEqual(3);
        for (const photo of request.photos) {
          expect(photo.document?.caption).toBe(request.title);
          expect(photo.document?.leaseId).toBeTruthy();
          expect(photo.document?.storageKey).toBe(photo.storageKey);
        }
      }
      const storage = createStorageAdapter(process.env);
      let nextDocument = 0;
      await Promise.all(Array.from({ length: 24 }, async () => {
        while (nextDocument < documents.length) {
          const document = documents[nextDocument++]!;
          const file = await storage.get(document.storageKey);
          expect(file, `Missing stored file for ${document.id}`).not.toBeNull();
          expect(file!.body.byteLength).toBe(Number(document.sizeBytes));
          if (document.kind === 'PHOTO') {
            expect(Number(document.sizeBytes)).toBeGreaterThanOrEqual(20_000);
            expect(Number(document.sizeBytes)).toBeLessThanOrEqual(60_000);
            expect(document.mimeType).toBe('image/png');
            expect(Array.from(file!.body.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
          }
        }
      }));
      console.log(`Photo audit: ${documents.filter((document) => document.propertyId).length} property, ${documents.filter((document) => document.unitId).length} unit, ${maintenance.reduce((sum, request) => sum + request.photos.length, 0)} maintenance across ${pictured.length}/${maintenance.length} requests; ${documents.length} stored files verified.`);
    } finally {
      await db.$disconnect();
    }
  }, 30000);
});
