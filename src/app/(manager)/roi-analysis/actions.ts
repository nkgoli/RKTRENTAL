'use server';

import { requireManagerRole, requireManagerWriteRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { analysisService } from '@/lib/analysis/service';

export async function loadAnalysisSelectionAction() {
  return analysisService(await requireManagerRole(), db).selection();
}
export async function loadRoiDraftAction(propertyId: string) {
  return analysisService(await requireManagerRole(), db).loadDraft(propertyId);
}
export async function loadSavedRoiAnalysisAction(propertyId: string) {
  return analysisService(await requireManagerRole(), db).loadSaved(propertyId);
}
export async function saveRoiAnalysisAction(request: unknown) {
  return analysisService(await requireManagerWriteRole(), db).save(request);
}
