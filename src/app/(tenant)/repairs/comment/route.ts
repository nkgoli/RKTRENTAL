import { getSession } from '@/lib/auth/server-session';
import { addRequestComment, MaintenanceError } from '@/lib/maintenance';

export const runtime = 'nodejs';
const redirectTo = (path: string) =>
  new Response(null, { status: 303, headers: { Location: path } });

/** A native POST keeps comment feedback navigable even when a streamed action cannot finish. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'TENANT') return redirectTo('/sign-in');
  const form = await request.formData();
  const requestId = String(form.get('requestId') ?? '');
  let notice = 'commented';
  try {
    await addRequestComment(session, requestId, String(form.get('comment') ?? ''));
  } catch (error) {
    if (!(error instanceof MaintenanceError)) throw error;
    notice = 'comment-failed';
  }
  return redirectTo(`/repairs?notice=${notice}#request-${encodeURIComponent(requestId)}`);
}
