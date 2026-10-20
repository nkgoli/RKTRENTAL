import { PrismaClient } from '@prisma/client';
import { assertDemoTarget } from '../scripts/demo-seed/guard';
import { loadRoiExamples } from './roi-examples';
import { loadSeedRoiInputs } from './seed-roi-inputs';

assertDemoTarget(process.env.NODE_ENV, process.env.DATABASE_URL, false);
if (process.env.ROCKETRENTAL_SANDBOX !== 'true')
  throw Error('ROCKETRENTAL_SANDBOX=true required for fictional ROI examples.');
const seedInputsOnly = process.argv.includes('--seed-inputs-only');
const db = new PrismaClient();
try {
  if (!seedInputsOnly) console.log(await loadRoiExamples(db));
  console.log(await loadSeedRoiInputs(db));
} finally {
  await db.$disconnect();
}
