import { PrismaClient } from '@prisma/client';
import { assertDemoTarget } from '../scripts/demo-seed/guard';
import { loadRoiExamples } from './roi-examples';

assertDemoTarget(process.env.NODE_ENV, process.env.DATABASE_URL, false);
if (process.env.ROCKETRENTAL_SANDBOX !== 'true')
  throw Error('ROCKETRENTAL_SANDBOX=true required for fictional ROI examples.');
const db = new PrismaClient();
try {
  console.log(await loadRoiExamples(db));
} finally {
  await db.$disconnect();
}
