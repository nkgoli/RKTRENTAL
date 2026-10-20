'use server';

import { requireManagerRole, requireManagerWriteRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { analysisService } from '@/lib/analysis/service';
import { actualReturnsService } from '@/lib/returns/actual-service';

export async function loadAnalysisSelectionAction() {
  return analysisService(await requireManagerRole(), db).selection();
}
export async function loadRoiDraftAction(propertyId: string) {
  return analysisService(await requireManagerRole(), db).loadDraft(propertyId);
}
export async function loadSavedRoiAnalysisAction(propertyId: string) {
  return analysisService(await requireManagerRole(), db).loadSaved(propertyId);
}
/** Recorded returns for one property and inclusive `from`/`to` days; read-only. */
export async function loadActualReturnsAction(request: unknown) {
  return actualReturnsService(await requireManagerRole(), db).load(request);
}
export async function saveRoiAnalysisAction(request: unknown) {
  return analysisService(await requireManagerWriteRole(), db).save(request);
}
