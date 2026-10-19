'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { parseRent } from '@/lib/comps/core';
import { COMPS_REVALIDATION_PATHS } from '@/lib/comps/navigation';
import { applyMarketRent, clearUnitComps, listPricingUnits } from '@/lib/comps/service';
import { uncertainApply, type ApplyState } from './apply-state';
export type { ApplyState } from './apply-state';

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

/** Sets the unit's market rent from the comps screen and records who applied it and when. */
export async function applyRentAction(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  // Keep framework authentication/authorization redirects outside recoverable data errors.
  const session = await requireManagerRole();
  const unitId = String(formData.get('unitId') ?? '');
  try {
    if (!(await listPricingUnits(session.organizationId)).some((unit) => unit.id === unitId))
      return { ok: false, outcome: 'rejected', message: 'Unit not found.' };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false,
      outcome: 'rejected',
      message: 'Couldn’t check this unit. No rent was changed. Your amount is kept. Try again.',
    };
  }
  let result;
  try {
    result = await applyMarketRent(session.organizationId, unitId, formData.get('rent'), {
      id: session.subjectId,
      name: session.name,
    });
  } catch (error) {
    unstable_rethrow(error);
    return uncertainApply;
  }
  if (!result.ok)
    return {
      ok: false,
      outcome: 'rejected',
      message: result.error,
      inputError: parseRent(formData.get('rent')) === null,
    };
  try {
    revalidateCompsViews();
  } catch (error) {
    unstable_rethrow(error);
    // The write was acknowledged; a cache failure must not invite another write.
    return {
      ok: true,
      rent: result.rent,
      message:
        'Market rent saved. Other views could not be refreshed; reload them to see the update.',
    };
  }
  return { ok: true, rent: result.rent, message: 'Market rent updated.' };
}

export async function refreshCompsAction(formData: FormData) {
  const session = await requireManagerRole();
  clearUnitComps(session.organizationId, String(formData.get('unitId') ?? ''));
  revalidateCompsViews();
}
