// Customer-style edits and explicit clears on an ISOLATED startup database, made
// through the app's own write paths, so a repeat start.ps1 can prove it never
// reseeds, duplicates or overwrites them. Refuses the live 5433/5434 datasets.
// node --import ./prisma/os-userinfo.mjs --import tsx tests/analysis/startup-preservation-edits.ts <dbPort>
import { PrismaClient } from '@prisma/client';
import { analysisService } from '@/lib/analysis/service';
import { propertiesDb } from '@/lib/properties/data';

const port = process.argv[2];
if (!port || ['5433', '5434'].includes(port)) throw Error('Isolated database port required.');
const db = new PrismaClient({
  datasourceUrl: `postgresql://rocketrental:rocketrental@localhost:${port}/rocketrental?schema=public`,
});
const org = 'seed-rocket-rental';
try {
  const properties = propertiesDb(org, db);
  // Edit: Maple's rent becomes the customer's value (its demo label must not return).
  console.log(
    await properties.updateRoiInputs('seed-property-maple', {
      version: 1,
      input: { income: { monthlyRent: 23456 } },
      options: {},
    }),
  );
  // Explicit clear: Cedar's insurance is removed and must stay removed.
  console.log(
    await properties.updateRoiInputs('seed-property-cedar', {
      version: 1,
      input: {},
      options: {},
      cleared: ['input.expenses.insurance'],
    }),
  );
  // Saved analysis: Harbor's draft, with a scenario and a Compare selection, must survive.
  const service = analysisService({ organizationId: org, role: 'MANAGER' }, db);
  const draft = await service.loadDraft('seed-property-harbor');
  if (!draft.ok) throw Error(JSON.stringify(draft));
  const saved = await service.save({
    propertyId: 'seed-property-harbor',
    expectedRevision: 0,
    status: 'DRAFT',
    payload: {
      ...draft.data.payload,
      input: {
        ...draft.data.payload.input,
        income: { ...draft.data.payload.input.income, vacancyRate: 7 },
      },
    },
  });
  console.log(saved.ok ? { saved: saved.data.revision } : saved);
  // Explicit clear of a linked sample record: one seeded Maple expense is deleted.
  const expense = await db.expense.findFirst({
    where: { organizationId: org, property: { id: 'seed-property-maple' } },
    orderBy: { id: 'asc' },
  });
  if (expense) await db.expense.delete({ where: { id: expense.id } });
  console.log({ deletedExpense: expense?.id ?? null });
} finally {
  await db.$disconnect();
}
