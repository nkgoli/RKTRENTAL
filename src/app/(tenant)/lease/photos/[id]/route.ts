import { getSession } from '@/lib/auth/server-session';
import { getStorage } from '@/lib/storage/config';
import { errorResponse, fileResponse } from '@/lib/storage/http';
import { TenantPortalAccessError, readTenantUnitPhoto } from '@/lib/tenant-portal';

export const runtime = 'nodejs';

/** GET /lease/photos/:id — a photo of the signed-in tenant's own unit; anything else is refused. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { document, body } = await readTenantUnitPhoto(session, (await params).id, getStorage());
    return fileResponse(body, document, 'inline');
  } catch (e) {
    if (e instanceof TenantPortalAccessError)
      return Response.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    return errorResponse(e);
  }
}
