'use server';

import { revalidatePath } from 'next/cache';
import { requireManagerRole } from '@/lib/auth/access';
import { COMPS_REVALIDATION_PATHS } from '@/lib/comps/navigation';
import { applyMarketRent, clearUnitComps, listPricingUnits } from '@/lib/comps/service';

/**
 * Refreshes every surface that renders comps or saved market rent: the legacy
 * route, the standalone Rent Analysis dashboard and the property Listing views.
 * No return URL is read from the form, so a submitted value can never redirect
 * or revalidate an arbitrary path.
 */
function revalidateCompsViews() {
  for (const path of COMPS_REVALIDATION_PATHS) revalidatePath(path);
  revalidatePath('/properties', 'layout');
}

export type ApplyState = { ok?: boolean; message?: string; rent?: number };

/** Sets the unit's market rent from the comps screen and records who applied it and when. */
export async function applyRentAction(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const session = await requireManagerRole();
  const unitId = String(formData.get('unitId') ?? '');
  if (!(await listPricingUnits(session.organizationId)).some((unit) => unit.id === unitId))
    return { ok: false, message: 'Unit not found.' };
  const result = await applyMarketRent(session.organizationId, unitId, formData.get('rent'), {
    id: session.subjectId,
    name: session.name,
  });
  if (!result.ok) return { ok: false, message: result.error };
  revalidateCompsViews();
  return { ok: true, rent: result.rent, message: 'Market rent updated.' };
}

export async function refreshCompsAction(formData: FormData) {
  const session = await requireManagerRole();
  clearUnitComps(session.organizationId, String(formData.get('unitId') ?? ''));
  revalidateCompsViews();
}
