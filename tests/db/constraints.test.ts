import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const migration = readFileSync('prisma/migrations/20261014000000_core/migration.sql', 'utf8');

describe('database constraints', () => {
  it('requires exactly one unit per lease in the Prisma model', () => {
    const lease = schema.match(/model Lease \{([\s\S]*?)\n\}/)?.[1];
    expect(lease).toBeDefined();
    expect(lease).toMatch(/unitId\s+String\s/);
    expect(lease).toMatch(/unit\s+Unit\s+@relation\(fields: \[unitId, organizationId\]/);
    expect(lease).not.toMatch(/propertyId/);
    expect(migration).toMatch(/"unitId" TEXT NOT NULL/);
  });

  it('rejects overlapping active date ranges at the database boundary', () => {
    expect(migration).toMatch(
      /EXCLUDE USING gist \("unitId" WITH =, daterange\("startDate", "endDate", '\[\]'\) WITH &&\)/,
    );
    expect(migration).toMatch(/WHERE \("status" = 'ACTIVE'\)/);
    expect(migration).toMatch(/"endDate" >= "startDate"/);
  });

  it('enforces one document parent and tenant-safe composite foreign keys', () => {
    expect(migration).toMatch(/num_nonnulls\("leaseId", "propertyId", "unitId"\) = 1/);
    expect(migration).toMatch(
      /FOREIGN KEY \("unitId", "organizationId"\) REFERENCES "Unit"\("id", "organizationId"\)/,
    );
    expect(migration).toMatch(
      /FOREIGN KEY \("tenantId", "organizationId"\) REFERENCES "Tenant"\("id", "organizationId"\)/,
    );
  });
});
