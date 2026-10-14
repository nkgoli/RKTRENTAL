'use server';

import { revalidatePath } from 'next/cache';
import { requireManagerRole } from '@/lib/auth/access';
import { applyMarketRent, clearUnitComps } from '@/lib/comps/service';

export type ApplyState = { ok?: boolean; message?: string; rent?: number };

/** Sets the unit's market rent from the comps screen and records who applied it and when. */
export async function applyRentAction(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const session = await requireManagerRole();
  const unitId = String(formData.get('unitId') ?? '');
  const result = await applyMarketRent(session.organizationId, unitId, formData.get('rent'), {
    id: session.subjectId,
    name: session.name,
  });
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath('/rent-comps');
  revalidatePath('/properties', 'layout');
  return { ok: true, rent: result.rent, message: 'Market rent updated.' };
}

export async function refreshCompsAction(formData: FormData) {
  const session = await requireManagerRole();
  clearUnitComps(session.organizationId, String(formData.get('unitId') ?? ''));
  revalidatePath('/rent-comps');
}
