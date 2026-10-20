// Stores the RealROI /demo inputs (realroi-sample.ts) on one property of an ISOLATED
// database for matched-input chart captures. Refuses the live 5433/5434 datasets.
// node --import ./prisma/os-userinfo.mjs --import tsx tests/analysis/load-realroi-sample.mts <dbPort> [propertyId]
import { PrismaClient } from '@prisma/client';
import { propertiesDb } from '@/lib/properties/data';
import { realRoiSample } from './realroi-sample';

const [port, propertyId = 'seed-property-elm'] = process.argv.slice(2);
if (!port || ['5433', '5434'].includes(port)) throw Error('Isolated database port required.');
const db = new PrismaClient({
  datasourceUrl: `postgresql://rocketrental:rocketrental@localhost:${port}/rocketrental?schema=public`,
});
try {
  const { input, options } = realRoiSample();
  const loanAmount =
    input.purchase!.purchasePrice! * (1 - input.financing!.downPaymentPercent! / 100);
  console.log(
    await propertiesDb('seed-rocket-rental', db).updateRoiInputs(propertyId, {
      version: 1,
      input: {
        purchase: input.purchase,
        financing: { ...input.financing, loanAmount },
        income: input.income,
        expenses: input.expenses,
        appreciationExit: input.appreciationExit,
      },
      options,
    }),
  );
} finally {
  await db.$disconnect();
}
