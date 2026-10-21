import { db } from '../../src/lib/db/client';
import { getLeaseSignStatus } from '../../src/lib/esign/service';

const [organizationId, leaseId] = process.argv.slice(2);
async function main() {
  try {
    const result = await getLeaseSignStatus(organizationId, leaseId);
    console.log(
      JSON.stringify({
        id: result.id,
        status: result.status,
        archiveStatus: result.archiveStatus,
        signedCount: result.signers.filter((party) => party.signedAt).length,
      }),
    );
  } finally {
    await db.$disconnect();
  }
}
void main();
