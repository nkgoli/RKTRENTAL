/** Optional, explicit fixture for the isolated review runtime; never targets user data. */
import { PrismaClient } from '@prisma/client';
import { analysisService } from '../../src/lib/analysis/service';
import { mapleCourt, mapleOptions } from '../roi/fixtures/maple-court';
import { DraftInputSchema, type AnalysisPayload } from '../../src/lib/analysis';
const db = new PrismaClient({
  datasourceUrl:
    'postgresql://roi_review:roi_review@127.0.0.1:55443/roi_summary_review?schema=public',
});
async function main() {
  try {
    const service = analysisService({ organizationId: 'seed-rocket-rental', role: 'MANAGER' }, db);
    const selection = await service.selection();
    if (!selection.ok) throw Error(selection.code);
    const property = selection.data.find((p) => p.name === 'Maple Court');
    if (!property) throw Error('Isolated Maple Court demo property missing');
    const saved = await service.loadSaved(property.id);
    if (!saved.ok) throw Error(saved.code);
    if (saved.data) {
      console.log('Existing review analysis preserved.');
    } else {
      const draft = await service.loadDraft(property.id);
      if (!draft.ok) throw Error(draft.code);
      const input = DraftInputSchema.parse(JSON.parse(JSON.stringify(mapleCourt)));
      delete input.propertyId;
      const payload: AnalysisPayload = {
        ...draft.data.payload,
        input: {
          ...input,
          propertyId: property.id,
          propertyInfo: draft.data.payload.input.propertyInfo,
        },
        options: {
          discountRate: mapleOptions.discountRate,
          startDate: mapleOptions.startDate.toISOString(),
        },
        scenarios: [],
        benchmarks: [],
        evidence: [],
      };
      for (const [section, fields] of Object.entries(payload.input)) {
        if (fields && typeof fields === 'object')
          for (const field of Object.keys(fields))
            payload.evidence.push({
              path: `input.${section}.${field}`,
              source: 'manager',
              observedAt: new Date().toISOString(),
              note: 'Explicit illustrative review-fixture assumption in isolated demo data; not a fresh property fact.',
            });
      }
      payload.evidence.push({
        path: 'options.discountRate',
        source: 'manager',
        observedAt: new Date().toISOString(),
        note: 'Explicit illustrative review-fixture discount assumption.',
      });
      const result = await service.save({
        propertyId: property.id,
        expectedRevision: 0,
        status: 'DRAFT',
        payload,
      });
      if (!result.ok) throw Error(JSON.stringify(result));
      console.log(
        'Saved explicitly annotated illustrative Maple Court draft in isolated review database.',
      );
    }
  } finally {
    await db.$disconnect();
  }
}
void main();
