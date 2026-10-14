import { getSession } from '@/lib/auth/server-session';
import { addRequestPhoto, createRequestAsTenant, MaintenanceError } from '@/lib/maintenance';
import { findTenantLeaseForPortal } from '@/lib/tenant-portal';
import {
  CATEGORIES,
  composeDescription,
  ENTRY_OPTIONS,
  MAX_PHOTOS,
  titleFrom,
  URGENCY_OPTIONS,
  type EntryChoice,
} from '../format';

export const runtime = 'nodejs';

// A relative Location keeps the browser on the host it signed in on; 303 turns the POST into a GET.
const redirectTo = (path: string) =>
  new Response(null, { status: 303, headers: { Location: path } });

const back = (notice: string) => redirectTo(`/repairs?notice=${notice}`);

/**
 * POST /repairs/submit — a route handler instead of a server action so phone photos are not
 * capped by the server-action body limit. The unit always comes from the tenant's own lease.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'TENANT') return redirectTo('/sign-in');
  const form = await request.formData();
  const category = String(form.get('category') ?? '');
  const entry = String(form.get('entry') ?? '') as EntryChoice;
  const urgency = URGENCY_OPTIONS.find((o) => o.value === String(form.get('urgency') ?? ''));
  const text = String(form.get('description') ?? '').trim();
  const photos = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  if (!CATEGORIES.includes(category) || !(entry in ENTRY_OPTIONS) || !urgency || !text)
    return back('invalid');
  if (photos.length > MAX_PHOTOS) return back('too-many-photos');
  if (photos.some((p) => !p.type.startsWith('image/'))) return back('bad-photo');

  const lease = await findTenantLeaseForPortal(session);
  if (!lease) return back('no-lease');
  try {
    const created = await createRequestAsTenant(session, {
      unitId: lease.unitId,
      title: titleFrom(text),
      description: composeDescription(category, entry, text),
      priority: urgency.value,
    });
    for (const photo of photos) {
      try {
        await addRequestPhoto(session, created.id, photo);
      } catch (error) {
        if (!(error instanceof MaintenanceError)) throw error;
        return back('photo-failed');
      }
    }
    return back('submitted');
  } catch (error) {
    if (error instanceof MaintenanceError) return back('invalid');
    throw error;
  }
}
